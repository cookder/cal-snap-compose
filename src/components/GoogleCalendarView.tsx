import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Calendar as CalendarIcon, Clock, CheckCircle, LogOut, LogIn, RefreshCw } from 'lucide-react';
import { format, isSameDay, isToday, isTomorrow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import GoogleCalendarOAuthService, { AvailableSlot, CalendarEvent, TimeSlot, GoogleCalendarInfo } from '@/services/googleCalendarOAuth';
import GoogleOAuthService, { OAuthCredentials } from '@/services/googleOAuth';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';

interface GoogleCalendarViewProps {
  onAvailabilityChange: (availability: AvailableSlot[]) => void;
  onSelectedSlotsChange: (selectedSlots: { date: Date; slots: TimeSlot[] }[]) => void;
  credentials: OAuthCredentials | null;
  onTogglePanel?: () => void;
  showToggle?: boolean;
  onSelectAll?: () => void;
  onDeselectAll?: () => void;
}

const GoogleCalendarView: React.FC<GoogleCalendarViewProps> = ({ onAvailabilityChange, onSelectedSlotsChange, credentials, onTogglePanel, showToggle, onSelectAll, onDeselectAll }) => {
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [events, setEvents] = useState<{ [key: string]: CalendarEvent[] }>({});
  const [availability, setAvailability] = useState<AvailableSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDurations, setSelectedDurations] = useState<Set<15 | 30 | 60 | 'custom' | 'grouped'>>(new Set(['grouped']));
  const [customDuration, setCustomDuration] = useState<number>(45);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [calendarService, setCalendarService] = useState<GoogleCalendarOAuthService | null>(null);
  const [oauthService, setOauthService] = useState<GoogleOAuthService | null>(null);
  const [availableCalendars, setAvailableCalendars] = useState<GoogleCalendarInfo[]>([]);
  const [selectedCalendars, setSelectedCalendars] = useState<string[]>([]);
  const [loadingCalendars, setLoadingCalendars] = useState(false);
  const [showCalendarSelector, setShowCalendarSelector] = useState(false);
  const { toast } = useToast();

  // Add cache with 5 minute expiration
  const eventCache = useMemo(() => ({
    data: new Map<string, { events: CalendarEvent[]; timestamp: number }>(),
    
    get(dateKey: string): CalendarEvent[] | null {
      const cached = this.data.get(dateKey);
      if (!cached) return null;
      
      // Expire after 5 minutes
      const isExpired = Date.now() - cached.timestamp > 5 * 60 * 1000;
      if (isExpired) {
        this.data.delete(dateKey);
        return null;
      }
      
      return cached.events;
    },
    
    set(dateKey: string, events: CalendarEvent[]) {
      this.data.set(dateKey, { events, timestamp: Date.now() });
    },
    
    clear() {
      this.data.clear();
    }
  }), []);

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
      const authenticated = !!accessToken;
      setIsAuthenticated(authenticated);
      
      // Fetch calendar list if authenticated
      if (authenticated && calendarService) {
        fetchCalendarList();
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
      setIsAuthenticated(false);
    }
  };

  const fetchCalendarList = async () => {
    if (!calendarService) return;
    
    setLoadingCalendars(true);
    try {
      const calendars = await calendarService.getCalendarList();
      setAvailableCalendars(calendars);
      
      // Auto-select primary calendar
      const primaryCalendar = calendars.find(cal => cal.primary);
      if (primaryCalendar) {
        setSelectedCalendars([primaryCalendar.id]);
      }
    } catch (error) {
      console.error('Error fetching calendar list:', error);
      toast({
        title: "Error",
        description: "Failed to fetch calendar list.",
        variant: "destructive",
      });
    } finally {
      setLoadingCalendars(false);
    }
  };

  const toggleCalendar = (calendarId: string) => {
    setSelectedCalendars(prev => {
      if (prev.includes(calendarId)) {
        return prev.filter(id => id !== calendarId);
      } else {
        return [...prev, calendarId];
      }
    });
  };

  const selectAllCalendars = () => {
    setSelectedCalendars(availableCalendars.map(cal => cal.id));
  };

  const deselectAllCalendars = () => {
    setSelectedCalendars([]);
  };


  // Select all slots
  const selectAllSlots = useCallback(() => {
    setAvailability(prev => {
      const updated = prev.map(daySlot => ({
        ...daySlot,
        slots: daySlot.slots.map(slot => ({ ...slot, selected: true }))
      }));
      
      const selectedSlots = updated.map(daySlot => ({
        date: daySlot.date,
        slots: daySlot.slots.filter(slot => slot.selected)
      })).filter(daySlot => daySlot.slots.length > 0);
      
      onSelectedSlotsChange(selectedSlots);
      return updated;
    });
  }, [onSelectedSlotsChange]);

  // Deselect all slots
  const deselectAllSlots = useCallback(() => {
    setAvailability(prev => {
      const updated = prev.map(daySlot => ({
        ...daySlot,
        slots: daySlot.slots.map(slot => ({ ...slot, selected: false }))
      }));
      
      onSelectedSlotsChange([]);
      return updated;
    });
  }, [onSelectedSlotsChange]);

  // Expose select/deselect functions to parent via callbacks
  useEffect(() => {
    if (onSelectAll) {
      // Store function reference in a way parent can call it
      (window as any).__googleCalendarSelectAll = selectAllSlots;
    }
    if (onDeselectAll) {
      (window as any).__googleCalendarDeselectAll = deselectAllSlots;
    }
  }, [selectAllSlots, deselectAllSlots, onSelectAll, onDeselectAll]);

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
      eventCache.clear(); // Clear cache
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
  const generateSlotsForDuration = async (
    selectedDates: Date[], 
    duration: number
  ): Promise<AvailableSlot[]> => {
    if (!calendarService) return [];
    
    // Use selected calendars or default to primary
    const calendarsToUse = selectedCalendars.length > 0 ? selectedCalendars : 'primary';
    
    // Use the calendar service but with custom duration and selected calendars
    return await calendarService.getAvailableSlots(selectedDates, duration as 15 | 30 | 60, undefined, calendarsToUse);
  };

  const fetchCalendarData = useCallback(async () => {
    if (!calendarService || !isAuthenticated || selectedDates.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      const eventsByDate: { [key: string]: CalendarEvent[] } = {};
      const calendarsToUse = selectedCalendars.length > 0 ? selectedCalendars : ['primary'];
      
      for (const date of selectedDates) {
        const dateKey = format(date, 'yyyy-MM-dd');
        
        // Check cache first (now includes calendar IDs in key)
        const cacheKey = `${dateKey}-${calendarsToUse.join(',')}`;
        const cachedEvents = eventCache.get(cacheKey);
        if (cachedEvents) {
          console.log(`Using cached events for ${dateKey} from ${calendarsToUse.length} calendar(s)`);
          eventsByDate[dateKey] = cachedEvents;
        } else {
          try {
            console.log(`Fetching events for ${dateKey} from ${calendarsToUse.length} calendar(s)`);
            const dayEvents = await calendarService.getCalendarEvents(calendarsToUse, date, date);
            const filteredEvents = dayEvents.filter(event => 
              event.start.dateTime && event.end.dateTime && event.status !== 'cancelled'
            );
            
            eventCache.set(cacheKey, filteredEvents);
            eventsByDate[dateKey] = filteredEvents;
          } catch (error) {
            console.error(`Error fetching events for ${dateKey}:`, error);
            eventsByDate[dateKey] = [];
          }
        }
      }

      setEvents(eventsByDate);

      // Generate availability
      let availableSlots: AvailableSlot[] = [];
      const allSlotsByDate = new Map<string, TimeSlot[]>();
      
      selectedDates.forEach(date => {
        allSlotsByDate.set(format(date, 'yyyy-MM-dd'), []);
      });
      
      if (selectedDurations.has('grouped')) {
        const baseSlots = await calendarService.getAvailableSlots(selectedDates, 30, undefined, calendarsToUse);
        
        baseSlots.forEach(daySlot => {
          const dateKey = format(daySlot.date, 'yyyy-MM-dd');
          const slots = daySlot.slots;
          const groupedSlots: TimeSlot[] = [];
          let i = 0;
          
          while (i < slots.length) {
            const currentSlot = slots[i];
            let endSlot = currentSlot;
            let j = i + 1;
            
            while (j < slots.length && slots[j].startTime.getTime() === endSlot.endTime.getTime()) {
              endSlot = slots[j];
              j++;
            }
            
            const durationMinutes = (endSlot.endTime.getTime() - currentSlot.startTime.getTime()) / (1000 * 60);
            
            groupedSlots.push({
              start: currentSlot.start,
              end: endSlot.end,
              startTime: currentSlot.startTime,
              endTime: endSlot.endTime,
              selected: true,
              id: `grouped-${dateKey}-${format(currentSlot.startTime, 'HH:mm')}-${durationMinutes}`
            });
            
            i = j;
          }
          
          allSlotsByDate.get(dateKey)?.push(...groupedSlots);
        });
      }
      
      const standardDurations = [15, 30, 60].filter(d => selectedDurations.has(d as 15 | 30 | 60));
      for (const duration of standardDurations) {
        const slots = await calendarService.getAvailableSlots(selectedDates, duration as 15 | 30 | 60, undefined, calendarsToUse);
        slots.forEach(daySlot => {
          const dateKey = format(daySlot.date, 'yyyy-MM-dd');
          const slotsWithIds = daySlot.slots.map(slot => ({
            ...slot,
            selected: true,
            id: `${duration}-${dateKey}-${slot.start}`
          }));
          allSlotsByDate.get(dateKey)?.push(...slotsWithIds);
        });
      }
      
      if (selectedDurations.has('custom') && customDuration > 0) {
        const closestDuration = customDuration <= 22 ? 15 : customDuration <= 45 ? 30 : 60;
        const baseSlots = await calendarService.getAvailableSlots(selectedDates, closestDuration, undefined, calendarsToUse);
        baseSlots.forEach(daySlot => {
          const dateKey = format(daySlot.date, 'yyyy-MM-dd');
          const slotsWithIds = daySlot.slots.map(slot => ({
            ...slot,
            selected: true,
            id: `custom-${dateKey}-${slot.start}`
          }));
          allSlotsByDate.get(dateKey)?.push(...slotsWithIds);
        });
      }
      
      selectedDates.forEach(date => {
        const dateKey = format(date, 'yyyy-MM-dd');
        const slots = allSlotsByDate.get(dateKey) || [];
        slots.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
        availableSlots.push({
          date,
          slots
        });
      });
      
      setAvailability(availableSlots);
      onAvailabilityChange(availableSlots);

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
  }, [calendarService, isAuthenticated, selectedDates, selectedDurations, customDuration, selectedCalendars, eventCache, onAvailabilityChange, onSelectedSlotsChange, toast]);

  useEffect(() => {
    if (!isAuthenticated || selectedDates.length === 0) {
      setAvailability([]);
      onAvailabilityChange([]);
      onSelectedSlotsChange([]);
      return;
    }

    // Debounce the fetch to avoid rapid calls
    const timeoutId = setTimeout(() => {
      fetchCalendarData();
    }, 500);

    // Cleanup function to cancel pending fetches
    return () => {
      clearTimeout(timeoutId);
    };
  }, [isAuthenticated, selectedDates, selectedDurations, customDuration, selectedCalendars, fetchCalendarData, onAvailabilityChange, onSelectedSlotsChange]);

  const removeDate = (dateToRemove: Date) => {
    setSelectedDates(prev => prev.filter(d => !isSameDay(d, dateToRemove)));
  };

  // Handle duration checkbox toggle
  const toggleDuration = (duration: 15 | 30 | 60 | 'custom' | 'grouped') => {
    setSelectedDurations(prev => {
      const newSet = new Set(prev);
      if (newSet.has(duration)) {
        newSet.delete(duration);
      } else {
        newSet.add(duration);
      }
      return newSet;
    });
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

        {/* Calendar Selector */}
        {isAuthenticated && availableCalendars.length > 0 && (
          <Collapsible open={showCalendarSelector} onOpenChange={setShowCalendarSelector}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="w-full h-8 text-xs justify-between">
                <span className="flex items-center gap-1">
                  <CalendarIcon className="h-3 w-3" />
                  {selectedCalendars.length === 0 
                    ? 'Select Calendars' 
                    : `${selectedCalendars.length} Calendar${selectedCalendars.length > 1 ? 's' : ''} Selected`}
                </span>
                <ChevronDown className={`h-3 w-3 transition-transform ${showCalendarSelector ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-2">
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={selectAllCalendars}
                  className="h-6 text-xs flex-1"
                  disabled={selectedCalendars.length === availableCalendars.length}
                >
                  Select All
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={deselectAllCalendars}
                  className="h-6 text-xs flex-1"
                  disabled={selectedCalendars.length === 0}
                >
                  Deselect All
                </Button>
              </div>
              <div className="space-y-1 max-h-48 overflow-y-auto border rounded-md p-2">
                {availableCalendars.map(calendar => (
                  <div 
                    key={calendar.id}
                    className="flex items-center space-x-2 p-1.5 hover:bg-muted rounded cursor-pointer"
                    onClick={() => toggleCalendar(calendar.id)}
                  >
                    <Checkbox 
                      id={`calendar-${calendar.id}`}
                      checked={selectedCalendars.includes(calendar.id)}
                      onCheckedChange={() => toggleCalendar(calendar.id)}
                    />
                    <label 
                      htmlFor={`calendar-${calendar.id}`}
                      className="flex-1 text-xs cursor-pointer flex items-center gap-2"
                    >
                      {calendar.backgroundColor && (
                        <div 
                          className="w-3 h-3 rounded-full border border-border" 
                          style={{ backgroundColor: calendar.backgroundColor }}
                        />
                      )}
                      <span className="flex-1">{calendar.summary}</span>
                      {calendar.primary && (
                        <Badge variant="secondary" className="text-[10px] px-1 py-0">Primary</Badge>
                      )}
                    </label>
                  </div>
                ))}
              </div>
              {selectedCalendars.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Events from {selectedCalendars.length} calendar{selectedCalendars.length > 1 ? 's' : ''} will be considered for availability.
                </p>
              )}
            </CollapsibleContent>
          </Collapsible>
        )}

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
            <label className="text-xs font-medium">Meeting Durations</label>
            <div className="space-y-2 p-2 border rounded-md bg-background">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedDurations.has(15)}
                  onChange={() => toggleDuration(15)}
                  className="h-3.5 w-3.5 rounded"
                />
                <span className="text-xs">15 minutes</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedDurations.has(30)}
                  onChange={() => toggleDuration(30)}
                  className="h-3.5 w-3.5 rounded"
                />
                <span className="text-xs">30 minutes</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedDurations.has(60)}
                  onChange={() => toggleDuration(60)}
                  className="h-3.5 w-3.5 rounded"
                />
                <span className="text-xs">60 minutes</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedDurations.has('grouped')}
                  onChange={() => toggleDuration('grouped')}
                  className="h-3.5 w-3.5 rounded"
                />
                <span className="text-xs">Grouped Chunks</span>
              </label>
              <div className="space-y-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedDurations.has('custom')}
                    onChange={() => toggleDuration('custom')}
                    className="h-3.5 w-3.5 rounded"
                  />
                  <span className="text-xs">Custom Duration</span>
                </label>
                {selectedDurations.has('custom') && (
                  <div className="flex items-center gap-1 ml-5">
                    <input
                      type="number"
                      min="5"
                      max="120"
                      step="5"
                      value={customDuration}
                      onChange={(e) => setCustomDuration(Number(e.target.value))}
                      className="w-16 h-6 px-2 text-xs border rounded-md bg-background"
                      placeholder="45"
                    />
                    <span className="text-xs text-muted-foreground">min</span>
                  </div>
                )}
              </div>
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
                  
                  {/* Show combined slots and events */}
                  <div className="space-y-1">
                    {(() => {
                      // Unified view - show all slots grouped by type
                      const groupedSlots = daySlots.slots.filter(s => s.id?.startsWith('grouped-'));
                      const slots15 = daySlots.slots.filter(s => s.id?.startsWith('15-'));
                      const slots30 = daySlots.slots.filter(s => s.id?.startsWith('30-'));
                      const slots60 = daySlots.slots.filter(s => s.id?.startsWith('60-'));
                      const customSlots = daySlots.slots.filter(s => s.id?.startsWith('custom-'));
                      
                      return (
                        <div className="space-y-3">
                          {/* Grouped chunks */}
                          {groupedSlots.length > 0 && (
                            <div>
                              <p className="text-xs font-medium mb-2 text-purple-700 dark:text-purple-400">
                                Grouped chunks ({groupedSlots.length} available, {groupedSlots.filter(s => s.selected).length} selected):
                              </p>
                              <div className="flex flex-col gap-1">
                                {groupedSlots.map((slot, index) => {
                                  const durationMinutes = (slot.endTime.getTime() - slot.startTime.getTime()) / (1000 * 60);
                                  const hours = Math.floor(durationMinutes / 60);
                                  const mins = durationMinutes % 60;
                                  const durationText = hours > 0 
                                    ? `${hours}h${mins > 0 ? ` ${mins}m` : ''}`
                                    : `${mins}m`;
                                  
                                  return (
                                    <button
                                      key={index}
                                      onClick={() => toggleSlotSelection(slot.id!)}
                                      className={`w-full flex items-center justify-between p-2 rounded-md border transition-all ${
                                        slot.selected
                                          ? 'bg-purple-100 dark:bg-purple-900/50 border-purple-300 dark:border-purple-700 ring-2 ring-purple-500 ring-opacity-50'
                                          : 'bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800 hover:bg-purple-75 dark:hover:bg-purple-900/40'
                                      }`}
                                    >
                                      <span className="text-sm font-medium text-purple-800 dark:text-purple-300">
                                        {slot.start} - {slot.end}
                                      </span>
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">
                                          {durationText}
                                        </span>
                                        <Clock className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          
                          {/* 15-minute slots */}
                          {slots15.length > 0 && (
                            <div>
                              <p className="text-xs font-medium mb-2 text-amber-700 dark:text-amber-400">
                                15-minute slots ({slots15.length} available, {slots15.filter(s => s.selected).length} selected):
                              </p>
                              <div className="flex flex-col gap-1">
                                {slots15.map((slot, index) => (
                                  <button
                                    key={index}
                                    onClick={() => toggleSlotSelection(slot.id!)}
                                    className={`w-full flex items-center justify-between p-2 rounded-md border transition-all ${
                                      slot.selected
                                        ? 'bg-amber-100 dark:bg-amber-900/50 border-amber-300 dark:border-amber-700 ring-2 ring-amber-500 ring-opacity-50'
                                        : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 hover:bg-amber-75 dark:hover:bg-amber-900/40'
                                    }`}
                                  >
                                    <span className="text-sm font-medium text-amber-800 dark:text-amber-300">
                                      {slot.start} - {slot.end}
                                    </span>
                                    <Clock className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* 30-minute slots */}
                          {slots30.length > 0 && (
                            <div>
                              <p className="text-xs font-medium mb-2 text-blue-700 dark:text-blue-400">
                                30-minute slots ({slots30.length} available, {slots30.filter(s => s.selected).length} selected):
                              </p>
                              <div className="flex flex-col gap-1">
                                {slots30.map((slot, index) => (
                                  <button
                                    key={index}
                                    onClick={() => toggleSlotSelection(slot.id!)}
                                    className={`w-full flex items-center justify-between p-2 rounded-md border transition-all ${
                                      slot.selected
                                        ? 'bg-blue-100 dark:bg-blue-900/50 border-blue-300 dark:border-blue-700 ring-2 ring-blue-500 ring-opacity-50'
                                        : 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 hover:bg-blue-75 dark:hover:bg-blue-900/40'
                                    }`}
                                  >
                                    <span className="text-sm font-medium text-blue-800 dark:text-blue-300">
                                      {slot.start} - {slot.end}
                                    </span>
                                    <Clock className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* 60-minute slots */}
                          {slots60.length > 0 && (
                            <div>
                              <p className="text-xs font-medium mb-2 text-green-700 dark:text-green-400">
                                60-minute slots ({slots60.length} available, {slots60.filter(s => s.selected).length} selected):
                              </p>
                              <div className="flex flex-col gap-1">
                                {slots60.map((slot, index) => (
                                  <button
                                    key={index}
                                    onClick={() => toggleSlotSelection(slot.id!)}
                                    className={`w-full flex items-center justify-between p-2 rounded-md border transition-all ${
                                      slot.selected
                                        ? 'bg-green-100 dark:bg-green-900/50 border-green-300 dark:border-green-700 ring-2 ring-green-500 ring-opacity-50'
                                        : 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800 hover:bg-green-75 dark:hover:bg-green-900/40'
                                    }`}
                                  >
                                    <span className="text-sm font-medium text-green-800 dark:text-green-300">
                                      {slot.start} - {slot.end}
                                    </span>
                                    <Clock className="h-3 w-3 text-green-600 dark:text-green-400" />
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* Custom duration slots */}
                          {customSlots.length > 0 && (
                            <div>
                              <p className="text-xs font-medium mb-2 text-indigo-700 dark:text-indigo-400">
                                Custom ({customDuration} min) slots ({customSlots.length} available, {customSlots.filter(s => s.selected).length} selected):
                              </p>
                              <div className="flex flex-col gap-1">
                                {customSlots.map((slot, index) => (
                                  <button
                                    key={index}
                                    onClick={() => toggleSlotSelection(slot.id!)}
                                    className={`w-full flex items-center justify-between p-2 rounded-md border transition-all ${
                                      slot.selected
                                        ? 'bg-indigo-100 dark:bg-indigo-900/50 border-indigo-300 dark:border-indigo-700 ring-2 ring-indigo-500 ring-opacity-50'
                                        : 'bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-75 dark:hover:bg-indigo-900/40'
                                    }`}
                                  >
                                    <span className="text-sm font-medium text-indigo-800 dark:text-indigo-300">
                                      {slot.start} - {slot.end}
                                    </span>
                                    <Clock className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Existing events */}
                          {dayEvents.length > 0 && (
                            <div>
                              <p className="text-xs font-medium mb-2 text-red-700 dark:text-red-400">
                                Existing events ({dayEvents.length}):
                              </p>
                              <div className="space-y-1">
                                {dayEvents
                                  .sort((a, b) => new Date(a.start.dateTime!).getTime() - new Date(b.start.dateTime!).getTime())
                                  .map((event, index) => (
                                    <div
                                      key={index}
                                      className="flex items-start gap-2 p-2 bg-red-50 dark:bg-red-950/30 rounded-md border border-red-200 dark:border-red-800"
                                    >
                                      {event.calendarColor && (
                                        <div 
                                          className="w-1 h-full rounded-full flex-shrink-0 mt-0.5" 
                                          style={{ backgroundColor: event.calendarColor }}
                                        />
                                      )}
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                          <span className="text-sm font-medium text-red-800 dark:text-red-300">
                                            {format(new Date(event.start.dateTime!), 'HH:mm')} - {format(new Date(event.end.dateTime!), 'HH:mm')}
                                          </span>
                                          {event.calendarName && event.calendarName !== 'primary' && (
                                            <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                                              {event.calendarName}
                                            </Badge>
                                          )}
                                        </div>
                                        <p className="text-xs text-red-600 dark:text-red-400 mt-0.5 truncate">
                                          {event.summary}
                                        </p>
                                      </div>
                                      <CalendarIcon className="h-3 w-3 text-red-600 dark:text-red-400 flex-shrink-0" />
                                    </div>
                                  ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
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
