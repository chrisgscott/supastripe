CREATE OR REPLACE FUNCTION migrate_pending_payment_plan(p_pending_plan_id UUID, p_payment_intent_id TEXT DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_new_plan_id UUID;
    v_new_customer_id UUID;
    v_user_id UUID;
    v_customer_count INT;
    v_transaction_count INT;
    v_payment_intent_id TEXT;
BEGIN
    RAISE NOTICE 'Starting migration for pending plan % with payment intent %', 
        p_pending_plan_id, 
        COALESCE(p_payment_intent_id, 'NULL');

    -- Get the user_id and payment_intent_id first
    IF p_payment_intent_id IS NULL THEN
        SELECT stripe_payment_intent_id INTO v_payment_intent_id
        FROM pending_transactions
        WHERE payment_plan_id = p_pending_plan_id
        AND transaction_type = 'downpayment';
        
        RAISE NOTICE 'Found payment intent % from pending transactions', 
            COALESCE(v_payment_intent_id, 'NULL');
    ELSE
        v_payment_intent_id := p_payment_intent_id;
    END IF;

    SELECT 
        ppp.user_id INTO v_user_id
    FROM pending_payment_plans ppp
    WHERE ppp.id = p_pending_plan_id;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Pending payment plan not found: %', p_pending_plan_id;
    END IF;

    -- First, migrate the customer
    INSERT INTO customers (
        id,
        name,
        email,
        user_id,
        stripe_customer_id,
        created_at,
        updated_at
    )
    SELECT 
        gen_random_uuid(),
        pc.name,
        pc.email,
        v_user_id,
        pc.stripe_customer_id,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    FROM pending_customers pc
    JOIN pending_payment_plans ppp ON pc.id = ppp.customer_id
    WHERE ppp.id = p_pending_plan_id
    RETURNING id INTO v_new_customer_id;

    IF v_new_customer_id IS NULL THEN
        RAISE EXCEPTION 'Failed to migrate customer for plan: %', p_pending_plan_id;
    END IF;

    -- Next, migrate the payment plan
    INSERT INTO payment_plans (
        id,
        user_id,
        customer_id,
        total_amount,
        downpayment_amount,
        number_of_payments,
        payment_interval,
        notes,
        status,
        card_last_four,
        card_expiration_month,
        card_expiration_year,
        created_at,
        updated_at,
        status_updated_at
    )
    SELECT 
        gen_random_uuid(),
        v_user_id,
        v_new_customer_id,
        total_amount,
        downpayment_amount,
        number_of_payments,
        payment_interval,
        notes,
        'active'::payment_status_type,
        card_last_four,
        card_expiration_month,
        card_expiration_year,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    FROM pending_payment_plans
    WHERE id = p_pending_plan_id
    RETURNING id INTO v_new_plan_id;

    IF v_new_plan_id IS NULL THEN
        RAISE EXCEPTION 'Failed to migrate payment plan: %', p_pending_plan_id;
    END IF;

    -- Finally, migrate the transactions
    WITH inserted_transactions AS (
        INSERT INTO transactions (
            id,
            payment_plan_id,
            user_id,
            amount,
            due_date,
            transaction_type,
            status,
            stripe_payment_intent_id,
            paid_at,
            created_at,
            updated_at,
            next_attempt_date
    )
        SELECT 
            gen_random_uuid(),
            v_new_plan_id,
            v_user_id,
            pt.amount,
            pt.due_date,
            pt.transaction_type,
            CASE 
                WHEN pt.transaction_type = 'downpayment' THEN 'completed'
                ELSE 'pending'
            END::transaction_status_type,
            CASE 
                WHEN pt.transaction_type = 'downpayment' THEN v_payment_intent_id
                ELSE NULL
            END,
            CASE 
                WHEN pt.transaction_type = 'downpayment' THEN CURRENT_TIMESTAMP
                ELSE NULL
            END,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP,
            CASE 
                WHEN pt.status = 'failed' THEN pt.due_date + INTERVAL '2 days'
                ELSE NULL
            END
        FROM pending_transactions pt
        WHERE pt.payment_plan_id = p_pending_plan_id
        RETURNING id
    )
    SELECT COUNT(*) INTO v_transaction_count FROM inserted_transactions;

    IF v_transaction_count = 0 THEN
        RAISE EXCEPTION 'No transactions migrated for plan: %', p_pending_plan_id;
    END IF;

    -- Verify the migration
    SELECT COUNT(*) INTO v_customer_count
    FROM customers
    WHERE id = v_new_customer_id;

    IF v_customer_count = 0 THEN
        RAISE EXCEPTION 'Failed to verify migrated customer: %', v_new_customer_id;
    END IF;

    RETURN v_new_plan_id;

EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error in migrate_pending_payment_plan: %', SQLERRM;
    RAISE;
END;
$$;