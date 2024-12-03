import { createClient } from '@/utils/supabase/client'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useState } from 'react'

interface OnboardingStateControlProps {
  userId: string
  currentState: {
    isOnboarded: boolean | null
    stripeAccountId: string | null
  }
}

export function OnboardingStateControl({ userId, currentState }: OnboardingStateControlProps) {
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const updateOnboardingState = async (isOnboarded: boolean | null, stripeAccountId: string | null) => {
    setLoading(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          is_onboarded: isOnboarded,
          stripe_account_id: stripeAccountId
        })
        .eq('id', userId)

      if (error) throw error

      // Force reload to update the UI
      window.location.reload()
    } catch (error) {
      console.error('Error updating onboarding state:', error)
    } finally {
      setLoading(false)
    }
  }

  if (process.env.NODE_ENV === 'production') {
    return null
  }

  return (
    <Card className="p-4 mb-4 border-2 border-yellow-500">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-yellow-600">Development Controls</h3>
          <div className="text-xs text-muted-foreground">
            Current State: {currentState.isOnboarded ? 'Onboarded' : 'Not Onboarded'}
          </div>
        </div>
        
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => updateOnboardingState(null, null)}
            disabled={loading || (currentState.isOnboarded === null && currentState.stripeAccountId === null)}
          >
            Reset to Start
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => updateOnboardingState(false, 'acct_fake')}
            disabled={loading || (currentState.isOnboarded === false && currentState.stripeAccountId === 'acct_fake')}
          >
            Set to Connecting
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => updateOnboardingState(false, 'acct_real')}
            disabled={loading || (currentState.isOnboarded === false && currentState.stripeAccountId === 'acct_real')}
          >
            Set to Profile Review
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => updateOnboardingState(true, 'acct_real')}
            disabled={loading || (currentState.isOnboarded === true && currentState.stripeAccountId === 'acct_real')}
          >
            Set to Completed
          </Button>
        </div>
      </div>
    </Card>
  )
}
