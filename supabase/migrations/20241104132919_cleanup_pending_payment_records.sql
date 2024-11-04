-- Create cleanup function for pending payment records
CREATE OR REPLACE FUNCTION cleanup_pending_payment_records(p_pending_plan_id UUID)
RETURNS void AS $$
BEGIN
    -- Delete pending transactions first (due to foreign key constraints)
    DELETE FROM pending_transactions
    WHERE payment_plan_id = p_pending_plan_id;

    -- Get the customer_id before deleting the plan
    WITH plan_customer AS (
        SELECT customer_id
        FROM pending_payment_plans
        WHERE id = p_pending_plan_id
    )
    -- Delete the pending payment plan
    DELETE FROM pending_payment_plans
    WHERE id = p_pending_plan_id;

    -- Delete the pending customer if no other pending plans reference it
    DELETE FROM pending_customers
    WHERE id IN (
        SELECT customer_id 
        FROM plan_customer
    )
    AND NOT EXISTS (
        SELECT 1 
        FROM pending_payment_plans 
        WHERE customer_id = plan_customer.customer_id
        AND id != p_pending_plan_id
    );
END;
$$ LANGUAGE plpgsql;

-- Add comment to the function
COMMENT ON FUNCTION cleanup_pending_payment_records(UUID) IS 'Cleans up pending records after successful migration to live tables';