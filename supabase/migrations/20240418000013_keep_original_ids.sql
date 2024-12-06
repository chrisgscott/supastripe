-- Update migrate_pending_payment_plan function to keep original IDs
CREATE OR REPLACE FUNCTION public.migrate_pending_payment_plan(p_pending_plan_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_payment_intent_id TEXT;
    v_customer_id UUID;
BEGIN
    -- Get the user_id and payment_intent_id first
    SELECT 
        ppp.user_id,
        ppp.customer_id,
        pt.stripe_payment_intent_id INTO v_user_id, v_customer_id, v_payment_intent_id
    FROM pending_payment_plans ppp
    JOIN pending_transactions pt ON pt.payment_plan_id = ppp.id
    WHERE ppp.id = p_pending_plan_id
    AND pt.transaction_type = 'downpayment';

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Pending payment plan not found: %', p_pending_plan_id;
    END IF;

    -- First, migrate the customer (keeping original ID)
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
        pc.id,  -- Keep original customer ID
        pc.name,
        pc.email,
        v_user_id,
        pc.stripe_customer_id,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    FROM pending_customers pc
    WHERE pc.id = v_customer_id;

    -- Next, migrate the payment plan (keeping original ID)
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
        id,  -- Keep original plan ID
        v_user_id,
        customer_id,  -- Original customer ID is already set
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
    WHERE id = p_pending_plan_id;

    -- Finally, migrate the transactions (already keeping original IDs)
    WITH inserted_transactions AS (
        INSERT INTO transactions (
            id,
            payment_plan_id,
            user_id,
            amount,
            due_date,
            status,
            transaction_type,
            stripe_payment_intent_id,
            created_at,
            updated_at,
            paid_at
        )
        SELECT 
            pt.id,
            pt.payment_plan_id,
            v_user_id,
            pt.amount,
            pt.due_date,
            CASE 
                WHEN pt.transaction_type = 'downpayment' THEN 'completed'::transaction_status_type
                ELSE 'pending'::transaction_status_type
            END,
            pt.transaction_type,
            pt.stripe_payment_intent_id,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP,
            CASE 
                WHEN pt.transaction_type = 'downpayment' THEN CURRENT_TIMESTAMP
                ELSE NULL
            END
        FROM pending_transactions pt
        WHERE pt.payment_plan_id = p_pending_plan_id
        RETURNING payment_plan_id
    )
    SELECT payment_plan_id INTO p_pending_plan_id
    FROM inserted_transactions
    LIMIT 1;

    RETURN p_pending_plan_id;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error in migrate_pending_payment_plan: %', SQLERRM;
    RAISE;
END;
$$;
