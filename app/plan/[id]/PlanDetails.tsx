"use client"

import React, { useState } from "react"
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

// Reference the interface from ConfirmationStep.tsx (lines 34-65)
interface PlanDetailsProps {
  planDetails: {
    customerName: string
    customerEmail: string
    totalAmount: number
    numberOfPayments: number
    paymentInterval: string
    paymentSchedule: {
      amount: number
      date: string
      is_downpayment: boolean
      status: "paid" | "pending"
      cardLastFour?: string
    }[]
    paymentPlanId: string
    businessDetails?: {
      name: string
      supportPhone: string
      supportEmail: string
    }
    paymentMethod?: {
      brand: string
      last4: string
    }
    notes?: {
      content: string
      delta: any
      plaintext: string
    }
    status: string
  }
}

export function PlanDetails({ planDetails }: PlanDetailsProps) {
  const [isSending, setIsSending] = useState(false)
  const [isPausing, setIsPausing] = useState(false)
  const { toast } = useToast()

  // Reference handleSendEmail function from ConfirmationStep.tsx (lines 148-184)
  const handleSendEmail = async () => {
    const endpoint = planDetails.status === 'draft' 
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
        description: planDetails.status === 'draft'
          ? "Payment approval link sent to customer"
          : "Payment plan details sent to customer",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send email. Please try again.",
        variant: "destructive",
      })
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
    ?.filter(payment => payment.status === "paid")
    .reduce((sum, payment) => sum + payment.amount, 0) || 0
  const totalScheduled = planDetails.paymentSchedule
    ?.filter(payment => payment.status === "pending")
    .reduce((sum, payment) => sum + payment.amount, 0) || 0

  const sortedPayments = [...planDetails.paymentSchedule].sort((a, b) => {
    if (a.is_downpayment) return -1;
    if (b.is_downpayment) return 1;
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{planDetails.customerName}</h1>
          <p className="text-muted-foreground mt-1">{planDetails.customerEmail}</p>
        </div>
        <div className="text-right text-sm text-muted-foreground">
          <p>Plan ID: {planDetails.paymentPlanId}</p>
          <p>Created: {format(new Date(), "MMM dd, yyyy")}</p>
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
                        {payment.status === "paid" ? (
                          <span className="status-badge inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-green-50 text-green-700">
                            Paid
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
                Email Plan Details
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
              <Button
                className="w-full justify-start"
                variant="outline"
                onClick={handlePausePlan}
                disabled={isPausing}
              >
                <Clock className="h-4 w-4 mr-2" />
                Pause Plan
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    className="w-full justify-start"
                    variant="destructive"
                  >
                    <Ban className="h-4 w-4 mr-2" />
                    Cancel Plan
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancel Payment Plan</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to cancel this payment plan? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>No, keep plan active</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => {
                        toast({
                          title: "Plan Cancelled",
                          description: "The payment plan has been cancelled.",
                          variant: "destructive",
                        })
                      }}
                    >
                      Yes, cancel plan
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