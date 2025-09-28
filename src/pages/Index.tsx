import { useState } from "react";
import { EmailComposer } from "@/components/EmailComposer";
import { AvailabilitySelector } from "@/components/AvailabilitySelector";
import { AvailabilityGenerator } from "@/components/AvailabilityGenerator";

interface TimeSlot {
  start: string;
  end: string;
}

interface AvailabilityItem {
  date: Date;
  slots: TimeSlot[];
}

const Index = () => {
  const [availability, setAvailability] = useState<AvailabilityItem[]>([]);
  const [availabilityText, setAvailabilityText] = useState("");

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gmail-blue rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-sm">G</span>
            </div>
            <div>
              <h1 className="text-xl font-semibold">Gmail Calendar Integration</h1>
              <p className="text-sm text-muted-foreground">Generate availability text for meeting scheduling</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-180px)]">
          {/* Calendar Selection */}
          <div className="lg:col-span-1">
            <AvailabilitySelector onAvailabilityChange={setAvailability} />
          </div>

          {/* Availability Text Generator */}
          <div className="lg:col-span-1">
            <AvailabilityGenerator 
              availability={availability}
              onTextGenerated={setAvailabilityText}
            />
          </div>

          {/* Email Composer */}
          <div className="lg:col-span-1">
            <EmailComposer 
              availabilityText={availabilityText}
              onInsertAvailability={() => {}}
            />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
