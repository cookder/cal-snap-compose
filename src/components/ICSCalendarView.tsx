import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Clock, MapPin, FileText, Trash2 } from 'lucide-react';
import { format, parseISO, isWithinInterval, startOfDay, endOfDay, isSameDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { AvailableSlot } from '@/services/googleCalendarOAuth';

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
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTimeRange, setSelectedTimeRange] = useState<{start: string, end: string}>({
    start: '09:00',
    end: '17:00'
  });

  // Get events for a specific date
  const getEventsForDate = (date: Date) => {
    return events.filter(event => 
      isSameDay(event.start, date) || 
      isSameDay(event.end, date) ||
      (date >= startOfDay(event.start) && date <= endOfDay(event.end))
    );
  };

  // Generate availability based on selected date and events
  const generateAvailability = () => {
    if (!selectedDate) return;

    const dayEvents = getEventsForDate(selectedDate);
    const timeSlots: any[] = [];

    // Parse time range
    const [startHour, startMinute] = selectedTimeRange.start.split(':').map(Number);
    const [endHour, endMinute] = selectedTimeRange.end.split(':').map(Number);
    
    const dayStart = new Date(selectedDate);
    dayStart.setHours(startHour, startMinute, 0, 0);
    
    const dayEnd = new Date(selectedDate);
    dayEnd.setHours(endHour, endMinute, 0, 0);

    // Sort events by start time
    const sortedEvents = dayEvents
      .filter(event => event.start < dayEnd && event.end > dayStart)
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    let currentTime = dayStart;

    // Find gaps between events
    for (const event of sortedEvents) {
      const eventStart = new Date(Math.max(event.start.getTime(), dayStart.getTime()));
      const eventEnd = new Date(Math.min(event.end.getTime(), dayEnd.getTime()));

      // Add availability slot before this event if there's a gap
      if (currentTime < eventStart) {
        timeSlots.push({
          start: format(currentTime, 'HH:mm'),
          end: format(eventStart, 'HH:mm'),
          startTime: new Date(currentTime),
          endTime: new Date(eventStart)
        });
      }

      // Move current time to after this event
      currentTime = new Date(Math.max(currentTime.getTime(), eventEnd.getTime()));
    }

    // Add final slot if there's time remaining
    if (currentTime < dayEnd) {
      timeSlots.push({
        start: format(currentTime, 'HH:mm'),
        end: format(dayEnd, 'HH:mm'),
        startTime: new Date(currentTime),
        endTime: new Date(dayEnd)
      });
    }

    const availability: AvailableSlot[] = [{
      date: selectedDate,
      slots: timeSlots
    }];

    onAvailabilityChange(availability);
  };

  // Auto-generate availability when date or time range changes
  useEffect(() => {
    if (selectedDate) {
      generateAvailability();
    }
  }, [selectedDate, selectedTimeRange, events]);

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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Imported Calendar
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onClearEvents}
            className="flex items-center gap-1"
          >
            <Trash2 className="h-3 w-3" />
            Clear
          </Button>
        </CardTitle>
        <CardDescription>
          {events.length} events imported. Select a date to find available time slots.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Calendar */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Select Date</h4>
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            className={cn("rounded-md border pointer-events-auto")}
            modifiers={{
              hasEvents: uniqueEventDates
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

        {/* Time Range Selection */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Working Hours</h4>
          <div className="flex items-center gap-2">
            <input
              type="time"
              value={selectedTimeRange.start}
              onChange={(e) => setSelectedTimeRange(prev => ({ ...prev, start: e.target.value }))}
              className="px-2 py-1 border rounded text-sm"
            />
            <span className="text-sm text-muted-foreground">to</span>
            <input
              type="time"
              value={selectedTimeRange.end}
              onChange={(e) => setSelectedTimeRange(prev => ({ ...prev, end: e.target.value }))}
              className="px-2 py-1 border rounded text-sm"
            />
          </div>
        </div>

        {/* Selected Date Events */}
        {selectedDate && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">
              Events on {format(selectedDate, 'MMMM d, yyyy')}
            </h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {getEventsForDate(selectedDate).map((event) => (
                <div key={event.id} className="p-3 border rounded-lg bg-muted/50">
                  <div className="font-medium text-sm">{event.summary}</div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                    <Clock className="h-3 w-3" />
                    {format(event.start, 'HH:mm')} - {format(event.end, 'HH:mm')}
                  </div>
                  {event.location && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                      <MapPin className="h-3 w-3" />
                      {event.location}
                    </div>
                  )}
                  {event.description && (
                    <div className="flex items-start gap-2 text-xs text-muted-foreground mt-1">
                      <FileText className="h-3 w-3 mt-0.5" />
                      <span className="line-clamp-2">{event.description}</span>
                    </div>
                  )}
                </div>
              ))}
              {getEventsForDate(selectedDate).length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-4">
                  No events on this date
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}