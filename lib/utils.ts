import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import Stripe from 'stripe';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Stripe instance
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2023-08-16',
  stripeAccount: process.env.NODE_ENV === 'production' ? undefined : 'YOUR_TEST_CONNECTED_ACCOUNT_ID',
});
