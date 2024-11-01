-- First, clean up any orphaned payment processing logs
DELETE FROM payment_processing_logs
WHERE transaction_id IN (
    SELECT t.id FROM transactions t
    WHERE t.payment_plan_id IS NOT NULL 
    AND t.payment_plan_id NOT IN (SELECT id FROM payment_plans)
);

-- Then clean up orphaned transactions
DELETE FROM transactions 
WHERE payment_plan_id IS NOT NULL 
AND payment_plan_id NOT IN (SELECT id FROM payment_plans);

-- Add the foreign key constraint
ALTER TABLE transactions 
ADD CONSTRAINT fk_payment_plan 
FOREIGN KEY (payment_plan_id) 
REFERENCES payment_plans(id) 
ON DELETE CASCADE;

-- Add index for performance
CREATE INDEX idx_transactions_payment_plan_id 
ON transactions(payment_plan_id);