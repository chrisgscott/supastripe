DROP FUNCTION IF EXISTS public.complete_payment_plan_creation(uuid, text, uuid, text);
DROP FUNCTION IF EXISTS public.complete_payment_plan_creation(uuid, uuid, uuid, text);

CREATE OR REPLACE FUNCTION public.complete_payment_plan_creation(
    p_payment_plan_id uuid,
    p_transaction_id uuid,
    p_idempotency_key uuid,
    p_card_last_four text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_customer_id UUID;
  v_stripe_payment_intent_id TEXT;
  v_transaction_type transaction_type;
BEGIN
  -- Get customer_id from payment_plan
  SELECT customer_id INTO v_customer_id
  FROM payment_plans
  WHERE id = p_payment_plan_id;

  -- Get stripe_payment_intent_id and transaction_type from the transaction
  SELECT 
    stripe_payment_intent_id,
    transaction_type
  INTO 
    v_stripe_payment_intent_id,
    v_transaction_type
  FROM transactions
  WHERE id = p_transaction_id;

  -- Verify this is a downpayment transaction
  IF v_transaction_type != 'downpayment' THEN
    RAISE EXCEPTION 'Transaction is not a downpayment';
  END IF;

  -- Update payment plan with card info and status
  UPDATE payment_plans
  SET 
    card_last_four = p_card_last_four,
    status = 'active',
    updated_at = NOW(),
    status_updated_at = NOW()
  WHERE id = p_payment_plan_id;

  -- Update the specific downpayment transaction that was paid
  UPDATE transactions
  SET 
    status = 'completed',
    paid_at = CURRENT_TIMESTAMP,
    updated_at = NOW()
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
    'payment_succeeded',
    p_idempotency_key
  );
END;
$$;

-- Add grants
GRANT EXECUTE ON FUNCTION public.complete_payment_plan_creation(uuid, uuid, uuid, text) TO anon, authenticated, service_role;