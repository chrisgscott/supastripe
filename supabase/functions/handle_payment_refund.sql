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