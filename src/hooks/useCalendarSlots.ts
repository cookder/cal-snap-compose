import { useState, useCallback, useMemo } from 'react';
import { format, addMinutes } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { TimeSlot, AvailableSlot } from '@/services/googleCalendarOAuth';

interface CalendarEvent {
  start: Date;
  end: Date;
}

interface UseCalendarSlotsOptions {
  workingHours?: { start: number; end: number };
}

export const useCalendarSlots = (options: UseCalendarSlotsOptions = {}) => {
  const { workingHours = { start: 9, end: 17 } } = options;
  const [availability, setAvailability] = useState<AvailableSlot[]>([]);

  const generateSlotsForDuration = useCallback((
    date: Date,
    busyIntervals: CalendarEvent[],
    slotDuration: number
  ): TimeSlot[] => {
    const slots: TimeSlot[] = [];
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    const workStart = new Date(date);
    workStart.setHours(workingHours.start, 0, 0, 0);
    
    const workEnd = new Date(date);
    workEnd.setHours(workingHours.end, 0, 0, 0);

    const sortedBusyIntervals = busyIntervals
      .filter(interval => interval.start < workEnd && interval.end > workStart)
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    let currentTime = new Date(workStart);

    if (sortedBusyIntervals.length === 0) {
      // No meetings, entire working day is available
      while (currentTime.getTime() + (slotDuration * 60 * 1000) <= workEnd.getTime()) {
        const slotEnd = addMinutes(currentTime, slotDuration);
        
        slots.push({
          start: formatInTimeZone(currentTime, timezone, 'h:mm a'),
          end: formatInTimeZone(slotEnd, timezone, 'h:mm a'),
          startTime: new Date(currentTime),
          endTime: new Date(slotEnd),
          selected: true,
          id: `${format(date, 'yyyy-MM-dd')}-${format(currentTime, 'HH:mm')}-${slotDuration}`
        });
        
        currentTime = addMinutes(currentTime, slotDuration);
      }
    } else {
      // Generate slots between meetings
      for (let i = 0; i <= sortedBusyIntervals.length; i++) {
        let periodEnd: Date;
        
        if (i === 0) {
          periodEnd = sortedBusyIntervals[0].start;
        } else if (i === sortedBusyIntervals.length) {
          currentTime = sortedBusyIntervals[i - 1].end;
          periodEnd = workEnd;
        } else {
          currentTime = sortedBusyIntervals[i - 1].end;
          periodEnd = sortedBusyIntervals[i].start;
        }

        while (currentTime.getTime() + (slotDuration * 60 * 1000) <= periodEnd.getTime()) {
          const slotEnd = addMinutes(currentTime, slotDuration);
          
          if (slotEnd.getTime() <= workEnd.getTime()) {
            slots.push({
              start: formatInTimeZone(currentTime, timezone, 'h:mm a'),
              end: formatInTimeZone(slotEnd, timezone, 'h:mm a'),
              startTime: new Date(currentTime),
              endTime: new Date(slotEnd),
              selected: true,
              id: `${format(date, 'yyyy-MM-dd')}-${format(currentTime, 'HH:mm')}-${slotDuration}`
            });
          }
          
          currentTime = addMinutes(currentTime, slotDuration);
        }
      }
    }

    return slots;
  }, [workingHours]);

  const generateGroupedSlots = useCallback((
    baseSlots: TimeSlot[],
    date: Date
  ): TimeSlot[] => {
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
      
      const durationMinutes = (endSlot.endTime.getTime() - currentSlot.startTime.getTime()) / (1000 * 60);
      
      groupedSlots.push({
        start: currentSlot.start,
        end: endSlot.end,
        startTime: currentSlot.startTime,
        endTime: endSlot.endTime,
        selected: true,
        id: `grouped-${format(date, 'yyyy-MM-dd')}-${format(currentSlot.startTime, 'HH:mm')}-${durationMinutes}`
      });
      
      i = j;
    }
    
    return groupedSlots;
  }, []);

  const toggleSlotSelection = useCallback((slotId: string) => {
    setAvailability(prev => {
      return prev.map(daySlot => ({
        ...daySlot,
        slots: daySlot.slots.map(slot => 
          slot.id === slotId ? { ...slot, selected: !slot.selected } : slot
        )
      }));
    });
  }, []);

  const selectAllSlots = useCallback(() => {
    setAvailability(prev => 
      prev.map(daySlot => ({
        ...daySlot,
        slots: daySlot.slots.map(slot => ({ ...slot, selected: true }))
      }))
    );
  }, []);

  const deselectAllSlots = useCallback(() => {
    setAvailability(prev => 
      prev.map(daySlot => ({
        ...daySlot,
        slots: daySlot.slots.map(slot => ({ ...slot, selected: false }))
      }))
    );
  }, []);

  const getSelectedSlots = useMemo(() => {
    return availability.map(daySlot => ({
      date: daySlot.date,
      slots: daySlot.slots.filter(slot => slot.selected)
    })).filter(daySlot => daySlot.slots.length > 0);
  }, [availability]);

  return {
    availability,
    setAvailability,
    generateSlotsForDuration,
    generateGroupedSlots,
    toggleSlotSelection,
    selectAllSlots,
    deselectAllSlots,
    getSelectedSlots
  };
};
