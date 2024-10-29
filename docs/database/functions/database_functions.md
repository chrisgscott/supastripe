Here are our database functions. This first one is on submission of the plan details form. It creates the necessary database items and sets the plan_creation_status to pending, since these database items shouldn't be considered complete until after a successful payment confirmation.

CREATE OR REPLACE FUNCTION create_payment_plan_step1(
  p_customer_name TEXT,
  p_customer_email TEXT,
  p_user_id UUID,
  p_total_amount INTEGER,
  p_number_of_payments INTEGER,
  p_payment_interval TEXT,
  p_downpayment_amount INTEGER,
  p_payment_schedule JSONB,
  p_stripe_customer_id TEXT,
  p_idempotency_key UUID
) RETURNS JSONB AS $$
DECLARE
  v_customer_id UUID;
  v_payment_plan_id UUID;
  v_transaction JSONB;
  v_first_transaction_id UUID;
BEGIN
  -- Set the function name for RLS policies
  PERFORM set_config('my.function_name', 'create_payment_plan_step1', TRUE);

  -- Create customer
  INSERT INTO customers (name, email, user_id, stripe_customer_id, plan_creation_status)
  VALUES (p_customer_name, p_customer_email, p_user_id, p_stripe_customer_id, 'pending')
  RETURNING id INTO v_customer_id;

  -- Create payment plan
  INSERT INTO payment_plans (
    customer_id, user_id, total_amount, number_of_payments, 
    payment_interval, downpayment_amount, status, plan_creation_status, idempotency_key
  )
  VALUES (
    v_customer_id, p_user_id, p_total_amount, p_number_of_payments,
    p_payment_interval, p_downpayment_amount, 'created', 'pending', p_idempotency_key
  )
  RETURNING id INTO v_payment_plan_id;

  -- Create transactions
  FOR v_transaction IN SELECT * FROM jsonb_array_elements(p_payment_schedule)
  LOOP
    INSERT INTO transactions (
      payment_plan_id, user_id, amount, due_date, is_downpayment, plan_creation_status, status
    )
    VALUES (
      v_payment_plan_id,
      p_user_id,
      (v_transaction->>'amount')::INTEGER,
      (v_transaction->>'date')::DATE,
      (v_transaction->>'is_downpayment')::BOOLEAN,
      'pending',
      'pending'
    )
    RETURNING id INTO v_first_transaction_id;

    IF (v_transaction->>'is_downpayment')::BOOLEAN THEN
      EXIT;  -- Exit after creating the first transaction (downpayment or first installment)
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'customer_id', v_customer_id,
    'payment_plan_id', v_payment_plan_id,
    'first_transaction_id', v_first_transaction_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


Now, on submitting the payment details, we perform all of our stripe functions and, if everything is successful, update our database items with this database function:

CREATE OR REPLACE FUNCTION complete_payment_plan_creation(
  p_payment_plan_id UUID,
  p_stripe_payment_intent_id TEXT,
  p_idempotency_key UUID
) RETURNS VOID AS $$
DECLARE
  v_transaction_id UUID;
BEGIN
  -- Update payment plan status
  UPDATE payment_plans
  SET status = 'active', plan_creation_status = 'completed'
  WHERE id = p_payment_plan_id;

  -- Update customer status
  UPDATE customers
  SET plan_creation_status = 'completed'
  WHERE id = (SELECT customer_id FROM payment_plans WHERE id = p_payment_plan_id);

  -- Get the transaction ID for the downpayment
  SELECT id INTO v_transaction_id
  FROM transactions
  WHERE payment_plan_id = p_payment_plan_id AND is_downpayment = true;

  -- Update transaction status for the first transaction
  UPDATE transactions
  SET status = 'paid', plan_creation_status = 'completed', stripe_payment_intent_id = p_stripe_payment_intent_id
  WHERE id = v_transaction_id;

  -- Insert a record into payment_processing_logs
  INSERT INTO payment_processing_logs (transaction_id, payment_plan_id, stripe_payment_intent_id, status, idempotency_key)
  VALUES (v_transaction_id, p_payment_plan_id, p_stripe_payment_intent_id, 'succeeded', p_idempotency_key);
END;
$$ LANGUAGE plpgsql;

Every 24 hours, we clean out any pending plans with this database function:

CREATE OR REPLACE FUNCTION cleanup_pending_plans(older_than TIMESTAMP)
RETURNS void AS $$
BEGIN
  -- Delete pending transactions
  DELETE FROM transactions
  WHERE plan_creation_status = 'pending'
  AND created_at < older_than;

  -- Delete pending payment plans
  DELETE FROM payment_plans
  WHERE plan_creation_status = 'pending'
  AND created_at < older_than;

  -- Update customers with no associated payment plans
  UPDATE customers
  SET plan_creation_status = 'failed'
  WHERE plan_creation_status = 'pending'
  AND id NOT IN (SELECT DISTINCT customer_id FROM payment_plans);
END;
$$ LANGUAGE plpgsql;


