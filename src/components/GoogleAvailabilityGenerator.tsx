import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Copy, FileText, CheckCircle, Calendar, Sparkles } from "lucide-react";
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
    <Card className="backdrop-blur-sm bg-card/50 border border-border/50 shadow-xl shadow-black/10">
      <CardHeader className="pb-4 bg-gradient-to-r from-card to-secondary/30 border-b border-border/20">
        <CardTitle className="flex items-center gap-3 text-lg">
          <Sparkles className="h-5 w-5 text-primary" />
          AI Text Generator
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 flex flex-col">
        {generatedText ? (
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  {totalDays} days • {totalSlots} available slots
                </div>
              </div>
              <Textarea
                value={generatedText}
                onChange={(e) => setGeneratedText(e.target.value)}
                className="min-h-[200px] bg-secondary/20 border-border/30 focus:border-primary/50 transition-colors font-mono text-sm"
                placeholder="Your availability will appear here..."
              />
            </div>
            
            <Button
              onClick={copyToClipboard}
              className={`w-full ${
                copied 
                  ? "bg-green-600 hover:bg-green-700 text-white" 
                  : "bg-primary hover:bg-primary/90 text-primary-foreground"
              } shadow-lg hover:shadow-primary/25 transition-all`}
            >
              {copied ? (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Copied to Clipboard!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Text
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center py-12">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Calendar className="h-8 w-8 text-primary/60" />
              </div>
              <p className="text-muted-foreground mb-2">Select dates from your calendar</p>
              <p className="text-sm text-muted-foreground/70">Available slots will be automatically detected</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};