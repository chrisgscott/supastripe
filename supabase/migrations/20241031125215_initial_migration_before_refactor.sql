
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

CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";

COMMENT ON SCHEMA "public" IS 'standard public schema';

CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "public";

CREATE EXTENSION IF NOT EXISTS "pgsodium" WITH SCHEMA "pgsodium";

CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";

CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";

CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";

CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA "extensions";

CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";

CREATE OR REPLACE FUNCTION "public"."begin_transaction"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- No need to explicitly start a transaction
  -- PostgreSQL automatically starts a transaction when needed
  NULL;
END;
$$;

ALTER FUNCTION "public"."begin_transaction"() OWNER TO "postgres";

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

CREATE OR REPLACE FUNCTION "public"."commit_transaction"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Commit the current transaction
  COMMIT;
END;
$$;

ALTER FUNCTION "public"."commit_transaction"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."complete_payment_plan_creation"("p_payment_plan_id" "uuid", "p_stripe_payment_intent_id" "text", "p_idempotency_key" "uuid", "p_card_last_four" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_customer_id UUID;
BEGIN
  -- Get customer_id from payment_plan
  SELECT customer_id INTO v_customer_id
  FROM payment_plans
  WHERE id = p_payment_plan_id;

  -- Update payment plan status
  UPDATE payment_plans
  SET 
    status = 'active',
    plan_creation_status = 'completed',
    stripe_payment_intent_id = p_stripe_payment_intent_id,
    card_last_four = p_card_last_four
  WHERE id = p_payment_plan_id;

  -- Update customer status
  UPDATE customers
  SET plan_creation_status = 'completed'
  WHERE id = v_customer_id;

  -- Update all transactions for this plan
  UPDATE transactions
  SET plan_creation_status = 'completed'
  WHERE payment_plan_id = p_payment_plan_id;

  -- Update the downpayment transaction with Stripe payment intent
  UPDATE transactions
  SET 
    status = 'paid',
    stripe_payment_intent_id = p_stripe_payment_intent_id,
    paid_at = CURRENT_TIMESTAMP
  WHERE 
    payment_plan_id = p_payment_plan_id 
    AND is_downpayment = true;

  -- Insert payment processing log
  INSERT INTO payment_processing_logs (
    transaction_id,
    payment_plan_id,
    stripe_payment_intent_id,
    status,
    idempotency_key
  )
  SELECT 
    id,
    payment_plan_id,
    p_stripe_payment_intent_id,
    'succeeded',
    p_idempotency_key::TEXT
  FROM transactions
  WHERE 
    payment_plan_id = p_payment_plan_id 
    AND is_downpayment = true;
END;
$$;

ALTER FUNCTION "public"."complete_payment_plan_creation"("p_payment_plan_id" "uuid", "p_stripe_payment_intent_id" "text", "p_idempotency_key" "uuid", "p_card_last_four" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."complete_payment_plan_creation"("p_payment_plan_id" "uuid", "p_transaction_id" "uuid", "p_idempotency_key" "uuid", "p_card_last_four" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_customer_id UUID;
  v_stripe_payment_intent_id TEXT;
  v_is_downpayment BOOLEAN;
BEGIN
  -- Get customer_id from payment_plan
  SELECT customer_id INTO v_customer_id
  FROM payment_plans
  WHERE id = p_payment_plan_id;

  -- Get stripe_payment_intent_id and is_downpayment from the transaction
  SELECT 
    stripe_payment_intent_id,
    is_downpayment 
  INTO 
    v_stripe_payment_intent_id,
    v_is_downpayment
  FROM transactions
  WHERE id = p_transaction_id;

  -- Verify this is a downpayment transaction
  IF NOT v_is_downpayment THEN
    RAISE EXCEPTION 'Transaction is not a downpayment';
  END IF;

  -- Update payment plan with card info
  UPDATE payment_plans
  SET card_last_four = p_card_last_four
  WHERE id = p_payment_plan_id;

  -- Update payment plan state to completed
  UPDATE payment_plan_states
  SET status = 'completed'
  WHERE payment_plan_id = p_payment_plan_id;

  -- Update the specific downpayment transaction that was paid
  UPDATE transactions
  SET 
    status = 'paid',
    paid_at = CURRENT_TIMESTAMP
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
    'succeeded',
    p_idempotency_key
  );
END;
$$;

ALTER FUNCTION "public"."complete_payment_plan_creation"("p_payment_plan_id" "uuid", "p_transaction_id" "uuid", "p_idempotency_key" "uuid", "p_card_last_four" "text") OWNER TO "postgres";

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

CREATE OR REPLACE FUNCTION "public"."handle_successful_payment"("p_transaction_id" "uuid", "p_paid_at" timestamp with time zone) RETURNS "json"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_payment_plan_id UUID;
  v_count INT;
BEGIN
  -- Start transaction
  BEGIN
    -- Update transaction status
    UPDATE transactions
    SET status = 'paid', paid_at = p_paid_at
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
END;
$$;

ALTER FUNCTION "public"."handle_successful_payment"("p_transaction_id" "uuid", "p_paid_at" timestamp with time zone) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."rollback_transaction"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Rollback the current transaction
  ROLLBACK;
END;
$$;

ALTER FUNCTION "public"."rollback_transaction"() OWNER TO "postgres";

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

CREATE TABLE IF NOT EXISTS "public"."payment_plans" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "total_amount" numeric(10,2) NOT NULL,
    "number_of_payments" integer NOT NULL,
    "payment_interval" "text" NOT NULL,
    "downpayment_amount" numeric(10,2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "status" "text" DEFAULT 'created'::"text" NOT NULL,
    "idempotency_key" "text",
    "notes" "jsonb",
    "card_last_four" character(4),
    CONSTRAINT "check_payment_plan_status" CHECK (("status" = ANY (ARRAY['created'::"text", 'active'::"text", 'completed'::"text", 'cancelled'::"text", 'failed'::"text"]))),
    CONSTRAINT "payment_plans_status_check" CHECK (("status" = ANY (ARRAY['created'::"text", 'active'::"text", 'completed'::"text", 'cancelled'::"text", 'failed'::"text"])))
);

ALTER TABLE "public"."payment_plans" OWNER TO "postgres";

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
    "is_downpayment" boolean DEFAULT false,
    "paid_at" timestamp with time zone,
    "next_attempt_date" timestamp with time zone,
    "reminder_email_date" "date",
    "last_reminder_email_log_id" "uuid",
    CONSTRAINT "check_transaction_status" CHECK (("status" = ANY (ARRAY['pending'::"text", 'paid'::"text", 'failed'::"text"])))
);

ALTER TABLE "public"."transactions" OWNER TO "postgres";

CREATE OR REPLACE VIEW "public"."customer_payment_details" AS
 SELECT "c"."name" AS "customer_name",
    "pp"."id" AS "payment_plan_id",
    "pp"."status" AS "payment_plan_status",
    "t"."id" AS "transaction_id",
    "t"."amount" AS "transaction_amount",
    "t"."due_date" AS "transaction_due_date",
    "t"."status" AS "transaction_status",
    "t"."created_at" AS "date_created"
   FROM (("public"."customers" "c"
     JOIN "public"."payment_plans" "pp" ON (("c"."id" = "pp"."customer_id")))
     LEFT JOIN "public"."transactions" "t" ON (("pp"."id" = "t"."payment_plan_id")))
  ORDER BY "c"."name", "pp"."id", "t"."due_date";

ALTER TABLE "public"."customer_payment_details" OWNER TO "postgres";

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

CREATE OR REPLACE VIEW "public"."detailed_transactions" AS
 SELECT "t"."id" AS "transaction_id",
    "t"."payment_plan_id",
    "t"."amount",
    "t"."due_date",
    "t"."status" AS "transaction_status",
    "t"."is_downpayment",
    "t"."stripe_payment_intent_id",
    "pp"."user_id" AS "seller_user_id",
    "c"."email" AS "customer_email",
    "pp"."status" AS "payment_plan_status",
    "p"."business_name" AS "seller_business_name",
    "au"."email" AS "seller_email"
   FROM (((("public"."transactions" "t"
     JOIN "public"."payment_plans" "pp" ON (("t"."payment_plan_id" = "pp"."id")))
     JOIN "public"."customers" "c" ON (("pp"."customer_id" = "c"."id")))
     JOIN "public"."profiles" "p" ON (("pp"."user_id" = "p"."id")))
     JOIN "auth"."users" "au" ON (("pp"."user_id" = "au"."id")));

ALTER TABLE "public"."detailed_transactions" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."email_logs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "email_type" character varying(255) NOT NULL,
    "recipient_email" character varying(255) NOT NULL,
    "status" character varying(50) NOT NULL,
    "sent_at" timestamp with time zone DEFAULT "now"(),
    "error_message" "text",
    "related_id" "uuid",
    "related_type" character varying(255),
    "idempotency_key" "text"
);

