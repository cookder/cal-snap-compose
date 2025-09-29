import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Calendar as CalendarIcon, Clock, CheckCircle, LogOut, LogIn, RefreshCw } from 'lucide-react';
import { format, isSameDay, isToday, isTomorrow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import GoogleCalendarOAuthService, { AvailableSlot, CalendarEvent, TimeSlot } from '@/services/googleCalendarOAuth';
import GoogleOAuthService, { OAuthCredentials } from '@/services/googleOAuth';
import { TimeSlotDisplay } from '@/components/ICSCalendarViewTimeSlots';

// Type adapter for Google Calendar events to match ICS component interface
interface AdaptedCalendarEvent {
  id: string;
  summary: string;
  start: Date;
  end: Date;
}

interface GoogleCalendarViewProps {
  onAvailabilityChange: (availability: AvailableSlot[]) => void;
  onSelectedSlotsChange: (selectedSlots: { date: Date; slots: TimeSlot[] }[]) => void;
  credentials: OAuthCredentials | null;
  onTogglePanel?: () => void;
  showToggle?: boolean;
}

const GoogleCalendarView: React.FC<GoogleCalendarViewProps> = ({ onAvailabilityChange, onSelectedSlotsChange, credentials, onTogglePanel, showToggle }) => {
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [events, setEvents] = useState<{ [key: string]: CalendarEvent[] }>({});
  const [availability, setAvailability] = useState<AvailableSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slotDuration, setSlotDuration] = useState<30 | 60 | 'both' | 'custom'>(30);
  const [customDuration, setCustomDuration] = useState<number>(15);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [calendarService, setCalendarService] = useState<GoogleCalendarOAuthService | null>(null);
  const [oauthService, setOauthService] = useState<GoogleOAuthService | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (credentials) {
      const oauth = new GoogleOAuthService(credentials);
      const calendar = new GoogleCalendarOAuthService(credentials);
      setOauthService(oauth);
      setCalendarService(calendar);
      
      // Check if already authenticated
      checkAuthStatus(oauth);
      
      // Check for OAuth success flag (mobile compatibility)
      const oauthSuccess = localStorage.getItem('google_oauth_success');
      if (oauthSuccess === 'true') {
        localStorage.removeItem('google_oauth_success');
        setIsAuthenticated(true);
        setError(null);
        toast({
          title: "Connected!",
          description: "Successfully connected to Google Calendar.",
        });
      }
      
      // Check for OAuth error (mobile compatibility)
      const oauthError = localStorage.getItem('google_oauth_error');
      if (oauthError) {
        localStorage.removeItem('google_oauth_error');
        setError(oauthError);
        toast({
          title: "Authentication Failed",
          description: oauthError,
          variant: "destructive",
        });
      }
    }
  }, [credentials, toast]);

  const checkAuthStatus = async (oauth: GoogleOAuthService) => {
    try {
      const accessToken = await oauth.getValidAccessToken();
      setIsAuthenticated(!!accessToken);
    } catch (error) {
      console.error('Error checking auth status:', error);
      setIsAuthenticated(false);
    }
  };


  // Toggle slot selection
  const toggleSlotSelection = (slotId: string) => {
    setAvailability(prev => {
      const updated = prev.map(daySlot => ({
        ...daySlot,
        slots: daySlot.slots.map(slot => 
          slot.id === slotId ? { ...slot, selected: !slot.selected } : slot
        )
      }));
      
      // Update selected slots callback
      const selectedSlots = updated.map(daySlot => ({
        date: daySlot.date,
        slots: daySlot.slots.filter(slot => slot.selected)
      })).filter(daySlot => daySlot.slots.length > 0);
      
      onSelectedSlotsChange(selectedSlots);
      
      return updated;
    });
  };

  const handleGoogleLogin = () => {
    if (oauthService) {
      console.log('Initiating Google Calendar authentication...');
      console.log('User agent:', navigator.userAgent);
      console.log('Is mobile:', /Mobi|Android/i.test(navigator.userAgent));
      
      const authUrl = oauthService.getAuthUrl();
      console.log('Redirecting to Google OAuth:', authUrl);
      
      // Clear any previous OAuth state
      localStorage.removeItem('google_oauth_success');
      localStorage.removeItem('google_oauth_error');
      
      // For mobile browsers, use a more reliable redirect method
      if (/Mobi|Android/i.test(navigator.userAgent)) {
        console.log('Using mobile-optimized redirect...');
        // Use replace instead of href for better mobile compatibility
        window.location.replace(authUrl);
      } else {
        window.location.href = authUrl;
      }
    }
  };

  const handleGoogleLogout = () => {
    if (oauthService) {
      oauthService.clearTokens();
      setIsAuthenticated(false);
      setSelectedDates([]);
      setEvents({});
      setAvailability([]);
      onAvailabilityChange([]);
      toast({
        title: "Disconnected",
        description: "Successfully disconnected from Google Calendar.",
      });
    }
  };

