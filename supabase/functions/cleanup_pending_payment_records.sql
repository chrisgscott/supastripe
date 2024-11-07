CREATE OR REPLACE FUNCTION cleanup_pending_payment_records(p_pending_plan_id UUID)
RETURNS void AS $$
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
$$ LANGUAGE plpgsql;