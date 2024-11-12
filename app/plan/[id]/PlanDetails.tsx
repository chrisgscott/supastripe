"use client"

import React, { useState } from "react"
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { formatCurrency, Money } from "@/utils/currencyUtils"
import { Mail, Printer, Clock, Ban, DollarSign, PiggyBank, CalendarClock } from "lucide-react"
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
import { CreditCard } from 'lucide-react'
import { UpdateCardDialog } from './UpdateCardDialog'
import { PlanActivityFeed } from './components/PlanActivityFeed'

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

export function PlanDetails({ planDetails }: PlanDetailsProps) {
  const [isSending, setIsSending] = useState(false)
  const [isPausing, setIsPausing] = useState(false)
  const { toast } = useToast()
  const [isUpdateCardDialogOpen, setIsUpdateCardDialogOpen] = useState(false)

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
              {!planDetails.isPending && (
                <>
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
                </>
              )}
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