// @ts-nocheck

import { createClient } from '@supabase/supabase-js'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import type { Request } from 'https://deno.land/std@0.168.0/http/server.ts'
import { sendPaymentReminderEmail } from '../../../utils/email-service.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL') as string
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string
const brevoApiKey = Deno.env.get('BREVO_API_KEY') as string

interface Transaction {
  id: string;
  amount: number;
  due_date: string;
  payment_plans: {
    user_id: string;
    customers: {
      name: string;
      email: string;
    };
  };
  users: {
    business_name: string;
    support_email: string;
    support_phone: string;
  };
}

serve(async (req: Request) => {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Get transactions due for reminder today
  const today = new Date().toISOString().split('T')[0]
  const { data: transactions, error } = await supabase
    .from('transactions')
    .select(`
      id,
      amount,
      due_date,
      payment_plans!inner(user_id, customers(name, email)),
      users!inner(business_name, profiles(support_email, support_phone))
    `)
    .eq('status', 'pending')
    .eq('reminder_email_date', today)
    .is('last_reminder_email_log_id', null);

  if (error) {
    console.error('Error fetching transactions:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
  }

  const typedTransactions: Transaction[] = transactions?.map((t: any) => ({
    id: t.id,
    amount: t.amount,
    due_date: t.due_date,
    payment_plans: {
      user_id: t.payment_plans.user_id,
      customers: t.payment_plans.customers[0]
    },
    users: {
      business_name: t.users[0].business_name,
      support_email: t.users[0].profiles[0]?.support_email,
      support_phone: t.users[0].profiles[0]?.support_phone
    }
  })) || [];

  for (const transaction of typedTransactions) {
    const emailParams = {
      customer_name: transaction.payment_plans.customers.name,
      amount: transaction.amount,
      due_date: transaction.due_date,
      business_name: transaction.users.business_name,
      support_email: transaction.users.support_email,
      support_phone: transaction.users.support_phone
    }

    try {
      const success = await sendPaymentReminderEmail(
        transaction.payment_plans.customers.email,
        emailParams
      )

      // Log the email attempt
      const { data: emailLog, error: emailLogError } = await supabase
        .from('email_logs')
        .insert({
          email_type: 'payment_reminder',
          recipient_email: transaction.payment_plans.customers.email,
          status: success ? 'sent' : 'failed',
          related_id: transaction.id,
          related_type: 'transaction'
        })
        .select()
        .single()

      if (emailLogError) {
        console.error(`Error logging email for transaction ${transaction.id}:`, emailLogError)
      }

      if (success) {
        // Update the transaction to reference the email log
        await supabase
          .from('transactions')
          .update({ last_reminder_email_log_id: emailLog.id })
          .eq('id', transaction.id)
        console.log(`Successfully sent reminder email for transaction ${transaction.id}`)
      } else {
        console.error(`Failed to send email for transaction ${transaction.id}`)
      }
    } catch (error) {
      console.error(`Error sending email for transaction ${transaction.id}:`, error)
      // Log the error in email_logs
      await supabase
        .from('email_logs')
        .insert({
          email_type: 'payment_reminder',
          recipient_email: transaction.payment_plans.customers.email,
          status: 'error',
          error_message: error.message,
          related_id: transaction.id,
          related_type: 'transaction'
        })
    }
  }

  return new Response(JSON.stringify({ message: 'Reminder emails processed successfully' }), { status: 200 })
})
