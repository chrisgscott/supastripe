import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import Stripe from 'stripe';
import { PaymentPlan } from '@/types/payment-plans';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" });

export async function GET(request: Request) {
  const supabase = createClient();
  const { searchParams } = new URL(request.url);
  const setupIntent = searchParams.get('setup_intent');
  const planId = searchParams.get('plan_id');

  if (!setupIntent || !planId) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}/error?message=Invalid setup intent`);
  }

  try {
    const intent = await stripe.setupIntents.retrieve(setupIntent, {
      expand: ['payment_method']
    });
    
    if (intent.status === 'succeeded' && intent.payment_method) {
      const paymentMethod = intent.payment_method as Stripe.PaymentMethod;

      // Get the payment plan to get the user_id and customer name
      const { data: plan, error: planError } = await supabase
        .from('payment_plans')
        .select(`
          user_id,
          customer:customers!inner (
            name,
            stripe_customer_id
          )
        `)
        .eq('id', planId)
        .single() as unknown as {
          data: {
            user_id: string;
            customer: {
              name: string;
              stripe_customer_id: string;
            };
          };
          error: any;
        };

      if (planError || !plan) {
        console.error('Error fetching payment plan:', planError);
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}/error?message=Payment plan not found`);
      }

      const customerName = plan.customer.name;

      // Update the customer's default payment method
      await stripe.customers.update(intent.customer as string, {
        invoice_settings: {
          default_payment_method: paymentMethod.id
        }
      });

      // Update payment plan with new card details
      const { error: updateError } = await supabase
        .from('payment_plans')
        .update({
          card_last_four: paymentMethod.card?.last4,
          card_expiration_month: paymentMethod.card?.exp_month,
          card_expiration_year: paymentMethod.card?.exp_year,
          updated_at: new Date().toISOString()
        })
        .eq('id', planId);

      if (updateError) {
        console.error('Error updating payment plan:', updateError);
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}/error?message=Failed to update card details`);
      }

      // Log the activity with user_id and customer_name
      const { error: logError } = await supabase
        .from('activity_logs')
        .insert({
          activity_type: 'payment_method_updated',
          entity_id: planId,
          entity_type: 'payment_plan',
          user_id: plan.user_id,
          customer_name: plan.customer.name,
          metadata: {
            card_last_four: paymentMethod.card?.last4,
            card_brand: paymentMethod.card?.brand
          }
        });

      if (logError) {
        console.error('Error logging card update activity:', logError);
      }

      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}/plan/${planId}`);
    }

    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}/error?message=Setup intent not succeeded`);
  } catch (error) {
    console.error('Error handling card update:', error);
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}/error?message=Failed to update card`);
  }
}