"use client"

import React, { useState, useEffect } from "react"
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
  CardDescription,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { formatCurrency, Money } from "@/utils/currencyUtils"
import { Mail, Printer, Clock, Ban, AlertCircle, DollarSign, PiggyBank, CalendarClock } from "lucide-react"
import { Separator } from "@/components/ui/separator"
import { format } from "date-fns"
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/components/ui/use-toast"
import { ScrollArea } from "@/components/ui/scroll-area"
import { CheckCircle2, XCircle, FileText } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Database } from "@/types/supabase"
import { createClient } from '@/utils/supabase/client';
import { CreditCard } from 'lucide-react';
import { UpdateCardDialog } from './UpdateCardDialog';

// Reference the interface from ConfirmationStep.tsx (lines 34-65)
interface PlanDetailsProps {
  planDetails: {
    customerName: string;
    customerEmail: string;
    totalAmount: number;
    numberOfPayments: number;
    paymentInterval: string;
    paymentSchedule: Array<{
      amount: number;
      date: string;
      transaction_type: 'downpayment' | 'installment';
      status: 'completed' | 'pending' | 'failed';
      cardLastFour?: string;
    }>;
    paymentPlanId: string;
    paymentMethod?: {
      brand: string;
      last4: string;
      cardExpiration: string;
    };
    notes?: { content: string };
    status: string;
    isPending: boolean;
    cardLastFour?: string;
    cardExpiration?: string;
  };
}

// Add after imports
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