ALTER TABLE "public"."email_logs" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."email_templates" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "template_type" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "public"."email_templates" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."payment_plan_states" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "payment_plan_id" "uuid",
    "status" "text" NOT NULL,
    "payment_link_token" "text",
    "payment_link_expires_at" timestamp with time zone,
    "change_request_notes" "text",
    "reminder_count" integer DEFAULT 0,
    "last_reminder_sent_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'pending_customer_approval'::"text", 'changes_requested'::"text", 'pending_payment'::"text", 'completed'::"text", 'cancelled'::"text"])))
);

ALTER TABLE "public"."payment_plan_states" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."payment_processing_logs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "transaction_id" "uuid" NOT NULL,
    "status" "text" NOT NULL,
    "stripe_payment_intent_id" "text",
    "error_message" "text",
    "idempotency_key" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "payment_plan_id" "uuid"
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
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
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

CREATE TABLE IF NOT EXISTS "public"."stripe_reviews" (
    "id" integer NOT NULL,
    "stripe_review_id" "text" NOT NULL,
    "stripe_account_id" "text" NOT NULL,
    "reason" "text" NOT NULL,
    "status" "text" NOT NULL,
    "opened_at" timestamp with time zone NOT NULL,
    "closed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "public"."stripe_reviews" OWNER TO "postgres";

CREATE SEQUENCE IF NOT EXISTS "public"."stripe_reviews_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER TABLE "public"."stripe_reviews_id_seq" OWNER TO "postgres";

ALTER SEQUENCE "public"."stripe_reviews_id_seq" OWNED BY "public"."stripe_reviews"."id";

ALTER TABLE ONLY "public"."payouts" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."payouts_id_seq"'::"regclass");

ALTER TABLE ONLY "public"."stripe_reviews" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."stripe_reviews_id_seq"'::"regclass");

ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."email_logs"
    ADD CONSTRAINT "email_logs_idempotency_key_key" UNIQUE ("idempotency_key");

ALTER TABLE ONLY "public"."email_logs"
    ADD CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."email_templates"
    ADD CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."email_templates"
    ADD CONSTRAINT "email_templates_user_id_template_type_key" UNIQUE ("user_id", "template_type");

ALTER TABLE ONLY "public"."payment_plan_states"
    ADD CONSTRAINT "payment_plan_states_payment_link_token_key" UNIQUE ("payment_link_token");

ALTER TABLE ONLY "public"."payment_plan_states"
    ADD CONSTRAINT "payment_plan_states_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."payment_plans"
    ADD CONSTRAINT "payment_plans_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."payment_processing_logs"
    ADD CONSTRAINT "payment_processing_logs_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."payouts"
    ADD CONSTRAINT "payouts_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."payouts"
    ADD CONSTRAINT "payouts_stripe_payout_id_key" UNIQUE ("stripe_payout_id");

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."stripe_accounts"
    ADD CONSTRAINT "stripe_accounts_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."stripe_accounts"
    ADD CONSTRAINT "stripe_accounts_stripe_account_id_key" UNIQUE ("stripe_account_id");

ALTER TABLE ONLY "public"."stripe_reviews"
    ADD CONSTRAINT "stripe_reviews_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."stripe_reviews"
    ADD CONSTRAINT "stripe_reviews_stripe_review_id_key" UNIQUE ("stripe_review_id");

ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "unique_email_user_id" UNIQUE ("email", "user_id");

CREATE INDEX "email_templates_user_id_idx" ON "public"."email_templates" USING "btree" ("user_id");

CREATE INDEX "idx_payment_plan_states_expires_at" ON "public"."payment_plan_states" USING "btree" ("payment_link_expires_at");

CREATE INDEX "idx_payment_plan_states_status" ON "public"."payment_plan_states" USING "btree" ("status");

CREATE INDEX "idx_payment_processing_logs_idempotency_key" ON "public"."payment_processing_logs" USING "btree" ("idempotency_key");

CREATE INDEX "idx_payment_processing_logs_transaction_id" ON "public"."payment_processing_logs" USING "btree" ("transaction_id");

CREATE INDEX "idx_profiles_stripe_account_id" ON "public"."profiles" USING "btree" ("stripe_account_id");

CREATE INDEX "idx_stripe_accounts_user_id" ON "public"."stripe_accounts" USING "btree" ("user_id");

CREATE OR REPLACE TRIGGER "set_reminder_email_date_trigger" BEFORE INSERT OR UPDATE ON "public"."transactions" FOR EACH ROW EXECUTE FUNCTION "public"."set_reminder_email_date"();

CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();

CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."stripe_accounts" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE OR REPLACE TRIGGER "update_email_templates_updated_at" BEFORE UPDATE ON "public"."email_templates" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_profiles_modtime" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_modified_column"();

ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");

ALTER TABLE ONLY "public"."email_templates"
    ADD CONSTRAINT "email_templates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."payment_plans"
    ADD CONSTRAINT "fk_payment_plans_user" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."payment_plan_states"
    ADD CONSTRAINT "payment_plan_states_payment_plan_id_fkey" FOREIGN KEY ("payment_plan_id") REFERENCES "public"."payment_plans"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."payment_plans"
    ADD CONSTRAINT "payment_plans_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id");

