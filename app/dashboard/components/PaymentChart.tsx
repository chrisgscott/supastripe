"use client"

import React, { useState } from "react"
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"

interface PaymentDataItem {
  month: string;
  collected: number;
  forecasted: number;
}

const defaultChartConfig: ChartConfig = {
  collected: {
    label: "Collected",
    color: "hsl(var(--chart-1))",
  },
  forecasted: {
    label: "Forecasted",
    color: "hsl(var(--chart-2))",
  },
}

export function PaymentChart({ data }: { data: PaymentDataItem[] }) {
  const [activeChart, setActiveChart] = useState<'collected' | 'forecasted'>('collected')

  const total = {
    collected: data.reduce((sum, item) => sum + item.collected, 0),
    forecasted: data.reduce((sum, item) => sum + item.forecasted, 0),
  }

  return (
    <div>
      <div className="flex items-center space-x-2">
        <h2 className="text-lg font-semibold">Payment Overview</h2>
        <div className="flex space-x-2">
          <button
            onClick={() => setActiveChart('collected')}
            className={`px-2 py-1 text-sm rounded ${
              activeChart === 'collected' ? 'bg-blue-500 text-white' : 'bg-gray-200'
            }`}
          >
            Collected: ${total.collected.toFixed(2)}
          </button>
          <button
            onClick={() => setActiveChart('forecasted')}
            className={`px-2 py-1 text-sm rounded ${
              activeChart === 'forecasted' ? 'bg-blue-500 text-white' : 'bg-gray-200'
            }`}
          >
            Forecasted: ${total.forecasted.toFixed(2)}
          </button>
        </div>
      </div>
      <ChartContainer config={defaultChartConfig}>
        <BarChart width={600} height={300} data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" />
          <ChartTooltip
            content={
              <ChartTooltipContent
                className="w-[150px]"
                nameKey={activeChart}
                labelFormatter={(value) => value}
              />
            }
          />
          <Bar dataKey={activeChart} fill={defaultChartConfig[activeChart].color} />
        </BarChart>
      </ChartContainer>
    </div>
  )
}
