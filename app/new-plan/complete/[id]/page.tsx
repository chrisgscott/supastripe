"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatCurrency } from "@/utils/currencyUtils"
import { useToast } from "@/components/ui/use-toast"
import { useQuery } from "@tanstack/react-query"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface PendingPlan {
  id: string
  customerName: string
  totalAmount: number
  numberOfPayments: number
  paymentInterval: 'weekly' | 'monthly'
}

export default function CompletePlanSetup() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { data: plan, isLoading, error } = useQuery({
    queryKey: ['pendingPlan', params.id],
    queryFn: async () => {
      const response = await fetch(`/api/pending-plans/${params.id}`)
      if (!response.ok) throw new Error('Failed to fetch plan details')
      return response.json()
    }
  })

  const [formData, setFormData] = useState<{
    numberOfPayments: number
    paymentInterval: 'weekly' | 'monthly'
  }>({
    numberOfPayments: plan?.numberOfPayments || 3,
    paymentInterval: plan?.paymentInterval || 'monthly'
  })

  useEffect(() => {
    if (plan) {
      setFormData({
        numberOfPayments: plan.numberOfPayments,
        paymentInterval: plan.paymentInterval
      })
    }
  }, [plan])

  const handleSubmit = async () => {
    if (formData.numberOfPayments < 2) {
      toast({
        variant: "destructive",
        title: "Invalid number of payments",
        description: "Number of payments must be at least 2"
      })
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/pending-plans/${params.id}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) throw new Error('Failed to complete setup')

      toast({
        title: "Success",
        description: "Payment plan setup completed"
      })
      router.push('/payment-plans')
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to complete payment plan setup"
      })
    } finally {
      setIsSubmitting(false)
      setShowConfirmDialog(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="space-y-4 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
          <p>Loading plan details...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto py-10">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-red-600">
              Failed to load plan details. Please try again later.
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-8">Complete Payment Plan Setup</h1>
      
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Customer Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label>Customer Name</Label>
                <div className="font-medium">{plan.customerName}</div>
              </div>
              <div>
                <Label>Total Amount</Label>
                <div className="font-medium">{formatCurrency(plan.totalAmount)}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payment Schedule</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Number of Payments</Label>
                  <Input 
                    type="number"
                    min={2}
                    value={formData.numberOfPayments}
                    onChange={(e) => {
                      setFormData({
                        ...formData,
                        numberOfPayments: parseInt(e.target.value)
                      })
                    }}
                  />
                </div>
                <div>
                  <Label>Payment Interval</Label>
                  <Select 
                    value={formData.paymentInterval}
                    onValueChange={(value: 'weekly' | 'monthly') => {
                      setFormData({
                        ...formData,
                        paymentInterval: value
                      })
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end space-x-4">
          <Button variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button 
            onClick={() => setShowConfirmDialog(true)}
            disabled={isSubmitting}
          >
            Complete Setup
          </Button>
        </div>
      </div>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Complete Payment Plan Setup</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to complete this payment plan setup? This will create the payment schedule and activate the plan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? "Processing..." : "Complete Setup"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