ALTER TABLE ONLY "public"."payment_plans"
    ADD CONSTRAINT "payment_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");

ALTER TABLE ONLY "public"."payment_processing_logs"
    ADD CONSTRAINT "payment_processing_logs_payment_plan_id_fkey" FOREIGN KEY ("payment_plan_id") REFERENCES "public"."payment_plans"("id");

ALTER TABLE ONLY "public"."payment_processing_logs"
    ADD CONSTRAINT "payment_processing_logs_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id");

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id");

ALTER TABLE ONLY "public"."stripe_accounts"
    ADD CONSTRAINT "stripe_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_last_reminder_email_log_id_fkey" FOREIGN KEY ("last_reminder_email_log_id") REFERENCES "public"."email_logs"("id");

ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_payment_plan_id_fkey" FOREIGN KEY ("payment_plan_id") REFERENCES "public"."payment_plans"("id");

ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");

CREATE POLICY "Admins can view all Stripe accounts" ON "public"."stripe_accounts" FOR SELECT USING ((("auth"."jwt"() ->> 'role'::"text") = 'admin'::"text"));

CREATE POLICY "Admins can view all profiles" ON "public"."profiles" FOR SELECT USING ((("auth"."jwt"() ->> 'role'::"text") = 'admin'::"text"));

CREATE POLICY "Allow authenticated users to insert email logs" ON "public"."email_logs" FOR INSERT TO "authenticated" WITH CHECK (true);

