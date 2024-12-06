"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  CheckCircle2, 
  XCircle, 
  FileText, 
  Calendar,
  Mail,
  CreditCard
} from 'lucide-react';
import { format } from 'date-fns';
import { formatCurrency, Money } from '@/utils/currencyUtils';
import { Database } from '@/types/supabase';
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from '@/utils/supabase/client';
import { User } from '@supabase/supabase-js';

type Event = {
  id: string;
  created_at: string;
  event_type: string;
  entity_type: string;
  entity_id: string;
  metadata: Record<string, any>;
  customer_id?: string;
};

const EVENT_ICONS: Record<string, React.ComponentType<any>> = {
  'payment_confirmation': CreditCard,
  'payment_confirmation_sent': Mail,
  'payment_success': CreditCard,
  'payment_failed': CreditCard,
  'plan_created': FileText,
  'plan_updated': FileText,
  'plan_payment_link_sent': Mail,
  'plan_payment_reminder_sent': Mail,
  'default': Calendar,
};

const formatEventMessage = (event: Event): string => {
  const messages: Record<string, (event: Event) => string> = {
    'payment_confirmation': (e) => `Payment confirmation received`,
    'payment_confirmation_sent': (e) => `Payment confirmation sent to ${e.metadata.recipient}`,
    'payment_success': (e) => `Payment of ${e.metadata.amount} successful`,
    'payment_failed': (e) => `Payment of ${e.metadata.amount} failed`,
    'plan_created': (e) => `Payment plan created${e.metadata.customer_name ? ` for ${e.metadata.customer_name}` : ''}`,
    'plan_updated': (e) => `Payment plan updated${e.metadata.change_description ? `: ${e.metadata.change_description}` : ''}`,
    'plan_payment_link_sent': (e) => `Payment link sent${e.metadata.recipient ? ` to ${e.metadata.recipient}` : ''}`,
    'plan_payment_reminder_sent': (e) => `Payment reminder sent${e.metadata.recipient ? ` to ${e.metadata.recipient}` : ''}`,
    'default': (e) => `${e.event_type.replace(/_/g, ' ')}`
  };

  const formatter = messages[event.event_type] || messages.default;
  return formatter(event);
};

interface PlanActivityFeedProps {
  planId: string;
  user: User | null;
}

export function PlanActivityFeed({ planId, user }: PlanActivityFeedProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    if (!user) return;
    const fetchEvents = async () => {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', user.id)
        .eq('entity_id', planId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setEvents(data);
      }
      setLoading(false);
    };

    fetchEvents();

    // Set up realtime subscription
    const subscription = supabase
      .channel('events')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'events',
          filter: `user_id=eq.${user.id}&entity_id=eq.${planId}`
        },
        (payload) => {
          setEvents(current => {
            const newEvent = payload.new as Event;
            return [newEvent, ...current];
          });
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user?.id, planId]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            <Skeleton className="h-4 w-[150px]" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-start space-x-4 animate-pulse">
                <div className="mt-0.5 bg-muted rounded-full p-2 w-8 h-8" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/4" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Plan Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[250px] pr-4">
          {events.map((event) => {
            const Icon = EVENT_ICONS[event.event_type] || EVENT_ICONS.default;
            const formattedDate = event.created_at 
              ? format(new Date(event.created_at), 'MMM d, yyyy h:mm a')
              : 'Unknown date';
            return (
              <div key={event.id} className="flex items-start space-x-4 mb-6">
                <div className="mt-0.5 bg-muted rounded-full p-2">
                  <Icon className={`w-4 h-4 text-gray-500`} />
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-sm">{formatEventMessage(event)}</p>
                  <p className="text-xs text-muted-foreground">
                    {formattedDate}
                  </p>
                </div>
              </div>
            );
          })}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}