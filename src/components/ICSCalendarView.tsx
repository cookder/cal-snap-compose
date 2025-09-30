import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon, Clock, FileText, Trash2, RefreshCw } from 'lucide-react';
import { format, isSameDay, startOfDay, endOfDay, isToday, isTomorrow, addMinutes } from 'date-fns';
import { cn } from '@/lib/utils';
import { TimeSlotDisplay } from './ICSCalendarViewTimeSlots';
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
  onSelectedSlotsChange: (selectedSlots: { date: Date; slots: TimeSlot[] }[]) => void;
  onClearEvents: () => void;
  onTogglePanel?: () => void;
  showToggle?: boolean;
}

export function ICSCalendarView({ events, onAvailabilityChange, onSelectedSlotsChange, onClearEvents, onTogglePanel, showToggle }: ICSCalendarViewProps) {
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [selectedDurations, setSelectedDurations] = useState<Set<15 | 30 | 60 | 'custom' | 'grouped'>>(new Set([30, 60]));
  const [customDuration, setCustomDuration] = useState<number>(45);
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
              start: format(currentTime, 'h:mm a'),
              end: format(slotEnd, 'h:mm a'),
              startTime: new Date(currentTime),
              endTime: new Date(slotEnd),
              selected: true,
              id: `${format(selectedDate, 'yyyy-MM-dd')}-${format(currentTime, 'HH:mm')}-${duration}`
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
            start: format(currentTime, 'h:mm a'),
            end: format(slotEnd, 'h:mm a'),
            startTime: new Date(currentTime),
            endTime: new Date(slotEnd),
            selected: true,
            id: `${format(selectedDate, 'yyyy-MM-dd')}-${format(currentTime, 'HH:mm')}-${duration}`
          });
        }

        currentTime = addMinutes(currentTime, duration);
      }

    return timeSlots;
  };

  // Generate availability for all selected dates
  const generateAvailability = () => {
    // When no dates are selected we should clear all state.
    // Without this the parent component may continue to display stale slots
    // from a previous selection, because onSelectedSlotsChange is never invoked
    // when there are no selected dates.
    if (selectedDates.length === 0) {
      // Clear local availability state
      setAvailability([]);
      // Inform parent that there are no available slots
      onAvailabilityChange([]);
      // Also clear any previously selected slots to avoid stale selections
      onSelectedSlotsChange([]);
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

      // Generate slots based on selected durations
      if (selectedDurations.has('grouped')) {
        // Generate 30-minute base slots first
        const baseSlots = generateSlotsForDuration(selectedDate, blockingEvents, 30);
        
        // Group consecutive slots
        const groupedSlots: TimeSlot[] = [];
        let i = 0;
        
        while (i < baseSlots.length) {
          const currentSlot = baseSlots[i];
          let endSlot = currentSlot;
          let j = i + 1;
          
          // Find consecutive slots
          while (j < baseSlots.length && baseSlots[j].startTime.getTime() === endSlot.endTime.getTime()) {
            endSlot = baseSlots[j];
            j++;
          }
          
          // Calculate duration in minutes
          const durationMinutes = (endSlot.endTime.getTime() - currentSlot.startTime.getTime()) / (1000 * 60);
          
          // Create grouped slot
          groupedSlots.push({
            start: currentSlot.start,
            end: endSlot.end,
            startTime: currentSlot.startTime,
            endTime: endSlot.endTime,
            selected: true,
            id: `grouped-${format(selectedDate, 'yyyy-MM-dd')}-${format(currentSlot.startTime, 'HH:mm')}-${durationMinutes}`
          });
          
          i = j;
        }
        
        allTimeSlots = [...allTimeSlots, ...groupedSlots];
      }
      
      // Generate slots for standard durations (15, 30, 60)
      const standardDurations = [15, 30, 60].filter(d => selectedDurations.has(d as 15 | 30 | 60));
      for (const duration of standardDurations) {
        const slots = generateSlotsForDuration(selectedDate, blockingEvents, duration);
        slots.forEach(slot => {
          slot.id = `${duration}-${slot.id}`;
        });
        allTimeSlots = [...allTimeSlots, ...slots];
      }
      
      // Generate custom duration slots
      if (selectedDurations.has('custom') && customDuration > 0) {
        const customSlots = generateSlotsForDuration(selectedDate, blockingEvents, customDuration);
        customSlots.forEach(slot => {
          slot.id = `custom-${slot.id}`;
        });
        allTimeSlots = [...allTimeSlots, ...customSlots];
      }
      
      // Sort all slots by start time
      allTimeSlots.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

      availableSlots.push({
        date: selectedDate,
        slots: allTimeSlots
      });
    }

    setAvailability(availableSlots);
    onAvailabilityChange(availableSlots);
    
    // Update selected slots callback
    const selectedSlots = availableSlots.map(daySlot => ({
      date: daySlot.date,
      slots: daySlot.slots.filter(slot => slot.selected)
    })).filter(daySlot => daySlot.slots.length > 0);
    
    onSelectedSlotsChange(selectedSlots);
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

  // Auto-generate availability when dates or slot duration changes
  useEffect(() => {
    generateAvailability();
  }, [selectedDates, selectedDurations, customDuration, events]);

  // Remove a selected date
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
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onClearEvents}
              className="h-6 px-2 text-xs flex items-center gap-1"
            >
              <Trash2 className="h-3 w-3" />
              Clear
            </Button>
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
          </div>
        </CardTitle>
        <CardDescription className="text-xs">
          {events.length} events imported. Select dates to find available time slots.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 pt-2">
        {/* Slot Duration Selection */}
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
                  position: 'relative'
                }
              }}
              modifiersClassNames={{
                hasEvents: 'relative before:absolute before:bottom-0 before:left-1/2 before:transform before:-translate-x-1/2 before:w-1 before:h-1 before:bg-primary before:rounded-full before:content-[""]'
              }}
            />
        </div>

        {/* Available Slots Display - Grid Layout */}
        {selectedDates.length > 0 && (
          <TimeSlotDisplay
            availability={availability}
            slotDuration="mixed"
            getEventsForDate={getEventsForDate}
            isAllDayEvent={isAllDayEvent}
            generateSlotsForDuration={generateSlotsForDuration}
            toggleSlotSelection={toggleSlotSelection}
            removeDate={removeDate}
            formatDateDisplay={formatDateDisplay}
          />
        )}
      </CardContent>
    </Card>
  );
}