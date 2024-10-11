// app/account/route.ts
import { NextResponse } from 'next/server';
import { stripe } from '@/lib/utils';

export async function POST(request: Request) {
  try {
    // Create a new connected account with the Stripe API
    const account = await stripe.accounts.create({});

    return NextResponse.json({ account: account.id });
  } catch (error: any) {
    console.error('An error occurred when calling the Stripe API to create an account:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
