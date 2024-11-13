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