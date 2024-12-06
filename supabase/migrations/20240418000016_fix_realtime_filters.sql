-- Drop the old realtime publication
DROP PUBLICATION IF EXISTS supabase_realtime;

-- Create a new publication with proper filter handling
CREATE PUBLICATION supabase_realtime FOR TABLE events
WITH (publish = 'insert');

-- Update RLS policies to handle filtering
DROP POLICY IF EXISTS "Users can view their own events" ON events;
CREATE POLICY "Users can view their own events"
ON events FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() AND
  (
    customer_id IS NULL OR
    customer_id IN (
      SELECT id FROM customers WHERE user_id = auth.uid()
    )
  )
);
