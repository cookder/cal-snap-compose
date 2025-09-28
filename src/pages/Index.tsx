import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LogOut, User, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { EmailComposer } from "@/components/EmailComposer";
import GoogleCalendarView from "@/components/GoogleCalendarView";
import { GoogleAvailabilityGenerator } from "@/components/GoogleAvailabilityGenerator";
import { FeedbackForm } from "@/components/FeedbackForm";
import { CalendarInstructions } from "@/components/CalendarInstructions";
import { AvailableSlot } from "@/services/googleCalendarOAuth";
import { OAuthCredentials } from "@/services/googleOAuth";

const Index = () => {
  // Force cache invalidation - Google Calendar integration active
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [availability, setAvailability] = useState<AvailableSlot[]>([]);
  const [availabilityText, setAvailabilityText] = useState("");
  const [credentials, setCredentials] = useState<OAuthCredentials | null>(null);
  const [credentialsError, setCredentialsError] = useState<string | null>(null);
  const [showInstructions, setShowInstructions] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Fetch OAuth credentials from secrets via edge function
  useEffect(() => {
    const fetchCredentials = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-google-oauth-credentials');
        
        if (error) {
          throw error;
        }
        
        if (data?.clientId && data?.clientSecret) {
          setCredentials({
            clientId: data.clientId,
            clientSecret: data.clientSecret
          });
          setCredentialsError(null);
        } else {
          setCredentialsError("Google OAuth credentials not found. Please add GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET to your Supabase secrets.");
        }
      } catch (error) {
        console.error('Error fetching OAuth credentials:', error);
        setCredentialsError("Failed to load Google OAuth credentials. Please check your Supabase configuration.");
      }
    };

    if (user) {
      fetchCredentials();
    }
  }, [user]);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (!session) {
          navigate('/auth');
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (!session) {
        navigate('/auth');
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "Error signing out",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Signed out successfully",
      });
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/20 bg-card/30 backdrop-blur-xl">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/80 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-primary-foreground font-bold text-lg">C</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
                  Calendar AI
                </h1>
                <p className="text-sm text-muted-foreground">Intelligent scheduling assistant</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-2 text-sm bg-secondary/50 rounded-full px-3 py-2">
                <User className="h-4 w-4 text-primary" />
                <span className="text-muted-foreground">{user.email}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSignOut}
                className="flex items-center gap-2 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        {showInstructions && (
          <div className="mb-8">
            <CalendarInstructions onDismiss={() => setShowInstructions(false)} />
          </div>
        )}
        
        {credentialsError && (
          <div className="mb-8">
            <Alert variant="destructive" className="bg-destructive/10 border-destructive/20">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {credentialsError} Please check your Supabase secrets configuration.
              </AlertDescription>
            </Alert>
          </div>
        )}
        
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 auto-rows-min">
          {/* Google Calendar View */}
          <div className="lg:col-span-1">
            {credentials ? (
              <GoogleCalendarView 
                onAvailabilityChange={setAvailability} 
                credentials={credentials}
              />
            ) : (
              <div className="h-full flex items-center justify-center border-2 border-dashed border-border/50 rounded-xl bg-card/30">
                <div className="text-center text-muted-foreground p-8">
                  <AlertCircle className="h-8 w-8 mx-auto mb-3 text-primary/50" />
                  <p className="text-sm">Loading credentials...</p>
                </div>
              </div>
            )}
          </div>

          {/* Availability Text Generator */}
          <div className="xl:col-span-1">
            <GoogleAvailabilityGenerator 
              availability={availability}
              onTextGenerated={setAvailabilityText}
            />
          </div>

          {/* Email Composer */}
          <div className="xl:col-span-1">
            <EmailComposer 
              availabilityText={availabilityText}
              onInsertAvailability={() => {}}
            />
          </div>
        </div>
        
        {/* Feedback Section */}
        <div className="mt-12 flex justify-center">
          <FeedbackForm />
        </div>
      </main>
    </div>
  );
};

export default Index;
