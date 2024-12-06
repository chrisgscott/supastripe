"use client"

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CalendarIcon } from 'lucide-react'
import { DashboardCardSkeleton } from './DashboardCardSkeleton'
import { formatCurrency, Money } from '@/utils/currencyUtils'

interface NextPayoutResponse {
  amount: number | null
  date: string | null
  error?: string
}

export function NextPayoutCard() {
  const [nextPayout, setNextPayout] = useState<NextPayoutResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchNextPayout() {
      try {
        const response = await fetch('/api/next-payout')
        const data: NextPayoutResponse = await response.json()
        
        if (data.error) {
          setError(data.error)
        } else {
          setNextPayout(data)
        }
      } catch (err) {
        setError('Failed to fetch next payout')
        console.error('Error fetching next payout:', err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchNextPayout()
  }, [])

  if (isLoading) {
    return <DashboardCardSkeleton />
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Next Payout</CardTitle>
        <CalendarIcon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="text-sm text-red-500">{error}</div>
        ) : nextPayout?.amount === null ? (
          <div className="text-2xl font-bold">No scheduled payouts</div>
        ) : (
          <div className="space-y-1">
            <div className="text-2xl font-bold">
              {formatCurrency(Money.fromCents(nextPayout?.amount || 0))}
            </div>
            {nextPayout?.date && (
              <p className="text-xs text-muted-foreground">
                Expected {nextPayout.date}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
