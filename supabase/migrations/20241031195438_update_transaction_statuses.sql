-- First, drop the existing constraint
ALTER TABLE transactions
DROP CONSTRAINT IF EXISTS transactions_status_check;

ALTER TABLE transactions
DROP CONSTRAINT IF EXISTS check_transaction_status;

-- Then update the statuses
UPDATE transactions
SET status = 'completed'
WHERE status = 'paid';

-- Finally, add the new constraint
ALTER TABLE transactions
ADD CONSTRAINT transactions_status_check 
CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled'));