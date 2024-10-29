"use client"

import { useSearchParams } from 'next/navigation'
import ConfirmationStep from '../new-plan/components/ConfirmationStep'

export default function PaymentConfirmation() {
  const searchParams = useSearchParams()
  const paymentIntent = searchParams.get('payment_intent')

  if (!paymentIntent) {
    return <div>No payment intent found</div>
  }

  // Pass undefined for planDetails - the component will fetch them using the paymentIntent
  return (
    <div className="container mx-auto py-10">
      <ConfirmationStep 
        planDetails={undefined} 
        paymentIntent={paymentIntent} 
      />
    </div>
  )
}
