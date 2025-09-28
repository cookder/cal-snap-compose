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
      <header className="border-b bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gmail-blue rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-sm">G</span>
              </div>
              <div>
                <h1 className="text-xl font-semibold">Google Calendar Scheduler</h1>
                <p className="text-sm text-muted-foreground">Find available time slots and generate scheduling text</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4" />
                <span className="text-muted-foreground">{user.email}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSignOut}
                className="flex items-center gap-2"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {showInstructions && (
          <CalendarInstructions onDismiss={() => setShowInstructions(false)} />
        )}
        
        {credentialsError && (
          <div className="mb-6">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {credentialsError} Please check your Supabase secrets configuration.
              </AlertDescription>
            </Alert>
          </div>
        )}
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-180px)]">
          {/* Google Calendar View */}
          <div className="lg:col-span-1">
            {credentials ? (
              <GoogleCalendarView 
                onAvailabilityChange={setAvailability} 
                credentials={credentials}
              />
            ) : (
              <div className="h-full flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg">
                <div className="text-center text-muted-foreground">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                  <p className="text-sm">Waiting for Google OAuth credentials...</p>
                </div>
              </div>
            )}
          </div>

          {/* Availability Text Generator */}
          <div className="lg:col-span-1">
            <GoogleAvailabilityGenerator 
              availability={availability}
              onTextGenerated={setAvailabilityText}
            />
          </div>

          {/* Email Composer */}
          <div className="lg:col-span-1">
            <EmailComposer 
              availabilityText={availabilityText}
              onInsertAvailability={() => {}}
            />
          </div>
        </div>
        
        {/* Feedback Section */}
        <div className="mt-8 flex justify-center">
          <FeedbackForm />
        </div>
      </main>
    </div>
  );
};

export default Index;