CREATE POLICY "Allow inserts from create_payment_plan_step1" ON "public"."customers" FOR INSERT TO "authenticated" WITH CHECK (("current_setting"('my.function_name'::"text", true) = 'create_payment_plan_step1'::"text"));

CREATE POLICY "Allow inserts from create_payment_plan_step1" ON "public"."payment_plans" FOR INSERT TO "authenticated" WITH CHECK (("current_setting"('my.function_name'::"text", true) = 'create_payment_plan_step1'::"text"));

CREATE POLICY "Allow inserts from create_payment_plan_step1" ON "public"."transactions" FOR INSERT TO "authenticated" WITH CHECK (("current_setting"('my.function_name'::"text", true) = 'create_payment_plan_step1'::"text"));

CREATE POLICY "Service role can insert email logs" ON "public"."email_logs" FOR INSERT WITH CHECK (("auth"."role"() = 'service_role'::"text"));

CREATE POLICY "Users can insert payment plan states for their plans" ON "public"."payment_plan_states" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."payment_plans"
  WHERE (("payment_plans"."id" = "payment_plan_states"."payment_plan_id") AND ("payment_plans"."user_id" = "auth"."uid"())))));

CREATE POLICY "Users can read and update their own profile" ON "public"."profiles" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));

CREATE POLICY "Users can update their own payment plan states" ON "public"."payment_plan_states" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."payment_plans"
  WHERE (("payment_plans"."id" = "payment_plan_states"."payment_plan_id") AND ("payment_plans"."user_id" = "auth"."uid"())))));