function PlanActivityFeed({ planId }: { planId: string }) {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    fetchActivities();

    // Set up realtime subscription
    const channel = supabase.channel('activity_logs')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activity_logs',
          filter: `payment_plan_id=eq.${planId}`
        },
        (payload) => {
          console.log('Received new activity:', payload);
          setActivities(prev => [payload.new as ActivityLog, ...prev]);
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status);
      });

    // Cleanup subscription
    return () => {
      supabase.channel('activity_logs').unsubscribe();
    };
  }, [planId]);

  const fetchActivities = async () => {
    try {
      const response = await fetch(`/api/plan-activity-logs?planId=${planId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch activities');
      }
      const data = await response.json();
      setActivities(data.activities || []);
    } catch (error) {
      console.error('Error fetching activities:', error);
      setActivities([]);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Plan Activity</CardTitle>
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
          {activities.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No activity recorded yet
            </div>
          ) : (
            activities.map((activity) => {
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
            })
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

export function PlanDetails({ planDetails }: PlanDetailsProps) {
  const [isSending, setIsSending] = useState(false)
  const [isPausing, setIsPausing] = useState(false)
  const { toast } = useToast()
  const [isUpdatePaymentMethodOpen, setIsUpdatePaymentMethodOpen] = useState(false);
  const [isUpdateCardDialogOpen, setIsUpdateCardDialogOpen] = useState(false);

  // Reference handleSendEmail function from ConfirmationStep.tsx (lines 148-184)
  const handleSendEmail = async () => {
    setIsSending(true)
    const endpoint = planDetails.isPending
      ? '/api/send-payment-link'
      : '/api/send-payment-plan-email'

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentPlanId: planDetails.paymentPlanId })
      })

      if (!response.ok) throw new Error('Failed to send email')

      toast({
        title: "Success",
        description: planDetails.isPending
          ? "Payment approval link sent to customer"
          : "Payment plan details sent to customer",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send email. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSending(false)
    }
  }

  const handlePausePlan = async () => {
    setIsPausing(true)
    try {
      // TODO: Implement plan pausing logic
      toast({
        title: "Plan Paused",
        description: "The payment plan has been paused successfully.",
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to pause the payment plan.",
      })
    } finally {
      setIsPausing(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  // Calculate totals
  const totalAmount = planDetails.totalAmount
  const totalCollected = planDetails.paymentSchedule
    ?.filter(payment => payment.status === "completed")
    .reduce((sum, payment) => sum + payment.amount, 0) || 0
  const totalScheduled = planDetails.paymentSchedule
    ?.filter(payment => payment.status === "pending")
    .reduce((sum, payment) => sum + payment.amount, 0) || 0

  const sortedPayments = [...planDetails.paymentSchedule].sort((a, b) => {
    if (a.transaction_type === "downpayment") return -1;
    if (b.transaction_type === "downpayment") return 1;
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  return (
    <div className="space-y-6">
      {/* Page Header with Pending Badge */}
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{planDetails.customerName}</h1>
            {planDetails.isPending && (
              <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800">
                Pending
              </span>
            )}
          </div>
          <p className="text-muted-foreground mt-1">{planDetails.customerEmail}</p>
        </div>
        <div className="text-right text-sm text-muted-foreground">
          <p><strong>Plan ID:</strong> {planDetails.paymentPlanId}</p>
          <p><strong>Created:</strong> {format(new Date(), "MMM dd, yyyy")}</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between space-x-4">
              <div className="flex items-center space-x-4">
                <div className="p-2 bg-primary/10 rounded-full">
                  <DollarSign className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium leading-none">Total Amount</p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(Money.fromCents(totalAmount))}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between space-x-4">
              <div className="flex items-center space-x-4">
                <div className="p-2 bg-green-100 rounded-full">
                  <PiggyBank className="h-6 w-6 text-green-700" />
                </div>
                <div>
                  <p className="text-sm font-medium leading-none">Total Collected</p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(Money.fromCents(totalCollected))}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between space-x-4">
              <div className="flex items-center space-x-4">
                <div className="p-2 bg-blue-100 rounded-full">
                  <CalendarClock className="h-6 w-6 text-blue-700" />
                </div>
                <div>
                  <p className="text-sm font-medium leading-none">Total Scheduled</p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(Money.fromCents(totalScheduled))}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Main Content Column */}
        <div className="col-span-2 space-y-6">
          {/* Payment Schedule Card */}
          <Card>
            <CardHeader>
              <CardTitle>Payment Schedule</CardTitle>
              <CardDescription>
                Payments will be automatically processed on this schedule:
              </CardDescription>
              <div className="mt-4 text-sm text-gray-500">
                {planDetails.cardLastFour && (
                  <p>Card ending in: {planDetails.cardLastFour}</p>
                )}
                {planDetails.cardExpiration && (
                  <p>Expires: {planDetails.cardExpiration}</p>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedPayments.map((payment, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        {format(new Date(payment.date), "MMM dd, yyyy")}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(Money.fromCents(payment.amount))}
                      </TableCell>
                      <TableCell className="text-right">
                        {payment.status === "completed" ? (
                          <span className="status-badge inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-green-50 text-green-700">
                            Paid
                          </span>
                        ) : planDetails.isPending ? (
                          <span className="status-badge inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-yellow-50 text-yellow-700">
                            Pending Approval
                          </span>
                        ) : (
                          <span className="status-badge inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-gray-50 text-gray-700">
                            Scheduled
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Notes Card */}
          {planDetails.notes?.content && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: planDetails.notes.content }}
                />
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar Column */}
        <div className="space-y-6">
          {/* Plan Activity Feed */}
          <PlanActivityFeed planId={planDetails.paymentPlanId} />

          {/* Plan Actions Card */}
          <Card>
            <CardHeader>
              <CardTitle>Plan Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                className="w-full justify-start"
                variant="outline"
                onClick={handleSendEmail}
                disabled={isSending}
              >
                <Mail className="h-4 w-4 mr-2" />
                {planDetails.isPending ? 'Email Payment Link' : 'Email Plan Details'}
              </Button>
              <Button
                className="w-full justify-start"
                variant="outline"
                onClick={handlePrint}
              >
                <Printer className="h-4 w-4 mr-2" />
                Print Plan Details
              </Button>
            </CardContent>
          </Card>

          {/* Manage Plan Card */}
          <Card>
            <CardHeader>
              <CardTitle>Manage Plan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!planDetails.isPending && (
                <Button
                  className="w-full justify-start"
                  variant="outline"
                  onClick={handlePausePlan}
                  disabled={isPausing}
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Pause Plan
                </Button>
              )}
              <Button
                className="w-full justify-start"
                variant="outline"
                onClick={() => setIsUpdateCardDialogOpen(true)}
              >
                <CreditCard className="h-4 w-4 mr-2" />
                Update Payment Method
              </Button>
              <UpdateCardDialog 
                open={isUpdateCardDialogOpen}
                onOpenChange={setIsUpdateCardDialogOpen}
                planId={planDetails.paymentPlanId}
              />
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    className="w-full justify-start"
                    variant="destructive"
                  >
                    <Ban className="h-4 w-4 mr-2" />
                    {planDetails.isPending ? 'Delete Plan' : 'Cancel Plan'}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {planDetails.isPending ? 'Delete Payment Plan' : 'Cancel Payment Plan'}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to {planDetails.isPending ? 'delete' : 'cancel'} this payment plan? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>No, keep plan</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => {
                        toast({
                          title: planDetails.isPending ? "Plan Deleted" : "Plan Cancelled",
                          description: `The payment plan has been ${planDetails.isPending ? 'deleted' : 'cancelled'}.`,
                          variant: "destructive",
                        })
                      }}
                    >
                      Yes, {planDetails.isPending ? 'delete' : 'cancel'} plan
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}