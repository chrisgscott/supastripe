// @ts-nocheck

// Import necessary dependencies
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import type { Request } from 'https://deno.land/std@0.168.0/http/server.ts'

// Get environment variables
const supabaseUrl = Deno.env.get('SUPABASE_URL') as string
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string
const brevoApiKey = Deno.env.get('BREVO_API_KEY') as string

// Define the Transaction interface
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
  business_info?: {
    business_name: string;
    support_email: string;
    support_phone: string;
  };
}

// Function to send a payment reminder email using Brevo API
async function sendPaymentReminderEmail(
  recipientEmail: string,
  params: {
    customer_name: string;
    amount: number;
    due_date: string;
    business_name: string;
    support_email: string;
    support_phone: string;
  }
): Promise<boolean> {
  try {
    // Send email using Brevo API
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': brevoApiKey,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        to: [{ email: recipientEmail }],
        templateId: 1,
        params: params
      })
    });

    // Check if the API request was successful
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error response from Brevo API:', errorData);
      return false;
    }

    console.log('Email sent successfully');
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}

// Main function to handle the HTTP request
serve(async (req: Request) => {
  console.log('Function started');
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    console.log('Fetching transactions');
    const today = new Date().toISOString().split('T')[0]
    
    // Fetch pending transactions that need reminder emails
    const { data: transactions, error } = await supabase
      .from('transactions')
      .select(`
        id,
        amount,
        due_date,
        payment_plans!inner(
          user_id,
          customers(name, email)
        )
      `)
      .eq('status', 'pending')
      .eq('reminder_email_date', today)
      .is('last_reminder_email_log_id', null);

    if (error) {
      console.error('Error fetching transactions:', error);
      return new Response(JSON.stringify({ error: 'Error fetching transactions' }), { status: 500 });
    }

    console.log(`Found ${transactions?.length || 0} transactions to process`);

    // Process each transaction concurrently
    const results = await Promise.allSettled(transactions.map(async (transaction) => {
      // Create a unique idempotency key for this email attempt
      const idempotencyKey = `payment_reminder_${transaction.id}_${today}`;

      // Check if an email has already been sent for this transaction today
      const { data: existingLog } = await supabase
        .from('email_logs')
        .select()
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle();

      if (existingLog) {
        console.log(`Email already processed for transaction ${transaction.id}`);
        return;
      }

      // Fetch business profile data
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('business_name, support_email, support_phone')
        .eq('id', transaction.payment_plans.user_id)
        .single();

      if (profileError) {
        console.error(`Error fetching profile data for user ID ${transaction.payment_plans.user_id}:`, profileError);
        return;
      }

      // Prepare email parameters
      const emailParams = {
        customer_name: transaction.payment_plans.customers.name,
        amount: Number((transaction.amount / 100).toFixed(2)), // Round to 2 decimal places
        due_date: transaction.due_date,
        business_name: profileData.business_name,
        support_email: profileData.support_email,
        support_phone: profileData.support_phone
      };

      // Attempt to send email with retries
      let retries = 3;
      while (retries > 0) {
        try {
          const success = await sendPaymentReminderEmail(
            transaction.payment_plans.customers.email,
            emailParams
          );

          // Prepare log data
          const logData = {
            email_type: 'payment_reminder',
            recipient_email: transaction.payment_plans.customers.email,
            status: success ? 'sent' : 'failed',
            related_id: transaction.id,
            related_type: 'transaction',
            idempotency_key: idempotencyKey
          };

          // Log the email attempt
          const { data, error: logError } = await supabase
            .from('email_logs')
            .insert(logData)
            .select()
            .single();

          if (logError) {
            throw logError;
          }

          if (success) {
            // Update the transaction with the email log ID
            await supabase
              .from('transactions')
              .update({ last_reminder_email_log_id: data.id })
              .eq('id', transaction.id);

            console.log(`Successfully sent reminder email for transaction ${transaction.id}`);
            return;
          }
        } catch (error) {
          console.error(`Error sending email for transaction ${transaction.id}:`, error);
          retries--;
          if (retries === 0) {
            // Log the final failed attempt
            await supabase
              .from('email_logs')
              .insert({
                email_type: 'payment_reminder',
                recipient_email: transaction.payment_plans.customers.email,
                status: 'failed',
                error_message: error.message,
                related_id: transaction.id,
                related_type: 'transaction',
                idempotency_key: idempotencyKey
              });
          }
        }
      }
    }));

    // Count successful and failed email sends
    const failedCount = results.filter(result => result.status === 'rejected').length;
    const successCount = results.length - failedCount;

    // Return the results
    return new Response(JSON.stringify({ 
      message: 'Reminder emails processed',
      successCount,
      failedCount
    }), { status: 200 });
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(JSON.stringify({ error: 'Unexpected error occurred' }), { status: 500 });
  }
});
