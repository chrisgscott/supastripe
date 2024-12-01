import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ReloadIcon, BackpackIcon, EnvelopeClosedIcon } from '@radix-ui/react-icons'

export function VerificationWaiting({ onCheckStatus }: { onCheckStatus: () => void }) {
  return (
    <div className="mt-6 space-y-6">
      <Card className="p-6">
        <h3 className="font-semibold text-lg mb-4">While You Wait</h3>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Stripe is reviewing your account. This usually takes less than 24 hours. We'll send you an email when your account is verified.
          </p>
          <div className="flex space-x-4">
            <Button
              variant="outline"
              onClick={onCheckStatus}
              className="flex items-center"
            >
              <ReloadIcon className="h-4 w-4 mr-2" />
              Check Verification Status
            </Button>
          </div>
        </div>
      </Card>

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
            <EnvelopeClosedIcon className="h-5 w-5 mr-2" />
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
    </div>
  )
}
