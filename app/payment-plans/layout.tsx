"use client"

import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PaymentPlansTable } from "./components/PaymentPlansTable"
import { PendingPlansTable } from "./components/PendingPlansTable"
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Card, CardContent } from "@/components/ui/card"

const queryClient = new QueryClient()

export default function PaymentPlansLayout({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="container mx-auto space-y-6 p-10 pb-16">
        <div className="space-y-0.5">
          <h2 className="text-2xl font-bold tracking-tight">Payment Plans</h2>
          <p className="text-muted-foreground">
            Manage your payment plans and view their status
          </p>
        </div>
        
        <Card>
          <CardContent className="pt-6">
            <Tabs defaultValue="active" className="space-y-4">
              <TabsList>
                <TabsTrigger value="active">Active Plans</TabsTrigger>
                <TabsTrigger value="pending">Pending Plans</TabsTrigger>
              </TabsList>
              <TabsContent value="active" className="space-y-4">
                <PaymentPlansTable />
              </TabsContent>
              <TabsContent value="pending" className="space-y-4">
                <PendingPlansTable />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </QueryClientProvider>
  )
}