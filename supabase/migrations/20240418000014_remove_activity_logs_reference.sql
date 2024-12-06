-- Update publish_activity function to remove activity_logs reference
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

  RETURN v_event_id;
END;
$$;
