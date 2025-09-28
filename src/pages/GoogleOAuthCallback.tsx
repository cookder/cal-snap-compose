import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import GoogleOAuthService, { OAuthCredentials } from '@/services/googleOAuth';
import { useToast } from '@/hooks/use-toast';

const GoogleOAuthCallback = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const run = async () => {
      const params = new URLSearchParams(window.location.search);
      const error = params.get('error');
      const errorDescription = params.get('error_description');
      const code = params.get('code');

      if (error) {
        console.error('Google OAuth error:', error, errorDescription);
        toast({
          title: 'Google authentication failed',
          description: errorDescription || error,
          variant: 'destructive',
        });
        // Clean URL then return to home
        window.history.replaceState({}, document.title, window.location.pathname);
        navigate('/');
        return;
      }

      if (!code) {
        navigate('/');
        return;
      }

      try {
        // Fetch OAuth credentials
        const { data, error } = await supabase.functions.invoke('get-google-oauth-credentials');
        if (error || !data?.clientId || !data?.clientSecret) {
          throw new Error('Missing Google OAuth credentials');
        }

        const creds: OAuthCredentials = { clientId: data.clientId, clientSecret: data.clientSecret };
        const oauth = new GoogleOAuthService(creds);

        // Exchange code and persist tokens
        const tokens = await oauth.exchangeCodeForTokens(code);
        oauth.saveTokens(tokens);

        toast({ title: 'Connected to Google Calendar' });
      } catch (e: any) {
        console.error('OAuth callback handling failed:', e);
        toast({
          title: 'Authentication error',
          description: e?.message || 'Failed to complete Google authentication',
          variant: 'destructive',
        });
      } finally {
        // Clean up URL and go back to home
        window.history.replaceState({}, document.title, window.location.pathname);
        navigate('/');
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Simple minimal UI
  useEffect(() => {
    document.title = 'Google OAuth Callback | Scheduler';
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        <p className="mt-2 text-muted-foreground text-sm">Completing Google sign-in…</p>
      </div>
    </div>
  );
};

export default GoogleOAuthCallback;
