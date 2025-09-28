import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarDays, Clock, AlertCircle, RefreshCw, CheckCircle2 } from "lucide-react";
import { format, isToday, isTomorrow, startOfWeek, endOfWeek, addDays } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import GoogleCalendarService, { CalendarEvent, AvailableSlot } from "@/services/googleCalendar";

interface GoogleCalendarViewProps {
  onAvailabilityChange: (availability: AvailableSlot[]) => void;
  apiKey: string;
}

export const GoogleCalendarView = ({ onAvailabilityChange, apiKey }: GoogleCalendarViewProps) => {
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slotDuration, setSlotDuration] = useState<30 | 60>(30);
  const [connectionTested, setConnectionTested] = useState(false);
  const { toast } = useToast();

  const calendarService = new GoogleCalendarService(apiKey);

  useEffect(() => {
    testConnection();
  }, [apiKey]);

  const testConnection = async () => {
    if (!apiKey) return;
    
    try {
      const isConnected = await calendarService.testConnection();
      if (isConnected) {
        setConnectionTested(true);
        setError(null);
        toast({
          title: "Google Calendar Connected",
          description: "Successfully connected to your Google Calendar.",
        });
      } else {
        setError("Failed to connect to Google Calendar. Please check your API key.");
      }
    } catch (err) {
      setError("Failed to connect to Google Calendar. Please check your API key and permissions.");
    }
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (!date || !connectionTested) return;
    
    const dateExists = selectedDates.some(d => d.toDateString() === date.toDateString());
    if (!dateExists) {
      const newDates = [...selectedDates, date].sort((a, b) => a.getTime() - b.getTime());
      setSelectedDates(newDates);
      fetchCalendarData(newDates);
    }
  };

  const removeDate = (dateToRemove: Date) => {
    const newDates = selectedDates.filter(d => d.toDateString() !== dateToRemove.toDateString());
    setSelectedDates(newDates);
    
    if (newDates.length > 0) {
      fetchCalendarData(newDates);
    } else {
      setCalendarEvents([]);
      setAvailableSlots([]);
      onAvailabilityChange([]);
    }
  };

  const fetchCalendarData = async (dates: Date[]) => {
    if (!connectionTested || dates.length === 0) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Get the date range to fetch events
      const startDate = new Date(Math.min(...dates.map(d => d.getTime())));
      const endDate = new Date(Math.max(...dates.map(d => d.getTime())));
      
      // Fetch calendar events
      const events = await calendarService.getCalendarEvents('primary', startDate, endDate);
      setCalendarEvents(events);
      
      // Generate available slots
      const slots = await calendarService.getAvailableSlots(dates, slotDuration);
      setAvailableSlots(slots);
      onAvailabilityChange(slots);
      
      toast({
        title: "Calendar Updated",
        description: `Found ${events.length} events and generated ${slots.reduce((total, day) => total + day.slots.length, 0)} available slots.`,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch calendar data";
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSlotDurationChange = (duration: string) => {
    const newDuration = parseInt(duration) as 30 | 60;
    setSlotDuration(newDuration);
    
    if (selectedDates.length > 0) {
      fetchCalendarData(selectedDates);
    }
  };

  const formatDateDisplay = (date: Date) => {
    if (isToday(date)) return "Today";
    if (isTomorrow(date)) return "Tomorrow";
    return format(date, "MMM d");
  };

  const getEventsForDate = (date: Date) => {
    return calendarEvents.filter(event => {
      if (!event.start.dateTime) return false;
      const eventDate = new Date(event.start.dateTime);
      return eventDate.toDateString() === date.toDateString();
    });
  };

  return (
    <Card className="h-full shadow-md">
      <CardHeader className="pb-3 bg-gmail-light border-b">
        <CardTitle className="flex items-center gap-2 text-foreground">
          <CalendarDays className="h-5 w-5 text-gmail-blue" />
          Google Calendar Integration
          {connectionTested && (
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 h-full overflow-auto">
        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {!connectionTested && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Connecting to Google Calendar... Please make sure your API key is configured correctly.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Slot Duration:</label>
            <Select value={slotDuration.toString()} onValueChange={handleSlotDurationChange}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 minutes</SelectItem>
                <SelectItem value="60">1 hour</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2">Select dates to check availability:</h3>
            <Calendar
              mode="single"
              selected={undefined}
              onSelect={handleDateSelect}
              disabled={(date) => date < new Date() || !connectionTested}
              className="rounded-md border w-full"
            />
          </div>

          {loading && (
            <div className="flex items-center justify-center py-4">
              <RefreshCw className="h-5 w-5 animate-spin text-gmail-blue mr-2" />
              <span className="text-sm text-muted-foreground">Loading calendar data...</span>
            </div>
          )}

          {selectedDates.length > 0 && !loading && (
            <>
              <Separator />
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Available Time Slots:</h3>
                {availableSlots.map((daySlots) => {
                  const dayEvents = getEventsForDate(daySlots.date);
                  return (
                    <div key={daySlots.date.toISOString()} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium flex items-center gap-2">
                          <Clock className="h-4 w-4 text-gmail-blue" />
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
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};