CREATE POLICY "Users can view and edit own Stripe account" ON "public"."stripe_accounts" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can view and edit own profile" ON "public"."profiles" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));

CREATE POLICY "Users can view their own email logs" ON "public"."email_logs" FOR SELECT USING (("auth"."uid"() IN ( SELECT "transactions"."user_id"
   FROM "public"."transactions"
  WHERE ("transactions"."id" = "email_logs"."related_id"))));

CREATE POLICY "Users can view their own payment plan states" ON "public"."payment_plan_states" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."payment_plans"
  WHERE (("payment_plans"."id" = "payment_plan_states"."payment_plan_id") AND ("payment_plans"."user_id" = "auth"."uid"())))));

CREATE POLICY "Users can view their own payment processing logs" ON "public"."payment_processing_logs" FOR SELECT USING (("auth"."uid"() IN ( SELECT "transactions"."user_id"
   FROM "public"."transactions"
  WHERE ("transactions"."id" = "payment_processing_logs"."transaction_id"))));

CREATE POLICY "allow_function_inserts" ON "public"."customers" FOR INSERT TO "authenticated" WITH CHECK (("current_setting"('my.function_name'::"text", true) = 'create_payment_plan_step1'::"text"));

CREATE POLICY "allow_function_inserts" ON "public"."payment_plans" FOR INSERT TO "authenticated" WITH CHECK (("current_setting"('my.function_name'::"text", true) = 'create_payment_plan_step1'::"text"));

CREATE POLICY "allow_function_inserts" ON "public"."transactions" FOR INSERT TO "authenticated" WITH CHECK (("current_setting"('my.function_name'::"text", true) = 'create_payment_plan_step1'::"text"));

CREATE POLICY "complete_payment_plan_creation_insert_policy" ON "public"."payment_processing_logs" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() IN ( SELECT "payment_plans"."user_id"
   FROM "public"."payment_plans"
  WHERE ("payment_plans"."id" = "payment_processing_logs"."payment_plan_id"))));

ALTER TABLE "public"."customers" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "delete_own_email_templates" ON "public"."email_templates" FOR DELETE USING (("auth"."uid"() = "user_id"));

ALTER TABLE "public"."email_logs" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."email_templates" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "insert_own_email_templates" ON "public"."email_templates" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));

CREATE POLICY "manage_all_payouts" ON "public"."payouts" USING (("auth"."role"() = 'service_role'::"text"));

CREATE POLICY "manage_all_reviews" ON "public"."stripe_reviews" USING (("auth"."role"() = 'service_role'::"text"));

CREATE POLICY "manage_all_stripe_accounts" ON "public"."stripe_accounts" USING (("auth"."role"() = 'service_role'::"text"));

CREATE POLICY "manage_own_customers" ON "public"."customers" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));

CREATE POLICY "manage_own_payment_plans" ON "public"."payment_plans" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));

CREATE POLICY "manage_own_transactions" ON "public"."transactions" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));

ALTER TABLE "public"."payment_plan_states" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."payment_plans" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."payment_processing_logs" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."payouts" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_email_templates" ON "public"."email_templates" FOR SELECT USING (("auth"."uid"() = "user_id"));

ALTER TABLE "public"."stripe_accounts" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."stripe_reviews" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."transactions" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "update_own_email_templates" ON "public"."email_templates" FOR UPDATE USING (("auth"."uid"() = "user_id"));

CREATE POLICY "view_own_payouts" ON "public"."payouts" FOR SELECT USING (("stripe_account_id" IN ( SELECT "stripe_accounts"."stripe_account_id"
   FROM "public"."stripe_accounts"
  WHERE ("stripe_accounts"."user_id" = "auth"."uid"()))));

