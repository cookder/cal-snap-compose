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
  slotDuration: 30 | 60 | 'both' | 'custom';
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
      
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
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
                  if (slotDuration === 'both') {
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
                         <div className="grid grid-cols-4 gap-1 items-start">
                                 {slots30.map((slot, index) => {
                                   const duration = 30; // 30 minutes
                                   // Proportional heights: 15min=h-8, 30min=h-16, 60min=h-32, 90min=h-48, 120min=h-64
                                   const heightClass = duration <= 15 ? 'h-8' : 
                                                     duration <= 30 ? 'h-16' : 
                                                     duration <= 60 ? 'h-32' : 
                                                     duration <= 90 ? 'h-48' : 'h-64';
                                   return (
                                     <button
                                       key={`30-${index}`}
                                       onClick={() => toggleSlotSelection(slot.id!)}
                                       className={`p-2 rounded-md border transition-all text-xs flex flex-col justify-between ${heightClass} ${
                                         slot.selected
                                           ? 'bg-blue-100 dark:bg-blue-900/50 border-blue-300 dark:border-blue-700 ring-2 ring-blue-500 ring-opacity-50'
                                           : 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 hover:bg-blue-75 dark:hover:bg-blue-900/40'
                                       }`}
                                     >
                                       <div className="font-medium text-blue-800 dark:text-blue-300">
                                         {slot.start}-{slot.end}
                                       </div>
                                       <div className="text-xs opacity-75">30m</div>
                                     </button>
                                   );
                                 })}
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
                         <div className="grid grid-cols-4 gap-1 items-start">
                                 {slots60.map((slot, index) => {
                                   const duration = 60; // 60 minutes  
                                   // Proportional heights: 15min=h-8, 30min=h-16, 60min=h-32, 90min=h-48, 120min=h-64
                                   const heightClass = duration <= 15 ? 'h-8' : 
                                                     duration <= 30 ? 'h-16' : 
                                                     duration <= 60 ? 'h-32' : 
                                                     duration <= 90 ? 'h-48' : 'h-64';
                                   return (
                                     <button
                                       key={`60-${index}`}
                                       onClick={() => toggleSlotSelection(slot.id!)}
                                       className={`p-2 rounded-md border transition-all text-xs flex flex-col justify-between ${heightClass} ${
                                         slot.selected
                                           ? 'bg-green-100 dark:bg-green-900/50 border-green-300 dark:border-green-700 ring-2 ring-green-500 ring-opacity-50'
                                           : 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800 hover:bg-green-75 dark:hover:bg-green-900/40'
                                       }`}
                                     >
                                       <div className="font-medium text-green-800 dark:text-green-300">
                                         {slot.start}-{slot.end}
                                       </div>
                                       <div className="text-xs opacity-75">60m</div>
                                     </button>
                                   );
                                 })}
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
                             <div className="grid grid-cols-4 gap-1 items-start">
                               {dayEvents
                                 .filter(event => !isAllDayEvent(event))
                                 .sort((a, b) => a.start.getTime() - b.start.getTime())
                                 .map((event, index) => {
                                   const durationMs = event.end.getTime() - event.start.getTime();
                                   const durationMinutes = Math.round(durationMs / (1000 * 60));
                                   // Proportional heights: 15min=h-8, 30min=h-16, 60min=h-32, 90min=h-48, 120min=h-64
                                   const heightClass = durationMinutes <= 15 ? 'h-8' : 
                                                     durationMinutes <= 30 ? 'h-16' : 
                                                     durationMinutes <= 60 ? 'h-32' : 
                                                     durationMinutes <= 90 ? 'h-48' : 'h-64';
                                   
                                   return (
                                     <div
                                       key={index}
                                       className={`p-2 bg-red-50 dark:bg-red-950/30 rounded-md border border-red-200 dark:border-red-800 text-xs flex flex-col ${heightClass}`}
                                     >
                                       <div className="font-medium text-red-800 dark:text-red-300 leading-tight">
                                         {format(event.start, 'HH:mm')} - {format(event.end, 'HH:mm')}
                                       </div>
                                       <div className="text-red-600 dark:text-red-400 flex-1 py-1 overflow-hidden leading-tight break-words">
                                         {event.summary}
                                       </div>
                                       <div className="text-xs opacity-75 mt-auto">{durationMinutes}m</div>
                                     </div>
                                   );
                                 })}
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
                          Time slots ({daySlots.slots.length} available, {daySlots.slots.filter(s => s.selected).length} selected, {dayEvents.filter(e => !isAllDayEvent(e)).length} busy):
                        </p>
                         <div className="flex gap-1">
                           {/* Time axis on the left */}
                           <div className="flex flex-col gap-1 w-16 text-xs text-muted-foreground">
                             {(() => {
                               // Group items by time ranges for the time axis
                               const timeRanges: string[] = [];
                               const groupedItems: Array<typeof allItems> = [];
                               
                               // Sort all items by start time first
                               const sortedItems = [...allItems].sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
                               
                               // Group items into rows (4 items per row)
                               for (let i = 0; i < sortedItems.length; i += 4) {
                                 const rowItems = sortedItems.slice(i, i + 4);
                                 groupedItems.push(rowItems);
                                 
                                 if (rowItems.length > 0) {
                                   const firstItem = rowItems[0];
                                   const lastItem = rowItems[rowItems.length - 1];
                                   timeRanges.push(`${firstItem.start}-${lastItem.end}`);
                                 }
                               }
                               
                               return timeRanges.map((timeRange, index) => {
                                 let durationMinutes = 30; // default for height calculation
                                 if (groupedItems[index] && groupedItems[index].length > 0) {
                                   const firstItem = groupedItems[index][0];
                                   if (firstItem.type === 'available') {
                                     const [startHour, startMin] = firstItem.start.split(':').map(Number);
                                     const [endHour, endMin] = firstItem.end.split(':').map(Number);
                                     durationMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
                                   } else {
                                     durationMinutes = parseInt(firstItem.end.split(':')[0]) * 60 + parseInt(firstItem.end.split(':')[1]) - 
                                       (parseInt(firstItem.start.split(':')[0]) * 60 + parseInt(firstItem.start.split(':')[1]));
                                   }
                                 }
                                 
                                 const heightClass = durationMinutes <= 15 ? 'h-8' : 
                                                   durationMinutes <= 30 ? 'h-16' : 
                                                   durationMinutes <= 60 ? 'h-32' : 
                                                   durationMinutes <= 90 ? 'h-48' : 'h-64';
                                 
                                 return (
                                   <div key={index} className={`flex items-center justify-center border-r border-muted/30 ${heightClass} bg-muted/10 rounded-l-md px-1`}>
                                     <span className="transform -rotate-90 whitespace-nowrap text-[10px] font-mono">
                                       {timeRange}
                                     </span>
                                   </div>
                                 );
                               });
                             })()}
                           </div>
                           
                           {/* Main grid content */}
                           <div className="grid grid-cols-4 gap-1 items-start flex-1">
                           {allItems.map((item, index) => {
                             let durationMinutes = 30; // default
                             if (item.type === 'available') {
                               // Calculate duration from time strings
                               const [startHour, startMin] = item.start.split(':').map(Number);
                               const [endHour, endMin] = item.end.split(':').map(Number);
                               durationMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
                             } else {
                               // Calculate duration from Date objects for busy events
                               const durationMs = item.startTime.getTime() - item.startTime.getTime();
                               durationMinutes = Math.round(durationMs / (1000 * 60)) || 
                                 parseInt(item.end.split(':')[0]) * 60 + parseInt(item.end.split(':')[1]) - 
                                 (parseInt(item.start.split(':')[0]) * 60 + parseInt(item.start.split(':')[1]));
                             }
                             
                             // Proportional heights: 15min=h-8, 30min=h-16, 60min=h-32, 90min=h-48, 120min=h-64
                             const heightClass = durationMinutes <= 15 ? 'h-8' : 
                                               durationMinutes <= 30 ? 'h-16' : 
                                               durationMinutes <= 60 ? 'h-32' : 
                                               durationMinutes <= 90 ? 'h-48' : 'h-64';
                             
                             return item.type === 'available' ? (
                               <button
                                 key={index}
                                 onClick={() => toggleSlotSelection(item.id!)}
                                 className={`p-2 rounded-md border transition-all text-xs flex flex-col justify-between ${heightClass} ${
                                   item.selected
                                     ? 'bg-green-100 dark:bg-green-900/50 border-green-300 dark:border-green-700 ring-2 ring-green-500 ring-opacity-50'
                                     : 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800 hover:bg-green-75 dark:hover:bg-green-900/40'
                                 }`}
                               >
                                 <div className="font-medium text-green-800 dark:text-green-300">
                                   {item.start}-{item.end}
                                 </div>
                                 <div className="text-xs opacity-75">{durationMinutes}m</div>
                               </button>
                             ) : (
                               <div
                                 key={index}
                                 className={`p-2 bg-red-50 dark:bg-red-950/30 rounded-md border border-red-200 dark:border-red-800 text-xs flex flex-col ${heightClass}`}
                               >
                                 <div className="font-medium text-red-800 dark:text-red-300 leading-tight">
                                   {item.start}-{item.end}
                                 </div>
                                 {item.title && (
                                   <div className="text-red-600 dark:text-red-400 flex-1 py-1 overflow-hidden leading-tight break-words">
                                     {item.title}
                                   </div>
                                 )}
                                 <div className="text-xs opacity-75 mt-auto">{durationMinutes}m</div>
                               </div>
                             );
                            })}
                          </div>
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
