// app/api/secret/route.ts
import { NextResponse } from "next/server";
import { stripe } from "@/lib/utils";

export async function GET() {
  try {
    // Replace with your logic for creating or fetching the PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: 1000, // Replace with the actual amount
      currency: "usd",
      automatic_payment_methods: { enabled: true },
    });

    return NextResponse.json({ client_secret: paymentIntent.client_secret });
  } catch (error: any) {
    console.error("An error occurred when creating the PaymentIntent:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
