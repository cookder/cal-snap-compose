import { format, startOfDay, endOfDay, addMinutes, isWithinInterval, parseISO } from 'date-fns';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';

export interface CalendarEvent {
  id: string;
  summary: string;
  start: {
    dateTime?: string;
    date?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
  };
  status: string;
}

export interface TimeSlot {
  start: string;
  end: string;
  startTime: Date;
  endTime: Date;
}

export interface AvailableSlot {
  date: Date;
  slots: TimeSlot[];
}

class GoogleCalendarService {
  private apiKey: string;
  private baseUrl = 'https://www.googleapis.com/calendar/v3';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async getCalendarEvents(calendarId: string = 'primary', startDate: Date, endDate: Date): Promise<CalendarEvent[]> {
    const timeMin = startOfDay(startDate).toISOString();
    const timeMax = endOfDay(endDate).toISOString();
    
    const url = `${this.baseUrl}/calendars/${encodeURIComponent(calendarId)}/events?` +
      `key=${this.apiKey}&` +
      `timeMin=${timeMin}&` +
      `timeMax=${timeMax}&` +
      `orderBy=startTime&` +
      `singleEvents=true`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Google Calendar API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.items || [];
    } catch (error) {
      console.error('Error fetching calendar events:', error);
      throw error;
    }
  }

  async getAvailableSlots(
    selectedDates: Date[], 
    slotDuration: 30 | 60 = 30,
    workingHours = { start: 9, end: 17 }
  ): Promise<AvailableSlot[]> {
    const availableSlots: AvailableSlot[] = [];
    
    for (const date of selectedDates) {
      try {
        // Get events for this specific date
        const events = await this.getCalendarEvents('primary', date, date);
        
        // Filter out all-day events and cancelled events
        const timedEvents = events.filter(event => 
          event.start.dateTime && 
          event.end.dateTime && 
          event.status !== 'cancelled'
        );

        // Convert events to time intervals
        const busyIntervals = timedEvents.map(event => ({
          start: new Date(event.start.dateTime!),
          end: new Date(event.end.dateTime!)
        }));

        // Generate available slots for this date
        const slots = this.generateAvailableSlots(date, busyIntervals, slotDuration, workingHours);
        
        if (slots.length > 0) {
          availableSlots.push({
            date,
            slots
          });
        }
      } catch (error) {
        console.error(`Error processing date ${date}:`, error);
        // Continue with other dates even if one fails
      }
    }

    return availableSlots;
  }

  private generateAvailableSlots(
    date: Date,
    busyIntervals: { start: Date; end: Date }[],
    slotDuration: number,
    workingHours: { start: number; end: number }
  ): TimeSlot[] {
    const slots: TimeSlot[] = [];
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    // Create working hours for the given date
    const workStart = new Date(date);
    workStart.setHours(workingHours.start, 0, 0, 0);
    
    const workEnd = new Date(date);
    workEnd.setHours(workingHours.end, 0, 0, 0);

    // Sort busy intervals by start time
    const sortedBusyIntervals = busyIntervals
      .filter(interval => 
        // Only include intervals that overlap with working hours
        interval.start < workEnd && interval.end > workStart
      )
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    let currentTime = new Date(workStart);

    // Check for slots before the first busy interval
    if (sortedBusyIntervals.length === 0) {
      // No meetings, entire working day is available
      while (currentTime.getTime() + (slotDuration * 60 * 1000) <= workEnd.getTime()) {
        const slotEnd = addMinutes(currentTime, slotDuration);
        
        slots.push({
          start: formatInTimeZone(currentTime, timezone, 'h:mm a'),
          end: formatInTimeZone(slotEnd, timezone, 'h:mm a'),
          startTime: new Date(currentTime),
          endTime: new Date(slotEnd)
        });
        
        currentTime = addMinutes(currentTime, slotDuration);
      }
    } else {
      // Check for slots between busy intervals
      for (let i = 0; i <= sortedBusyIntervals.length; i++) {
        let periodEnd: Date;
        
        if (i === 0) {
          // Before first meeting
          periodEnd = sortedBusyIntervals[0].start;
        } else if (i === sortedBusyIntervals.length) {
          // After last meeting
          currentTime = sortedBusyIntervals[i - 1].end;
          periodEnd = workEnd;
        } else {
          // Between meetings
          currentTime = sortedBusyIntervals[i - 1].end;
          periodEnd = sortedBusyIntervals[i].start;
        }

        // Generate slots for this free period
        while (currentTime.getTime() + (slotDuration * 60 * 1000) <= periodEnd.getTime()) {
          const slotEnd = addMinutes(currentTime, slotDuration);
          
          // Make sure slot doesn't extend beyond working hours
          if (slotEnd.getTime() <= workEnd.getTime()) {
            slots.push({
              start: formatInTimeZone(currentTime, timezone, 'h:mm a'),
              end: formatInTimeZone(slotEnd, timezone, 'h:mm a'),
              startTime: new Date(currentTime),
              endTime: new Date(slotEnd)
            });
          }
          
          currentTime = addMinutes(currentTime, slotDuration);
        }
      }
    }

    return slots;
  }

  async testConnection(): Promise<boolean> {
    try {
      const url = `${this.baseUrl}/calendars/primary?key=${this.apiKey}`;
      const response = await fetch(url);
      return response.ok;
    } catch (error) {
      console.error('Error testing Google Calendar connection:', error);
      return false;
    }
  }
}

export default GoogleCalendarService;