// Helper function to generate slots for a specific duration
  const generateSlotsForDurationAsync = async (
    selectedDates: Date[], 
    duration: number
  ): Promise<AvailableSlot[]> => {
    if (!calendarService) return [];
    
    // Use the calendar service but with custom duration
    return await calendarService.getAvailableSlots(selectedDates, duration as 30 | 60);
  };

  const fetchCalendarData = async () => {
    if (!calendarService || !isAuthenticated || selectedDates.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch events for selected dates
      const eventsByDate: { [key: string]: CalendarEvent[] } = {};
      
      for (const date of selectedDates) {
        const dateKey = format(date, 'yyyy-MM-dd');
        try {
          const dayEvents = await calendarService.getCalendarEvents('primary', date, date);
          eventsByDate[dateKey] = dayEvents.filter(event => 
            event.start.dateTime && event.end.dateTime && event.status !== 'cancelled'
          );
        } catch (error) {
          console.error(`Error fetching events for ${dateKey}:`, error);
          eventsByDate[dateKey] = [];
        }
      }

      setEvents(eventsByDate);

      // Generate availability based on duration type
      let availableSlots: AvailableSlot[] = [];
      
      if (slotDuration === 'both') {
        // Generate both 30 and 60 minute slots with unique IDs
        const slots30 = await calendarService.getAvailableSlots(selectedDates, 30);
        const slots60 = await calendarService.getAvailableSlots(selectedDates, 60);
        
        // Combine slots with unique prefixes
        availableSlots = selectedDates.map(date => {
          const dateKey = format(date, 'yyyy-MM-dd');
          const day30Slots = slots30.find(day => format(day.date, 'yyyy-MM-dd') === dateKey);
          const day60Slots = slots60.find(day => format(day.date, 'yyyy-MM-dd') === dateKey);
          
          const combinedSlots: TimeSlot[] = [];
          
          if (day30Slots) {
            day30Slots.slots.forEach(slot => {
              combinedSlots.push({
                ...slot,
                selected: false,
                id: `30-${dateKey}-${slot.start}`
              });
            });
          }
          
          if (day60Slots) {
            day60Slots.slots.forEach(slot => {
              combinedSlots.push({
                ...slot,
                selected: true,
                id: `60-${dateKey}-${slot.start}`
              });
            });
          }
          
          combinedSlots.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
          
          return {
            date,
            slots: combinedSlots
          };
        });
      } else if (slotDuration === 'custom') {
        // For custom duration, use closest supported duration
        const closestDuration = customDuration <= 45 ? 30 : 60;
        const baseSlots = await calendarService.getAvailableSlots(selectedDates, closestDuration);
        availableSlots = baseSlots.map(daySlot => ({
          ...daySlot,
          slots: daySlot.slots.map(slot => ({
            ...slot,
            selected: true,
            id: `custom-${format(daySlot.date, 'yyyy-MM-dd')}-${slot.start}`
          }))
        }));
      } else {
        const baseSlots = await calendarService.getAvailableSlots(selectedDates, slotDuration);
        availableSlots = baseSlots.map(daySlot => ({
          ...daySlot,
          slots: daySlot.slots.map(slot => ({
            ...slot,
            selected: true,
            id: `${slotDuration}-${format(daySlot.date, 'yyyy-MM-dd')}-${slot.start}`
          }))
        }));
      }
      
      setAvailability(availableSlots);
      onAvailabilityChange(availableSlots);

      // Update selected slots callback
      const selectedSlots = availableSlots.map(daySlot => ({
        date: daySlot.date,
        slots: daySlot.slots.filter(slot => slot.selected)
      })).filter(daySlot => daySlot.slots.length > 0);
      
      onSelectedSlotsChange(selectedSlots);

      toast({
        title: "Calendar Updated",
        description: `Found ${Object.values(eventsByDate).flat().length} events and generated ${availableSlots.reduce((total, day) => total + day.slots.length, 0)} available slots.`,
      });

    } catch (error) {
      console.error('Error fetching calendar data:', error);
      if (error instanceof Error && error.message.includes('Authentication')) {
        setIsAuthenticated(false);
        setError('Authentication expired. Please log in again.');
        toast({
          title: "Authentication Expired",
          description: "Please reconnect to Google Calendar.",
          variant: "destructive",
        });
      } else {
        setError(error instanceof Error ? error.message : 'Failed to fetch calendar data');
        toast({
          title: "Error",
          description: "Failed to fetch calendar data. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && selectedDates.length > 0) {
      fetchCalendarData();
    }
  }, [selectedDates, slotDuration, customDuration, isAuthenticated]);

  const removeDate = (dateToRemove: Date) => {
    setSelectedDates(prev => prev.filter(d => !isSameDay(d, dateToRemove)));
  };

  const handleSlotDurationChange = (value: string) => {
    if (value === '30' || value === '60') {
      setSlotDuration(parseInt(value) as 30 | 60);
    } else {
      setSlotDuration(value as 'both' | 'custom');
    }
  };

  const formatDateDisplay = (date: Date) => {
    if (isToday(date)) return "Today";
    if (isTomorrow(date)) return "Tomorrow";
    return format(date, "MMM d");
  };

  const getEventsForDate = (date: Date): AdaptedCalendarEvent[] => {
    const dateKey = format(date, 'yyyy-MM-dd');
    const googleEvents = events[dateKey] || [];
    
    // Convert Google Calendar events to adapted format
    return googleEvents.map(event => ({
      id: event.id || 'unknown',
      summary: event.summary || 'Untitled',
      start: new Date(event.start.dateTime || event.start.date || ''),
      end: new Date(event.end.dateTime || event.end.date || '')
    })).filter(event => !isNaN(event.start.getTime()) && !isNaN(event.end.getTime()));
  };

  const isAllDayEventForGoogle = (event: AdaptedCalendarEvent) => {
    return false; // We filter out all-day events in getEventsForDate
  };

  const generateSlotsForDurationForGoogle = (date: Date, blockingEvents: AdaptedCalendarEvent[], duration: number) => {
    // This function is needed for the TimeSlotDisplay interface
    // Since we generate slots differently in Google Calendar, return empty array
    return [];
  };

  // Toggle all slots for a date
  const toggleAllSlots = (date: Date) => {
    setAvailability(prev => {
      const updated = prev.map(daySlot => {
        if (format(daySlot.date, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')) {
          const allSelected = daySlot.slots.every(slot => slot.selected);
          return {
            ...daySlot,
            slots: daySlot.slots.map(slot => ({
              ...slot,
              selected: !allSelected
            }))
          };
        }
        return daySlot;
      });
      
      // Update selected slots callback
      const selectedSlots = updated.map(daySlot => ({
        date: daySlot.date,
        slots: daySlot.slots.filter(slot => slot.selected)
      })).filter(daySlot => daySlot.slots.length > 0);
      
      onSelectedSlotsChange(selectedSlots);
      
      return updated;
    });
  };

  if (!credentials) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Google Calendar Integration
          </CardTitle>
          <CardDescription>
            Loading Google Calendar credentials...
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="shadow-md">
      <CardHeader className="pb-1 pt-3">
        <CardTitle className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4" />
            Google Calendar Integration
          </div>
          {showToggle && onTogglePanel && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onTogglePanel}
              className="h-6 px-2 text-xs"
            >
              Hide
            </Button>
          )}
        </CardTitle>
        <CardDescription className="text-xs">
          Connect your Google Calendar to view your availability
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 pt-2">
        {/* Authentication Status */}
        <div className="flex items-center justify-between p-2 bg-muted rounded-md">
          <div className="flex items-center gap-1">
            {isAuthenticated ? (
              <>
                <CheckCircle className="h-3 w-3 text-green-600" />
                <span className="text-xs font-medium">Connected to Google Calendar</span>
              </>
            ) : (
              <>
                <LogIn className="h-3 w-3 text-gray-600" />
                <span className="text-xs font-medium">Not connected</span>
              </>
            )}
          </div>
          {isAuthenticated ? (
            <Button variant="outline" size="sm" onClick={handleGoogleLogout} className="h-6 px-2 text-xs">
              <LogOut className="h-3 w-3 mr-1" />
              Disconnect
            </Button>
          ) : (
            <Button onClick={handleGoogleLogin} disabled={loading} size="sm" className="h-6 px-2 text-xs">
              <LogIn className="h-3 w-3 mr-1" />
              Connect
            </Button>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Slot Duration Selection */}
        {isAuthenticated && (
          <div className="space-y-1">
            <label className="text-xs font-medium">Meeting Duration</label>
            <div className="flex gap-2 items-center">
              <Select 
                value={slotDuration.toString()} 
                onValueChange={handleSlotDurationChange}
              >
                <SelectTrigger className="w-[140px] h-7 text-xs bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-md z-50">
                  <SelectItem value="30">30 min</SelectItem>
                  <SelectItem value="60">60 min</SelectItem>
                  <SelectItem value="both">Both (30 & 60)</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
              
              {slotDuration === 'custom' && (
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="5"
                    max="120"
                    step="5"
                    value={customDuration}
                    onChange={(e) => setCustomDuration(Number(e.target.value))}
                    className="w-16 h-7 px-2 text-xs border rounded-md bg-background"
                    placeholder="15"
                  />
                  <span className="text-xs text-muted-foreground">min</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Calendar */}
        {isAuthenticated && (
          <div className="space-y-1">
            <label className="text-xs font-medium">Select Available Dates</label>
            <Calendar
              mode="multiple"
              selected={selectedDates}
              onSelect={(dates) => {
                if (dates) {
                  setSelectedDates(dates.sort((a, b) => a.getTime() - b.getTime()));
                }
              }}
              disabled={(date) => new Date(date.getTime() + 24 * 60 * 60 * 1000) < new Date()}
              className="rounded-md border text-xs p-1"
            />
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-4">
            <RefreshCw className="h-5 w-5 animate-spin mr-2" />
            <span className="text-sm text-muted-foreground">Loading calendar data...</span>
          </div>
        )}

        {/* Available Slots Display */}
        {isAuthenticated && selectedDates.length > 0 && !loading && (
          <TimeSlotDisplay
            availability={availability}
            slotDuration={slotDuration}
            getEventsForDate={getEventsForDate}
            isAllDayEvent={isAllDayEventForGoogle}
            generateSlotsForDuration={generateSlotsForDurationForGoogle}
            toggleSlotSelection={toggleSlotSelection}
            removeDate={removeDate}
            formatDateDisplay={formatDateDisplay}
            toggleAllSlots={toggleAllSlots}
          />
        )}
      </CardContent>
    </Card>
  );
};

export default GoogleCalendarView;