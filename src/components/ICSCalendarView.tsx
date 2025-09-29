import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon, Clock, FileText, Trash2, RefreshCw } from 'lucide-react';
import { format, isSameDay, startOfDay, endOfDay, isToday, isTomorrow, addMinutes } from 'date-fns';
import { cn } from '@/lib/utils';
import { AvailableSlot, TimeSlot } from '@/services/googleCalendarOAuth';

interface CalendarEvent {
  id: string;
  summary: string;
  start: Date;
  end: Date;
  description?: string;
  location?: string;
}

interface ICSCalendarViewProps {
  events: CalendarEvent[];
  onAvailabilityChange: (availability: AvailableSlot[]) => void;
  onClearEvents: () => void;
}

export function ICSCalendarView({ events, onAvailabilityChange, onClearEvents }: ICSCalendarViewProps) {
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [slotDuration, setSlotDuration] = useState<30 | 60 | 'both' | 'custom'>(30);
  const [customDuration, setCustomDuration] = useState<number>(15);
  const [availability, setAvailability] = useState<AvailableSlot[]>([]);
  // Helper: detect all-day events (00:00 to 00:00 next day or longer)
  const isAllDayEvent = (event: CalendarEvent) => {
    const start = event.start;
    const end = event.end;
    const durationMs = end.getTime() - start.getTime();
    return (
      start.getHours() === 0 &&
      start.getMinutes() === 0 &&
      end.getHours() === 0 &&
      end.getMinutes() === 0 &&
      durationMs >= 24 * 60 * 60 * 1000
    );
  };

  // Get events for a specific date
  const getEventsForDate = (date: Date) => {
    return events.filter(event => 
      isSameDay(event.start, date) || 
      isSameDay(event.end, date) ||
      (date >= startOfDay(event.start) && date <= endOfDay(event.end))
    );
  };
  // Helper function to generate slots for a specific duration
  const generateSlotsForDuration = (
    selectedDate: Date, 
    blockingEvents: CalendarEvent[], 
    duration: number
  ): TimeSlot[] => {
    const timeSlots: TimeSlot[] = [];
    
    // Working hours: 9 AM to 5 PM (standard business hours)
    const dayStart = new Date(selectedDate);
    dayStart.setHours(9, 0, 0, 0);
    
    const dayEnd = new Date(selectedDate);
    dayEnd.setHours(17, 0, 0, 0);

    let currentTime = dayStart;

    // Find gaps between events and create slots based on duration
    for (const event of blockingEvents) {
      const eventStart = new Date(Math.max(event.start.getTime(), dayStart.getTime()));
      const eventEnd = new Date(Math.min(event.end.getTime(), dayEnd.getTime()));

      // Generate slots before this event if there's a gap
      while (currentTime < eventStart) {
        const slotEnd = new Date(Math.min(
          addMinutes(currentTime, duration).getTime(),
          eventStart.getTime()
        ));

        // Only add slot if it's the full duration
        if (slotEnd.getTime() - currentTime.getTime() >= duration * 60 * 1000) {
          timeSlots.push({
            start: format(currentTime, 'HH:mm'),
            end: format(slotEnd, 'HH:mm'),
            startTime: new Date(currentTime),
            endTime: new Date(slotEnd)
          });
        }

        currentTime = addMinutes(currentTime, duration);
      }

      // Move current time to after this event
      currentTime = new Date(Math.max(currentTime.getTime(), eventEnd.getTime()));
    }

    // Generate remaining slots after all events
    while (currentTime < dayEnd) {
      const slotEnd = new Date(Math.min(
        addMinutes(currentTime, duration).getTime(),
        dayEnd.getTime()
      ));

      // Only add slot if it's the full duration
      if (slotEnd.getTime() - currentTime.getTime() >= duration * 60 * 1000) {
        timeSlots.push({
          start: format(currentTime, 'HH:mm'),
          end: format(slotEnd, 'HH:mm'),
          startTime: new Date(currentTime),
          endTime: new Date(slotEnd)
        });
      }

      currentTime = addMinutes(currentTime, duration);
    }

    return timeSlots;
  };

  // Generate availability for all selected dates
  const generateAvailability = () => {
    if (selectedDates.length === 0) {
      setAvailability([]);
      onAvailabilityChange([]);
      return;
    }

    const availableSlots: AvailableSlot[] = [];

    for (const selectedDate of selectedDates) {
      const dayEvents = getEventsForDate(selectedDate);

      // Consider only blocking events (ignore all-day/transparent-like events)
      const blockingEvents = dayEvents
        .filter(e => !isAllDayEvent(e))
        .filter(event => event.start < new Date(selectedDate.getTime() + 17 * 60 * 60 * 1000) && 
                        event.end > new Date(selectedDate.getTime() + 9 * 60 * 60 * 1000))
        .sort((a, b) => a.start.getTime() - b.start.getTime());

      let allTimeSlots: TimeSlot[] = [];

      // Generate slots based on duration type
      if (slotDuration === 'both') {
        // Generate both 30 and 60 minute slots
        const slots30 = generateSlotsForDuration(selectedDate, blockingEvents, 30);
        const slots60 = generateSlotsForDuration(selectedDate, blockingEvents, 60);
        
        // Merge and sort by start time, remove duplicates
        const allSlots = [...slots30, ...slots60];
        allTimeSlots = allSlots
          .filter((slot, index, arr) => 
            arr.findIndex(s => s.start === slot.start && s.end === slot.end) === index
          )
          .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
      } else if (slotDuration === 'custom') {
        allTimeSlots = generateSlotsForDuration(selectedDate, blockingEvents, customDuration);
      } else {
        allTimeSlots = generateSlotsForDuration(selectedDate, blockingEvents, slotDuration);
      }

      availableSlots.push({
        date: selectedDate,
        slots: allTimeSlots
      });
    }

    setAvailability(availableSlots);
    onAvailabilityChange(availableSlots);
  };

  // Auto-generate availability when dates or slot duration changes
  useEffect(() => {
    generateAvailability();
  }, [selectedDates, slotDuration, customDuration, events]);

  // Remove a selected date
  const removeDate = (dateToRemove: Date) => {
    setSelectedDates(prev => prev.filter(d => !isSameDay(d, dateToRemove)));
  };

  // Handle slot duration change
  const handleSlotDurationChange = (value: string) => {
    if (value === '30' || value === '60') {
      setSlotDuration(parseInt(value) as 30 | 60);
    } else {
      setSlotDuration(value as 'both' | 'custom');
    }
  };

  // Format date for display
  const formatDateDisplay = (date: Date) => {
    if (isToday(date)) return "Today";
    if (isTomorrow(date)) return "Tomorrow";
    return format(date, "MMM d");
  };

  // Get dates that have events for calendar styling
  const eventDates = events.map(event => startOfDay(event.start));
  const uniqueEventDates = Array.from(new Set(eventDates.map(date => date.getTime())))
    .map(time => new Date(time));

  if (events.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Imported Calendar
          </CardTitle>
          <CardDescription>
            No events imported yet. Import an ICS file to view your calendar.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="shadow-md">
      <CardHeader className="pb-1 pt-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <CalendarIcon className="h-4 w-4" />
            Imported Calendar
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onClearEvents}
            className="h-6 px-2 text-xs flex items-center gap-1"
          >
            <Trash2 className="h-3 w-3" />
            Clear
          </Button>
        </CardTitle>
        <CardDescription className="text-xs">
          {events.length} events imported. Select dates to find available time slots.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 pt-2">
        {/* Slot Duration Selection */}
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

        {/* Calendar */}
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
            disabled={(date) => startOfDay(date) < startOfDay(new Date())}
            className={cn("rounded-md border text-xs p-1 pointer-events-auto")}
            modifiers={{
              hasEvents: events.map(event => startOfDay(event.start))
            }}
            modifiersStyles={{
              hasEvents: { 
                backgroundColor: 'hsl(var(--primary))', 
                color: 'hsl(var(--primary-foreground))',
                fontWeight: 'bold'
              }
            }}
          />
        </div>

        {/* Available Slots Display */}
        {selectedDates.length > 0 && (
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
                  

                  {/* Show combined slots and events in chronological order */}
                  <div className="space-y-1">
                    {(() => {
                      const dayEvents = getEventsForDate(daySlots.date);
                      const allItems: Array<{
                        type: 'available' | 'busy';
                        start: string;
                        end: string;
                        startTime: Date;
                        title?: string;
                      }> = [];

                      // Add available slots
                      daySlots.slots.forEach(slot => {
                        allItems.push({
                          type: 'available',
                          start: slot.start,
                          end: slot.end,
                          startTime: slot.startTime
                        });
                      });

                      // Add busy events (excluding all-day events)
                      dayEvents
                        .filter(event => !isAllDayEvent(event))
                        .forEach(event => {
                          allItems.push({
                            type: 'busy',
                            start: format(event.start, 'HH:mm'),
                            end: format(event.end, 'HH:mm'),
                            startTime: event.start,
                            title: event.summary
                          });
                        });

                      // Sort by start time
                      allItems.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

                      if (allItems.length === 0) {
                        return (
                          <div className="p-3 bg-muted/50 rounded-md border border-dashed">
                            <p className="text-sm text-muted-foreground text-center">No slots or events for this day</p>
                          </div>
                        );
                      }

                      return (
                        <>
                          <p className="text-xs font-medium mb-2">
                            Time slots ({daySlots.slots.length} available, {dayEvents.filter(e => !isAllDayEvent(e)).length} busy):
                          </p>
                          <div className="space-y-1">
                            {allItems.map((item, index) => (
                              <div
                                key={index}
                                className={`flex items-center justify-between p-2 rounded-md border ${
                                  item.type === 'available'
                                    ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800'
                                    : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800'
                                }`}
                              >
                                <div className="flex-1">
                                  <span className={`text-sm font-medium ${
                                    item.type === 'available'
                                      ? 'text-green-800 dark:text-green-300'
                                      : 'text-red-800 dark:text-red-300'
                                  }`}>
                                    {item.start} - {item.end}
                                  </span>
                                  {item.title && (
                                    <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                                      {item.title}
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center gap-1">
                                  {item.type === 'available' ? (
                                    <Clock className="h-3 w-3 text-green-600 dark:text-green-400" />
                                  ) : (
                                    <CalendarIcon className="h-3 w-3 text-red-600 dark:text-red-400" />
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
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
}