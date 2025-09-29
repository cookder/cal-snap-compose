import { useState, useEffect, Suspense, lazy } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { LogOut, User, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { toast } from 'sonner';
import { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { AvailableSlot, TimeSlot } from "@/services/googleCalendarOAuth";
import { OAuthCredentials } from "@/services/googleOAuth";

// Lazy load components for better performance
const EmailComposer = lazy(() => import("@/components/EmailComposer").then(module => ({ default: module.EmailComposer })));
const GoogleCalendarView = lazy(() => import("@/components/GoogleCalendarView"));
const GoogleAvailabilityGenerator = lazy(() => import("@/components/GoogleAvailabilityGenerator").then(module => ({ default: module.GoogleAvailabilityGenerator })));
const FeedbackForm = lazy(() => import("@/components/FeedbackForm").then(module => ({ default: module.FeedbackForm })));
const CalendarInstructions = lazy(() => import("@/components/CalendarInstructions").then(module => ({ default: module.CalendarInstructions })));
const ICSImporter = lazy(() => import("@/components/ICSImporter").then(module => ({ default: module.ICSImporter })));
const ICSCalendarView = lazy(() => import("@/components/ICSCalendarView").then(module => ({ default: module.ICSCalendarView })));

const Index = () => {
  // Force cache invalidation - Google Calendar integration active
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [availability, setAvailability] = useState<AvailableSlot[]>([]);
  const [selectedSlots, setSelectedSlots] = useState<{ date: Date; slots: TimeSlot[] }[]>([]);
  const [showGoogleCalendar, setShowGoogleCalendar] = useState(true);
  const [showICSCalendar, setShowICSCalendar] = useState(true);
  const [availabilityText, setAvailabilityText] = useState("");
  const [credentials, setCredentials] = useState<OAuthCredentials | null>(null);
  const [credentialsError, setCredentialsError] = useState<string | null>(null);
  const [showInstructions, setShowInstructions] = useState(true);
  const [importedEvents, setImportedEvents] = useState<any[]>([]);
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
    // Robust sign out: try global, then local, then hard-clear client tokens
    try {
      await supabase.auth.signOut(); // global
    } catch (e) {
      // ignore server session_not_found
    }

    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (e) {
      // ignore local errors (seen as 403 when server session is gone)
    }

    // Hard clear any persisted Supabase auth tokens for this project (desktop fix)
    try {
      const projectRef = 'zlrratamkejbxlzmhkyr';
      const keys = Object.keys(localStorage);
      for (const k of keys) {
        if (k.startsWith(`sb-${projectRef}-`) || k.startsWith('supabase.auth.token')) {
          localStorage.removeItem(k);
        }
      }
    } catch (e) {
      // no-op
    }

    setUser(null);
    setSession(null);
    toast({ title: "Signed out successfully" });
    navigate('/auth', { replace: true });
  };

  const handleSelectedSlotsChange = (slots: { date: Date; slots: TimeSlot[] }[]) => {
    setSelectedSlots(slots);
  };

  const handleEventsImported = (events: any[]) => {
    setImportedEvents(events);
    toast({
      title: "Events imported successfully",
      description: `Imported ${events.length} events from ICS file`,
    });
  };

  const handleClearImportedEvents = () => {
    setImportedEvents([]);
    setAvailability([]); // Clear availability when clearing events
    setSelectedSlots([]); // Clear selected slots when clearing events
    setShowICSCalendar(true); // Show ICS panel again when cleared
    toast({
      title: "Imported events cleared",
    });
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
        <div className="container mx-auto px-2 py-2">
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
      <main className="container mx-auto px-2 py-2">
        {showInstructions && (
          <div className="mb-2">
            <Suspense fallback={<div className="h-16 bg-muted animate-pulse rounded-lg" />}>
              <CalendarInstructions onDismiss={() => setShowInstructions(false)} />
            </Suspense>
          </div>
        )}
        
        {credentialsError && (
          <div className="mb-2">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {credentialsError} Please check your Supabase secrets configuration.
              </AlertDescription>
            </Alert>
          </div>
        )}
        
        <div className={`grid gap-2 ${
          (showGoogleCalendar && showICSCalendar) || (!showGoogleCalendar && !showICSCalendar)
            ? 'grid-cols-1 lg:grid-cols-5' 
            : 'grid-cols-1 lg:grid-cols-4'
        }`}>
          {/* Google Calendar View */}
          {showGoogleCalendar && (
            <div className="lg:col-span-1">
              {credentials ? (
                <Suspense fallback={<div className="h-96 bg-muted animate-pulse rounded-lg" />}>
                  <GoogleCalendarView 
                    onAvailabilityChange={setAvailability} 
                    onSelectedSlotsChange={handleSelectedSlotsChange}
                    credentials={credentials}
                    onTogglePanel={() => setShowGoogleCalendar(false)}
                    showToggle={showICSCalendar || importedEvents.length > 0}
                  />
                </Suspense>
              ) : (
                <div className="h-full flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg">
                  <div className="text-center text-muted-foreground">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                    <p className="text-sm">Waiting for Google OAuth credentials...</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ICS Import and Calendar View */}
          {showICSCalendar && (
            <div className="lg:col-span-1">
              {importedEvents.length === 0 ? (
                <Suspense fallback={<div className="h-96 bg-muted animate-pulse rounded-lg" />}>
                  <ICSImporter onEventsImported={handleEventsImported} />
                </Suspense>
              ) : (
                <Suspense fallback={<div className="h-96 bg-muted animate-pulse rounded-lg" />}>
                  <ICSCalendarView 
                    events={importedEvents}
                    onAvailabilityChange={setAvailability}
                    onSelectedSlotsChange={handleSelectedSlotsChange}
                    onClearEvents={handleClearImportedEvents}
                    onTogglePanel={() => setShowICSCalendar(false)}
                    showToggle={showGoogleCalendar}
                  />
                </Suspense>
              )}
            </div>
          )}

          {/* Hidden Panel Toggles */}
          {!showGoogleCalendar && (
            <div className="lg:col-span-1 flex items-start">
              <Button
                variant="outline"
                onClick={() => setShowGoogleCalendar(true)}
                className="w-full h-12 border-dashed border-2 text-muted-foreground hover:text-foreground"
              >
                Show Google Calendar
              </Button>
            </div>
          )}
          
          {!showICSCalendar && (
            <div className="lg:col-span-1 flex items-start">
              <Button
                variant="outline"
                onClick={() => setShowICSCalendar(true)}
                className="w-full h-12 border-dashed border-2 text-muted-foreground hover:text-foreground"
              >
                Show ICS Calendar
              </Button>
            </div>
          )}

          {/* Sticky Container for Text Generator and Email Composer */}
          <div className={`lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)] lg:overflow-hidden ${
            showGoogleCalendar || showICSCalendar ? 'lg:col-span-3' : 'hidden'
          }`}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 h-full">
              {/* Availability Text Generator */}
              <div className="h-full">
                <Suspense fallback={<div className="h-96 bg-muted animate-pulse rounded-lg" />}>
                  <GoogleAvailabilityGenerator 
                    selectedSlots={selectedSlots}
                    onTextGenerated={setAvailabilityText}
                  />
                </Suspense>
              </div>

              {/* Email Composer */}
              <div className="h-full">
                <Suspense fallback={<div className="h-96 bg-muted animate-pulse rounded-lg" />}>
                  <EmailComposer 
                    availabilityText={availabilityText}
                    onInsertAvailability={() => {}}
                  />
                </Suspense>
              </div>
            </div>
          </div>
        </div>
        
        {/* Feedback Section */}
        <div className="mt-2 flex justify-center">
          <Suspense fallback={<div className="h-32 w-96 bg-muted animate-pulse rounded-lg" />}>
            <FeedbackForm />
          </Suspense>
        </div>
      </main>
    </div>
  );
};

export default Index;
