"use client"

import { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  getFilteredRowModel,
  ColumnFiltersState,
} from "@tanstack/react-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowUpDown, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { formatCurrency } from '@/utils/currencyUtils';
import { Money } from '@/utils/currencyUtils';

const PAYMENT_PLAN_STATUSES = [
  "created",
  "active",
  "completed",
  "cancelled",
  "failed",
] as const;

type PaymentPlanStatus = (typeof PAYMENT_PLAN_STATUSES)[number];

interface PaymentPlan {
  id: string;
  customerName: string;
  totalAmount: string;
  nextPaymentDate: string | null;
  status: string;
  created_at: string;
}

const getStatusColor = (status: PaymentPlanStatus): string => {
  switch (status) {
    case 'active':
      return 'text-green-600';
    case 'completed':
      return 'text-blue-600';
    case 'cancelled':
      return 'text-red-600';
    case 'failed':
      return 'text-orange-600';
    default:
      return 'text-gray-600';
  }
};

const columns: ColumnDef<PaymentPlan>[] = [
  {
    accessorKey: "customerName",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Customer
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const customerName = row.original.customerName || "Unknown";
      return <div>{customerName}</div>;
    },
  },
  {
    accessorKey: "totalAmount",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Amount
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      return row.getValue("totalAmount");
    },
  },
  {
    accessorKey: "nextPaymentDate",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Next Payment
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const date = row.getValue("nextPaymentDate");
      if (!date) return "No payments scheduled";
      return format(new Date(date as string), "MMM d, yyyy");
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      return (
        <span className="capitalize">{row.getValue("status")}</span>
      );
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const plan = row.original;
      return (
        <Button
          variant="default"
          size="sm"
          className="h-8"
          onClick={() => window.location.href = `/plan/${plan.id}`}
        >
          View Details
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      );
    },
  },
];

async function fetchPaymentPlans() {
  const response = await fetch("/api/payment-plans");
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to fetch payment plans");
  }
  const data = await response.json();
  console.log('Fetched payment plans:', JSON.stringify(data, null, 2));
  return data;
}

export function PaymentPlansTable() {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  const {
    data: paymentPlans,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["paymentPlans"],
    queryFn: fetchPaymentPlans,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const table = useReactTable({
    data: paymentPlans || [],
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: (row, columnId, filterValue) => {
      const value = row.getValue(columnId);
      return String(value).toLowerCase().includes(String(filterValue).toLowerCase());
    },
    state: {
      sorting,
      columnFilters,
      globalFilter,
    },
  });

  useEffect(() => {
    if (paymentPlans) {
      console.log('Payment plans in component:', JSON.stringify(paymentPlans, null, 2));
    }
  }, [paymentPlans]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (isError) {
    return <div>Error loading payment plans</div>;
  }

  return (
    <div className="w-full">
      <div className="flex items-center py-4">
        <Input
          placeholder="Search all columns..."
          value={globalFilter ?? ""}
          onChange={(event) => setGlobalFilter(event.target.value)}
          className="max-w-sm mr-4"
        />
        <Select
          value={
            (table.getColumn("status")?.getFilterValue() as string) ?? "all"
          }
          onValueChange={(value) =>
            table
              .getColumn("status")
              ?.setFilterValue(value === "all" ? "" : value)
          }
        >
          <SelectTrigger className="max-w-sm">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {PAYMENT_PLAN_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody className="text-sm">
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end space-x-2 py-4">
        <div className="flex-1 text-sm text-muted-foreground">
          {table.getFilteredSelectedRowModel().rows.length} of{" "}
          {table.getFilteredRowModel().rows.length} row(s) selected.
        </div>
        <div className="space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
