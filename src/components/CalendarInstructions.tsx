import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Info, Calendar, Clock, Copy, Mail } from "lucide-react";

interface CalendarInstructionsProps {
  onDismiss: () => void;
}

export const CalendarInstructions = ({ onDismiss }: CalendarInstructionsProps) => {
  return (
    <Card className="mb-6 border-gmail-blue/20 bg-gmail-light/10">
      <CardHeader className="border-b border-gmail-blue/20">
        <CardTitle className="flex items-center gap-2 text-gmail-blue">
          <Info className="h-5 w-5" />
          How to Use Your Google Calendar Scheduler
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <div className="space-y-4">
          <Alert>
            <Calendar className="h-4 w-4" />
            <AlertDescription>
              This app connects to your Google Calendar to automatically find available time slots between 9 AM - 5 PM.
            </AlertDescription>
          </Alert>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <span className="bg-gmail-blue text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">1</span>
                Select Dates
              </h4>
              <p className="text-sm text-muted-foreground">
                Choose the dates you want to check for availability using the calendar.
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <span className="bg-gmail-blue text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">2</span>
                Choose Duration
              </h4>
              <p className="text-sm text-muted-foreground">
                Select whether you want 30-minute or 1-hour available slots.
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <span className="bg-gmail-blue text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">3</span>
                Review Available Slots
              </h4>
              <p className="text-sm text-muted-foreground">
                The app will show your existing events and highlight available time slots.
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <span className="bg-gmail-blue text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">4</span>
                Share Your Availability
              </h4>
              <p className="text-sm text-muted-foreground">
                Copy the generated text and paste it into your emails to share your availability.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Working hours: 9:00 AM - 5:00 PM</span>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onDismiss}
              className="ml-auto"
            >
              Got it!
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};