'use client'

import { Card } from "@/components/ui/card"
import { BackpackIcon, MailIcon } from 'lucide-react'
import { OnboardingProfileReview } from './OnboardingProfileReview'
import { User } from '@supabase/supabase-js'
import { Database } from '@/types/supabase'

type Profile = Database['public']['Tables']['profiles']['Row']

interface VerificationWaitingProps {
  onCheckStatus: () => void;
  user: User;
  profile: Profile;
}

export function VerificationWaiting({ onCheckStatus, user, profile }: VerificationWaitingProps) {
  return (
    <div className="grid gap-6 grid-cols-1">
      <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
        <OnboardingProfileReview user={user} profile={profile} />
        
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
      </div>

      <Card className="p-6">
        <h3 className="font-semibold mb-4 flex items-center">
          <MailIcon className="h-5 w-5 mr-2" />
          Verification Status
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          We&apos;ll notify you once your account is verified. This usually takes 1-2 business days.
        </p>
        <button
          onClick={onCheckStatus}
          className="text-sm text-primary hover:underline"
        >
          Check verification status
        </button>
      </Card>
    </div>
  )
}
