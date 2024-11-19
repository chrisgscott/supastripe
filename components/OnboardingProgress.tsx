'use client'

import { useState, useEffect } from 'react'
import { CheckCircle, Circle, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { User } from '@supabase/supabase-js'
import LoadingOverlay from './LoadingOverlay'
import { Database } from '@/types/supabase'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle2, ArrowRight } from "lucide-react"

type StripeAccount = Database['public']['Tables']['stripe_accounts']['Row']

interface OnboardingProgressProps {
  user: User
}

interface OnboardingStep {
  id: string
  title: string
  description: string
  completed: boolean
  href: string
}

interface FormattedStripeAccount {
  id: string
  user_id: string
  stripe_account_id: string
  stripe_onboarding_completed: boolean
  stripe_account_created_at: string
  stripe_account_details_url: string | null
}

export default function OnboardingProgress({ user }: OnboardingProgressProps) {
  const router = useRouter()
  const [loadingStep, setLoadingStep] = useState<string | null>(null)
  const [steps, setSteps] = useState<OnboardingStep[]>([
    {
      id: 'confirm-account',
      title: 'Confirm Your Account',
      description: 'Verify your email address',
      completed: true,
      href: '#'
    },
    {
      id: 'connect-stripe',
      title: 'Connect Stripe Account',
      description: 'Set up your Stripe account',
      completed: false,
      href: '#'
    },
    {
      id: 'verify-stripe',
      title: 'Verify Stripe Account',
      description: 'Pending verification. This process typically takes 5-7 business days.',
      completed: false,
      href: '#'
    },
    {
      id: 'create-plan',
      title: 'Create Your First Plan',
      description: 'Set up a payment plan for your customers',
      completed: false,
      href: '/payment-plans/new'
    }
  ])
  const [connecting, setConnecting] = useState(false)
  const [stripeAccount, setStripeAccount] = useState<StripeAccount | null>(null)
  const [stripeData, setStripeData] = useState<{ stripeAccount: StripeAccount | null }>({ stripeAccount: null })

  const isStepAvailable = (index: number): boolean => {
    if (index === 0) return true
    if (index === 2) { // verify-stripe step
      return !!stripeAccount && !stripeAccount.stripe_onboarding_completed
    }
    return steps.slice(0, index).every(step => step.completed)
  }

  const handleStripeConnect = async () => {
    console.log('Starting Stripe connection...')
    setConnecting(true)
    console.log('Connecting state:', connecting)

    try {
      console.log('Making account request...')
      const accountResponse = await fetch('/api/account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'standard',
          country: 'US',
          email: user?.email,
        }),
      })

      const accountData = await accountResponse.json()
      console.log('Account response:', accountData)

      if (accountData.error) {
        throw new Error(accountData.error)
      }

      console.log('Making link request...')
      const linkResponse = await fetch('/api/account_link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account: accountData.account,
          type: 'account_onboarding',
          refresh_url: window.location.href,
          return_url: window.location.href,
        }),
      })

      const linkData = await linkResponse.json()
      console.log('Link response:', linkData)

      if (linkData.error) {
        throw new Error(linkData.error)
      }

      console.log('Redirecting to:', linkData.url)
      window.location.href = linkData.url
    } catch (error) {
      console.error('Error in handleStripeConnect:', error)
      setConnecting(false)
    } finally {
      setConnecting(false)
      checkStripeStatus()
    }
  }

  const checkProgress = async () => {
    try {
      const supabase = createClient()
      const { data: stripeAccount } = await supabase
        .from('stripe_accounts')
        .select('stripe_account_id, stripe_onboarding_completed, stripe_account_details_url')
        .single()

      setSteps(steps => steps.map(step => {
        if (step.id === 'connect-stripe') {
          return {
            ...step,
            completed: !!stripeAccount?.stripe_onboarding_completed,
            href: stripeAccount?.stripe_account_details_url || '#'
          }
        }
        if (step.id === 'verify-stripe') {
          return {
            ...step,
            completed: stripeAccount?.stripe_onboarding_completed,
            href: stripeAccount?.stripe_account_details_url || '#'
          }
        }
        if (step.id === 'create-plan') {
          return {
            ...step,
            completed: stripeAccount?.stripe_onboarding_completed,
            href: stripeAccount?.stripe_account_details_url || '#'
          }
        }
        return step
      }))
    } catch (error) {
      console.error('Error checking progress:', error)
    } finally {
      setLoadingStep(null)
    }
  }

  const getStepIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-6 w-6 text-primary" />
      case 'pending':
        return <AlertCircle className="h-6 w-6 text-yellow-500" />
      default:
        return <Circle className="h-6 w-6 text-muted-foreground" />
    }
  }

  const getStepButton = (step: OnboardingStep) => {
    if (loadingStep === step.id) {
      return (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Connecting...
        </>
      )
    }

    // For connect-stripe step, show completed when account exists
    if (step.id === 'connect-stripe' && stripeAccount) {
      return 'Completed'
    }
    
    // For verify-stripe step
    if (step.id === 'verify-stripe') {
      return 'Check Status'
    }
    
    if (step.completed) return 'Completed'
    return 'Start'
  }

  const handleStepClick = (step: OnboardingStep) => {
    if (step.id === 'connect-stripe' && stripeAccount) {
      return // Disable click when completed
    }
    
    if (!step.completed && isStepAvailable(steps.indexOf(step))) {
      if (step.id === 'verify-stripe') {
        // Always use the account-specific dashboard URL
        if (stripeAccount?.stripe_account_id) {
          window.open(`https://dashboard.stripe.com/connect/accounts/${stripeAccount.stripe_account_id}`, '_blank');
        } else {
          console.error('No Stripe account ID available');
          window.open('https://dashboard.stripe.com', '_blank');
        }
      } else if (step.id === 'connect-stripe') {
        handleStripeConnect()
      } else if (step.href) {
        router.push(step.href)
      }
    }
  }

  useEffect(() => {
    checkProgress()
  }, [])

  useEffect(() => {
    checkStripeStatus()
  }, [])

  const checkStripeStatus = async () => {
    try {
      const response = await fetch('/api/stripe-status')
      const data = await response.json()
      
      if (data.stripeAccount) {
        setStripeAccount(data.stripeAccount)
      }
    } catch (error) {
      console.error('Error checking Stripe status:', error)
    }
  }

  const getStepStatus = (stepId: string) => {
    if (stepId === 'connect-stripe') {
      return stripeAccount ? 'completed' : 'not_started'
    }
    if (stepId === 'verify-stripe') {
      if (!stripeAccount) return 'not_started'
      return stripeAccount.stripe_onboarding_completed ? 'completed' : 'pending'
    }
    return 'completed' // For email verification step
  }

  // Start with 1 completed step (email confirmation)
  const completedSteps = steps.filter(step => step.completed).length
  const progress = (completedSteps / steps.length) * 100

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const response = await fetch('/api/stripe-status')
        const data = await response.json()
        console.log('Stripe Status Response:', data)
        setStripeData(data)
      } catch (error) {
        console.error('Error fetching stripe status:', error)
      }
    }

    checkStatus()
  }, [])

  const formatStripeAccount = (account: StripeAccount | null): FormattedStripeAccount | null => {
    if (!account) return null
    return {
      id: account.id,
      user_id: account.user_id || '',
      stripe_account_id: account.stripe_account_id || '',
      stripe_onboarding_completed: account.stripe_onboarding_completed || false,
      stripe_account_created_at: account.stripe_account_created_at || new Date().toISOString(),
      stripe_account_details_url: account.stripe_account_details_url
    }
  }

  const formattedStripeAccount = formatStripeAccount(stripeData.stripeAccount)

  const getStripeStatus = () => {
    if (!formattedStripeAccount) return 'not_started'
    if (!formattedStripeAccount.stripe_onboarding_completed) return 'pending'
    return 'completed'
  }

  const getStripeDetailsUrl = () => {
    return formattedStripeAccount?.stripe_account_details_url || 'https://dashboard.stripe.com'
  }

  const renderStripeConnectButton = () => {
    if (!stripeData?.stripeAccount) {
      return (
        <Button onClick={() => window.location.href = '/onboarding'}>
          Start <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      )
    }
    
    if (!stripeData.stripeAccount.stripe_onboarding_completed) {
      return (
        <Button 
          variant="outline"
          onClick={() => window.open(getStripeDetailsUrl(), '_blank')}
        >
          Check Status <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      )
    }
    
    return null // No button needed if completed
  }

  if (loadingStep) {
    return null
  }

  return (
    <>
      <LoadingOverlay visible={connecting} message="Connecting to Stripe..." />
      <Card className="relative shadow-xl">
        <CardHeader>
          <CardTitle>Complete Your Setup</CardTitle>
          <CardDescription className="text-muted-foreground">Finish these steps to start using your account</CardDescription>
        </CardHeader>
        <CardContent>
          <Progress value={progress} className="mb-4 [&>div]:bg-[#0D89CA]" />
          <p className="text-sm text-foreground mb-6">
            {completedSteps} of {steps.length} steps completed
          </p>
          <div className="space-y-4">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-start space-x-3">
                <div className="mt-0.5">
                  {getStepIcon(getStepStatus(step.id))}
                </div>
                <div className="flex-grow min-w-0">
                  <h3 className="text-sm mb-1 font-medium">{step.title}</h3>
                  <p className="text-xs text-muted-foreground">
                    {getStepStatus(step.id) === 'pending' ? 'Pending verification...' : step.description}
                  </p>
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <Button 
                          variant={getStepStatus(step.id) === 'completed' ? "outline" : "default"} 
                          size="sm" 
                          onClick={() => handleStepClick(step)}
                          disabled={getStepStatus(step.id) === 'completed' || (step.id === 'connect-stripe' && !!stripeAccount)}
                        >
                          {getStepButton(step)}
                        </Button>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      {getStepStatus(step.id) === 'completed' 
                        ? "You've completed this step" 
                        : "Complete previous steps to unlock"}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            ))}
          </div>
          {completedSteps === steps.length && (
            <div className="mt-6 text-center">
              <h3 className="text-lg font-semibold text-primary">All Set!</h3>
              <p className="text-sm text-muted-foreground">You're ready to start creating payment plans.</p>
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Onboarding Progress</CardTitle>
          <CardDescription>Debug View</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertDescription>
              <pre className="whitespace-pre-wrap">
                {JSON.stringify(stripeData, null, 2)}
              </pre>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </>
  )
}