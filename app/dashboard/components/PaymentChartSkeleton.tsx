import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export function PaymentChartSkeleton() {
  // Generate random heights between 30% and 90%
  const getRandomHeight = () => `${Math.floor(Math.random() * 60 + 30)}%`;
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <Skeleton className="h-6 w-[150px]" />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[350px] relative">
          <div className="absolute bottom-0 left-0 right-0 flex justify-between gap-4">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="flex-1 flex flex-col gap-2 items-center">
                <Skeleton 
                  className="w-full" 
                  style={{ 
                    height: getRandomHeight(),
                    opacity: 0.7 
                  }} 
                />
                <Skeleton className="h-4 w-full mt-2" />
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}