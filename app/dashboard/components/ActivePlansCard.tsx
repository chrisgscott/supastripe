"use client"

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { UserIcon } from 'lucide-react'
import { DashboardCardSkeleton } from './DashboardCardSkeleton'

interface ActivePlansResponse {
  activePlans: number
  error?: string
}

export function ActivePlansCard() {
  const [activePlans, setActivePlans] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchActivePlans() {
      try {
        const response = await fetch('/api/active-plans-count')
        const data: ActivePlansResponse = await response.json()
        
        if (data.error) {
          setError(data.error)
        } else {
          setActivePlans(data.activePlans)
        }
      } catch (err) {
        setError('Failed to fetch active plans')
        console.error('Error fetching active plans:', err)
      }
    }

    fetchActivePlans()
  }, [])

  if (activePlans === null && !error) {
    return <DashboardCardSkeleton />
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Active Plans</CardTitle>
        <UserIcon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="text-sm text-red-500">{error}</div>
        ) : (
          <div className="text-2xl font-bold">{activePlans}</div>
        )}
      </CardContent>
    </Card>
  )
}
