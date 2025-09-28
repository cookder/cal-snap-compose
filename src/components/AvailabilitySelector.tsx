import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CalendarDays, Clock, Plus, X } from "lucide-react";
import { format, isToday, isTomorrow } from "date-fns";

interface TimeSlot {
  start: string;
  end: string;
}

interface AvailabilityItem {
  date: Date;
  slots: TimeSlot[];
}

interface AvailabilitySelectorProps {
  onAvailabilityChange: (availability: AvailabilityItem[]) => void;
}

const commonTimeSlots = [
  { start: "9:00 AM", end: "10:00 AM" },
  { start: "10:00 AM", end: "11:00 AM" },
  { start: "11:00 AM", end: "12:00 PM" },
  { start: "1:00 PM", end: "2:00 PM" },
  { start: "2:00 PM", end: "3:00 PM" },
  { start: "3:00 PM", end: "4:00 PM" },
  { start: "4:00 PM", end: "5:00 PM" },
];

export const AvailabilitySelector = ({ onAvailabilityChange }: AvailabilitySelectorProps) => {
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [availability, setAvailability] = useState<AvailabilityItem[]>([]);

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    
    const dateExists = selectedDates.some(d => d.toDateString() === date.toDateString());
    if (!dateExists) {
      const newDates = [...selectedDates, date];
      setSelectedDates(newDates);
      
      const newAvailability = [...availability, { date, slots: [] }];
      setAvailability(newAvailability);
      onAvailabilityChange(newAvailability);
    }
  };

  const removeDate = (dateToRemove: Date) => {
    const newDates = selectedDates.filter(d => d.toDateString() !== dateToRemove.toDateString());
    setSelectedDates(newDates);
    
    const newAvailability = availability.filter(a => a.date.toDateString() !== dateToRemove.toDateString());
    setAvailability(newAvailability);
    onAvailabilityChange(newAvailability);
  };

  const addTimeSlot = (date: Date, slot: TimeSlot) => {
    const newAvailability = availability.map(item => {
      if (item.date.toDateString() === date.toDateString()) {
        const slotExists = item.slots.some(s => s.start === slot.start && s.end === slot.end);
        if (!slotExists) {
          return { ...item, slots: [...item.slots, slot] };
        }
      }
      return item;
    });
    setAvailability(newAvailability);
    onAvailabilityChange(newAvailability);
  };

  const removeTimeSlot = (date: Date, slotToRemove: TimeSlot) => {
    const newAvailability = availability.map(item => {
      if (item.date.toDateString() === date.toDateString()) {
        return {
          ...item,
          slots: item.slots.filter(s => !(s.start === slotToRemove.start && s.end === slotToRemove.end))
        };
      }
      return item;
    });
    setAvailability(newAvailability);
    onAvailabilityChange(newAvailability);
  };

  const formatDateDisplay = (date: Date) => {
    if (isToday(date)) return "Today";
    if (isTomorrow(date)) return "Tomorrow";
    return format(date, "MMM d");
  };

  return (
    <Card className="h-full shadow-md">
      <CardHeader className="pb-3 bg-gmail-light border-b">
        <CardTitle className="flex items-center gap-2 text-foreground">
          <CalendarDays className="h-5 w-5 text-gmail-blue" />
          Select Your Availability
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 h-full overflow-auto">
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium mb-2">Choose dates:</h3>
            <Calendar
              mode="single"
              selected={undefined}
              onSelect={handleDateSelect}
              disabled={(date) => date < new Date()}
              className="rounded-md border w-full"
            />
          </div>

          {selectedDates.length > 0 && (
            <>
              <Separator />
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Add time slots:</h3>
                {availability.map((item) => (
                  <div key={item.date.toISOString()} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium flex items-center gap-2">
                        <Clock className="h-4 w-4 text-gmail-blue" />
                        {formatDateDisplay(item.date)} ({format(item.date, "EEE, MMM d")})
                      </h4>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => removeDate(item.date)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                      {commonTimeSlots.map((slot) => {
                        const isSelected = item.slots.some(s => s.start === slot.start && s.end === slot.end);
                        return (
                          <Button
                            key={`${slot.start}-${slot.end}`}
                            variant={isSelected ? "default" : "outline"}
                            size="sm"
                            className={isSelected ? "bg-gmail-blue hover:bg-gmail-hover text-white" : ""}
                            onClick={() => {
                              if (isSelected) {
                                removeTimeSlot(item.date, slot);
                              } else {
                                addTimeSlot(item.date, slot);
                              }
                            }}
                          >
                            {slot.start} - {slot.end}
                          </Button>
                        );
                      })}
                    </div>

                    {item.slots.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {item.slots.map((slot, index) => (
                          <Badge
                            key={index}
                            variant="secondary"
                            className="bg-gmail-light text-gmail-blue border-gmail-blue/20"
                          >
                            {slot.start} - {slot.end}
                            <button
                              onClick={() => removeTimeSlot(item.date, slot)}
                              className="ml-1 hover:text-destructive"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};