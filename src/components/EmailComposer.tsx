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
    <Card className="backdrop-blur-sm bg-card/50 border border-border/50 shadow-xl shadow-black/10">
      <CardHeader className="pb-4 bg-gradient-to-r from-card to-secondary/30 border-b border-border/20">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3 text-lg text-foreground">
            <Mail className="h-5 w-5 text-primary" />
            Email Composer
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10">
              <Paperclip className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 flex flex-col">
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-muted-foreground w-8">To</span>
            <Input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="recipient@example.com"
              className="bg-secondary/30 border-border/30 focus:border-primary/50 transition-colors"
            />
          </div>
          <Separator className="bg-border/30" />
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-muted-foreground w-16">Subject</span>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="bg-secondary/30 border-border/30 focus:border-primary/50 transition-colors"
            />
          </div>
          <Separator className="bg-border/30" />
        </div>
        
        <div className="flex-1 p-6 flex flex-col">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Compose your email..."
            className="flex-1 min-h-[200px] bg-secondary/20 border-border/30 focus:border-primary/50 resize-none transition-colors"
          />
        </div>

        <div className="p-6 border-t border-border/20 bg-gradient-to-r from-secondary/20 to-secondary/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button 
                className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-primary/25 transition-all"
                disabled={!availabilityText}
                onClick={handleInsertAvailability}
              >
                Insert Availability
              </Button>
            </div>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-primary/25 transition-all">
              <Send className="h-4 w-4 mr-2" />
              Send
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};