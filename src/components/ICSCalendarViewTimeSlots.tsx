import React from 'react';
import { Button } from '@/components/ui/button';
import { Clock, CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { AvailableSlot, TimeSlot } from '@/services/googleCalendarOAuth';

interface CalendarEvent {
  id: string;
  summary: string;
  start: Date;
  end: Date;
  description?: string;
  location?: string;
}

interface TimeSlotDisplayProps {
  availability: AvailableSlot[];
  slotDuration: 'mixed' | 15 | 30 | 60 | 'both' | 'custom' | 'grouped';
  getEventsForDate: (date: Date) => CalendarEvent[];
  isAllDayEvent: (event: CalendarEvent) => boolean;
  generateSlotsForDuration: (date: Date, blockingEvents: CalendarEvent[], duration: number) => TimeSlot[];
  toggleSlotSelection: (slotId: string) => void;
  removeDate: (date: Date) => void;
  formatDateDisplay: (date: Date) => string;
}

export function TimeSlotDisplay({
  availability,
  slotDuration,
  getEventsForDate,
  isAllDayEvent,
  generateSlotsForDuration,
  toggleSlotSelection,
  removeDate,
  formatDateDisplay
}: TimeSlotDisplayProps) {
  if (availability.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">Available Time Slots</h3>
      
      <div className="grid grid-cols-1 gap-3">
        {availability.map((daySlots) => {
          const dayEvents = getEventsForDate(daySlots.date);
          return (
            <div key={daySlots.date.toISOString()} className="border rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
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
                  if (slotDuration === 'grouped') {
                    // Grouped mode - show consolidated time chunks
                    return (
                      <div className="space-y-2">
                        <p className="text-xs font-medium mb-2 text-purple-700 dark:text-purple-400">
                          Grouped time chunks ({daySlots.slots.length} available, {daySlots.slots.filter(s => s.selected).length} selected):
                        </p>
                        {daySlots.slots.length > 0 ? (
                          <div className="flex flex-col gap-1">
                            {daySlots.slots.map((slot, index) => {
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
                        ) : (
                          <p className="text-xs text-muted-foreground">No grouped slots available</p>
                        )}
                        
                        {/* Existing events */}
                        {dayEvents.filter(e => !isAllDayEvent(e)).length > 0 && (
                          <div className="pt-1">
                            <p className="text-xs font-medium mb-2 text-red-700 dark:text-red-400">
                              Existing events ({dayEvents.filter(e => !isAllDayEvent(e)).length}):
                            </p>
                            <div className="space-y-1">
                              {dayEvents
                                .filter(event => !isAllDayEvent(event))
                                .sort((a, b) => a.start.getTime() - b.start.getTime())
                                .map((event, index) => (
                                  <div
                                    key={index}
                                    className="flex items-center justify-between p-2 bg-red-50 dark:bg-red-950/30 rounded-md border border-red-200 dark:border-red-800"
                                  >
                                    <div className="flex-1">
                                      <span className="text-sm font-medium text-red-800 dark:text-red-300">
                                        {format(event.start, 'h:mm a')} - {format(event.end, 'h:mm a')}
                                      </span>
                                      <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                                        {event.summary}
                                      </p>
                                    </div>
                                    <CalendarIcon className="h-3 w-3 text-red-600 dark:text-red-400" />
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  } else if (slotDuration === 'both') {
                    return (
                      <div className="space-y-3">
                        {/* 30-minute slots */}
                        <div>
                          <p className="text-xs font-medium mb-2 text-blue-700 dark:text-blue-400">
                            30-minute slots ({daySlots.slots.filter(s => s.id?.startsWith('30-')).length} available, {daySlots.slots.filter(s => s.id?.startsWith('30-') && s.selected).length} selected):
                          </p>
                          {(() => {
                            const slots30 = daySlots.slots.filter(s => s.id?.startsWith('30-'));
                            return slots30.length > 0 ? (
                               <div className="flex flex-col gap-1">
                                {slots30.map((slot, index) => (
                                  <button
                                    key={`30-${index}`}
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
                            ) : (
                              <p className="text-xs text-muted-foreground">No 30-min slots available</p>
                            );
                          })()}
                        </div>

                        {/* 60-minute slots */}
                        <div>
                          <p className="text-xs font-medium mb-2 text-green-700 dark:text-green-400">
                            60-minute slots ({daySlots.slots.filter(s => s.id?.startsWith('60-')).length} available, {daySlots.slots.filter(s => s.id?.startsWith('60-') && s.selected).length} selected):
                          </p>
                          {(() => {
                            const slots60 = daySlots.slots.filter(s => s.id?.startsWith('60-'));
                            return slots60.length > 0 ? (
                              <div className="flex flex-col gap-1">
                                {slots60.map((slot, index) => (
                                  <button
                                    key={`60-${index}`}
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
                            ) : (
                              <p className="text-xs text-muted-foreground">No 60-min slots available</p>
                            );
                          })()}
                        </div>

                        {/* Existing events */}
                        {dayEvents.filter(e => !isAllDayEvent(e)).length > 0 && (
                          <div>
                            <p className="text-xs font-medium mb-2 text-red-700 dark:text-red-400">
                              Existing events ({dayEvents.filter(e => !isAllDayEvent(e)).length}):
                            </p>
                            <div className="space-y-1">
                              {dayEvents
                                .filter(event => !isAllDayEvent(event))
                                .sort((a, b) => a.start.getTime() - b.start.getTime())
                                .map((event, index) => (
                                  <div
                                    key={index}
                                    className="flex items-center justify-between p-2 bg-red-50 dark:bg-red-950/30 rounded-md border border-red-200 dark:border-red-800"
                                  >
                                    <div className="flex-1">
                                      <span className="text-sm font-medium text-red-800 dark:text-red-300">
                                        {format(event.start, 'h:mm a')} - {format(event.end, 'h:mm a')}
                                      </span>
                                      <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                                        {event.summary}
                                      </p>
                                    </div>
                                    <CalendarIcon className="h-3 w-3 text-red-600 dark:text-red-400" />
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  } else {
                    // Single duration mode - grid layout
                    const allItems: Array<{
                      type: 'available' | 'busy';
                      start: string;
                      end: string;
                      startTime: Date;
                      title?: string;
                      selected?: boolean;
                      id?: string;
                    }> = [];

                    // Add available slots
                    daySlots.slots.forEach(slot => {
                      allItems.push({
                        type: 'available',
                        start: slot.start,
                        end: slot.end,
                        startTime: slot.startTime,
                        selected: slot.selected,
                        id: slot.id
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
                          Time slots ({daySlots.slots.length} available, {daySlots.slots.filter(s => s.selected).length} selected{dayEvents.filter(e => !isAllDayEvent(e)).length ? `, ${dayEvents.filter(e => !isAllDayEvent(e)).length} busy` : ''}):
                        </p>
                        <div className="space-y-2">
                          <div className="space-y-1">
                            {daySlots.slots.length > 0 ? (
                              daySlots.slots.map((slot, index) => (
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
                              ))
                            ) : (
                              <p className="text-xs text-muted-foreground">No slots available</p>
                            )}
                          </div>
                          {dayEvents.filter(e => !isAllDayEvent(e)).length > 0 && (
                            <div className="pt-1">
                              <p className="text-xs font-medium mb-2 text-red-700 dark:text-red-400">
                                Existing events ({dayEvents.filter(e => !isAllDayEvent(e)).length}):
                              </p>
                              <div className="space-y-1">
                                {dayEvents
                                  .filter(event => !isAllDayEvent(event))
                                  .sort((a, b) => a.start.getTime() - b.start.getTime())
                                  .map((event, index) => (
                                    <div
                                      key={index}
                                      className="flex items-center justify-between p-2 bg-red-50 dark:bg-red-950/30 rounded-md border border-red-200 dark:border-red-800"
                                    >
                                      <div className="flex-1">
                                        <span className="text-sm font-medium text-red-800 dark:text-red-300">
                                          {format(event.start, 'h:mm a')} - {format(event.end, 'h:mm a')}
                                        </span>
                                        <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                                          {event.summary}
                                        </p>
                                      </div>
                                      <CalendarIcon className="h-3 w-3 text-red-600 dark:text-red-400" />
                                    </div>
                                  ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </>
                    );
                  }
                })()}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
