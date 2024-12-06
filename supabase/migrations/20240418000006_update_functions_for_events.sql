-- Update handle_payment_confirmation function to use events instead of activity_logs
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
        pending_plan_id,
        amount,
        payment_intent_id,
        idempotency_key,
        user_id
    ) VALUES (
        p_pending_plan_id,
        v_amount,
        p_payment_intent_id,
        p_idempotency_key,
        v_user_id
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
            'payment_method', 'card',
            'card_last_four', p_card_last_four,
            'card_expiration_month', p_card_expiration_month,
            'card_expiration_year', p_card_expiration_year,
            'plan_id', v_migrated_plan_id
        ),
        v_customer_id
    );

    RETURN jsonb_build_object(
        'success', true,
        'migrated_plan_id', v_migrated_plan_id
    );
END;
$$;

-- Update the publish_activity function to remove activity_logs references
CREATE OR REPLACE FUNCTION public.publish_activity(
    p_event_type text,
    p_entity_type text,
    p_entity_id uuid,
    p_user_id uuid,
    p_metadata jsonb DEFAULT '{}'::jsonb,
    p_customer_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_event_id uuid;
BEGIN
    -- Insert into events table
    INSERT INTO events (
        event_type,
        entity_type,
        entity_id,
        user_id,
        metadata,
        customer_id
    ) VALUES (
        p_event_type,
        p_entity_type,
        p_entity_id,
        p_user_id,
        p_metadata,
        p_customer_id
    )
    RETURNING id INTO v_event_id;

    RETURN v_event_id;
END;
$$;
