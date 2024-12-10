-- Add logging to the handle_payment_confirmation function
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
    v_debug_info json;
BEGIN
    RAISE LOG 'handle_payment_confirmation called with payment_intent_id: %, status: %', payment_intent_id, payment_status;

    -- Find the transaction with this payment intent
    SELECT id, payment_plan_id 
    INTO v_transaction_id, v_payment_plan_id
    FROM pending_transactions 
    WHERE stripe_payment_intent_id = payment_intent_id;

    -- Log the found transaction info
    v_debug_info := json_build_object(
        'found_transaction_id', v_transaction_id,
        'found_payment_plan_id', v_payment_plan_id,
        'payment_intent_id', payment_intent_id
    );
    RAISE LOG 'Transaction lookup results: %', v_debug_info::text;

    -- If no transaction found with payment_intent_id, try looking up by pending status
    IF v_transaction_id IS NULL THEN
        SELECT id, payment_plan_id 
        INTO v_transaction_id, v_payment_plan_id
        FROM pending_transactions 
        WHERE status = 'pending'
        ORDER BY created_at DESC
        LIMIT 1;
        
        RAISE LOG 'Fallback transaction lookup results: %', 
            json_build_object(
                'fallback_transaction_id', v_transaction_id,
                'fallback_payment_plan_id', v_payment_plan_id
            )::text;
    END IF;

    IF v_transaction_id IS NULL THEN
        RAISE LOG 'No transaction found for payment_intent_id: %', payment_intent_id;
        RETURN json_build_object(
            'success', false,
            'message', 'No transaction found yet, webhook processing in progress'
        );
    END IF;

    -- Get customer_id from payment plan
    SELECT customer_id INTO v_customer_id
    FROM pending_payment_plans
    WHERE id = v_payment_plan_id;

    RAISE LOG 'Found customer_id: % for payment_plan_id: %', v_customer_id, v_payment_plan_id;

    IF payment_status = 'succeeded' THEN
        RAISE LOG 'Processing successful payment for transaction_id: %', v_transaction_id;
        
        -- First update the payment intent ID if it's not set
        UPDATE pending_transactions 
        SET stripe_payment_intent_id = payment_intent_id
        WHERE id = v_transaction_id AND stripe_payment_intent_id IS NULL;

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

        RAISE LOG 'Successfully processed payment and moved records';
        
        v_result := json_build_object(
            'success', true,
            'message', 'Payment confirmed and records moved'
        );
    ELSE
        RAISE LOG 'Processing failed payment for transaction_id: %', v_transaction_id;
        
        -- Update the pending transaction with error
        UPDATE pending_transactions
        SET 
            status = 'failed',
            error_message = handle_payment_confirmation.error_message,
            stripe_payment_intent_id = payment_intent_id
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
