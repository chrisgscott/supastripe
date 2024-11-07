CREATE OR REPLACE FUNCTION handle_payment_confirmation(
    p_pending_plan_id UUID,
    p_payment_intent_id TEXT,
    p_idempotency_key UUID
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    v_first_transaction_id UUID;
    v_migrated_plan_id UUID;
    v_user_id UUID;
    v_customer_email TEXT;
    v_result jsonb;
BEGIN
    RAISE NOTICE 'handle_payment_confirmation: Starting with params: pending_plan_id=%, payment_intent_id=%, idempotency_key=%',
        p_pending_plan_id, p_payment_intent_id, p_idempotency_key;

    -- Get the user_id and customer email first
    SELECT 
        ppp.user_id, 
        pc.email INTO v_user_id, v_customer_email
    FROM pending_payment_plans ppp
    JOIN pending_customers pc ON pc.id = ppp.customer_id
    WHERE ppp.id = p_pending_plan_id;

    IF NOT FOUND THEN
        RAISE WARNING 'handle_payment_confirmation: Pending plan not found: %', p_pending_plan_id;
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Pending plan not found',
            'details', jsonb_build_object(
                'pending_plan_id', p_pending_plan_id
            )
        );
    END IF;

    RAISE NOTICE 'handle_payment_confirmation: Found user_id: %, customer_email: %', v_user_id, v_customer_email;

    -- Update the first transaction status to completed
    UPDATE pending_transactions 
    SET status = 'completed',
        paid_at = NOW(),
        stripe_payment_intent_id = p_payment_intent_id
    WHERE payment_plan_id = p_pending_plan_id
    AND transaction_type = 'downpayment'
    RETURNING id INTO v_first_transaction_id;

    IF v_first_transaction_id IS NULL THEN
        RAISE NOTICE 'handle_payment_confirmation: No downpayment transaction found for plan: %', p_pending_plan_id;
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Downpayment transaction not found',
            'details', jsonb_build_object(
                'pending_plan_id', p_pending_plan_id
            )
        );
    END IF;

    RAISE NOTICE 'handle_payment_confirmation: Updated downpayment transaction: %', v_first_transaction_id;

    -- Update the pending payment plan status
    UPDATE pending_payment_plans 
    SET status = 'ready_to_migrate',
        status_updated_at = NOW()
    WHERE id = p_pending_plan_id;

    RAISE NOTICE 'handle_payment_confirmation: Updated pending payment plan status to ready_to_migrate';

    -- Create email log
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

    RAISE NOTICE 'handle_payment_confirmation: Created email log entry';

    -- Migrate the data
    v_migrated_plan_id := migrate_pending_payment_plan(p_pending_plan_id);
    RAISE NOTICE 'handle_payment_confirmation: Migrated plan, new ID: %', v_migrated_plan_id;

    IF v_migrated_plan_id IS NULL THEN
        RAISE NOTICE 'handle_payment_confirmation: Migration failed - migrated_plan_id is NULL';
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Migration failed',
            'details', jsonb_build_object(
                'pending_plan_id', p_pending_plan_id
            )
        );
    END IF;

    -- Verify the payment plan exists
    IF NOT EXISTS (
        SELECT 1 
        FROM payment_plans 
        WHERE id = v_migrated_plan_id
    ) THEN
        RAISE NOTICE 'handle_payment_confirmation: Migration verification failed - plan not found in payment_plans';
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Failed to verify migrated payment plan',
            'details', jsonb_build_object(
                'pending_plan_id', p_pending_plan_id
            )
        );
    END IF;

    RAISE NOTICE 'handle_payment_confirmation: Migration verified successfully';

    -- Clean up pending records
    PERFORM cleanup_pending_payment_records(p_pending_plan_id);
    RAISE NOTICE 'handle_payment_confirmation: Cleaned up pending records';

    -- Return success result
    RETURN jsonb_build_object(
        'success', true,
        'migrated_plan_id', v_migrated_plan_id,
        'details', jsonb_build_object(
            'user_id', v_user_id,
            'first_transaction_id', v_first_transaction_id
        )
    );

EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_payment_confirmation: Error: %, State: %', SQLERRM, SQLSTATE;
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'details', jsonb_build_object(
            'sqlstate', SQLSTATE,
            'pending_plan_id', p_pending_plan_id,
            'payment_intent_id', p_payment_intent_id
        )
    );
END;
$$;

-- Add a comment to the function
COMMENT ON FUNCTION handle_payment_confirmation IS 'Handles payment confirmation and migration of pending payment plans, returning JSON with success status and migrated plan ID';