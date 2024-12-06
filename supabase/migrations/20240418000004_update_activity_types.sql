-- Update activity_type enum to include all needed types

-- Create a temporary type with all values
CREATE TYPE public.activity_type_new AS ENUM (
    'payment_method_updated',
    'payment_success',
    'payment_failed',
    'plan_created',
    'plan_updated',
    'plan_payment_link_sent',
    'plan_payment_reminder_sent',
    'plan_payment_confirmation_sent',
    'email_sent',
    'plan_activated',
    'plan_completed',
    'plan_cancelled',
    'payout_scheduled',
    'payout_paid',
    'payout_failed'
);

-- Drop the old type (this will cascade to dependent objects)
DROP TYPE public.activity_type CASCADE;

-- Rename the new type to the original name
ALTER TYPE public.activity_type_new RENAME TO activity_type;

-- Recreate the convert_activity_type function
CREATE OR REPLACE FUNCTION public.text_to_activity_type(p_text text)
RETURNS public.activity_type
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE NOTICE 'Attempting to convert text to activity_type: %', p_text;
    RETURN p_text::activity_type;
EXCEPTION
    WHEN invalid_text_representation THEN
        RAISE NOTICE 'Invalid activity type: %. Defaulting to email_sent', p_text;
        RETURN 'email_sent'::activity_type;
END;
$$;
