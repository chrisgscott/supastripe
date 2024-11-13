'use client'

import { useState, useEffect } from 'react'
import { CheckCircle, Circle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface OnboardingStep {
  id: string
  title: string
  description: string
  completed: boolean
  href: string
}

export default function OnboardingProgress() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [steps, setSteps] = useState<OnboardingStep[]>([
    {
      id: 'confirm-account',
      title: 'Confirm Your Account',
      description: 'Verify your email address',
      completed: true, // Always true since they've already done this
      href: '#'
    },
    {
      id: 'connect-stripe',
      title: 'Connect Stripe Account',
      description: 'Link your Stripe account for payments',
      completed: false,
      href: '/api/account'
    },
    {
      id: 'complete-stripe',
      title: 'Complete Stripe Setup',
      description: 'Verify your identity and add business details',
      completed: false,
      href: '/api/get-onboarding-link'
    },
    {
      id: 'create-plan',
      title: 'Create Your First Plan',
      description: 'Set up a payment plan for your customers',
      completed: false,
      href: '/payment-plans/new'
    },
  ])

  useEffect(() => {
    const checkProgress = async () => {
      try {
        const supabase = createClient()

        // Get Stripe account data
        const { data: stripeAccount } = await supabase
          .from('stripe_accounts')
          .select('stripe_account_id, stripe_onboarding_completed')
          .single()

        // Get payment plans count
        const { hasPaymentPlans } = await fetch('/api/check-payment-plans')
          .then(res => res.json())

        setSteps(steps => steps.map(step => ({
          ...step,
          completed:
            step.id === 'confirm-account' ? true : // Always true
              step.id === 'connect-stripe' ? !!stripeAccount?.stripe_account_id :
                step.id === 'complete-stripe' ? !!stripeAccount?.stripe_onboarding_completed :
                  step.id === 'create-plan' ? hasPaymentPlans :
                    false
        })))
      } catch (error) {
        console.error('Error checking progress:', error)
      } finally {
        setLoading(false)
      }
    }

    checkProgress()
  }, [])

  // Start with 1 completed step (email confirmation)
  const completedSteps = steps.filter(step => step.completed).length
  const progress = (completedSteps / steps.length) * 100

  const getStepCompletion = (
    stepId: string,
    profile: any,
    stripeAccount: any,
    plansCount: number
  ) => {
    switch (stepId) {
      case 'connect-stripe':
        return !!stripeAccount?.stripe_account_id
      case 'complete-stripe':
        return !!stripeAccount?.stripe_onboarding_completed
      case 'create-plan':
        return plansCount > 0
      default:
        return false
    }
  }

  const handleStepClick = (step: OnboardingStep) => {
    if (!step.completed && isStepAvailable(steps.indexOf(step))) {
      router.push(step.href)
    }
  }

  const isStepAvailable = (index: number) => {
    if (index === 0) return true
    return steps[index - 1].completed
  }


  if (loading) {
    return null
  }

  return (
    <Card className="shadow-xl">
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
                {step.completed ? (
                  <CheckCircle className="text-emerald-500 h-5 w-5 flex-shrink-0" />
                ) : (
                  <Circle className="text-muted-foreground h-5 w-5 flex-shrink-0" />
                )}
              </div>
              <div className="flex-grow min-w-0">
                <h3 className="text-sm mb-1 font-medium">{step.title}</h3>
                <p className="text-xs text-muted-foreground">{step.description}</p>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <Button 
                        variant={step.completed ? "outline" : "default"} 
                        size="sm" 
                        onClick={() => handleStepClick(step)}
                        disabled={!isStepAvailable(index) || step.completed}
                      >
                        {step.completed ? "Completed" : "Start"}
                      </Button>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    {step.completed 
                      ? "You've completed this step" 
                      : isStepAvailable(index)
                        ? "Click to start this step" 
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
    </Card >
  )
}