-- Fix duplicate transactions by removing duplicates and keeping the most recent one
DO $$
DECLARE
    v_duplicate_count INTEGER;
BEGIN
    -- First, find and count duplicate transactions
    WITH duplicate_transactions AS (
        SELECT 
            payment_plan_id,
            transaction_type,
            amount,
            COUNT(*) as count
        FROM transactions
        GROUP BY payment_plan_id, transaction_type, amount
        HAVING COUNT(*) > 1
    )
    SELECT SUM(count - 1) INTO v_duplicate_count
    FROM duplicate_transactions;

    RAISE NOTICE 'Found % duplicate transactions to clean up', v_duplicate_count;

    -- Delete duplicate transactions, keeping the most recent one
    WITH ranked_transactions AS (
        SELECT 
            id,
            payment_plan_id,
            transaction_type,
            amount,
            ROW_NUMBER() OVER (
                PARTITION BY payment_plan_id, transaction_type, amount 
                ORDER BY COALESCE(paid_at, created_at) DESC, id DESC
            ) as rn
        FROM transactions
    )
    DELETE FROM transactions t
    USING ranked_transactions rt
    WHERE t.id = rt.id 
    AND rt.rn > 1;

    RAISE NOTICE 'Cleaned up duplicate transactions';
END;
$$;
