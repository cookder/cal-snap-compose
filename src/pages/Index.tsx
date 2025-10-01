import { useState, useEffect, Suspense, lazy, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LogOut, User, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { AvailableSlot, TimeSlot } from "@/services/googleCalendarOAuth";
import { OAuthCredentials } from "@/services/googleOAuth";

// Lazy load components
const EmailComposer = lazy(() => import("@/components/EmailComposer").then(module => ({ default: module.EmailComposer })));
const GoogleCalendarView = lazy(() => import("@/components/GoogleCalendarView"));
const GoogleAvailabilityGenerator = lazy(() => import("@/components/GoogleAvailabilityGenerator").then(module => ({ default: module.GoogleAvailabilityGenerator })));
const FeedbackForm = lazy(() => import("@/components/FeedbackForm").then(module => ({ default: module.FeedbackForm })));
const CalendarInstructions = lazy(() => import("@/components/CalendarInstructions").then(module => ({ default: module.CalendarInstructions })));
const ICSImporter = lazy(() => import("@/components/ICSImporter").then(module => ({ default: module.ICSImporter })));
const ICSCalendarView = lazy(() => import("@/components/ICSCalendarView").then(module => ({ default: module.ICSCalendarView })));

const Index = () => {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  
  // Separate state for each calendar source
  const [googleSelectedSlots, setGoogleSelectedSlots] = useState<{ date: Date; slots: TimeSlot[] }[]>([]);
  const [icsSelectedSlots, setIcsSelectedSlots] = useState<{ date: Date; slots: TimeSlot[] }[]>([]);
  
  const [showGoogleCalendar, setShowGoogleCalendar] = useState(true);
  const [showICSCalendar, setShowICSCalendar] = useState(true);
  const [availabilityText, setAvailabilityText] = useState("");
  const [credentials, setCredentials] = useState<OAuthCredentials | null>(null);
  const [credentialsError, setCredentialsError] = useState<string | null>(null);
  const [showInstructions, setShowInstructions] = useState(true);
  const [importedEvents, setImportedEvents] = useState<any[]>([]);
  
  const navigate = useNavigate();
  const { toast } = useToast();

  // Combine slots from both calendars
  const combinedSelectedSlots = useCallback(() => {
    const allSlots = [...googleSelectedSlots, ...icsSelectedSlots];
    
    // Merge slots by date
    const slotsByDate = new Map<string, TimeSlot[]>();
    
    allSlots.forEach(({ date, slots }) => {
      const dateKey = date.toISOString().split('T')[0];
      const existing = slotsByDate.get(dateKey) || [];
      slotsByDate.set(dateKey, [...existing, ...slots]);
    });
    
    // Convert back to array format
    return Array.from(slotsByDate.entries()).map(([dateStr, slots]) => ({
      date: new Date(dateStr),
      slots: slots
    }));
  }, [googleSelectedSlots, icsSelectedSlots]);

  // Fetch OAuth credentials
  useEffect(() => {
    const fetchCredentials = async () => {
      if (!user) return;
      
      try {
        const { data, error } = await supabase.functions.invoke('get-google-oauth-credentials');
        
        if (error) throw error;
        
        if (data?.clientId && data?.clientSecret) {
          setCredentials({
            clientId: data.clientId,
            clientSecret: data.clientSecret
          });
          setCredentialsError(null);
        } else {
          setCredentialsError("Google OAuth credentials not found.");
        }
      } catch (error) {
        console.error('Error fetching OAuth credentials:', error);
        setCredentialsError("Failed to load Google OAuth credentials.");
      }
    };

    fetchCredentials();
  }, [user]);

  // Auth state management
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (!session) {
          navigate('/auth');
        }
      }
    );

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
    try {
      await supabase.auth.signOut();
    } catch (e) {
      // Ignore errors
    }

    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (e) {
      // Ignore errors
    }

    // Clear local storage
    try {
      const projectRef = 'zlrratamkejbxlzmhkyr';
      const keys = Object.keys(localStorage);
      for (const k of keys) {
        if (k.startsWith(`sb-${projectRef}-`) || k.startsWith('supabase.auth.token')) {
          localStorage.removeItem(k);
        }
      }
    } catch (e) {
      // Ignore errors
    }

    setUser(null);
    setSession(null);
    toast({ title: "Signed out successfully" });
    navigate('/auth', { replace: true });
  };

  const handleEventsImported = useCallback((events: any[]) => {
    setImportedEvents(events);
    toast({
      title: "Events imported successfully",
      description: `Imported ${events.length} events from ICS file`,
    });
  }, [toast]);

  const handleClearImportedEvents = useCallback(() => {
    setImportedEvents([]);
    setIcsSelectedSlots([]);
    setShowICSCalendar(true);
    toast({
      title: "Imported events cleared",
    });
  }, [toast]);

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
              <AlertDescription>{credentialsError}</AlertDescription>
            </Alert>
          </div>
        )}
        
        <div className="grid gap-2 grid-cols-1 lg:grid-cols-5">
          {/* Google Calendar View */}
          {showGoogleCalendar && (
            <div className="lg:col-span-1">
              {credentials ? (
                <Suspense fallback={<div className="h-96 bg-muted animate-pulse rounded-lg" />}>
                  <GoogleCalendarView 
                    onAvailabilityChange={() => {}} // Not used anymore
                    onSelectedSlotsChange={setGoogleSelectedSlots}
                    credentials={credentials}
                    onTogglePanel={() => setShowGoogleCalendar(false)}
                    showToggle={showICSCalendar || importedEvents.length > 0}
                  />
                </Suspense>
              ) : (
                <div className="h-full flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg">
                  <div className="text-center text-muted-foreground">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                    <p className="text-sm">Waiting for credentials...</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ICS Calendar View */}
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
                    onAvailabilityChange={() => {}} // Not used anymore
                    onSelectedSlotsChange={setIcsSelectedSlots}
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
                className="w-full h-12 border-dashed border-2"
              >
                Show Google Calendar
              </Button>
            </div>
          )}
          
          {!showICSCalendar && importedEvents.length > 0 && (
            <div className="lg:col-span-1 flex items-start">
              <Button
                variant="outline"
                onClick={() => setShowICSCalendar(true)}
                className="w-full h-12 border-dashed border-2"
              >
                Show ICS Calendar
              </Button>
            </div>
          )}

          {/* Text Generator and Email Composer */}
          <div className={`lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)] ${
            (showGoogleCalendar || showICSCalendar) 
              ? 'lg:col-span-3' 
              : 'lg:col-span-5'
          }`}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 h-full">
              <div className="h-full">
                <Suspense fallback={<div className="h-96 bg-muted animate-pulse rounded-lg" />}>
                  <GoogleAvailabilityGenerator 
                    selectedSlots={combinedSelectedSlots()}
                    onTextGenerated={setAvailabilityText}
                  />
                </Suspense>
              </div>

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
        
        {/* Feedback */}
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