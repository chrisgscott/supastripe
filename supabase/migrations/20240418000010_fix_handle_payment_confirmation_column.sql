-- Fix handle_payment_confirmation function to use correct column names
CREATE OR REPLACE FUNCTION public.handle_payment_confirmation(
    p_pending_plan_id uuid,
    p_payment_intent_id text,
    p_idempotency_key uuid,
    p_card_last_four text,
    p_card_expiration_month integer,
    p_card_expiration_year integer
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_first_transaction_id UUID;
    v_migrated_plan_id UUID;
    v_user_id UUID;
    v_customer_email TEXT;
    v_customer_id UUID;
    v_amount INTEGER;
BEGIN
    RAISE NOTICE 'Starting handle_payment_confirmation for pending plan: %', p_pending_plan_id;

    -- Get the user_id and customer email first
    SELECT 
        ppp.user_id, 
        pc.email,
        ppp.customer_id,
        ppp.downpayment_amount INTO v_user_id, v_customer_email, v_customer_id, v_amount
    FROM pending_payment_plans ppp
    JOIN pending_customers pc ON pc.id = ppp.customer_id
    WHERE ppp.id = p_pending_plan_id;

    IF NOT FOUND THEN
        RAISE NOTICE 'Pending plan not found: %', p_pending_plan_id;
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Pending plan not found'
        );
    END IF;

    -- Create the first transaction record
    INSERT INTO pending_transactions (
        payment_plan_id,
        amount,
        stripe_payment_intent_id,
        status,
        transaction_type,
        due_date
    ) VALUES (
        p_pending_plan_id,
        v_amount,
        p_payment_intent_id,
        'completed'::transaction_status_type,
        'downpayment'::transaction_type,
        NOW()
    )
    RETURNING id INTO v_first_transaction_id;

    -- Publish payment confirmation event
    PERFORM publish_activity(
        'payment_confirmation',
        'pending',
        v_first_transaction_id,
        v_user_id,
        jsonb_build_object(
            'amount', v_amount,
            'customer_email', v_customer_email
        ),
        v_customer_id
    );

    -- Publish email sent event
    PERFORM publish_activity(
        'payment_confirmation_sent',
        'email',
        v_first_transaction_id,
        v_user_id,
        jsonb_build_object(
            'recipient', v_customer_email,
            'email_type', 'payment_confirmation'
        ),
        v_customer_id
    );

    RAISE NOTICE 'Created email log entry and published event';

    -- Migrate the data (card details will be copied as part of the migration)
    v_migrated_plan_id := migrate_pending_payment_plan(p_pending_plan_id);
    RAISE NOTICE 'Migrated plan, new ID: %', v_migrated_plan_id;

    IF v_migrated_plan_id IS NULL THEN
        RAISE NOTICE 'Migration failed - migrated_plan_id is NULL';
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Migration failed'
        );
    END IF;

    -- Publish payment confirmed event
    PERFORM publish_activity(
        'payment_confirmed',
        'payment',
        v_first_transaction_id,
        v_user_id,
        jsonb_build_object(
            'amount', v_amount,
            'customer_email', v_customer_email,
            'payment_intent_id', p_payment_intent_id
        ),
        v_customer_id
    );

    RETURN jsonb_build_object(
        'success', true,
        'migrated_plan_id', v_migrated_plan_id,
        'transaction_id', v_first_transaction_id
    );
END;
$$;
