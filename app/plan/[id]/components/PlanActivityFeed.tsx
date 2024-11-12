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

// Define the activity types as a const enum
const ACTIVITY_TYPES = {
  PAYMENT_METHOD_UPDATED: 'payment_method_updated',
  PAYMENT_SUCCESS: 'payment_success',
  PAYMENT_FAILED: 'payment_failed',
  PLAN_CREATED: 'plan_created',
  EMAIL_SENT: 'email_sent',
  PLAN_ACTIVATED: 'plan_activated',
  PLAN_COMPLETED: 'plan_completed',
  PLAN_CANCELLED: 'plan_cancelled',
  PAYOUT_SCHEDULED: 'payout_scheduled',
  PAYOUT_PAID: 'payout_paid',
  PAYOUT_FAILED: 'payout_failed'
} as const;

// Type for the activity metadata
type ActivityMetadata = {
  card_last_four?: string;
  card_brand?: string;
  payment_intent_id?: string;
  customer_email?: string;
  payment_interval?: string;
  number_of_payments?: number;
};

const formatActivityMessage = (activity: ActivityLog) => {
  console.log('Formatting activity:', {
    type: activity.activity_type,
    metadata: activity.metadata
  });

  const amount = activity.amount ? Money.fromCents(activity.amount) : Money.fromCents(0);
  
  switch (activity.activity_type) {
    case ACTIVITY_TYPES.PAYMENT_METHOD_UPDATED: {
      const metadata = activity.metadata as ActivityMetadata;
      if (!metadata.card_brand || !metadata.card_last_four) {
        return 'Payment method was updated';
      }
      return `Payment method updated to ${metadata.card_brand} card ending in ${metadata.card_last_four}`;
    }
    case ACTIVITY_TYPES.PAYMENT_SUCCESS:
      return `Payment of ${formatCurrency(amount)} was successful`;
    case ACTIVITY_TYPES.PAYMENT_FAILED:
      return `Payment of ${formatCurrency(amount)} failed!`;
    case ACTIVITY_TYPES.PLAN_CREATED:
      return `Payment plan of ${formatCurrency(amount)} was created`;
    case ACTIVITY_TYPES.EMAIL_SENT: {
      const metadata = activity.metadata as { email_type?: string; recipient?: string };
      return metadata.email_type ? 
        `A ${metadata.email_type} email was sent` : 
        'A payment reminder email was sent';
    }
    case ACTIVITY_TYPES.PLAN_ACTIVATED:
      return 'Payment plan was activated';
    case ACTIVITY_TYPES.PLAN_COMPLETED:
      return 'Payment plan was completed';
    case ACTIVITY_TYPES.PLAN_CANCELLED:
      return 'Payment plan was cancelled';
    default:
      console.warn('Unknown activity type:', activity.activity_type);
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
      return { icon: Mail, color: 'text-blue-500' };
    case 'payment_method_updated':
      return { icon: CreditCard, color: 'text-blue-500' };
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
          console.log('Realtime activity payload:', {
            raw: payload,
            newActivity: payload.new,
            activityType: payload.new.activity_type
          });
          
          const newActivity = payload.new as ActivityLog;
          setActivities(prev => [newActivity, ...prev]);
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status);
      });

    return () => {
      channel.unsubscribe();
    };
  }, [planId]);

  const fetchActivities = async () => {
    try {
      console.log('PlanActivityFeed: Fetching activities for plan:', planId);
      const response = await fetch(`/api/plan-activity-logs?planId=${planId}`);
      const data = await response.json();
      
      console.log('PlanActivityFeed: Raw API response:', JSON.stringify(data, null, 2));
      console.log('PlanActivityFeed: Activity types:', data.activities?.map((a: ActivityLog) => a.activity_type));
      
      if (data.activities) {
        setActivities(data.activities);
      } else {
        console.error('PlanActivityFeed: No activities in response:', data);
      }
    } catch (error) {
      console.error('PlanActivityFeed: Error fetching activities:', error);
    } finally {
      setIsLoading(false);
    }
  };

  console.log('PlanActivityFeed: Current activities:', activities);

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
            const formattedDate = activity.created_at 
              ? format(new Date(activity.created_at), 'MMM d, yyyy h:mm a')
              : 'Unknown date';
            return (
              <div key={activity.id} className="flex items-start space-x-4 mb-6">
                <div className="mt-0.5 bg-muted rounded-full p-2">
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-sm">{formatActivityMessage(activity)}</p>
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