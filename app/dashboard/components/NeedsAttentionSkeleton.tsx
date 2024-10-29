import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export function NeedsAttentionSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <Skeleton className="h-6 w-[150px]" />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center space-x-4">
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-[200px]" />
              <Skeleton className="h-3 w-[150px]" />
            </div>
            <Skeleton className="h-8 w-[100px]" />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}