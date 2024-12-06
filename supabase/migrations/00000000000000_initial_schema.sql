SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";
CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "public";
CREATE EXTENSION IF NOT EXISTS "pgsodium" WITH SCHEMA "pgsodium";
CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";

-- Drop types if they exist
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'activity_type') THEN
        DROP TYPE public.activity_type;
    END IF;
END $$;

-- Create types
CREATE TYPE public.activity_type AS ENUM (
    'payment_method_updated',
    'payment_success',
    'payment_failed',
    'plan_created',
    'plan_updated',
    'plan_payment_link_sent',
    'plan_payment_reminder_sent',
    'plan_payment_confirmation_sent',
    'email_sent',
    'plan_activated',
    'plan_completed',
    'plan_cancelled',
    'payout_scheduled',
    'payout_paid',
    'payout_failed'
);

ALTER TYPE "public"."activity_type" OWNER TO "postgres";

CREATE TYPE "public"."email_status_type" AS ENUM (
    'sent',
    'failed',
    'bounced'
);

ALTER TYPE "public"."email_status_type" OWNER TO "postgres";

CREATE TYPE "public"."email_type" AS ENUM (
    'customer_payment_plan_created',
    'customer_payment_plan_ready',
    'customer_payment_plan_modified',
    'customer_payment_plan_approved',
    'customer_payment_plan_rejected',
    'customer_payment_link_sent',
    'customer_payment_reminder',
    'customer_payment_confirmation',
    'customer_payment_failed',
    'customer_payment_overdue',
    'customer_payment_plan_completed',
    'customer_card_expiring_soon',
    'customer_card_expired',
    'customer_card_update_needed',
    'customer_card_updated',
    'user_payment_plan_approved',
    'user_payment_plan_rejected',
    'user_payment_plan_modified',
    'user_payment_failed_alert',
    'user_payment_overdue_alert',
    'user_daily_transactions_summary',
    'user_weekly_transactions_summary',
    'user_monthly_transactions_summary',
    'user_account_created',
    'user_account_verified',
    'user_password_reset',
    'user_login_alert',
    'user_stripe_account_connected',
    'user_stripe_account_updated'
);

ALTER TYPE "public"."email_type" OWNER TO "postgres";

CREATE TYPE "public"."payment_interval_type" AS ENUM (
    'weekly',
    'monthly'
);

ALTER TYPE "public"."payment_interval_type" OWNER TO "postgres";

CREATE TYPE "public"."payment_status_type" AS ENUM (
    'draft',
    'pending_payment',
    'active',
    'paused',
    'completed',
    'cancelled',
    'failed',
    'ready_to_migrate'
);

ALTER TYPE "public"."payment_status_type" OWNER TO "postgres";

CREATE TYPE "public"."payout_status_type" AS ENUM (
    'pending',
    'in_transit',
    'paid',
    'failed',
    'cancelled'
);

ALTER TYPE "public"."payout_status_type" OWNER TO "postgres";

CREATE TYPE "public"."processing_status_type" AS ENUM (
    'started',
    'completed',
    'failed'
);

ALTER TYPE "public"."processing_status_type" OWNER TO "postgres";

CREATE TYPE "public"."transaction_status_type" AS ENUM (
    'pending',
    'processing',
    'completed',
    'failed',
    'cancelled'
);

ALTER TYPE "public"."transaction_status_type" OWNER TO "postgres";

CREATE TYPE "public"."transaction_type" AS ENUM (
    'downpayment',
    'installment'
);

