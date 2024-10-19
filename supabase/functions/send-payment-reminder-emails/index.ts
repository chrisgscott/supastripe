import { createClient } from '@supabase/supabase-js'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

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
  };
}

serve(async (req) => {
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
      users!inner(business_name)
    `)
    .eq('status', 'pending')
    .eq('reminder_email_date', today)
    .eq('reminder_sent', false);

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
      business_name: t.users[0].business_name
    }
  })) || [];

  for (const transaction of typedTransactions) {
    const { data: emailTemplate } = await supabase
      .from('email_templates')
      .select('subject, content')
      .eq('user_id', transaction.payment_plans.user_id)
      .eq('template_type', 'upcomingPaymentReminder')
      .single()

    if (emailTemplate) {
      const emailData = {
        to: [{ email: transaction.payment_plans.customers.email }],
        templateId: 1, // Replace with your Brevo template ID
        params: {
          customer_name: transaction.payment_plans.customers.name,
          amount: transaction.amount,
          due_date: transaction.due_date,
          business_name: transaction.users.business_name
        },
        subject: emailTemplate.subject,
        htmlContent: emailTemplate.content
      }

      try {
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': brevoApiKey
          },
          body: JSON.stringify(emailData)
        })

        if (response.ok) {
          // Update the transaction to mark that a reminder has been sent
          await supabase
            .from('transactions')
            .update({ reminder_sent: true })
            .eq('id', transaction.id)
        } else {
          console.error(`Failed to send email for transaction ${transaction.id}:`, await response.text())
        }
      } catch (error) {
        console.error(`Error sending email for transaction ${transaction.id}:`, error)
      }
    }
  }

  return new Response(JSON.stringify({ message: 'Reminder emails processed successfully' }), { status: 200 })
})
