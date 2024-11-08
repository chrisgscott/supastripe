"use client"

import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export function PaymentPlansTableSkeleton() {
  return (
    <div className="w-full">
      <div className="flex items-center py-4">
        <Skeleton className="h-10 w-[300px] mr-4" />
        <Skeleton className="h-10 w-[200px]" />
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead><Skeleton className="h-6 w-[100px]" /></TableHead>
              <TableHead><Skeleton className="h-6 w-[100px]" /></TableHead>
              <TableHead><Skeleton className="h-6 w-[120px]" /></TableHead>
              <TableHead><Skeleton className="h-6 w-[80px]" /></TableHead>
              <TableHead><Skeleton className="h-6 w-[100px]" /></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(5)].map((_, index) => (
              <TableRow key={index}>
                <TableCell><Skeleton className="h-6 w-[150px]" /></TableCell>
                <TableCell><Skeleton className="h-6 w-[100px]" /></TableCell>
                <TableCell><Skeleton className="h-6 w-[120px]" /></TableCell>
                <TableCell><Skeleton className="h-6 w-[80px]" /></TableCell>
                <TableCell><Skeleton className="h-8 w-[120px]" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end space-x-2 py-4">
        <Skeleton className="h-6 w-[200px]" />
        <div className="space-x-2">
          <Skeleton className="h-8 w-[80px] inline-block" />
          <Skeleton className="h-8 w-[80px] inline-block" />
        </div>
      </div>
    </div>
  )
}