CREATE POLICY "view_own_reviews" ON "public"."stripe_reviews" FOR SELECT USING (("stripe_account_id" IN ( SELECT "stripe_accounts"."stripe_account_id"
   FROM "public"."stripe_accounts"
  WHERE ("stripe_accounts"."user_id" = "auth"."uid"()))));

CREATE POLICY "view_own_stripe_account" ON "public"."stripe_accounts" FOR SELECT USING (("user_id" = "auth"."uid"()));

ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";

ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."payment_plans";

ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."payouts";

ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."stripe_accounts";

ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."transactions";

SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;

GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

GRANT ALL ON FUNCTION "public"."begin_transaction"() TO "anon";
GRANT ALL ON FUNCTION "public"."begin_transaction"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."begin_transaction"() TO "service_role";

GRANT ALL ON FUNCTION "public"."cleanup_pending_plans"("older_than" timestamp without time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_pending_plans"("older_than" timestamp without time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_pending_plans"("older_than" timestamp without time zone) TO "service_role";

GRANT ALL ON FUNCTION "public"."commit_transaction"() TO "anon";
GRANT ALL ON FUNCTION "public"."commit_transaction"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."commit_transaction"() TO "service_role";

GRANT ALL ON FUNCTION "public"."complete_payment_plan_creation"("p_payment_plan_id" "uuid", "p_stripe_payment_intent_id" "text", "p_idempotency_key" "uuid", "p_card_last_four" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."complete_payment_plan_creation"("p_payment_plan_id" "uuid", "p_stripe_payment_intent_id" "text", "p_idempotency_key" "uuid", "p_card_last_four" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."complete_payment_plan_creation"("p_payment_plan_id" "uuid", "p_stripe_payment_intent_id" "text", "p_idempotency_key" "uuid", "p_card_last_four" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."complete_payment_plan_creation"("p_payment_plan_id" "uuid", "p_transaction_id" "uuid", "p_idempotency_key" "uuid", "p_card_last_four" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."complete_payment_plan_creation"("p_payment_plan_id" "uuid", "p_transaction_id" "uuid", "p_idempotency_key" "uuid", "p_card_last_four" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."complete_payment_plan_creation"("p_payment_plan_id" "uuid", "p_transaction_id" "uuid", "p_idempotency_key" "uuid", "p_card_last_four" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."create_payment_plan"("p_customer_id" "uuid", "p_user_id" "uuid", "p_total_amount" integer, "p_number_of_payments" integer, "p_payment_interval" "text", "p_downpayment_amount" integer, "p_payment_schedule" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_payment_plan"("p_customer_id" "uuid", "p_user_id" "uuid", "p_total_amount" integer, "p_number_of_payments" integer, "p_payment_interval" "text", "p_downpayment_amount" integer, "p_payment_schedule" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_payment_plan"("p_customer_id" "uuid", "p_user_id" "uuid", "p_total_amount" integer, "p_number_of_payments" integer, "p_payment_interval" "text", "p_downpayment_amount" integer, "p_payment_schedule" "jsonb") TO "service_role";

GRANT ALL ON FUNCTION "public"."create_payment_plan_step1"("p_customer_name" "text", "p_customer_email" "text", "p_user_id" "uuid", "p_total_amount" integer, "p_number_of_payments" integer, "p_payment_interval" "text", "p_downpayment_amount" integer, "p_payment_schedule" "jsonb", "p_stripe_customer_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_payment_plan_step1"("p_customer_name" "text", "p_customer_email" "text", "p_user_id" "uuid", "p_total_amount" integer, "p_number_of_payments" integer, "p_payment_interval" "text", "p_downpayment_amount" integer, "p_payment_schedule" "jsonb", "p_stripe_customer_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_payment_plan_step1"("p_customer_name" "text", "p_customer_email" "text", "p_user_id" "uuid", "p_total_amount" integer, "p_number_of_payments" integer, "p_payment_interval" "text", "p_downpayment_amount" integer, "p_payment_schedule" "jsonb", "p_stripe_customer_id" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."create_payment_plan_step1"("p_customer_name" "text", "p_customer_email" "text", "p_user_id" "uuid", "p_total_amount" integer, "p_number_of_payments" integer, "p_payment_interval" "text", "p_downpayment_amount" integer, "p_payment_schedule" "jsonb", "p_stripe_customer_id" "text", "p_idempotency_key" "uuid", "p_notes" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_payment_plan_step1"("p_customer_name" "text", "p_customer_email" "text", "p_user_id" "uuid", "p_total_amount" integer, "p_number_of_payments" integer, "p_payment_interval" "text", "p_downpayment_amount" integer, "p_payment_schedule" "jsonb", "p_stripe_customer_id" "text", "p_idempotency_key" "uuid", "p_notes" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_payment_plan_step1"("p_customer_name" "text", "p_customer_email" "text", "p_user_id" "uuid", "p_total_amount" integer, "p_number_of_payments" integer, "p_payment_interval" "text", "p_downpayment_amount" integer, "p_payment_schedule" "jsonb", "p_stripe_customer_id" "text", "p_idempotency_key" "uuid", "p_notes" "jsonb") TO "service_role";

GRANT ALL ON FUNCTION "public"."handle_successful_payment"("p_transaction_id" "uuid", "p_paid_at" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."handle_successful_payment"("p_transaction_id" "uuid", "p_paid_at" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_successful_payment"("p_transaction_id" "uuid", "p_paid_at" timestamp with time zone) TO "service_role";

GRANT ALL ON FUNCTION "public"."rollback_transaction"() TO "anon";
GRANT ALL ON FUNCTION "public"."rollback_transaction"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rollback_transaction"() TO "service_role";

GRANT ALL ON FUNCTION "public"."set_reminder_email_date"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_reminder_email_date"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_reminder_email_date"() TO "service_role";

GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";

GRANT ALL ON FUNCTION "public"."update_modified_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_modified_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_modified_column"() TO "service_role";

GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "service_role";

GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";

GRANT ALL ON TABLE "public"."customers" TO "anon";
GRANT ALL ON TABLE "public"."customers" TO "authenticated";
GRANT ALL ON TABLE "public"."customers" TO "service_role";

GRANT ALL ON TABLE "public"."payment_plans" TO "anon";
GRANT ALL ON TABLE "public"."payment_plans" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_plans" TO "service_role";

GRANT ALL ON TABLE "public"."transactions" TO "anon";
GRANT ALL ON TABLE "public"."transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."transactions" TO "service_role";

GRANT ALL ON TABLE "public"."customer_payment_details" TO "anon";
GRANT ALL ON TABLE "public"."customer_payment_details" TO "authenticated";
GRANT ALL ON TABLE "public"."customer_payment_details" TO "service_role";

GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";

GRANT ALL ON TABLE "public"."detailed_transactions" TO "anon";
GRANT ALL ON TABLE "public"."detailed_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."detailed_transactions" TO "service_role";

GRANT ALL ON TABLE "public"."email_logs" TO "anon";
GRANT ALL ON TABLE "public"."email_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."email_logs" TO "service_role";

GRANT ALL ON TABLE "public"."email_templates" TO "anon";
GRANT ALL ON TABLE "public"."email_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."email_templates" TO "service_role";

GRANT ALL ON TABLE "public"."payment_plan_states" TO "anon";
GRANT ALL ON TABLE "public"."payment_plan_states" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_plan_states" TO "service_role";

GRANT ALL ON TABLE "public"."payment_processing_logs" TO "anon";
GRANT ALL ON TABLE "public"."payment_processing_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_processing_logs" TO "service_role";

GRANT ALL ON TABLE "public"."payouts" TO "anon";
GRANT ALL ON TABLE "public"."payouts" TO "authenticated";
GRANT ALL ON TABLE "public"."payouts" TO "service_role";

GRANT ALL ON SEQUENCE "public"."payouts_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."payouts_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."payouts_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."stripe_accounts" TO "anon";
GRANT ALL ON TABLE "public"."stripe_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."stripe_accounts" TO "service_role";

GRANT ALL ON TABLE "public"."stripe_reviews" TO "anon";
GRANT ALL ON TABLE "public"."stripe_reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."stripe_reviews" TO "service_role";

GRANT ALL ON SEQUENCE "public"."stripe_reviews_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."stripe_reviews_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."stripe_reviews_id_seq" TO "service_role";

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
