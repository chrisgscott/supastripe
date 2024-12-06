-- Update handle_payment_confirmation function to use new event system
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
    v_amount NUMERIC;
BEGIN
    RAISE NOTICE 'Starting handle_payment_confirmation for pending plan: %', p_pending_plan_id;

    -- Get the user_id, customer details, and amount
    SELECT 
        ppp.user_id, 
        pc.email,
        pc.id,
        ppp.total_amount INTO v_user_id, v_customer_email, v_customer_id, v_amount
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

    RAISE NOTICE 'Found user_id: %, customer_email: %', v_user_id, v_customer_email;

    -- Update the first transaction status to completed
    UPDATE pending_transactions 
    SET status = 'completed',
        paid_at = NOW(),
        stripe_payment_intent_id = p_payment_intent_id
    WHERE payment_plan_id = p_pending_plan_id
    AND transaction_type = 'downpayment'
    RETURNING id INTO v_first_transaction_id;

    IF v_first_transaction_id IS NULL THEN
        RAISE NOTICE 'No downpayment transaction found for plan: %', p_pending_plan_id;
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Downpayment transaction not found'
        );
    END IF;

    RAISE NOTICE 'Updated downpayment transaction: %', v_first_transaction_id;

    -- Update the pending payment plan status and card details
    UPDATE pending_payment_plans 
    SET status = 'ready_to_migrate',
        status_updated_at = NOW(),
        card_last_four = p_card_last_four,
        card_expiration_month = p_card_expiration_month,
        card_expiration_year = p_card_expiration_year
    WHERE id = p_pending_plan_id;

    RAISE NOTICE 'Updated pending payment plan status and card details';

    -- Create email log and publish email event
    INSERT INTO email_logs (
        email_type,
        status,
        related_id,
        related_type,
        idempotency_key,
        recipient_email,
        user_id
    ) VALUES (
        'payment_confirmation',
        'pending',
        v_first_transaction_id,
        'transaction',
        p_idempotency_key,
        v_customer_email,
        v_user_id
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

    -- Return success response
    RETURN jsonb_build_object(
        'success', true,
        'migrated_plan_id', v_migrated_plan_id
    );
END;
$$;
