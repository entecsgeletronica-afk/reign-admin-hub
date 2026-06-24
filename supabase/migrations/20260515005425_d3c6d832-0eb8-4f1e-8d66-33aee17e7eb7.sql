-- Ensure profiles has RLS enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Allow admins to see all profiles
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profiles' AND policyname = 'Admins can view all profiles'
    ) THEN
        CREATE POLICY "Admins can view all profiles" 
        ON public.profiles 
        FOR SELECT 
        USING (
            EXISTS (
                SELECT 1 FROM user_roles 
                WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
            )
        );
    END IF;
END $$;

-- Allow users to see their own profile
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profiles' AND policyname = 'Users can view their own profile'
    ) THEN
        CREATE POLICY "Users can view their own profile" 
        ON public.profiles 
        FOR SELECT 
        USING (auth.uid() = user_id);
    END IF;
END $$;
