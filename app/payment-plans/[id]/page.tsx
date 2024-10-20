import { createClient } from '@/utils/supabase/server'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { format } from 'date-fns'
import UpdateCardModalWrapper from '../components/UpdateCardModalWrapper'
import { formatCurrency } from '@/utils/formatCurrency'

interface PaymentPlanDetails {
  id: string
  customerName: string
  customerEmail: string
  totalAmount: number
  amountPaid: number
  status: string
  createdAt: string
  customers: { name?: string; email?: string; stripe_customer_id?: string } | { name?: string; email?: string; stripe_customer_id?: string }[] | null
  transactions: {
    id: string
    amount: number
    dueDate: string
    status: string
  }[]
}

export default async function PaymentPlanDetails({ params }: { params: { id: string } }) {
  const supabase = createClient();
  
  const { data: paymentPlan, error } = await supabase
    .from('payment_plans')
    .select(`
      id,
      total_amount,
      status,
      created_at,
      customers (id, name, email, stripe_customer_id),
      transactions (id, amount, due_date, status)
    `)
    .eq('id', params.id)
    .single();

  if (error || !paymentPlan) {
    console.error('Error fetching payment plan:', error);
    notFound();
  }

  const planDetails: PaymentPlanDetails = {
    id: paymentPlan.id,
    customerName: (() => {
      if (Array.isArray(paymentPlan.customers)) {
        return paymentPlan.customers[0]?.name || 'Unknown';
      } else if (paymentPlan.customers && typeof paymentPlan.customers === 'object') {
        return (paymentPlan.customers as { name?: string }).name || 'Unknown';
      }
      return 'Unknown';
    })(),
    customerEmail: (() => {
      if (Array.isArray(paymentPlan.customers)) {
        return paymentPlan.customers[0]?.email || 'Unknown';
      } else if (paymentPlan.customers && typeof paymentPlan.customers === 'object') {
        return (paymentPlan.customers as { email?: string }).email || 'Unknown';
      }
      return 'Unknown';
    })(),
    totalAmount: paymentPlan.total_amount,
    amountPaid: paymentPlan.transactions.reduce((sum, t) => t.status === 'paid' ? sum + t.amount : sum, 0),
    status: paymentPlan.status,
    createdAt: paymentPlan.created_at,
    customers: paymentPlan.customers,
    transactions: paymentPlan.transactions.map((t: any) => ({
      id: t.id,
      amount: t.amount,
      dueDate: t.due_date,
      status: t.status
    }))
  };

  // Sort transactions by due date and find the next unpaid one
  const nextPayment = planDetails.transactions
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .find(t => t.status !== 'paid' && new Date(t.dueDate) >= new Date());

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-4">{planDetails.customerName}</h1>
      <p className="text-gray-600 mb-8">{planDetails.customerEmail} • Created on {format(new Date(planDetails.createdAt), 'MMMM d, yyyy')} • <span className="bg-green-100 text-green-800 px-2 py-1 rounded">{planDetails.status}</span></p>
      
      <div className="grid grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Plan Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Total Amount:</span>
                <span className="font-semibold">{formatCurrency(planDetails.totalAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span>Amount Paid:</span>
                <span className="font-semibold">{formatCurrency(planDetails.amountPaid)}</span>
              </div>
              <div className="flex justify-between">
                <span>Amount Scheduled:</span>
                <span className="font-semibold mb-3">{formatCurrency(planDetails.totalAmount - planDetails.amountPaid)}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4 mt-2">
                <div className="bg-blue-500 h-4 rounded-full" style={{ width: `${(planDetails.amountPaid / planDetails.totalAmount) * 100}%` }}></div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Next Payment</CardTitle>
          </CardHeader>
          <CardContent>
            {nextPayment ? (
              <>
                <div className="text-3xl font-bold mb-2">{formatCurrency(nextPayment.amount)}</div>
                <div className="text-gray-600 mb-4">Due on {format(new Date(nextPayment.dueDate), 'MMMM d, yyyy')}</div>
                <UpdateCardModalWrapper 
                  stripeCustomerId={
                    Array.isArray(planDetails.customers)
                      ? planDetails.customers[0]?.stripe_customer_id ?? ''
                      : planDetails.customers?.stripe_customer_id ?? ''
                  } 
                  paymentPlanId={planDetails.id}
                />
                <Button variant="outline" className="w-full">Update Payment Schedule</Button>
              </>
            ) : (
              <div>No upcoming payments</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Email Logs</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-2">Recent emails sent to the client</p>
            <ul className="space-y-2">
              <li>✉️ Payment Reminder - June 25, 2023</li>
              <li>✉️ Payment Confirmation - June 1, 2023</li>
              <li>✉️ Payment Reminder - May 25, 2023</li>
            </ul>
          </CardContent>
        </Card>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {planDetails.transactions
                .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
                .map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell>{format(new Date(transaction.dueDate), 'MMMM d, yyyy')}</TableCell>
                    <TableCell>{formatCurrency(transaction.amount)}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded ${transaction.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                        {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
