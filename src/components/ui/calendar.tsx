import * as React from "react";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: "text-sm font-medium",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-1",
        head_row: "flex",
        head_cell: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
        row: "flex w-full mt-2",
        cell: cn(
          "h-9 w-9 text-center text-sm p-0 relative",
          "[&:has([aria-selected].day-range-end)]:rounded-r-md",
          "[&:has([aria-selected]:not(.day-outside))]:bg-accent",
          "first:[&:has([aria-selected])]:rounded-l-md",
          "last:[&:has([aria-selected])]:rounded-r-md",
          "focus-within:relative focus-within:z-20"
        ),
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal relative",
          "bg-transparent hover:bg-accent hover:text-accent-foreground",
          "transition-all duration-200",
          // Add checkmark for selected dates
          "aria-selected:after:content-['✓'] aria-selected:after:absolute aria-selected:after:top-0 aria-selected:after:right-0.5 aria-selected:after:text-[10px] aria-selected:after:font-bold",
          // Add ring border for selected dates
          "aria-selected:ring-2 aria-selected:ring-primary aria-selected:ring-offset-1"
        ),
        day_range_end: "day-range-end",
        day_selected: cn(
          "bg-primary text-primary-foreground",
          "hover:bg-primary/90 hover:text-primary-foreground",
          "focus:bg-primary focus:text-primary-foreground",
          "font-bold shadow-md",
          // Enhance the checkmark for selected
          "after:text-primary-foreground after:drop-shadow-sm"
        ),
        day_today: cn(
          "bg-accent text-accent-foreground font-medium",
          "ring-1 ring-primary/50" // Add subtle ring to today
        ),
        day_outside: cn(
          "day-outside text-muted-foreground",
          "opacity-30",
          // Selected outside days: very clear visual treatment
          "aria-selected:opacity-100",
          "aria-selected:bg-primary/95",
          "aria-selected:text-primary-foreground",
          "aria-selected:font-bold",
          "aria-selected:shadow-md",
          "aria-selected:after:text-primary-foreground",
          // Deselected outside days: clearly transparent with subtle hover
          "[&:not([aria-selected])]:bg-transparent",
          "[&:not([aria-selected])]:hover:bg-accent/40",
          "[&:not([aria-selected])]:hover:opacity-60"
        ),
        day_disabled: cn(
          "text-muted-foreground opacity-30 cursor-not-allowed",
          "hover:bg-transparent hover:text-muted-foreground"
        ),
        day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ ..._props }) => <ChevronLeft className="h-4 w-4" />,
        IconRight: ({ ..._props }) => <ChevronRight className="h-4 w-4" />,
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
