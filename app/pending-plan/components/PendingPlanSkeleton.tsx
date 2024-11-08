"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function PendingPlanSkeleton() {
  return (
    <div className="container mx-auto space-y-6 p-10 pb-16">
      <div className="space-y-0.5">
        <Skeleton className="h-8 w-[300px]" />
        <Skeleton className="h-4 w-[200px]" />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Customer Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-4 w-[200px]" />
            <Skeleton className="h-4 w-[150px]" />
            <Skeleton className="h-4 w-[180px]" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Plan Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-4 w-[120px]" />
            <Skeleton className="h-4 w-[150px]" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payment Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-4 w-[180px]" />
            <Skeleton className="h-4 w-[150px]" />
            <Skeleton className="h-4 w-[160px]" />
            <Skeleton className="h-4 w-[140px]" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Next Payment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-4 w-[160px]" />
            <Skeleton className="h-4 w-[140px]" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}