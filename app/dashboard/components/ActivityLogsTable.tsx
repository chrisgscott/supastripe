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

interface ActivityResponse {
  activities: ActivityLog[];
  pagination: {
    total: number;
    totalPages: number;
    currentPage: number;
    itemsPerPage: number;
  };
}

const formatActivityMessage = (activity: ActivityLog) => {
  const amount = activity.amount ? Money.fromCents(activity.amount) : Money.fromCents(0);
  
  switch (activity.activity_type) {
    case 'payment_success':
      return `${activity.customer_name}'s payment of ${formatCurrency(amount)} was successful.`;
    case 'payment_failed':
      return `${activity.customer_name}'s payment of ${formatCurrency(amount)} failed!`;
    case 'plan_created':
      return `A new plan of ${formatCurrency(amount)} was created for ${activity.customer_name}`;
    case 'payout_scheduled':
      return `A payout of ${formatCurrency(amount)} was scheduled`;
    case 'payout_paid':
      return `A payout of ${formatCurrency(amount)} was processed`;
    case 'email_sent':
      const metadata = activity.metadata as { email_type: string; recipient: string };
      return `A payment reminder email was sent to ${metadata?.recipient || 'Unknown recipient'}`;
    case 'payment_method_updated':
      const cardMetadata = activity.metadata as { card_last_four: string; card_brand: string };
      return `${activity.customer_name}'s payment method updated to card ending in ${cardMetadata.card_last_four}`;
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
    case 'payout_scheduled':
      return { icon: Calendar, color: 'text-yellow-500' };
    case 'payout_paid':
      return { icon: CreditCard, color: 'text-green-500' };
    case 'payment_method_updated':
      return { icon: CreditCard, color: 'text-blue-500' };
    default:
      return { icon: FileText, color: 'text-gray-500' };
  }
};

export function ActivityLogsTable() {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    fetchActivities();

    // Get the current user's session
    const initializeChannel = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const channel = supabase.channel('user_activities')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'activity_logs',
            filter: `user_id=eq.${session.user.id}`
          },
          (payload) => {
            console.log('New activity:', payload);
            setActivities(prev => [payload.new as ActivityLog, ...prev]);
          }
        )
        .subscribe((status) => {
          console.log('Realtime subscription status:', status);
        });

      return () => {
        channel.unsubscribe();
      };
    };

    initializeChannel();
  }, []);

  const fetchActivities = async () => {
    try {
      const response = await fetch('/api/activity-logs?page=1');
      const data: ActivityResponse = await response.json();
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
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[375px] pr-4">
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