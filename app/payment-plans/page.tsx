"use client"

import { Card, CardContent } from "@/components/ui/card"
import { PaymentPlansTable } from "./components/PaymentPlansTable"

export default function PaymentPlansPage() {
  return (
    <div className="container mx-auto space-y-6 p-10 pb-16">
      <div className="space-y-0.5">
        <h2 className="text-2xl font-bold tracking-tight">Payment Plans</h2>
        <p className="text-muted-foreground">
          Manage your payment plans and view their status
        </p>
      </div>
      
      <Card>
        <CardContent className="pt-6">
          <PaymentPlansTable />
        </CardContent>
      </Card>
    </div>
  )
}