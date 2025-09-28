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
    <Card className="backdrop-blur-sm bg-card/50 border border-border/50 shadow-xl shadow-black/10">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-3 text-lg">
          <CalendarIcon className="h-5 w-5 text-primary" />
          Calendar Integration
          <CalendarIcon className="h-4 w-4" />
          Google Calendar Integration
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
          <div className="space-y-3 bg-secondary/20 p-4 rounded-lg border border-border/30">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <label className="text-sm font-medium text-foreground">Meeting Duration</label>
            </div>
            <div className="flex gap-2">
              <Button 
                variant={slotDuration === 30 ? "default" : "outline"}
                size="sm"
                onClick={() => handleSlotDurationChange("30")}
                className={`flex-1 ${slotDuration === 30 
                  ? 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-md' 
                  : 'border-border/30 hover:bg-primary/10 hover:border-primary/30'
                } transition-all`}
              >
                <Clock className="h-3 w-3 mr-1" />
                30 min
              </Button>
              <Button 
                variant={slotDuration === 60 ? "default" : "outline"}
                size="sm"
                onClick={() => handleSlotDurationChange("60")}
                className={`flex-1 ${slotDuration === 60 
                  ? 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-md' 
                  : 'border-border/30 hover:bg-primary/10 hover:border-primary/30'
                } transition-all`}
              >
                <Clock className="h-3 w-3 mr-1" />
                1 hour
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Choose your preferred meeting slot duration for availability detection
            </p>
          </div>
        )}

        {/* Calendar */}
        {isAuthenticated && (
          <div className="space-y-3 bg-secondary/20 p-4 rounded-lg border border-border/30">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-primary" />
              <label className="text-sm font-medium text-foreground">Select Available Dates</label>
            </div>
            <Calendar
              mode="multiple"
              selected={selectedDates}
              onSelect={(dates) => {
                if (dates) {
                  setSelectedDates(dates.sort((a, b) => a.getTime() - b.getTime()));
                }
              }}
              disabled={(date) => date < new Date()}
              className="rounded-lg border border-border/30 bg-card/30 text-sm p-3 mx-auto"
              classNames={{
                months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                month: "space-y-4",
                caption: "flex justify-center pt-1 relative items-center",
                caption_label: "text-sm font-medium",
                nav: "space-x-1 flex items-center",
                nav_button: "h-7 w-7 bg-transparent p-0 hover:bg-primary/10 transition-colors",
                nav_button_previous: "absolute left-1",
                nav_button_next: "absolute right-1",
                table: "w-full border-collapse space-y-1",
                head_row: "flex",
                head_cell: "text-muted-foreground rounded-md w-8 font-normal text-[0.8rem]",
                row: "flex w-full mt-2",
                cell: "text-center text-sm p-0 relative [&:has([aria-selected])]:bg-primary/10 [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:rounded-l-md first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                day: "h-8 w-8 p-0 font-normal aria-selected:opacity-100 hover:bg-primary/20 transition-colors rounded-md",
                day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                day_today: "bg-accent text-accent-foreground",
                day_outside: "text-muted-foreground opacity-50",
                day_disabled: "text-muted-foreground opacity-50",
                day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
                day_hidden: "invisible",
              }}
            />
            <p className="text-xs text-muted-foreground">
              Select multiple dates to find available {slotDuration}-minute time slots
            </p>
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
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Available Time Slots</h3>
            
            {availability.map((daySlots) => {
              const dayEvents = getEventsForDate(daySlots.date);
              return (
                <div key={daySlots.date.toISOString()} className="space-y-1 border-b border-border pb-1 mb-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-medium flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDateDisplay(daySlots.date)} ({format(daySlots.date, "EEE, MMM d")})
                    </h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeDate(daySlots.date)}
                      className="h-5 px-1 text-xs"
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