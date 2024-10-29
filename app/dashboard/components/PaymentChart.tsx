"use client"

import React, { useState, useMemo } from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { formatCurrency } from '@/utils/currencyUtils';

interface PaymentDataItem {
  month: string;
  collected: number;
  forecasted: number;
}

interface PaymentChartProps {
  data: PaymentDataItem[];
}

const chartConfig: ChartConfig = {
  collected: {
    label: "Collected",
    color: "#0CC9AA",
  },
  forecasted: {
    label: "Forecasted",
    color: "#5FC1F6",
  },
} as const;

type ChartKey = keyof typeof chartConfig;

export function PaymentChart({ data }: PaymentChartProps) {
  const [activeChart, setActiveChart] = useState<ChartKey>("forecasted");

  const total = useMemo<Record<ChartKey, number>>(
    () => ({
      collected: data.reduce((acc, curr) => acc + curr.collected, 0),
      forecasted: data.reduce((acc, curr) => acc + curr.forecasted, 0),
    }),
    [data]
  );

  return (
    <Card>
      <CardHeader className="flex flex-col items-stretch space-y-0 border-b p-0 sm:flex-row">
        <div className="flex flex-1 flex-col justify-center gap-1 px-6 py-5 sm:py-6">
          <CardTitle>Cash Flow</CardTitle>
          <CardDescription>
            Your collected and forecasted payments
          </CardDescription>
        </div>
        <div className="flex">
          {(Object.keys(chartConfig) as ChartKey[]).map((key) => (
            <button
              key={key}
              data-active={activeChart === key}
              className="relative z-30 flex flex-1 flex-col justify-center gap-1 border-t px-6 py-4 text-left even:border-l data-[active=true]:bg-muted/50 sm:border-l sm:border-t-0 sm:px-8 sm:py-6"
              onClick={() => setActiveChart(key)}
            >
              <span className="text-xs text-muted-foreground">
                {chartConfig[key].label}
              </span>
              <span className="text-lg font-bold leading-none sm:text-3xl">
                {formatCurrency(total[key])}
              </span>
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="px-2 sm:p-6">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[250px] w-full"
        >
          <BarChart
            data={data}
            margin={{
              left: 12,
              right: 12,
            }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value) => {
                const date = new Date(value);
                return date.toLocaleDateString("en-US", {
                  month: "short",
                  year: "numeric",
                });
              }}
            />
            <YAxis
              tickFormatter={(value) => formatCurrency(value)}
              axisLine={false}
              tickLine={false}
              tickMargin={8}
            />
            <ChartTooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  const value = payload[0].value;
                  return (
                    <div className="rounded-lg bg-white p-2 shadow-md">
                      <p className="font-semibold">{new Date(label).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</p>
                      <p>{`${chartConfig[activeChart].label}: ${typeof value === 'number' ? formatCurrency(value) : 'N/A'}`}</p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar 
              dataKey={activeChart} 
              fill={chartConfig[activeChart].color}
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
