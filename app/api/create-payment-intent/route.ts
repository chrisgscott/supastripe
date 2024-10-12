// app/api/create-payment-intent/route.ts
import { NextResponse } from "next/server";
import { stripe } from "@/lib/utils";
import { createClient } from "@/utils/supabase/server";

export async function POST(request: Request) {
  try {
    const { items } = await request.json();
    const supabase = createClient();

    // Fetch the user's ID
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "User not authenticated" }, { status: 401 });
    }

    // Fetch the Stripe account ID from the stripe_accounts table
    const { data: stripeAccount, error: stripeAccountError } = await supabase
      .from('stripe_accounts')
      .select('stripe_account_id')
      .eq('user_id', user.id)
      .single();

    if (stripeAccountError || !stripeAccount?.stripe_account_id) {
      return NextResponse.json({ error: "Stripe account not found" }, { status: 400 });
    }

    const amount = calculateOrderAmount(items);

    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount,
        currency: "usd",
        automatic_payment_methods: { enabled: true },
        application_fee_amount: 123, // Consider making this dynamic
      },
      { stripeAccount: stripeAccount.stripe_account_id }
    );

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error: any) {
    console.error("Error creating PaymentIntent:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function calculateOrderAmount(items: any[]): number {
  return items.reduce((total, item) => total + item.price, 0);
}
