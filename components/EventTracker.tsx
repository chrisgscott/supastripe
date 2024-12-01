import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function EventTracker({ 
  event,
  description,
  metadata,
  once = true
}: { 
  event: string;
  description: string;
  metadata?: Record<string, any>;
  once?: boolean;
}) {
  useEffect(() => {
    // Track the event
    window?.datafast(event, { description, ...metadata });
    
    // If this is a one-time event, remove the URL parameter after tracking
    if (once) {
      const url = new URL(window.location.href);
      url.searchParams.delete('track');
      window.history.replaceState({}, '', url.toString());
    }
  }, [event, description, metadata, once]);

  return null;
}
