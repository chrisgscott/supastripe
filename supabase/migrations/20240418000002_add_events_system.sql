-- Enable the pgcrypto extension for UUID generation if not already enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create an events table to track all system events
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  customer_id UUID REFERENCES customers(id)
);

-- Enable row level security
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to view their own events
CREATE POLICY "Users can view their own events"
  ON events FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Create policy to allow system to insert events
CREATE POLICY "System can insert events"
  ON events FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Add indices for events table
CREATE INDEX IF NOT EXISTS events_user_created_idx ON events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS events_customer_created_idx ON events (customer_id, created_at DESC) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS events_entity_idx ON events (entity_type, entity_id);

-- Function to publish an activity event
CREATE OR REPLACE FUNCTION publish_activity(
  p_event_type TEXT,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_user_id UUID,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_customer_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event_id UUID;
BEGIN
  -- Insert the event
  INSERT INTO events (
    event_type,
    entity_type,
    entity_id,
    user_id,
    metadata,
    customer_id
  ) VALUES (
    p_event_type,
    p_entity_type,
    p_entity_id,
    p_user_id,
    p_metadata,
    p_customer_id
  )
  RETURNING id INTO v_event_id;

  -- Insert into activity_logs for backward compatibility
  INSERT INTO activity_logs (
    user_id,
    activity_type,
    entity_type,
    entity_id,
    metadata,
    customer_name
  )
  SELECT
    p_user_id,
    p_event_type,
    p_entity_type,
    p_entity_id,
    p_metadata,
    c.name
  FROM customers c
  WHERE c.id = p_customer_id;

  RETURN v_event_id;
END;
$$;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION publish_activity TO authenticated;

-- Enable realtime for the events table
ALTER PUBLICATION supabase_realtime ADD TABLE events;
