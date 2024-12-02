'use client'

import { Card } from "@/components/ui/card"
import { BackpackIcon, MailIcon } from 'lucide-react'

interface VerificationWaitingProps {
  onCheckStatus: () => void;
}

export function VerificationWaiting({ onCheckStatus }: VerificationWaitingProps) {
  return (
    <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
      <Card className="p-6">
        <h3 className="font-semibold mb-4 flex items-center">
          <BackpackIcon className="h-5 w-5 mr-2" />
          Helpful Resources
        </h3>
        <ul className="space-y-3 text-sm text-muted-foreground">
          <li>
            <a
              href="https://stripe.com/docs/connect/testing"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Testing Guide: Learn how to test payments
            </a>
          </li>
          <li>
            <a
              href="https://stripe.com/docs/connect/best-practices"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Best Practices: Tips for a successful integration
            </a>
          </li>
          <li>
            <a
              href="https://stripe.com/docs/payments/payment-methods/overview"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Payment Methods: Overview of supported methods
            </a>
          </li>
        </ul>
      </Card>

      <Card className="p-6">
        <h3 className="font-semibold mb-4 flex items-center">
          <MailIcon className="h-5 w-5 mr-2" />
          Next Steps
        </h3>
        <ul className="space-y-3 text-sm text-muted-foreground">
          <li>✓ Review the payment plan options you'll offer</li>
          <li>✓ Prepare your customer communications</li>
          <li>✓ Set up your business profile in the dashboard</li>
          <li>✓ Bookmark the Stripe dashboard for easy access</li>
        </ul>
      </Card>
    </div>
  )
}
