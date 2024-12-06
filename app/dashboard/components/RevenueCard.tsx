"use client"

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DashboardCardSkeleton } from './DashboardCardSkeleton'
import { formatCurrency, Money } from '@/utils/currencyUtils'

interface RevenueResponse {
  revenue: number
  error?: string
}

export function RevenueCard() {
  const [revenue, setRevenue] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [days, setDays] = useState('30')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchRevenue() {
      setIsLoading(true)
      try {
        const response = await fetch(`/api/revenue?days=${days}`)
        const data: RevenueResponse = await response.json()
        
        if (data.error) {
          setError(data.error)
        } else {
          setRevenue(data.revenue)
        }
      } catch (err) {
        setError('Failed to fetch revenue')
        console.error('Error fetching revenue:', err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchRevenue()
  }, [days])

  if (isLoading) {
    return <DashboardCardSkeleton />
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Revenue</CardTitle>
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-[70px] h-8">
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">7d</SelectItem>
            <SelectItem value="30">30d</SelectItem>
            <SelectItem value="90">90d</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="text-sm text-red-500">{error}</div>
        ) : (
          <div className="text-2xl font-bold">
            {formatCurrency(Money.fromCents(revenue || 0))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