ALTER TYPE "public"."transaction_type" OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."cleanup_pending_payment_records"("p_pending_plan_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
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

ALTER FUNCTION "public"."cleanup_pending_payment_records"("p_pending_plan_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."cleanup_pending_plans"("older_than" timestamp without time zone) RETURNS "void"
    LANGUAGE "plpgsql"
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

ALTER FUNCTION "public"."cleanup_pending_plans"("older_than" timestamp without time zone) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION public.complete_payment_plan_creation(
    p_payment_plan_id uuid,
    p_transaction_id uuid,
    p_idempotency_key uuid,
    p_card_last_four text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_customer_id UUID;
  v_stripe_payment_intent_id TEXT;
  v_transaction_type transaction_type;
BEGIN
  -- Get customer_id from payment_plan
  SELECT customer_id INTO v_customer_id
  FROM payment_plans
  WHERE id = p_payment_plan_id;

  -- Get stripe_payment_intent_id and transaction_type from the transaction
  SELECT 
    stripe_payment_intent_id,
    transaction_type
  INTO 
    v_stripe_payment_intent_id,
    v_transaction_type
  FROM transactions
  WHERE id = p_transaction_id;

  -- Verify this is a downpayment transaction
  IF v_transaction_type != 'downpayment' THEN
    RAISE EXCEPTION 'Transaction is not a downpayment';
  END IF;

  -- Update payment plan with card info and status
  UPDATE payment_plans
  SET 
    card_last_four = p_card_last_four,
    status = 'active',
    updated_at = NOW(),
    status_updated_at = NOW()
  WHERE id = p_payment_plan_id;

  -- Update the specific downpayment transaction that was paid
  UPDATE transactions
  SET 
    status = 'completed',
    paid_at = CURRENT_TIMESTAMP,
    updated_at = NOW()
  WHERE id = p_transaction_id;

  -- Insert payment processing log
  INSERT INTO payment_processing_logs (
    transaction_id,
    payment_plan_id,
    stripe_payment_intent_id,
    status,
    idempotency_key
  ) VALUES (
    p_transaction_id,
    p_payment_plan_id,
    v_stripe_payment_intent_id,
    'payment_succeeded',
    p_idempotency_key
  );
END;
$$;

-- Add grants
GRANT EXECUTE ON FUNCTION public.complete_payment_plan_creation(uuid, uuid, uuid, text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION "public"."convert_activity_type_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF NEW.activity_type IS NOT NULL THEN
        NEW.activity_type = text_to_activity_type(NEW.activity_type::text);
    END IF;
    RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."convert_activity_type_trigger"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."create_payment_plan"("p_customer_id" "uuid", "p_user_id" "uuid", "p_total_amount" integer, "p_number_of_payments" integer, "p_payment_interval" "text", "p_downpayment_amount" integer, "p_payment_schedule" "jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_payment_plan_id UUID;
BEGIN
  -- Start transaction
  BEGIN
    -- Insert payment plan
    INSERT INTO payment_plans (
      customer_id, user_id, total_amount, number_of_payments, 
      payment_interval, downpayment_amount, status
    ) VALUES (
      p_customer_id, p_user_id, p_total_amount, p_number_of_payments, 
      p_payment_interval, p_downpayment_amount, 'created'
    ) RETURNING id INTO v_payment_plan_id;

    -- Insert transactions
    INSERT INTO transactions (
      payment_plan_id, amount, due_date, status, user_id, is_downpayment
    )
    SELECT 
      v_payment_plan_id,
      (payment->>'amount')::INTEGER,
      (payment->>'date')::TIMESTAMP,
      CASE WHEN payment->>'is_downpayment' = 'true' THEN 'pending_capture' ELSE 'pending' END,
      p_user_id,
      (payment->>'is_downpayment')::BOOLEAN
    FROM jsonb_array_elements(p_payment_schedule) AS payment;

    -- If successful, commit the transaction
    RETURN v_payment_plan_id;
  EXCEPTION
    WHEN OTHERS THEN
      -- If there's an error, roll back the transaction
      RAISE;
  END;
END;
$$;

ALTER FUNCTION "public"."create_payment_plan"("p_customer_id" "uuid", "p_user_id" "uuid", "p_total_amount" integer, "p_number_of_payments" integer, "p_payment_interval" "text", "p_downpayment_amount" integer, "p_payment_schedule" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."create_payment_plan_step1"("p_customer_name" "text", "p_customer_email" "text", "p_user_id" "uuid", "p_total_amount" integer, "p_number_of_payments" integer, "p_payment_interval" "text", "p_downpayment_amount" integer, "p_payment_schedule" "jsonb", "p_stripe_customer_id" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_customer_id UUID;
  v_payment_plan_id UUID;
  v_transaction JSONB;
  v_first_transaction_id UUID;
BEGIN
  -- Set the function name for RLS policies
  PERFORM set_config('my.function_name', 'create_payment_plan_step1', TRUE);

  -- Create customer
  INSERT INTO customers (name, email, user_id, stripe_customer_id, plan_creation_status)
  VALUES (p_customer_name, p_customer_email, p_user_id, p_stripe_customer_id, 'pending')
  RETURNING id INTO v_customer_id;

  -- Create payment plan
  INSERT INTO payment_plans (
    customer_id, user_id, total_amount, number_of_payments, 
    payment_interval, downpayment_amount, status, plan_creation_status
  )
  VALUES (
    v_customer_id, p_user_id, p_total_amount, p_number_of_payments,
    p_payment_interval, p_downpayment_amount, 'created', 'pending'
  )
  RETURNING id INTO v_payment_plan_id;

  -- Create transactions
  FOR v_transaction IN SELECT * FROM jsonb_array_elements(p_payment_schedule)
  LOOP
    INSERT INTO transactions (
      payment_plan_id, user_id, amount, due_date, is_downpayment, plan_creation_status, status
    )
    VALUES (
      v_payment_plan_id,
      p_user_id,
      (v_transaction->>'amount')::INTEGER,
      (v_transaction->>'date')::DATE,
      (v_transaction->>'is_downpayment')::BOOLEAN,
      'pending',
      'pending'
    )
    RETURNING id INTO v_first_transaction_id;

    IF (v_transaction->>'is_downpayment')::BOOLEAN THEN
      EXIT;  -- Exit after creating the first transaction (downpayment or first installment)
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'customer_id', v_customer_id,
    'payment_plan_id', v_payment_plan_id,
    'first_transaction_id', v_first_transaction_id
  );
END;
$$;

ALTER FUNCTION "public"."create_payment_plan_step1"("p_customer_name" "text", "p_customer_email" "text", "p_user_id" "uuid", "p_total_amount" integer, "p_number_of_payments" integer, "p_payment_interval" "text", "p_downpayment_amount" integer, "p_payment_schedule" "jsonb", "p_stripe_customer_id" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."create_payment_plan_step1"("p_customer_name" "text", "p_customer_email" "text", "p_user_id" "uuid", "p_total_amount" integer, "p_number_of_payments" integer, "p_payment_interval" "text", "p_downpayment_amount" integer, "p_payment_schedule" "jsonb", "p_stripe_customer_id" "text", "p_idempotency_key" "uuid", "p_notes" "jsonb" DEFAULT NULL::"jsonb") RETURNS TABLE("payment_plan_id" "uuid", "first_transaction_id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_customer_id UUID;
    v_payment_plan_id UUID := gen_random_uuid();
    v_first_transaction_id UUID;
    v_transaction_id UUID;
    v_transaction JSONB;
BEGIN
    -- Create or update customer
    INSERT INTO customers (
        name,
        email,
        user_id,
        stripe_customer_id
    )
    VALUES (
        p_customer_name,
        p_customer_email,
        p_user_id,
        p_stripe_customer_id
    )
    ON CONFLICT (email, user_id) DO UPDATE
    SET
        name = EXCLUDED.name,
        stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, customers.stripe_customer_id)
    RETURNING id INTO v_customer_id;

    -- Create payment plan
    INSERT INTO payment_plans (
        id,
        customer_id,
        user_id,
        total_amount,
        number_of_payments,
        payment_interval,
        downpayment_amount,
        status,
        idempotency_key,
        notes
    )
    VALUES (
        v_payment_plan_id,
        v_customer_id,
        p_user_id,
        p_total_amount,
        p_number_of_payments,
        p_payment_interval,
        p_downpayment_amount,
        'created',
        p_idempotency_key,
        p_notes
    );

    -- Create initial payment plan state
    INSERT INTO payment_plan_states (
        payment_plan_id,
        status
    )
    VALUES (
        v_payment_plan_id,
        'draft'
    );

    -- Create transactions from payment schedule
    FOR v_transaction IN SELECT * FROM jsonb_array_elements(p_payment_schedule)
    LOOP
        INSERT INTO transactions (
            payment_plan_id,
            user_id,
            amount,
            due_date,
            is_downpayment,
            status
        )
        VALUES (
            v_payment_plan_id,
            p_user_id,
            (v_transaction->>'amount')::INTEGER,
            (v_transaction->>'date')::TIMESTAMP,
            (v_transaction->>'is_downpayment')::BOOLEAN,
            'pending'
        )
        RETURNING id INTO v_transaction_id;

        IF (v_transaction->>'is_downpayment')::BOOLEAN THEN
            v_first_transaction_id := v_transaction_id;
        END IF;
    END LOOP;

    RETURN QUERY SELECT v_payment_plan_id, v_first_transaction_id;
END;
$$;

ALTER FUNCTION "public"."create_payment_plan_step1"("p_customer_name" "text", "p_customer_email" "text", "p_user_id" "uuid", "p_total_amount" integer, "p_number_of_payments" integer, "p_payment_interval" "text", "p_downpayment_amount" integer, "p_payment_schedule" "jsonb", "p_stripe_customer_id" "text", "p_idempotency_key" "uuid", "p_notes" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."create_pending_payment_records"("payment_data" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  new_pending_plan_id uuid;
  new_pending_customer_id uuid;
BEGIN
  -- Log incoming data
  RAISE NOTICE 'Starting create_pending_payment_records with data: %', payment_data;

  -- Create pending customer record
  RAISE NOTICE 'Creating pending customer record...';
  INSERT INTO pending_customers (
    name,
    email,
    user_id
  )
  VALUES (
    payment_data->>'customerName',
    payment_data->>'customerEmail',
    auth.uid()
  )
  RETURNING id INTO new_pending_customer_id;
  RAISE NOTICE 'Created pending customer with ID: %', new_pending_customer_id;

  -- Create pending payment plan record
  RAISE NOTICE 'Creating pending payment plan record...';
  INSERT INTO pending_payment_plans (
    customer_id,
    total_amount,
    number_of_payments,
    payment_interval,
    status,
    notes,
    user_id
  )
  VALUES (
    new_pending_customer_id,
    (payment_data->>'totalAmount')::integer,
    (payment_data->>'numberOfPayments')::integer,
    payment_data->>'paymentInterval',
    'draft',
    payment_data->'notes',
    auth.uid()
  )
  RETURNING id INTO new_pending_plan_id;
  RAISE NOTICE 'Created pending payment plan with ID: %', new_pending_plan_id;

  -- Create pending transaction records
  RAISE NOTICE 'Creating pending transaction records...';
  INSERT INTO pending_transactions (
    payment_plan_id,
    amount,
    due_date,
    transaction_type,
    status,
    user_id
  )
  SELECT
    new_pending_plan_id,
    (value->>'amount')::integer,
    (value->>'date')::timestamp,
    COALESCE(value->>'transaction_type', 'scheduled'),
    'pending',
    auth.uid()
  FROM jsonb_array_elements(payment_data->'paymentSchedule');
  RAISE NOTICE 'Created pending transaction records';
  
  RETURN jsonb_build_object(
    'pending_payment_plan_id', new_pending_plan_id,
    'pending_customer_id', new_pending_customer_id
  );
  
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error in create_pending_payment_records: %', SQLERRM;
  RAISE;
END;
$$;

ALTER FUNCTION "public"."create_pending_payment_records"("payment_data" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."create_pending_payment_records"("p_customer_id" "uuid", "p_payment_plan_id" "uuid", "p_transaction_id" "uuid", "p_customer_name" "text", "p_customer_email" "text", "p_user_id" "uuid", "p_total_amount" integer, "p_number_of_payments" integer, "p_payment_interval" "text", "p_downpayment_amount" integer, "p_payment_schedule" "jsonb", "p_stripe_customer_id" "text", "p_idempotency_key" "uuid", "p_notes" "jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Create pending customer record
    INSERT INTO pending_customers (
        id,
        name,
        email,
        user_id,
        stripe_customer_id
    )
    VALUES (
        p_customer_id,
        p_customer_name,
        p_customer_email,
        p_user_id,
        p_stripe_customer_id
    );

    -- Create pending payment plan
    INSERT INTO pending_payment_plans (
        id,
        customer_id,
        user_id,
        total_amount,
        number_of_payments,
        payment_interval,
        downpayment_amount,
        status,
        idempotency_key,
        notes
    )
    VALUES (
        p_payment_plan_id,
        p_customer_id,
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
        id,
        payment_plan_id,
        amount,
        due_date,
        status,
        transaction_type
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

ALTER FUNCTION "public"."create_pending_payment_records"("p_customer_id" "uuid", "p_payment_plan_id" "uuid", "p_transaction_id" "uuid", "p_customer_name" "text", "p_customer_email" "text", "p_user_id" "uuid", "p_total_amount" integer, "p_number_of_payments" integer, "p_payment_interval" "text", "p_downpayment_amount" integer, "p_payment_schedule" "jsonb", "p_stripe_customer_id" "text", "p_idempotency_key" "uuid", "p_notes" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."handle_payment_confirmation"("p_pending_plan_id" "uuid", "p_payment_intent_id" "text", "p_idempotency_key" "uuid", "p_card_last_four" "text", "p_card_expiration_month" integer, "p_card_expiration_year" integer) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
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

    -- Verify the payment plan exists with card details
    IF NOT EXISTS (
        SELECT 1 
        FROM payment_plans 
        WHERE id = v_migrated_plan_id
        AND card_last_four IS NOT NULL
        AND card_expiration_month IS NOT NULL
        AND card_expiration_year IS NOT NULL
    ) THEN
        RAISE NOTICE 'Migration verification failed - plan not found or missing card details';
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Failed to verify migrated payment plan'
        );
    END IF;

    RAISE NOTICE 'Migration verified successfully';

    -- Clean up pending records
    PERFORM cleanup_pending_payment_records(p_pending_plan_id);
    RAISE NOTICE 'Cleaned up pending records';

    -- Return success result
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

ALTER FUNCTION "public"."handle_payment_confirmation"("p_pending_plan_id" "uuid", "p_payment_intent_id" "text", "p_idempotency_key" "uuid", "p_card_last_four" "text", "p_card_expiration_month" integer, "p_card_expiration_year" integer) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."handle_successful_payment"("p_transaction_id" "uuid", "p_paid_at" timestamp with time zone) RETURNS "json"
    LANGUAGE "plpgsql"
    AS $$DECLARE
  v_payment_plan_id UUID;
  v_count INT;
BEGIN
  -- Start transaction
  BEGIN
    -- Update transaction status
    UPDATE transactions
    SET status = 'completed', paid_at = p_paid_at
    WHERE id = p_transaction_id
    RETURNING payment_plan_id INTO v_payment_plan_id;

    -- Check if this is the first paid transaction for the payment plan
    SELECT COUNT(*) INTO v_count
    FROM transactions
    WHERE payment_plan_id = v_payment_plan_id AND status = 'paid';

    -- If this is the first paid transaction, update the payment plan status to 'active'
    IF v_count = 1 THEN
      UPDATE payment_plans
      SET status = 'active'
      WHERE id = v_payment_plan_id;
    END IF;

    -- Commit transaction
    RETURN json_build_object('success', true);
  EXCEPTION
    WHEN OTHERS THEN
      -- Rollback transaction
      RAISE;
  END;
END;$$;

ALTER FUNCTION "public"."handle_successful_payment"("p_transaction_id" "uuid", "p_paid_at" timestamp with time zone) OWNER TO "postgres";

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

-- Add grants
GRANT EXECUTE ON FUNCTION public.handle_failed_payment(uuid) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.handle_payment_refund(
    p_transaction_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Update the transaction status to refunded
    UPDATE transactions
    SET 
        status = 'refunded',
        updated_at = NOW(),
        next_attempt_date = NULL
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
    RAISE NOTICE 'Error in handle_payment_refund: %', SQLERRM;
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$;

CREATE OR REPLACE FUNCTION "public"."log_email_activity"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if (TG_OP = 'INSERT') then
    insert into activity_logs (
      user_id,
      activity_type,
      entity_type,
      entity_id,
      metadata,
      customer_name
    )
    select
      NEW.user_id,
      'email_sent',
      NEW.related_type,
      NEW.related_id,
      jsonb_build_object(
        'email_type', NEW.email_type,
        'recipient', NEW.recipient_email,
        'status', NEW.status
      ),
      case
        when NEW.related_type = 'payment_plan' then
          (select c.name from payment_plans p join customers c on c.id = p.customer_id where p.id = NEW.related_id)
        when NEW.related_type = 'pending_payment_plan' then
          (select pc.name from pending_payment_plans p join pending_customers pc on pc.id = p.customer_id where p.id = NEW.related_id)
      end;
  end if;
  return NEW;
end;
$$;

ALTER FUNCTION "public"."log_email_activity"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."log_payment_plan_activity"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if (TG_OP = 'INSERT') then
    insert into activity_logs (
      user_id,
      activity_type,
      entity_type,
      entity_id,
      amount,
      metadata,
      customer_name
    )
    select
      NEW.user_id,
      'plan_created',
      'payment_plan',
      NEW.id,
      NEW.total_amount,
      jsonb_build_object(
        'number_of_payments', NEW.number_of_payments,
        'payment_interval', NEW.payment_interval
      ),
      (select name from customers where id = NEW.customer_id);
  elsif (TG_OP = 'UPDATE') then
    -- Log status changes
    if NEW.status != OLD.status then
      insert into activity_logs (
        user_id,
        activity_type,
        entity_type,
        entity_id,
        amount,
        metadata,
        customer_name
      )
      select
        NEW.user_id,
        case
          when NEW.status = 'active' then 'plan_activated'
          when NEW.status = 'completed' then 'plan_completed'
          when NEW.status = 'cancelled' then 'plan_cancelled'
        end,
        'payment_plan',
        NEW.id,
        NEW.total_amount,
        jsonb_build_object('status', NEW.status),
        (select name from customers where id = NEW.customer_id);
    end if;
  end if;
  return NEW;
end;
$$;

ALTER FUNCTION "public"."log_payment_plan_activity"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."log_payout_activity"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if (TG_OP = 'INSERT' or (TG_OP = 'UPDATE' and NEW.status != OLD.status)) then
    insert into activity_logs (
      user_id,
      activity_type,
      entity_type,
      entity_id,
      amount,
      metadata
    )
    values (
      NEW.user_id,
      case
        when NEW.status = 'pending' then 'payout_scheduled'
        when NEW.status = 'paid' then 'payout_paid'
        when NEW.status = 'failed' then 'payout_failed'
      end,
      'payout',
      NEW.id,
      NEW.amount,
      jsonb_build_object(
        'arrival_date', NEW.arrival_date,
        'status', NEW.status
      )
    );
  end if;
  return NEW;
end;
$$;

ALTER FUNCTION "public"."log_payout_activity"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."log_transaction_activity"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if (TG_OP = 'UPDATE' and NEW.status != OLD.status) then
    insert into activity_logs (
      user_id,
      activity_type,
      entity_type,
      entity_id,
      amount,
      metadata,
      customer_name
    )
    select
      NEW.user_id,
      case
        when NEW.status = 'paid' then 'payment_success'
        when NEW.status = 'failed' then 'payment_failed'
      end,
      'transaction',
      NEW.id,
      NEW.amount,
      jsonb_build_object(
        'payment_plan_id', NEW.payment_plan_id,
        'transaction_type', NEW.transaction_type
      ),
      (
        select c.name 
        from payment_plans p 
        join customers c on c.id = p.customer_id 
        where p.id = NEW.payment_plan_id
      );
  end if;
  return NEW;
end;
$$;

ALTER FUNCTION "public"."log_transaction_activity"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."migrate_pending_payment_plan"("p_pending_plan_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
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

ALTER FUNCTION "public"."migrate_pending_payment_plan"("p_pending_plan_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."set_reminder_email_date"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.reminder_email_date := NEW.due_date - INTERVAL '2 days';
  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."set_reminder_email_date"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."text_to_activity_type"("p_text" "text") RETURNS "public"."activity_type"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RAISE NOTICE 'Attempting to convert text to activity_type: %', p_text;
    -- Attempt to cast the text to activity_type
    RETURN p_text::activity_type;
EXCEPTION
    WHEN invalid_text_representation THEN
        RAISE NOTICE 'Failed to convert text to activity_type: %', p_text;
        RAISE EXCEPTION 'Invalid activity_type: %. Valid values are: payment_method_updated, payment_success, payment_failed, plan_created, email_sent, plan_activated, plan_completed, plan_cancelled, payout_scheduled, payout_paid, payout_failed', p_text;
END;
$$;

ALTER FUNCTION "public"."text_to_activity_type"("p_text" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."update_modified_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."update_modified_column"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."update_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."update_updated_at"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";

CREATE TABLE IF NOT EXISTS "public"."activity_logs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "activity_type" "public"."activity_type" NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "amount" bigint,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "customer_name" "text"
);

ALTER TABLE "public"."activity_logs" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."customers" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "stripe_customer_id" "text"
);

ALTER TABLE "public"."customers" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."customers_backup" (
    "id" "uuid",
    "user_id" "uuid",
    "name" "text",
    "email" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "stripe_customer_id" "text"
);

ALTER TABLE "public"."customers_backup" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."email_logs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "email_type" character varying(255) NOT NULL,
    "recipient_email" character varying(255) NOT NULL,
    "status" character varying(50) NOT NULL,
    "sent_at" timestamp with time zone DEFAULT "now"(),
    "error_message" "text",
    "related_id" "uuid",
    "related_type" character varying(255),
    "idempotency_key" "text",
    "user_id" "uuid"
);

ALTER TABLE "public"."email_logs" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."migration_20240415000000_completed" (
    "completed_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "public"."migration_20240415000000_completed" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."payment_plans" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "total_amount" numeric NOT NULL,
    "number_of_payments" integer NOT NULL,
    "payment_interval" "public"."payment_interval_type" NOT NULL,
    "downpayment_amount" numeric NOT NULL,
    "status" "public"."payment_status_type" DEFAULT 'draft'::"public"."payment_status_type" NOT NULL,
    "status_updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "notes" "jsonb",
    "card_last_four" character varying(4),
    "card_expiration_month" integer,
    "card_expiration_year" integer,
    "payment_link_token" "text",
    "payment_link_expires_at" timestamp with time zone,
    "change_request_notes" "text",
    "reminder_count" integer DEFAULT 0,
    "last_reminder_sent_at" timestamp with time zone,
    "idempotency_key" "text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "public"."payment_plans" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."payment_plans_backup" (
    "id" "uuid",
    "user_id" "uuid",
    "customer_id" "uuid",
    "total_amount" numeric(10,2),
    "number_of_payments" integer,
    "payment_interval" "text",
    "downpayment_amount" numeric(10,2),
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "status" "text",
    "idempotency_key" "text",
    "notes" "jsonb",
    "card_last_four" character(4)
);

ALTER TABLE "public"."payment_plans_backup" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."payment_processing_logs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "transaction_id" "uuid" NOT NULL,
    "status" "text" NOT NULL,
    "stripe_payment_intent_id" "text",
    "error_message" "text",
    "idempotency_key" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "payment_plan_id" "uuid",
    "user_id" "uuid"
);

ALTER TABLE "public"."payment_processing_logs" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."payouts" (
    "id" integer NOT NULL,
    "stripe_payout_id" "text" NOT NULL,
    "stripe_account_id" "text" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "currency" "text" NOT NULL,
    "status" "text" NOT NULL,
    "arrival_date" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "user_id" "uuid"
);

ALTER TABLE "public"."payouts" OWNER TO "postgres";

CREATE SEQUENCE IF NOT EXISTS "public"."payouts_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER TABLE "public"."payouts_id_seq" OWNER TO "postgres";

ALTER SEQUENCE "public"."payouts_id_seq" OWNED BY "public"."payouts"."id";

CREATE TABLE IF NOT EXISTS "public"."pending_customers" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "stripe_customer_id" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "public"."pending_customers" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."pending_payment_plans" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "total_amount" numeric NOT NULL,
    "number_of_payments" integer NOT NULL,
    "payment_interval" "public"."payment_interval_type" NOT NULL,
    "downpayment_amount" numeric NOT NULL,
    "status" "public"."payment_status_type" DEFAULT 'draft'::"public"."payment_status_type" NOT NULL,
    "status_updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "notes" "jsonb",
    "card_last_four" character varying(4),
    "card_expiration_month" integer,
    "card_expiration_year" integer,
    "payment_link_token" "text",
    "payment_link_expires_at" timestamp with time zone,
    "change_request_notes" "text",
    "reminder_count" integer DEFAULT 0,
    "last_reminder_sent_at" timestamp with time zone,
    "idempotency_key" "text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "public"."pending_payment_plans" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."pending_transactions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "payment_plan_id" "uuid",
    "amount" numeric NOT NULL,
    "due_date" timestamp with time zone NOT NULL,
    "status" "public"."transaction_status_type" NOT NULL,
    "next_attempt_date" timestamp with time zone,
    "stripe_payment_intent_id" "text",
    "transaction_type" "public"."transaction_type" NOT NULL,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "paid_at" timestamp with time zone
);

ALTER TABLE "public"."pending_transactions" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "first_name" character varying(255),
    "last_name" character varying(255),
    "is_onboarded" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "business_name" "text",
    "business_url" "text",
    "business_type" "text",
    "business_description" "text",
    "support_email" "text",
    "support_phone" "text",
    "address_line1" "text",
    "address_line2" "text",
    "address_city" "text",
    "address_state" "text",
    "address_postal_code" "text",
    "address_country" "text",
    "logo_url" "text",
    "stripe_account_id" "text"
);

ALTER TABLE "public"."profiles" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."profiles_backup" (
    "id" "uuid",
    "first_name" character varying(255),
    "last_name" character varying(255),
    "is_onboarded" boolean,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "business_name" "text",
    "business_url" "text",
    "business_type" "text",
    "business_description" "text",
    "support_email" "text",
    "support_phone" "text",
    "address_line1" "text",
    "address_line2" "text",
    "address_city" "text",
    "address_state" "text",
    "address_postal_code" "text",
    "address_country" "text",
    "logo_url" "text",
    "stripe_account_id" "text"
);

ALTER TABLE "public"."profiles_backup" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."stripe_accounts" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "stripe_account_id" "text",
    "stripe_onboarding_completed" boolean DEFAULT false,
    "stripe_account_created_at" timestamp with time zone,
    "stripe_account_details_url" "text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "public"."stripe_accounts" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."stripe_accounts_backup" (
    "id" "uuid",
    "user_id" "uuid",
    "stripe_account_id" "text",
    "stripe_onboarding_completed" boolean,
    "stripe_account_created_at" timestamp with time zone,
    "stripe_account_details_url" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone
);

ALTER TABLE "public"."stripe_accounts_backup" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."transactions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "payment_plan_id" "uuid" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "due_date" "date" NOT NULL,
    "status" "text" NOT NULL,
    "stripe_payment_intent_id" "text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "paid_at" timestamp with time zone,
    "next_attempt_date" timestamp with time zone,
    "reminder_email_date" "date",
    "last_reminder_email_log_id" "uuid",
    "transaction_type" "public"."transaction_type" NOT NULL,
    CONSTRAINT "transactions_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text", 'cancelled'::"text"])))
);

ALTER TABLE "public"."transactions" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."transactions_backup" (
    "id" "uuid",
    "user_id" "uuid",
    "payment_plan_id" "uuid",
    "amount" numeric(10,2),
    "due_date" "date",
    "status" "text",
    "stripe_payment_intent_id" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "is_downpayment" boolean,
    "paid_at" timestamp with time zone,
    "next_attempt_date" timestamp with time zone,
    "reminder_email_date" "date",
    "last_reminder_email_log_id" "uuid"
);

ALTER TABLE "public"."transactions_backup" OWNER TO "postgres";

ALTER TABLE ONLY "public"."payouts" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."payouts_id_seq"'::"regclass");

ALTER TABLE ONLY "public"."activity_logs"
    ADD CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."email_logs"
    ADD CONSTRAINT "email_logs_idempotency_key_key" UNIQUE ("idempotency_key");

ALTER TABLE ONLY "public"."email_logs"
    ADD CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."payment_plans"
    ADD CONSTRAINT "payment_plans_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."payment_processing_logs"
    ADD CONSTRAINT "payment_processing_logs_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."payouts"
    ADD CONSTRAINT "payouts_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."payouts"
    ADD CONSTRAINT "payouts_stripe_payout_id_key" UNIQUE ("stripe_payout_id");

ALTER TABLE ONLY "public"."pending_customers"
    ADD CONSTRAINT "pending_customers_email_user_id_key" UNIQUE ("email", "user_id");

ALTER TABLE ONLY "public"."pending_customers"
    ADD CONSTRAINT "pending_customers_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."pending_payment_plans"
    ADD CONSTRAINT "pending_payment_plans_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."pending_transactions"
    ADD CONSTRAINT "pending_transactions_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."stripe_accounts"
    ADD CONSTRAINT "stripe_accounts_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."stripe_accounts"
    ADD CONSTRAINT "stripe_accounts_stripe_account_id_key" UNIQUE ("stripe_account_id");

ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "unique_email_user_id" UNIQUE ("email", "user_id");

CREATE INDEX "idx_activity_logs_entity" ON "public"."activity_logs" USING "btree" ("entity_id", "entity_type");

CREATE INDEX "idx_activity_logs_user_id" ON "public"."activity_logs" USING "btree" ("user_id");

CREATE INDEX "idx_activity_logs_user_id_created_at" ON "public"."activity_logs" USING "btree" ("user_id", "created_at" DESC);

CREATE INDEX "idx_customers_email" ON "public"."customers" USING "btree" ("email");

CREATE INDEX "idx_customers_stripe_customer_id" ON "public"."customers" USING "btree" ("stripe_customer_id");

CREATE INDEX "idx_customers_user_id_email" ON "public"."customers" USING "btree" ("user_id", "email");

CREATE INDEX "idx_email_logs_recipient" ON "public"."email_logs" USING "btree" ("recipient_email");

CREATE INDEX "idx_email_logs_related" ON "public"."email_logs" USING "btree" ("related_id", "related_type");

CREATE INDEX "idx_email_logs_sent" ON "public"."email_logs" USING "btree" ("sent_at");

CREATE INDEX "idx_email_logs_user_sent" ON "public"."email_logs" USING "btree" ("user_id", "sent_at");

CREATE INDEX "idx_payment_plans_customer_id" ON "public"."payment_plans" USING "btree" ("customer_id");

CREATE INDEX "idx_payment_plans_payment_link_token" ON "public"."payment_plans" USING "btree" ("payment_link_token");

CREATE INDEX "idx_payment_plans_status_user_id" ON "public"."payment_plans" USING "btree" ("status", "user_id");

CREATE INDEX "idx_payment_processing_logs_created" ON "public"."payment_processing_logs" USING "btree" ("created_at");

CREATE INDEX "idx_payment_processing_logs_idempotency_key" ON "public"."payment_processing_logs" USING "btree" ("idempotency_key");

CREATE INDEX "idx_payment_processing_logs_payment_plan" ON "public"."payment_processing_logs" USING "btree" ("payment_plan_id");

CREATE INDEX "idx_payment_processing_logs_transaction" ON "public"."payment_processing_logs" USING "btree" ("transaction_id");

CREATE INDEX "idx_payment_processing_logs_transaction_id" ON "public"."payment_processing_logs" USING "btree" ("transaction_id");

CREATE INDEX "idx_payment_processing_logs_user_created" ON "public"."payment_processing_logs" USING "btree" ("user_id", "created_at");

CREATE INDEX "idx_payouts_arrival" ON "public"."payouts" USING "btree" ("arrival_date");

CREATE INDEX "idx_payouts_stripe_id" ON "public"."payouts" USING "btree" ("stripe_payout_id");

CREATE INDEX "idx_payouts_user_status" ON "public"."payouts" USING "btree" ("user_id", "status");

CREATE INDEX "idx_pending_customers_email" ON "public"."pending_customers" USING "btree" ("email");

CREATE INDEX "idx_pending_customers_stripe_customer_id" ON "public"."pending_customers" USING "btree" ("stripe_customer_id");

CREATE INDEX "idx_pending_customers_user_id_email" ON "public"."pending_customers" USING "btree" ("user_id", "email");

CREATE INDEX "idx_pending_payment_plans_customer_id" ON "public"."pending_payment_plans" USING "btree" ("customer_id");

CREATE INDEX "idx_pending_payment_plans_payment_link_token" ON "public"."pending_payment_plans" USING "btree" ("payment_link_token");

CREATE INDEX "idx_pending_payment_plans_status_user_id" ON "public"."pending_payment_plans" USING "btree" ("status", "user_id");

CREATE INDEX "idx_pending_transactions_payment_plan_status" ON "public"."pending_transactions" USING "btree" ("payment_plan_id", "status");

CREATE INDEX "idx_pending_transactions_plan_type" ON "public"."pending_transactions" USING "btree" ("payment_plan_id", "transaction_type");

CREATE INDEX "idx_pending_transactions_stripe_payment_intent" ON "public"."pending_transactions" USING "btree" ("stripe_payment_intent_id");

CREATE INDEX "idx_profiles_stripe_account" ON "public"."profiles" USING "btree" ("stripe_account_id");

CREATE INDEX "idx_profiles_stripe_account_id" ON "public"."profiles" USING "btree" ("stripe_account_id");

CREATE INDEX "idx_stripe_accounts_user_id" ON "public"."stripe_accounts" USING "btree" ("user_id");

CREATE INDEX "idx_transactions_payment_plan_id" ON "public"."transactions" USING "btree" ("payment_plan_id");

CREATE INDEX "idx_transactions_payment_plan_status" ON "public"."transactions" USING "btree" ("payment_plan_id", "status");

CREATE INDEX "idx_transactions_plan_type" ON "public"."transactions" USING "btree" ("payment_plan_id", "transaction_type");

CREATE INDEX "idx_transactions_stripe_payment_intent" ON "public"."transactions" USING "btree" ("stripe_payment_intent_id");

CREATE OR REPLACE TRIGGER "convert_activity_type" BEFORE INSERT OR UPDATE ON "public"."activity_logs" FOR EACH ROW EXECUTE FUNCTION "public"."convert_activity_type_trigger"();

CREATE OR REPLACE TRIGGER "email_activity_trigger" AFTER INSERT ON "public"."email_logs" FOR EACH ROW EXECUTE FUNCTION "public"."log_email_activity"();

CREATE OR REPLACE TRIGGER "payment_plan_activity_trigger" AFTER INSERT OR UPDATE ON "public"."payment_plans" FOR EACH ROW EXECUTE FUNCTION "public"."log_payment_plan_activity"();

CREATE OR REPLACE TRIGGER "payout_activity_trigger" AFTER INSERT OR UPDATE ON "public"."payouts" FOR EACH ROW EXECUTE FUNCTION "public"."log_payout_activity"();

CREATE OR REPLACE TRIGGER "set_reminder_email_date_trigger" BEFORE INSERT OR UPDATE ON "public"."transactions" FOR EACH ROW EXECUTE FUNCTION "public"."set_reminder_email_date"();

CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();

CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."stripe_accounts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();

CREATE OR REPLACE TRIGGER "transaction_activity_trigger" AFTER UPDATE ON "public"."transactions" FOR EACH ROW EXECUTE FUNCTION "public"."log_transaction_activity"();

CREATE OR REPLACE TRIGGER "update_customers_updated_at" BEFORE UPDATE ON "public"."customers" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_payment_plans_updated_at" BEFORE UPDATE ON "public"."payment_plans" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_pending_customers_updated_at" BEFORE UPDATE ON "public"."pending_customers" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_pending_payment_plans_updated_at" BEFORE UPDATE ON "public"."pending_payment_plans" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_profiles_modtime" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_modified_column"();

CREATE OR REPLACE TRIGGER "update_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_stripe_accounts_updated_at" BEFORE UPDATE ON "public"."stripe_accounts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

ALTER TABLE "public"."activity_logs" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."customers" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."email_logs" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."payment_plans" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."payment_processing_logs" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."payouts" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."pending_customers" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."pending_payment_plans" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."pending_transactions" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."stripe_accounts" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."transactions" ENABLE ROW LEVEL SECURITY;

ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";

ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."activity_logs";

SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;

GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

GRANT ALL ON FUNCTION "public"."cleanup_pending_payment_records"("p_pending_plan_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_pending_payment_records"("p_pending_plan_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_pending_payment_records"("p_pending_plan_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."cleanup_pending_plans"("older_than" timestamp without time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_pending_plans"("older_than" timestamp without time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_pending_plans"("older_than" timestamp without time zone) TO "service_role";

GRANT ALL ON FUNCTION "public"."complete_payment_plan_creation"("p_payment_plan_id" "uuid", "p_transaction_id" "uuid", "p_idempotency_key" "uuid", "p_card_last_four" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."complete_payment_plan_creation"("p_payment_plan_id" "uuid", "p_transaction_id" "uuid", "p_idempotency_key" "uuid", "p_card_last_four" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."complete_payment_plan_creation"("p_payment_plan_id" "uuid", "p_transaction_id" "uuid", "p_idempotency_key" "uuid", "p_card_last_four" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."convert_activity_type_trigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."convert_activity_type_trigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."convert_activity_type_trigger"() TO "service_role";

GRANT ALL ON FUNCTION "public"."create_payment_plan"("p_customer_id" "uuid", "p_user_id" "uuid", "p_total_amount" integer, "p_number_of_payments" integer, "p_payment_interval" "text", "p_downpayment_amount" integer, "p_payment_schedule" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_payment_plan"("p_customer_id" "uuid", "p_user_id" "uuid", "p_total_amount" integer, "p_number_of_payments" integer, "p_payment_interval" "text", "p_downpayment_amount" integer, "p_payment_schedule" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_payment_plan"("p_customer_id" "uuid", "p_user_id" "uuid", "p_total_amount" integer, "p_number_of_payments" integer, "p_payment_interval" "text", "p_downpayment_amount" integer, "p_payment_schedule" "jsonb") TO "service_role";

GRANT ALL ON FUNCTION "public"."create_payment_plan_step1"("p_customer_name" "text", "p_customer_email" "text", "p_user_id" "uuid", "p_total_amount" integer, "p_number_of_payments" integer, "p_payment_interval" "text", "p_downpayment_amount" integer, "p_payment_schedule" "jsonb", "p_stripe_customer_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_payment_plan_step1"("p_customer_name" "text", "p_customer_email" "text", "p_user_id" "uuid", "p_total_amount" integer, "p_number_of_payments" integer, "p_payment_interval" "text", "p_downpayment_amount" integer, "p_payment_schedule" "jsonb", "p_stripe_customer_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_payment_plan_step1"("p_customer_name" "text", "p_customer_email" "text", "p_user_id" "uuid", "p_total_amount" integer, "p_number_of_payments" integer, "p_payment_interval" "text", "p_downpayment_amount" integer, "p_payment_schedule" "jsonb", "p_stripe_customer_id" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."create_payment_plan_step1"("p_customer_name" "text", "p_customer_email" "text", "p_user_id" "uuid", "p_total_amount" integer, "p_number_of_payments" integer, "p_payment_interval" "text", "p_downpayment_amount" integer, "p_payment_schedule" "jsonb", "p_stripe_customer_id" "text", "p_idempotency_key" "uuid", "p_notes" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_payment_plan_step1"("p_customer_name" "text", "p_customer_email" "text", "p_user_id" "uuid", "p_total_amount" integer, "p_number_of_payments" integer, "p_payment_interval" "text", "p_downpayment_amount" integer, "p_payment_schedule" "jsonb", "p_stripe_customer_id" "text", "p_idempotency_key" "uuid", "p_notes" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_payment_plan_step1"("p_customer_name" "text", "p_customer_email" "text", "p_user_id" "uuid", "p_total_amount" integer, "p_number_of_payments" integer, "p_payment_interval" "text", "p_downpayment_amount" integer, "p_payment_schedule" "jsonb", "p_stripe_customer_id" "text", "p_idempotency_key" "uuid", "p_notes" "jsonb") TO "service_role";

GRANT ALL ON FUNCTION "public"."create_pending_payment_records"("payment_data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_pending_payment_records"("payment_data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_pending_payment_records"("payment_data" "jsonb") TO "service_role";

GRANT ALL ON FUNCTION "public"."create_pending_payment_records"("p_customer_id" "uuid", "p_payment_plan_id" "uuid", "p_transaction_id" "uuid", "p_customer_name" "text", "p_customer_email" "text", "p_user_id" "uuid", "p_total_amount" integer, "p_number_of_payments" integer, "p_payment_interval" "text", "p_downpayment_amount" integer, "p_payment_schedule" "jsonb", "p_stripe_customer_id" "text", "p_idempotency_key" "uuid", "p_notes" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_pending_payment_records"("p_customer_id" "uuid", "p_payment_plan_id" "uuid", "p_transaction_id" "uuid", "p_customer_name" "text", "p_customer_email" "text", "p_user_id" "uuid", "p_total_amount" integer, "p_number_of_payments" integer, "p_payment_interval" "text", "p_downpayment_amount" integer, "p_payment_schedule" "jsonb", "p_stripe_customer_id" "text", "p_idempotency_key" "uuid", "p_notes" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_pending_payment_records"("p_customer_id" "uuid", "p_payment_plan_id" "uuid", "p_transaction_id" "uuid", "p_customer_name" "text", "p_customer_email" "text", "p_user_id" "uuid", "p_total_amount" integer, "p_number_of_payments" integer, "p_payment_interval" "text", "p_downpayment_amount" integer, "p_payment_schedule" "jsonb", "p_stripe_customer_id" "text", "p_idempotency_key" "uuid", "p_notes" "jsonb") TO "service_role";

GRANT ALL ON FUNCTION "public"."handle_payment_confirmation"("p_pending_plan_id" "uuid", "p_payment_intent_id" "text", "p_idempotency_key" "uuid", "p_card_last_four" "text", "p_card_expiration_month" integer, "p_card_expiration_year" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."handle_payment_confirmation"("p_pending_plan_id" "uuid", "p_payment_intent_id" "text", "p_idempotency_key" "uuid", "p_card_last_four" "text", "p_card_expiration_month" integer, "p_card_expiration_year" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_payment_confirmation"("p_pending_plan_id" "uuid", "p_payment_intent_id" "text", "p_idempotency_key" "uuid", "p_card_last_four" "text", "p_card_expiration_month" integer, "p_card_expiration_year" integer) TO "service_role";

GRANT ALL ON FUNCTION "public"."handle_successful_payment"("p_transaction_id" "uuid", "p_paid_at" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."handle_successful_payment"("p_transaction_id" "uuid", "p_paid_at" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_successful_payment"("p_transaction_id" "uuid", "p_paid_at" timestamp with time zone) TO "service_role";

GRANT ALL ON FUNCTION "public"."log_email_activity"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_email_activity"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_email_activity"() TO "service_role";

GRANT ALL ON FUNCTION "public"."log_payment_plan_activity"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_payment_plan_activity"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_payment_plan_activity"() TO "service_role";

GRANT ALL ON FUNCTION "public"."log_payout_activity"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_payout_activity"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_payout_activity"() TO "service_role";

GRANT ALL ON FUNCTION "public"."log_transaction_activity"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_transaction_activity"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_transaction_activity"() TO "service_role";

GRANT ALL ON FUNCTION "public"."migrate_pending_payment_plan"("p_pending_plan_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."migrate_pending_payment_plan"("p_pending_plan_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."migrate_pending_payment_plan"("p_pending_plan_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."set_reminder_email_date"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_reminder_email_date"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_reminder_email_date"() TO "service_role";

GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";

GRANT ALL ON FUNCTION "public"."text_to_activity_type"("p_text" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."text_to_activity_type"("p_text" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."text_to_activity_type"("p_text" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."update_modified_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_modified_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_modified_column"() TO "service_role";

GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "service_role";

GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";

GRANT ALL ON TABLE "public"."activity_logs" TO "anon";
GRANT ALL ON TABLE "public"."activity_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_logs" TO "service_role";

GRANT ALL ON TABLE "public"."customers" TO "anon";
GRANT ALL ON TABLE "public"."customers" TO "authenticated";
GRANT ALL ON TABLE "public"."customers" TO "service_role";

GRANT ALL ON TABLE "public"."customers_backup" TO "anon";
GRANT ALL ON TABLE "public"."customers_backup" TO "authenticated";
GRANT ALL ON TABLE "public"."customers_backup" TO "service_role";

GRANT ALL ON TABLE "public"."email_logs" TO "anon";
GRANT ALL ON TABLE "public"."email_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."email_logs" TO "service_role";

GRANT ALL ON TABLE "public"."migration_20240415000000_completed" TO "anon";
GRANT ALL ON TABLE "public"."migration_20240415000000_completed" TO "authenticated";
GRANT ALL ON TABLE "public"."migration_20240415000000_completed" TO "service_role";

GRANT ALL ON TABLE "public"."payment_plans" TO "anon";
GRANT ALL ON TABLE "public"."payment_plans" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_plans" TO "service_role";

GRANT ALL ON TABLE "public"."payment_plans_backup" TO "anon";
GRANT ALL ON TABLE "public"."payment_plans_backup" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_plans_backup" TO "service_role";

GRANT ALL ON TABLE "public"."payment_processing_logs" TO "anon";
GRANT ALL ON TABLE "public"."payment_processing_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_processing_logs" TO "service_role";

GRANT ALL ON TABLE "public"."payouts" TO "anon";
GRANT ALL ON TABLE "public"."payouts" TO "authenticated";
GRANT ALL ON TABLE "public"."payouts" TO "service_role";

GRANT ALL ON SEQUENCE "public"."payouts_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."payouts_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."payouts_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."pending_customers" TO "anon";
GRANT ALL ON TABLE "public"."pending_customers" TO "authenticated";
GRANT ALL ON TABLE "public"."pending_customers" TO "service_role";

GRANT ALL ON TABLE "public"."pending_payment_plans" TO "anon";
GRANT ALL ON TABLE "public"."pending_payment_plans" TO "authenticated";
GRANT ALL ON TABLE "public"."pending_payment_plans" TO "service_role";

GRANT ALL ON TABLE "public"."pending_transactions" TO "anon";
GRANT ALL ON TABLE "public"."pending_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."pending_transactions" TO "service_role";

GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";

GRANT ALL ON TABLE "public"."profiles_backup" TO "anon";
GRANT ALL ON TABLE "public"."profiles_backup" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles_backup" TO "service_role";

GRANT ALL ON TABLE "public"."stripe_accounts" TO "anon";
GRANT ALL ON TABLE "public"."stripe_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."stripe_accounts" TO "service_role";

GRANT ALL ON TABLE "public"."stripe_accounts_backup" TO "anon";
GRANT ALL ON TABLE "public"."stripe_accounts_backup" TO "authenticated";
GRANT ALL ON TABLE "public"."stripe_accounts_backup" TO "service_role";

GRANT ALL ON TABLE "public"."transactions" TO "anon";
GRANT ALL ON TABLE "public"."transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."transactions" TO "service_role";

GRANT ALL ON TABLE "public"."transactions_backup" TO "anon";
GRANT ALL ON TABLE "public"."transactions_backup" TO "authenticated";
GRANT ALL ON TABLE "public"."transactions_backup" TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";

RESET ALL;
