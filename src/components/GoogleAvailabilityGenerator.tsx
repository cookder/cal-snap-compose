import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Copy, FileText, CheckCircle, Calendar } from "lucide-react";
import { format, isToday, isTomorrow } from "date-fns";
import { AvailableSlot } from "@/services/googleCalendar";

interface GoogleAvailabilityGeneratorProps {
  availability: AvailableSlot[];
  onTextGenerated: (text: string) => void;
}

export const GoogleAvailabilityGenerator = ({ availability, onTextGenerated }: GoogleAvailabilityGeneratorProps) => {
  const [generatedText, setGeneratedText] = useState("");
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const formatDateForText = (date: Date) => {
    if (isToday(date)) return "Today";
    if (isTomorrow(date)) return "Tomorrow";
    return format(date, "EEEE, MMMM d");
  };

  const generateAvailabilityText = () => {
    if (availability.length === 0) return "";

    const availabilityWithSlots = availability.filter(item => item.slots.length > 0);
    
    if (availabilityWithSlots.length === 0) return "";

    let text = "Here are my available time slots:\n\n";
    
    availabilityWithSlots.forEach((item, index) => {
      text += `${formatDateForText(item.date)}:\n`;
      item.slots.forEach((slot) => {
        text += `• ${slot.start} - ${slot.end}\n`;
      });
      if (index < availabilityWithSlots.length - 1) {
        text += "\n";
      }
    });

    text += "\nPlease let me know which time works best for you!";

    return text;
  };

  useEffect(() => {
    const text = generateAvailabilityText();
    setGeneratedText(text);
    onTextGenerated(text);
    setCopied(false);
  }, [availability, onTextGenerated]);

  const copyToClipboard = async () => {
    if (!generatedText) return;
    
    try {
      await navigator.clipboard.writeText(generatedText);
      setCopied(true);
      toast({
        title: "Copied to clipboard",
        description: "Your availability has been copied and is ready to paste into your email.",
      });
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      toast({
        title: "Failed to copy",
        description: "Please select and copy the text manually.",
        variant: "destructive",
      });
    }
  };

  const totalSlots = availability.reduce((total, day) => total + day.slots.length, 0);
  const totalDays = availability.filter(day => day.slots.length > 0).length;

  return (
    <Card className="h-full shadow-md">
      <CardHeader className="pb-3 bg-gmail-light border-b">
        <CardTitle className="flex items-center gap-2 text-foreground">
          <FileText className="h-5 w-5 text-gmail-blue" />
          Generated Availability Text
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 h-full flex flex-col">
        {generatedText ? (
          <div className="flex-1 space-y-4">
            <div className="flex-1">
              <Textarea
                value={generatedText}
                onChange={(e) => setGeneratedText(e.target.value)}
                className="h-full min-h-[200px] resize-none font-mono text-sm"
                placeholder="Your availability will appear here..."
              />
            </div>
            
            <div className="flex items-center justify-between pt-2 border-t">
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {totalDays} days • {totalSlots} available slots
              </div>
              <Button
                onClick={copyToClipboard}
                className={`${
                  copied 
                    ? "bg-success hover:bg-success text-success-foreground" 
                    : "bg-gmail-blue hover:bg-gmail-hover text-white"
                } transition-colors`}
              >
                {copied ? (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Text
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-sm">Select dates from your Google Calendar to generate availability text</p>
              <p className="text-xs mt-2">Available slots will be automatically detected between 9 AM - 5 PM</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};