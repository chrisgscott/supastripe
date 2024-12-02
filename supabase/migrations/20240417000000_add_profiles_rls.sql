-- Enable RLS on profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Add policy for users to manage their own profile
CREATE POLICY "Users can manage own profile" 
    ON public.profiles 
    FOR ALL 
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Allow service role to manage all profiles
CREATE POLICY "Service role can manage all profiles"
    ON public.profiles
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
