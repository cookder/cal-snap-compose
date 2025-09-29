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
  const [slotDuration, setSlotDuration] = useState<30 | 60>(30);
  const [availability, setAvailability] = useState<AvailableSlot[]>([]);
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set());

  // Get events for a specific date
  const getEventsForDate = (date: Date) => {
    return events.filter(event => 
      isSameDay(event.start, date) || 
      isSameDay(event.end, date) ||
      (date >= startOfDay(event.start) && date <= endOfDay(event.end))
    );
  };

  // Generate availability for all selected dates
  const generateAvailability = () => {
    if (selectedDates.length === 0) {
      setAvailability([]);
      setSelectedSlots(new Set());
      onAvailabilityChange([]);
      return;
    }

    const availableSlots: AvailableSlot[] = [];

    for (const selectedDate of selectedDates) {
      const dayEvents = getEventsForDate(selectedDate);
      const timeSlots: TimeSlot[] = [];

      // Working hours: 9 AM to 5 PM (standard business hours)
      const dayStart = new Date(selectedDate);
      dayStart.setHours(9, 0, 0, 0);
      
      const dayEnd = new Date(selectedDate);
      dayEnd.setHours(17, 0, 0, 0);

      // Sort events by start time
      const sortedEvents = dayEvents
        .filter(event => event.start < dayEnd && event.end > dayStart)
        .sort((a, b) => a.start.getTime() - b.start.getTime());

      let currentTime = dayStart;

      // Find gaps between events and create slots based on duration
      for (const event of sortedEvents) {
        const eventStart = new Date(Math.max(event.start.getTime(), dayStart.getTime()));
        const eventEnd = new Date(Math.min(event.end.getTime(), dayEnd.getTime()));

        // Generate slots before this event if there's a gap
        while (currentTime < eventStart) {
          const slotEnd = new Date(Math.min(
            addMinutes(currentTime, slotDuration).getTime(),
            eventStart.getTime()
          ));

          // Only add slot if it's the full duration
          if (slotEnd.getTime() - currentTime.getTime() >= slotDuration * 60 * 1000) {
            timeSlots.push({
              start: format(currentTime, 'h:mm a'),
              end: format(slotEnd, 'h:mm a'),
              startTime: new Date(currentTime),
              endTime: new Date(slotEnd)
            });
          }

          currentTime = addMinutes(currentTime, slotDuration);
        }

        // Move current time to after this event
        currentTime = new Date(Math.max(currentTime.getTime(), eventEnd.getTime()));
      }

      // Generate remaining slots after all events
      while (currentTime < dayEnd) {
        const slotEnd = new Date(Math.min(
          addMinutes(currentTime, slotDuration).getTime(),
          dayEnd.getTime()
        ));

        // Only add slot if it's the full duration
        if (slotEnd.getTime() - currentTime.getTime() >= slotDuration * 60 * 1000) {
          timeSlots.push({
            start: format(currentTime, 'h:mm a'),
            end: format(slotEnd, 'h:mm a'),
            startTime: new Date(currentTime),
            endTime: new Date(slotEnd)
          });
        }

        currentTime = addMinutes(currentTime, slotDuration);
      }

      availableSlots.push({
        date: selectedDate,
        slots: timeSlots
      });
    }

    setAvailability(availableSlots);
    
    // Auto-select all new slots by default
    const newSlotIds = new Set<string>();
    availableSlots.forEach(daySlots => {
      daySlots.slots.forEach(slot => {
        const slotId = `${daySlots.date.toISOString()}-${slot.startTime.getTime()}`;
        newSlotIds.add(slotId);
      });
    });
    setSelectedSlots(newSlotIds);
    
    // Send all slots initially (all selected by default)
    onAvailabilityChange(availableSlots);
  };

  // Generate slot ID for tracking selection
  const getSlotId = (date: Date, slot: TimeSlot) => {
    return `${date.toISOString()}-${slot.startTime.getTime()}`;
  };

  // Toggle slot selection
  const toggleSlotSelection = (date: Date, slot: TimeSlot) => {
    const slotId = getSlotId(date, slot);
    setSelectedSlots(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(slotId)) {
        newSelected.delete(slotId);
      } else {
        newSelected.add(slotId);
      }
      return newSelected;
    });
  };

  // Update availability callback when selection changes
  useEffect(() => {
    if (availability.length > 0) {
      const filteredAvailability = availability.map(daySlots => ({
        ...daySlots,
        slots: daySlots.slots.filter(s => {
          const id = getSlotId(daySlots.date, s);
          return selectedSlots.has(id);
        })
      })).filter(daySlots => daySlots.slots.length > 0);
      
      onAvailabilityChange(filteredAvailability);
    }
  }, [selectedSlots, availability, onAvailabilityChange]);

  // Auto-generate availability when dates or slot duration changes
  useEffect(() => {
    generateAvailability();
  }, [selectedDates, slotDuration, events]);

  // Remove a selected date
  const removeDate = (dateToRemove: Date) => {
    setSelectedDates(prev => prev.filter(d => !isSameDay(d, dateToRemove)));
  };

  // Handle slot duration change
  const handleSlotDurationChange = (value: string) => {
    const newDuration = parseInt(value) as 30 | 60;
    setSlotDuration(newDuration);
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
          <Select value={slotDuration.toString()} onValueChange={handleSlotDurationChange}>
            <SelectTrigger className="w-[140px] h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">30 min</SelectItem>
              <SelectItem value="60">60 min</SelectItem>
            </SelectContent>
          </Select>
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
            disabled={(date) => date < new Date()}
            className={cn("rounded-md border text-xs p-1 pointer-events-auto")}
          />
        </div>

        {/* Available Slots Display */}
        {selectedDates.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Available Time Slots</h3>
            
            {availability.map((daySlots) => {
              const dayEvents = getEventsForDate(daySlots.date);
              
              // Create a combined timeline of events and available slots
              const timeline: Array<{
                type: 'event' | 'slot';
                start: string;
                end: string;
                startTime: Date;
                endTime: Date;
                title?: string;
                data?: any;
                isAllDay?: boolean;
                isSelected?: boolean;
              }> = [];

              // Add events to timeline
              dayEvents.forEach(event => {
                // Check if it's an all-day event (starts and ends at midnight)
                const isAllDay = event.start.getHours() === 0 && event.start.getMinutes() === 0 && 
                                event.end.getHours() === 0 && event.end.getMinutes() === 0;
                
                timeline.push({
                  type: 'event',
                  start: isAllDay ? 'All-day' : format(event.start, 'h:mm a'),
                  end: isAllDay ? '' : format(event.end, 'h:mm a'),
                  startTime: event.start,
                  endTime: event.end,
                  title: event.summary,
                  data: event,
                  isAllDay
                });
              });

              // Add available slots to timeline
              daySlots.slots.forEach(slot => {
                const slotId = getSlotId(daySlots.date, slot);
                const isSelected = selectedSlots.has(slotId);
                timeline.push({
                  type: 'slot',
                  start: format(slot.startTime, 'h:mm a'),
                  end: format(slot.endTime, 'h:mm a'),
                  startTime: slot.startTime,
                  endTime: slot.endTime,
                  isSelected
                });
              });

              // Sort timeline by type (all-day events first) then by start time
              timeline.sort((a, b) => {
                // All-day events come first
                if (a.isAllDay && !b.isAllDay) return -1;
                if (!a.isAllDay && b.isAllDay) return 1;
                // Then sort by start time
                return a.startTime.getTime() - b.startTime.getTime();
              });

              return (
                <div key={daySlots.date.toISOString()} className="border rounded-lg p-3 bg-muted/20">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      {formatDateDisplay(daySlots.date)} ({format(daySlots.date, "EEE, MMM d")})
                    </h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeDate(daySlots.date)}
                      className="h-6 px-2 text-xs"
                    >
                      Remove
                    </Button>
                  </div>
                  
                  {/* Timeline View */}
                  <div className="space-y-1">
                    {timeline.length > 0 ? (
                      timeline.map((item, index) => (
                        <div
                          key={index}
                          className={cn(
                            "flex items-center justify-between p-2 rounded-md",
                            item.type === 'event' 
                              ? "bg-red-50 border border-red-200" 
                              : item.isSelected
                                ? "bg-green-50 border border-green-200 cursor-pointer hover:bg-green-100"
                                : "bg-gray-50 border border-gray-200 cursor-pointer hover:bg-gray-100 opacity-60"
                          )}
                          onClick={item.type === 'slot' ? () => {
                            const slot = daySlots.slots.find(s => 
                              format(s.startTime, 'h:mm a') === item.start && 
                              format(s.endTime, 'h:mm a') === item.end
                            );
                            if (slot) {
                              toggleSlotSelection(daySlots.date, slot);
                            }
                          } : undefined}
                        >
                          <div className="flex items-center gap-2">
                            <div className={cn(
                              "w-2 h-2 rounded-full",
                              item.type === 'event' 
                                ? "bg-red-400" 
                                : item.isSelected 
                                  ? "bg-green-400" 
                                  : "bg-gray-400"
                            )} />
                            <span className="text-sm font-medium">
                              {item.isAllDay ? item.start : `${item.start} - ${item.end}`}
                            </span>
                            {item.type === 'event' && item.title && (
                              <span className="text-xs text-muted-foreground">
                                • {item.title}
                              </span>
                            )}
                          </div>
                          <Badge 
                            variant={item.type === 'event' ? "destructive" : "default"}
                            className={cn(
                              "text-xs",
                              item.type === 'event' 
                                ? "bg-red-100 text-red-800 border-red-300" 
                                : item.isSelected
                                  ? "bg-green-100 text-green-800 border-green-300"
                                  : "bg-gray-100 text-gray-600 border-gray-300"
                            )}
                          >
                            {item.type === 'event' ? 'Busy' : (item.isSelected ? 'Selected' : 'Available')}
                          </Badge>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No events or available slots for this day</p>
                      </div>
                    )}
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