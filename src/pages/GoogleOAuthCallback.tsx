import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import GoogleOAuthService, { OAuthCredentials } from '@/services/googleOAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';

const GoogleOAuthCallback = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    const run = async () => {
      console.log('OAuth callback processing started...');
      const params = new URLSearchParams(window.location.search);
      const error = params.get('error');
      const errorDescription = params.get('error_description');
      const code = params.get('code');

      console.log('OAuth callback params:', { 
        hasError: !!error, 
        hasCode: !!code, 
        error, 
        errorDescription 
      });

      if (error) {
        console.error('Google OAuth error received:', error, errorDescription);
        const errorMsg = errorDescription || error;
        setError(`Google authentication failed: ${errorMsg}`);
        
        toast({
          title: 'Google Authentication Failed',
          description: errorMsg,
          variant: 'destructive',
        });
        setIsProcessing(false);
        return;
      }

      if (!code) {
        console.log('No authorization code found, redirecting to home...');
        navigate('/');
        return;
      }

      try {
        console.log('Fetching OAuth credentials from Supabase...');
        
        // Fetch OAuth credentials
        const { data, error } = await supabase.functions.invoke('get-google-oauth-credentials');
        if (error || !data?.clientId || !data?.clientSecret) {
          throw new Error('Missing Google OAuth credentials from server');
        }

        console.log('OAuth credentials retrieved successfully');
        
        const creds: OAuthCredentials = { clientId: data.clientId, clientSecret: data.clientSecret };
        const oauth = new GoogleOAuthService(creds);

        console.log('Starting token exchange...');
        // Exchange code and persist tokens
        const tokens = await oauth.exchangeCodeForTokens(code);
        oauth.saveTokens(tokens);

        console.log('Google Calendar connection successful!');
        toast({ 
          title: 'Connected to Google Calendar',
          description: 'You can now view your calendar availability.'
        });
        
        // Clean up URL and go back to home after a short delay
        setTimeout(() => {
          window.history.replaceState({}, document.title, window.location.pathname);
          navigate('/');
        }, 1500);
        
      } catch (e: any) {
        console.error('OAuth callback processing failed:', e);
        const errorMsg = e?.message || 'Failed to complete Google authentication';
        setError(errorMsg);
        
        toast({
          title: 'Authentication Error',
          description: errorMsg,
          variant: 'destructive',
        });
        setIsProcessing(false);
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.title = 'Google OAuth Callback | Scheduler';
  }, []);

  const handleRetry = () => {
    window.history.replaceState({}, document.title, window.location.pathname);
    navigate('/');
  };

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-2">
              <AlertCircle className="h-12 w-12 text-destructive" />
            </div>
            <CardTitle className="text-destructive">Authentication Failed</CardTitle>
            <CardDescription>
              There was a problem connecting to Google Calendar
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
              {error}
            </p>
            <Button onClick={handleRetry} className="w-full">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2">
            {isProcessing ? (
              <RefreshCw className="h-12 w-12 text-primary animate-spin" />
            ) : (
              <CheckCircle className="h-12 w-12 text-green-600" />
            )}
          </div>
          <CardTitle>
            {isProcessing ? 'Connecting to Google Calendar' : 'Connection Successful'}
          </CardTitle>
          <CardDescription>
            {isProcessing 
              ? 'Please wait while we complete your authentication...' 
              : 'Redirecting you back to the application...'
            }
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
};

export default GoogleOAuthCallback;
