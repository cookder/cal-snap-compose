-- Fix security vulnerability: Remove anonymous access to feedback table
-- This prevents unauthorized users from viewing customer emails and feedback messages

-- Drop the current insecure policy
DROP POLICY IF EXISTS "Users can view their own feedback" ON public.feedback;

-- Create a secure policy that only allows authenticated users to view their own feedback
CREATE POLICY "Users can view their own feedback" 
ON public.feedback 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

-- Ensure the feedback table has RLS enabled (should already be enabled)
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;