-- Create the handle_payment_confirmation RPC function
CREATE OR REPLACE FUNCTION handle_payment_confirmation(
    payment_intent_id text,
    payment_status text,
    error_message text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_transaction_id uuid;
    v_payment_plan_id uuid;
    v_customer_id uuid;
    v_result json;
BEGIN
    -- Find the transaction with this payment intent
    SELECT id, payment_plan_id 
    INTO v_transaction_id, v_payment_plan_id
    FROM pending_transactions 
    WHERE stripe_payment_intent_id = payment_intent_id;

    IF v_transaction_id IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'message', 'No transaction found yet, webhook processing in progress'
        );
    END IF;

    -- Get customer_id from payment plan
    SELECT customer_id INTO v_customer_id
    FROM pending_payment_plans
    WHERE id = v_payment_plan_id;

    IF payment_status = 'succeeded' THEN
        -- Move records from pending to main tables
        WITH moved_customer AS (
            INSERT INTO customers (
                id, 
                email,
                stripe_customer_id,
                created_at
            )
            SELECT 
                id,
                email,
                stripe_customer_id,
                created_at
            FROM pending_customers
            WHERE id = v_customer_id
            RETURNING *
        ),
        moved_payment_plan AS (
            INSERT INTO payment_plans (
                id,
                customer_id,
                total_amount,
                downpayment_amount,
                number_of_payments,
                payment_frequency,
                first_payment_date,
                created_at
            )
            SELECT 
                id,
                customer_id,
                total_amount,
                downpayment_amount,
                number_of_payments,
                payment_frequency,
                first_payment_date,
                created_at
            FROM pending_payment_plans
            WHERE id = v_payment_plan_id
            RETURNING *
        ),
        moved_transaction AS (
            INSERT INTO transactions (
                id,
                payment_plan_id,
                amount,
                due_date,
                status,
                stripe_payment_intent_id,
                transaction_type,
                error_message,
                created_at,
                paid_at
            )
            SELECT 
                id,
                payment_plan_id,
                amount,
                due_date,
                'completed',
                stripe_payment_intent_id,
                transaction_type,
                error_message,
                created_at,
                NOW()
            FROM pending_transactions
            WHERE id = v_transaction_id
            RETURNING *
        )
        -- Clean up pending records
        DELETE FROM pending_transactions WHERE id = v_transaction_id;
        DELETE FROM pending_payment_plans WHERE id = v_payment_plan_id;
        DELETE FROM pending_customers WHERE id = v_customer_id;

        v_result := json_build_object(
            'success', true,
            'message', 'Payment confirmed and records moved'
        );
    ELSE
        -- Update the pending transaction with error
        UPDATE pending_transactions
        SET 
            status = 'failed',
            error_message = handle_payment_confirmation.error_message
        WHERE id = v_transaction_id;

        v_result := json_build_object(
            'success', false,
            'message', 'Payment failed',
            'error', error_message
        );
    END IF;

    RETURN v_result;
END;
$$;
