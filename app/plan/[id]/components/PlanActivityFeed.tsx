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

type ActivityLog = Database['public']['Tables']['activity_logs']['Row'];

const formatActivityMessage = (activity: ActivityLog) => {
  const amount = activity.amount ? Money.fromCents(activity.amount) : Money.fromCents(0);
  
  switch (activity.activity_type) {
    case 'payment_success':
      return `Payment of ${formatCurrency(amount)} was successful.`;
    case 'payment_failed':
      return `Payment of ${formatCurrency(amount)} failed!`;
    case 'plan_created':
      return `Payment plan of ${formatCurrency(amount)} was created`;
    case 'email_sent':
      const metadata = activity.metadata as { email_type: string; recipient: string };
      return `A payment reminder email was sent`;
    default:
      return 'Unknown activity';
  }
};

const getActivityIcon = (type: string) => {
  switch (type) {
    case 'payment_success':
      return { icon: CheckCircle2, color: 'text-green-500' };
    case 'payment_failed':
      return { icon: XCircle, color: 'text-red-500' };
    case 'plan_created':
      return { icon: FileText, color: 'text-blue-500' };
    case 'email_sent':
      return { icon: Mail, color: 'text-purple-500' };
    default:
      return { icon: FileText, color: 'text-gray-500' };
  }
};

interface PlanActivityFeedProps {
  planId: string;
}

export function PlanActivityFeed({ planId }: PlanActivityFeedProps) {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    fetchActivities();

    const channel = supabase.channel(`plan_activities_${planId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activity_logs',
          filter: `entity_id=eq.${planId} and entity_type=eq.payment_plan`
        },
        (payload) => {
          console.log('New plan activity:', payload);
          setActivities(prev => [payload.new as ActivityLog, ...prev]);
        }
      )
      .subscribe((status) => {
        console.log('Plan activities subscription status:', status);
      });

    return () => {
      channel.unsubscribe();
    };
  }, [planId]);

  const fetchActivities = async () => {
    try {
      const response = await fetch(`/api/activity-logs?planId=${planId}`);
      const data = await response.json();
      setActivities(data.activities);
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
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
          {activities.map((activity) => {
            const { icon: Icon, color } = getActivityIcon(activity.activity_type);
            return (
              <div key={activity.id} className="flex items-start space-x-4 mb-6">
                <div className="mt-0.5 bg-muted rounded-full p-2">
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-sm">{formatActivityMessage(activity)}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(activity.created_at), 'MMM d, h:mm a')}
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