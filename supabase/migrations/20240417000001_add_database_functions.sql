-- Cleanup Pending Payment Records Function
DROP FUNCTION IF EXISTS public.cleanup_pending_payment_records(uuid);
CREATE OR REPLACE FUNCTION public.cleanup_pending_payment_records(p_pending_plan_id UUID)
RETURNS void 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_customer_id UUID;
BEGIN
    -- Store the customer_id before any deletions
    SELECT customer_id INTO v_customer_id
    FROM pending_payment_plans
    WHERE id = p_pending_plan_id;

    -- Delete pending transactions first (due to foreign key constraints)
    DELETE FROM pending_transactions
    WHERE payment_plan_id = p_pending_plan_id;

    -- Delete the pending payment plan
    DELETE FROM pending_payment_plans
    WHERE id = p_pending_plan_id;

    -- Delete the pending customer if no other pending plans reference it
    IF v_customer_id IS NOT NULL THEN
        DELETE FROM pending_customers
        WHERE id = v_customer_id
        AND NOT EXISTS (
            SELECT 1 
            FROM pending_payment_plans 
            WHERE customer_id = v_customer_id
        );
    END IF;

EXCEPTION WHEN OTHERS THEN
    -- Log the error details
    RAISE NOTICE 'Error cleaning up pending records: %', SQLERRM;
    -- Re-raise the error
    RAISE;
END;
$$;

-- Cleanup Pending Plans Function
DROP FUNCTION IF EXISTS public.cleanup_pending_plans(timestamp without time zone);
CREATE OR REPLACE FUNCTION public.cleanup_pending_plans(older_than timestamp without time zone)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete pending transactions
  DELETE FROM transactions
  WHERE plan_creation_status = 'pending'
  AND created_at < older_than;

  -- Delete pending payment plans
  DELETE FROM payment_plans
  WHERE plan_creation_status = 'pending'
  AND created_at < older_than;

  -- Update customers with no associated payment plans
  UPDATE customers
  SET plan_creation_status = 'failed'
  WHERE plan_creation_status = 'pending'
  AND id NOT IN (SELECT DISTINCT customer_id FROM payment_plans);
END;
$$;

-- Complete Payment Plan Creation Function
DROP FUNCTION IF EXISTS public.complete_payment_plan_creation(uuid);
CREATE OR REPLACE FUNCTION public.complete_payment_plan_creation(p_payment_plan_id UUID)
RETURNS void 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Update the payment plan status to 'active'
    UPDATE payment_plans
    SET status = 'active'
    WHERE id = p_payment_plan_id;
END;
$$;

-- Create Pending Payment Records Function
DROP FUNCTION IF EXISTS public.create_pending_payment_records(uuid,uuid,uuid,text,text,uuid,integer,integer,text,integer,jsonb,text,uuid,jsonb);
CREATE OR REPLACE FUNCTION public.create_pending_payment_records(
    p_customer_id UUID,
    p_payment_plan_id UUID,
    p_transaction_id UUID,
    p_customer_name TEXT,
    p_customer_email TEXT,
    p_user_id UUID,
    p_total_amount INTEGER,
    p_number_of_payments INTEGER,
    p_payment_interval TEXT,
    p_downpayment_amount INTEGER,
    p_payment_schedule JSONB,
    p_stripe_customer_id TEXT,
    p_idempotency_key UUID,
    p_notes JSONB
) RETURNS uuid 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_customer_id UUID;
BEGIN
    -- Try to get existing pending customer or insert new one
    INSERT INTO pending_customers (
        id, name, email, user_id, stripe_customer_id
    )
    VALUES (
        p_customer_id, p_customer_name, p_customer_email, p_user_id, p_stripe_customer_id
    )
    ON CONFLICT (email, user_id) DO UPDATE 
    SET 
        name = EXCLUDED.name,
        stripe_customer_id = EXCLUDED.stripe_customer_id,
        updated_at = NOW()
    RETURNING id INTO v_customer_id;

    -- Create pending payment plan
    INSERT INTO pending_payment_plans (
        id, customer_id, user_id, total_amount, number_of_payments,
        payment_interval, downpayment_amount, status, idempotency_key, notes
    )
    VALUES (
        p_payment_plan_id, 
        COALESCE(v_customer_id, p_customer_id), 
        p_user_id,
        p_total_amount,
        p_number_of_payments,
        p_payment_interval::payment_interval_type,
        p_downpayment_amount,
        'pending_payment',
        p_idempotency_key,
        p_notes
    );

    -- Create pending transactions
    INSERT INTO pending_transactions (
        id, payment_plan_id, amount, due_date, status, transaction_type
    )
    SELECT
        CASE 
            WHEN value->>'transaction_type' = 'downpayment' THEN p_transaction_id
            ELSE gen_random_uuid()
        END,
        p_payment_plan_id,
        (value->>'amount')::INTEGER,
        (value->>'date')::TIMESTAMP,
        'pending',
        (value->>'transaction_type')::transaction_type
    FROM jsonb_array_elements(p_payment_schedule);

    -- Return the payment plan ID
    RETURN p_payment_plan_id;

