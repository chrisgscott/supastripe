DROP FUNCTION IF EXISTS create_pending_payment_records(uuid,uuid,uuid,text,text,uuid,integer,integer,text,integer,jsonb,text,uuid,jsonb);

CREATE OR REPLACE FUNCTION create_pending_payment_records(
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
) RETURNS uuid AS $$
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
$$ LANGUAGE plpgsql;