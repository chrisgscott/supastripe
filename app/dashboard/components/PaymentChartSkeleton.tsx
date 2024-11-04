import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export function PaymentChartSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-col items-stretch space-y-0 border-b p-0 sm:flex-row">
        <div className="flex flex-1 flex-col justify-center gap-1 px-6 py-5 sm:py-6">
          <CardTitle>
            <Skeleton className="h-6 w-[100px]" />
          </CardTitle>
          <CardDescription>
            <Skeleton className="h-4 w-[200px]" />
          </CardDescription>
        </div>
        <div className="flex">
          <div className="relative z-30 flex flex-1 flex-col justify-center gap-1 border-t px-6 py-4 sm:border-l sm:border-t-0 sm:px-8 sm:py-6">
            <Skeleton className="h-4 w-[80px]" />
            <Skeleton className="h-8 w-[120px]" />
          </div>
          <div className="relative z-30 flex flex-1 flex-col justify-center gap-1 border-t border-l px-6 py-4 sm:border-l sm:border-t-0 sm:px-8 sm:py-6">
            <Skeleton className="h-4 w-[80px]" />
            <Skeleton className="h-8 w-[120px]" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-2 sm:p-6">
        <div className="h-[250px] relative">
          <div className="absolute bottom-0 left-0 right-0 flex justify-between gap-2">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="flex-1 flex flex-col gap-2">
                <Skeleton 
                  className="w-full" 
                  style={{ 
                    height: `${Math.floor(Math.random() * 60 + 30)}%`,
                    opacity: 0.7 
                  }} 
                />
                <Skeleton className="h-4 w-full" />
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}