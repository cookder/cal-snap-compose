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
import GoogleCalendarOAuthService, { AvailableSlot, CalendarEvent } from '@/services/googleCalendarOAuth';
import GoogleOAuthService, { OAuthCredentials } from '@/services/googleOAuth';

interface GoogleCalendarViewProps {
  onAvailabilityChange: (availability: AvailableSlot[]) => void;
  credentials: OAuthCredentials | null;
}

const GoogleCalendarView: React.FC<GoogleCalendarViewProps> = ({ onAvailabilityChange, credentials }) => {
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [events, setEvents] = useState<{ [key: string]: CalendarEvent[] }>({});
  const [availability, setAvailability] = useState<AvailableSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slotDuration, setSlotDuration] = useState<30 | 60>(30);
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
      
      // Handle OAuth callback
      handleOAuthCallback(oauth);
    }
  }, [credentials]);

  const checkAuthStatus = async (oauth: GoogleOAuthService) => {
    try {
      const accessToken = await oauth.getValidAccessToken();
      setIsAuthenticated(!!accessToken);
    } catch (error) {
      console.error('Error checking auth status:', error);
      setIsAuthenticated(false);
    }
  };

  const handleOAuthCallback = async (oauth: GoogleOAuthService) => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    
    if (code) {
      try {
        setLoading(true);
        const tokens = await oauth.exchangeCodeForTokens(code);
        oauth.saveTokens(tokens);
        setIsAuthenticated(true);
        
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
        
        setError(null);
        toast({
          title: "Connected!",
          description: "Successfully connected to Google Calendar.",
        });
      } catch (error) {
        console.error('OAuth callback error:', error);
        setError(error instanceof Error ? error.message : 'Failed to complete Google authentication');
        toast({
          title: "Authentication Failed",
          description: "Failed to connect to Google Calendar. Please try again.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    }
  };

  const handleGoogleLogin = () => {
    if (oauthService) {
      const authUrl = oauthService.getAuthUrl();
      window.location.href = authUrl;
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

      // Generate availability
      const availableSlots = await calendarService.getAvailableSlots(selectedDates, slotDuration);
      setAvailability(availableSlots);
      onAvailabilityChange(availableSlots);

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
  }, [selectedDates, slotDuration, isAuthenticated]);

  const removeDate = (dateToRemove: Date) => {
    setSelectedDates(prev => prev.filter(d => !isSameDay(d, dateToRemove)));
  };

  const handleSlotDurationChange = (value: string) => {
    const newDuration = parseInt(value) as 30 | 60;
    setSlotDuration(newDuration);
  };

  const formatDateDisplay = (date: Date) => {
    if (isToday(date)) return "Today";
    if (isTomorrow(date)) return "Tomorrow";
    return format(date, "MMM d");
  };

  const getEventsForDate = (date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    return events[dateKey] || [];
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
    <Card className="h-full shadow-md">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <CalendarIcon className="h-5 w-5" />
          Google Calendar Integration
        </CardTitle>
        <CardDescription>
          Connect your Google Calendar to view your availability
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Authentication Status */}
        <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <>
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium">Connected to Google Calendar</span>
              </>
            ) : (
              <>
                <LogIn className="h-4 w-4 text-gray-600" />
                <span className="text-sm font-medium">Not connected</span>
              </>
            )}
          </div>
          {isAuthenticated ? (
            <Button variant="outline" size="sm" onClick={handleGoogleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Disconnect
            </Button>
          ) : (
            <Button onClick={handleGoogleLogin} disabled={loading}>
              <LogIn className="h-4 w-4 mr-2" />
              Connect Google Calendar
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
          <div className="space-y-2">
            <label className="text-sm font-medium">Meeting Duration</label>
            <Select value={slotDuration.toString()} onValueChange={handleSlotDurationChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 minutes</SelectItem>
                <SelectItem value="60">60 minutes</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Calendar */}
        {isAuthenticated && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Available Dates</label>
            <Calendar
              mode="multiple"
              selected={selectedDates}
              onSelect={(dates) => {
                if (dates) {
                  setSelectedDates(dates.sort((a, b) => a.getTime() - b.getTime()));
                }
              }}
              disabled={(date) => date < new Date()}
              className="rounded-md border"
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
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Available Time Slots</h3>
            
            {availability.map((daySlots) => {
              const dayEvents = getEventsForDate(daySlots.date);
              return (
                <div key={daySlots.date.toISOString()} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      {formatDateDisplay(daySlots.date)} ({format(daySlots.date, "EEE, MMM d")})
                    </h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeDate(daySlots.date)}
                    >
                      Remove
                    </Button>
                  </div>
                  
                  {/* Show existing events */}
                  {dayEvents.length > 0 && (
                    <div className="mb-2">
                      <p className="text-xs text-muted-foreground mb-1">Existing events:</p>
                      <div className="flex flex-wrap gap-1">
                        {dayEvents.map((event, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {event.summary} ({format(new Date(event.start.dateTime!), 'h:mm a')} - {format(new Date(event.end.dateTime!), 'h:mm a')})
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Show available slots */}
                  {daySlots.slots.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {daySlots.slots.map((slot, index) => (
                        <Badge
                          key={index}
                          className="bg-green-100 text-green-800 border-green-300"
                        >
                          {slot.start} - {slot.end}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No available slots for this day</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default GoogleCalendarView;