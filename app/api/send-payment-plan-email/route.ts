import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { sendEmail } from '@/utils/core-email-service';

export async function POST(request: Request) {
  const supabase = createClient();
  const planDetails = await request.json();

  try {
    // Fetch business details
    const { data: businessInfo, error: businessError } = await supabase
      .from('profiles')
      .select('business_name, support_email, support_phone')
      .single();

    if (businessError) throw businessError;

    const emailParams = {
      customer_name: planDetails.customerName,
      total_amount: planDetails.totalAmount.toFixed(2),
      number_of_payments: planDetails.numberOfPayments,
      payment_interval: planDetails.paymentInterval,
      business_name: businessInfo.business_name,
      support_email: businessInfo.support_email,
      support_phone: businessInfo.support_phone,
      payment_schedule: planDetails.paymentSchedule.map((payment: any) => 
        `${new Date(payment.date).toLocaleDateString()}: $${payment.amount.toFixed(2)}`
      ).join('\n')
    };

    const success = await sendEmail(planDetails.customerEmail, 2, emailParams); // Assuming template ID 2 for payment plan details

    if (success) {
      return NextResponse.json({ message: 'Payment plan email sent successfully' });
    } else {
      return NextResponse.json({ error: 'Failed to send payment plan email' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error sending payment plan email:', error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}
