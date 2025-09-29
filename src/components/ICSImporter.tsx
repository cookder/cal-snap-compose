import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Upload, Calendar, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import ICAL from 'ical.js';

interface CalendarEvent {
  id: string;
  summary: string;
  start: Date;
  end: Date;
  description?: string;
  location?: string;
}

interface ICSImporterProps {
  onEventsImported: (events: CalendarEvent[]) => void;
}

export function ICSImporter({ onEventsImported }: ICSImporterProps) {
  const [icsContent, setIcsContent] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parseICSContent = (content: string): CalendarEvent[] => {
    try {
      const jcalData = ICAL.parse(content);
      const comp = new ICAL.Component(jcalData);
      const events: CalendarEvent[] = [];

      const vevents = comp.getAllSubcomponents('vevent');
      
      vevents.forEach((vevent, index) => {
        const event = new ICAL.Event(vevent);
        
        events.push({
          id: event.uid || `imported-${index}`,
          summary: event.summary || 'Untitled Event',
          start: event.startDate.toJSDate(),
          end: event.endDate.toJSDate(),
          description: event.description || '',
          location: event.location || ''
        });
      });

      return events;
    } catch (err) {
      throw new Error('Invalid ICS format. Please check your calendar file content.');
    }
  };

  const importICSContent = (content: string) => {
    if (!content.trim()) {
      setError('Please paste ICS file content');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const events = parseICSContent(content);
      
      if (events.length === 0) {
        setError('No events found in the ICS content');
        setIsProcessing(false);
        return;
      }

      onEventsImported(events);
      toast.success(`Successfully imported ${events.length} events`);
      setIcsContent('');
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to parse ICS content';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImport = () => {
    importICSContent(icsContent);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.ics')) {
      setError('Please select an ICS file (.ics extension)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setIcsContent(content);
      setError(null);
      // Automatically import after successful file read
      importICSContent(content);
    };
    reader.onerror = () => {
      setError('Failed to read the file');
    };
    reader.readAsText(file);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Import ICS Calendar
        </CardTitle>
        <CardDescription>
          Upload an ICS file or paste calendar content to import events
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label htmlFor="ics-file" className="block text-sm font-medium mb-2">
            Upload ICS File
          </label>
          <input
            id="ics-file"
            type="file"
            accept=".ics"
            onChange={handleFileUpload}
            className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
          />
        </div>

        <div className="relative">
          <label htmlFor="ics-content" className="block text-sm font-medium mb-2">
            Or Paste ICS Content
          </label>
          <Textarea
            id="ics-content"
            value={icsContent}
            onChange={(e) => setIcsContent(e.target.value)}
            placeholder="Paste your ICS calendar content here..."
            className="min-h-[120px] font-mono text-sm"
          />
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button 
          onClick={handleImport}
          disabled={!icsContent.trim() || isProcessing}
          className="w-full"
        >
          <Upload className="h-4 w-4 mr-2" />
          {isProcessing ? 'Processing...' : 'Import Events'}
        </Button>
      </CardContent>
    </Card>
  );
}