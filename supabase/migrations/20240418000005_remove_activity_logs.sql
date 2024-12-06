-- Drop the old activity_logs table and related functions
DROP TABLE IF EXISTS public.activity_logs;

-- Drop any related functions
DROP FUNCTION IF EXISTS public.create_activity_log;
DROP FUNCTION IF EXISTS public.get_activity_logs;