EXCEPTION WHEN OTHERS THEN
    RAISE;
END;
$$;

-- Handle Failed Payment Function
DROP FUNCTION IF EXISTS public.handle_failed_payment(uuid);
CREATE OR REPLACE FUNCTION public.handle_failed_payment(
    p_transaction_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Update the transaction status to failed
    UPDATE transactions
    SET 
        status = 'failed',
        updated_at = NOW(),
        next_attempt_date = NOW() + INTERVAL '2 days'
    WHERE id = p_transaction_id;

    -- If no rows were updated, raise an exception
    IF NOT FOUND THEN
        RAISE NOTICE 'Transaction not found: %', p_transaction_id;
        RETURN jsonb_build_object(
            'success', false,
            'error', format('Transaction not found: %s', p_transaction_id)
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true
    );

EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error in handle_failed_payment: %', SQLERRM;
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$;

-- Handle Payment Refund Function
DROP FUNCTION IF EXISTS public.handle_payment_refund(uuid);
CREATE OR REPLACE FUNCTION public.handle_payment_refund(p_payment_id UUID)
RETURNS void 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Update the payment status to 'refunded'
    UPDATE payments
    SET status = 'refunded'
    WHERE id = p_payment_id;
END;
$$;

-- Handle Successful Payment Function
DROP FUNCTION IF EXISTS public.handle_successful_payment(uuid, timestamp with time zone);
CREATE OR REPLACE FUNCTION public.handle_successful_payment(
    p_transaction_id uuid,
    p_paid_at timestamp with time zone
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE transactions
    SET 
        status = 'completed',
        paid_at = p_paid_at,
        updated_at = NOW(),
        next_attempt_date = NULL
    WHERE id = p_transaction_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Transaction not found: %', p_transaction_id;
    END IF;
END;
$$;

-- Migrate Pending Payment Plan Function
DROP FUNCTION IF EXISTS public.migrate_pending_payment_plan(uuid);
CREATE OR REPLACE FUNCTION public.migrate_pending_payment_plan(p_pending_plan_id UUID)
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
    -- Get the user_id and payment_intent_id first
    SELECT 
        ppp.user_id,
        pt.stripe_payment_intent_id INTO v_user_id, v_payment_intent_id
    FROM pending_payment_plans ppp
    JOIN pending_transactions pt ON pt.payment_plan_id = ppp.id
    WHERE ppp.id = p_pending_plan_id
    AND pt.transaction_type = 'downpayment';

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
            status,
            transaction_type,
            stripe_payment_intent_id,
            created_at,
            updated_at,
            paid_at
        )
        SELECT 
            pt.id,
            v_new_plan_id,
            v_user_id,
            pt.amount,
            pt.due_date,
            pt.status,
            pt.transaction_type,
            pt.stripe_payment_intent_id,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP,
            pt.paid_at
        FROM pending_transactions pt
        WHERE pt.payment_plan_id = p_pending_plan_id
        RETURNING id
    )
    SELECT COUNT(*) INTO v_transaction_count FROM inserted_transactions;

    IF v_transaction_count = 0 THEN
        RAISE EXCEPTION 'No transactions were migrated for plan: %', p_pending_plan_id;
    END IF;

    -- Clean up pending records
    PERFORM cleanup_pending_payment_records(p_pending_plan_id);

    RETURN v_new_plan_id;
END;
$$;

-- Handle Payment Confirmation Function (depends on migrate_pending_payment_plan)
DROP FUNCTION IF EXISTS public.handle_payment_confirmation(uuid,text,uuid,text,integer,integer);
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
BEGIN
    RAISE NOTICE 'Starting handle_payment_confirmation for pending plan: %', p_pending_plan_id;

    -- Get the user_id and customer email first
    SELECT 
        ppp.user_id, 
        pc.email INTO v_user_id, v_customer_email
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

    RAISE NOTICE 'Created email log entry';

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

    RETURN jsonb_build_object(
        'success', true,
        'migrated_plan_id', v_migrated_plan_id
    );

EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error in handle_payment_confirmation: %', SQLERRM;
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$;

-- Add grants for all functions
GRANT EXECUTE ON FUNCTION public.cleanup_pending_payment_records(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_pending_plans(timestamp without time zone) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.complete_payment_plan_creation(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_pending_payment_records(uuid,uuid,uuid,text,text,uuid,integer,integer,text,integer,jsonb,text,uuid,jsonb) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.handle_failed_payment(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.handle_payment_confirmation(uuid,text,uuid,text,integer,integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.handle_payment_refund(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.handle_successful_payment(uuid, timestamp with time zone) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.migrate_pending_payment_plan(uuid) TO anon, authenticated, service_role;