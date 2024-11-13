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