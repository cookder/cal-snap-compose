import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Mail, Send, Paperclip, MoreHorizontal } from "lucide-react";

interface EmailComposerProps {
  availabilityText: string;
  onInsertAvailability: () => void;
}

export const EmailComposer = ({ availabilityText, onInsertAvailability }: EmailComposerProps) => {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("Meeting Request");
  const [body, setBody] = useState("");

  const handleInsertAvailability = () => {
    const currentBody = body || "Hi,\n\nI'd like to schedule a meeting with you. Here are my available times:\n\n";
    const newBody = `${currentBody}${availabilityText}\n\nPlease let me know what works best for you.\n\nBest regards`;
    setBody(newBody);
    onInsertAvailability();
  };

  return (
    <Card className="h-full shadow-md">
      <CardHeader className="pb-3 bg-gmail-light border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Mail className="h-5 w-5 text-gmail-blue" />
            Compose Email
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Paperclip className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 h-full flex flex-col">
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground w-12">To:</span>
            <Input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="recipient@example.com"
              className="border-0 shadow-none focus-visible:ring-0 p-0 h-8"
            />
          </div>
          <Separator />
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground w-12">Subject:</span>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="border-0 shadow-none focus-visible:ring-0 p-0 h-8"
            />
          </div>
          <Separator />
        </div>
        
        <div className="flex-1 p-4 flex flex-col">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Compose your email..."
            className="flex-1 min-h-[200px] border-0 shadow-none focus-visible:ring-0 resize-none"
          />
        </div>

        <div className="p-4 border-t bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button 
                className="bg-gmail-blue hover:bg-gmail-hover text-white"
                disabled={!availabilityText}
                onClick={handleInsertAvailability}
              >
                Insert Availability
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Paperclip className="h-4 w-4" />
              </Button>
            </div>
            <Button className="bg-gmail-blue hover:bg-gmail-hover text-white">
              <Send className="h-4 w-4 mr-2" />
              Send
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};