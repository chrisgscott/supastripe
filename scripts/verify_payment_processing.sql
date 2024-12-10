-- Replace [payment_intent_id] with your test payment intent ID
WITH payment_verification AS (
  SELECT 
    COUNT(*) as transaction_count,
    COUNT(DISTINCT id) as unique_transaction_count,
    COUNT(DISTINCT stripe_payment_intent_id) as unique_payment_intent_count
  FROM transactions 
  WHERE stripe_payment_intent_id = '[payment_intent_id]'
),
event_verification AS (
  SELECT 
    COUNT(*) as event_count,
    COUNT(DISTINCT id) as unique_event_count,
    array_agg(DISTINCT event_type) as event_types
  FROM events 
  WHERE metadata->>'payment_intent_id' = '[payment_intent_id]'
),
pending_verification AS (
  SELECT COUNT(*) as pending_count
  FROM pending_transactions 
  WHERE stripe_payment_intent_id = '[payment_intent_id]'
)
SELECT 
  pv.transaction_count,
  pv.unique_transaction_count,
  pv.unique_payment_intent_count,
  ev.event_count,
  ev.unique_event_count,
  ev.event_types,
  pndv.pending_count
FROM 
  payment_verification pv,
  event_verification ev,
  pending_verification pndv;
