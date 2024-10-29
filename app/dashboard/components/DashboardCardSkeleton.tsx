import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export function DashboardCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle><Skeleton className="h-4 w-[200px]" /></CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-6 w-[250px]" />
      </CardContent>
    </Card>
  )
}