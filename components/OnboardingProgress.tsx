'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { User } from '@supabase/supabase-js'
import { OnboardingStep, VerificationStatus } from '@/types/onboarding'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, CheckCircle, AlertCircle, Circle, ArrowRight, Clock, FileText } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { format } from 'date-fns'
import { useRouter } from 'next/navigation'

export interface OnboardingProgressProps {
  user: User
}

export default function OnboardingProgress({ user }: OnboardingProgressProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [loadingStep, setLoadingStep] = useState<string | null>(null)
  const [steps, setSteps] = useState<OnboardingStep[]>([
    {
      id: 'confirm-account',
      title: 'Confirm Your Account',
      description: 'Quick email verification (1-2 minutes)',
      completed: true,
      href: '#',
      timeEstimate: '2 min',
      requiredInfo: ['Email address'],
      status: 'completed'
    },
    {
      id: 'connect-stripe',
      title: 'Connect Stripe Account',
      description: 'Set up payment processing (5-10 minutes)',
      completed: false,
      href: '#',
      timeEstimate: '10 min',
      requiredInfo: [
        'Business name',
        'Business address',
        'Tax ID or SSN',
        'Bank account details'
      ],
      status: 'not_started'
    },
    {
      id: 'verify-stripe',
      title: 'Verify Stripe Account',
      description: 'Verification process (5-7 business days)',
      completed: false,
      href: '#',
      timeEstimate: '5-7 days',
      verificationChecklist: [
        'Business documentation',
        'Identity verification',
        'Bank account verification'
      ],
      status: 'not_started'
    },
    {
      id: 'create-plan',
      title: 'Create Your First Plan',
      description: 'Set up a payment plan for your customers',
      completed: false,
      href: '/payment-plans/new',
      timeEstimate: '5 min',
      requiredInfo: ['Plan details', 'Payment terms'],
      status: 'not_started'
    }
  ])
  
  const [connecting, setConnecting] = useState(false)
  const [stripeAccount, setStripeAccount] = useState<any>(null)
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus | null>(null)

  useEffect(() => {
    checkProgress()
    const interval = setInterval(checkVerificationStatus, 3600000) // Check every hour
    return () => clearInterval(interval)
  }, [])

  const checkVerificationStatus = async () => {
    try {
      const response = await fetch('/api/stripe-status')
      const data = await response.json()
      
      if (data.stripeAccount) {
        setStripeAccount(data.stripeAccount)
        
        if (data.verificationStatus) {
          setVerificationStatus(data.verificationStatus)
          
          // Show notification if action is required
          if (data.verificationStatus.actionItems.length > 0) {
            const highPriorityItems = data.verificationStatus.actionItems
              .filter(item => item.priority === 'high')
            
            if (highPriorityItems.length > 0) {
              toast({
                title: "Action Required",
                description: highPriorityItems[0].description,
                action: {
                  label: "Take Action",
                  onClick: highPriorityItems[0].action
                }
              })
            }
          }
        }
      }
    } catch (error) {
      console.error('Error checking verification status:', error)
    }
  }

  const handleStripeConnect = async () => {
    setConnecting(true)
    setLoadingStep('connect-stripe')
    
    try {
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
      
      if (accountData.error) {
        throw new Error(accountData.error)
      }

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
      
      if (linkData.error) {
        throw new Error(linkData.error)
      }

      window.location.href = linkData.url
    } catch (error: any) {
      console.error('Error in handleStripeConnect:', error)
      toast({
        title: "Connection Failed",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setConnecting(false)
      setLoadingStep(null)
    }
  }

  const handleStepClick = (step: OnboardingStep) => {
    if (step.id === 'connect-stripe' && stripeAccount) {
      return // Disable click when completed
    }
    
    if (!step.completed && isStepAvailable(steps.indexOf(step))) {
      if (step.id === 'verify-stripe') {
        if (stripeAccount?.stripe_account_id) {
          window.open(`https://dashboard.stripe.com/connect/accounts/${stripeAccount.stripe_account_id}`, '_blank')
        } else {
          console.error('No Stripe account ID available')
          toast({
            title: "Error",
            description: "Unable to access Stripe dashboard. Please try again later.",
            variant: "destructive",
          })
        }
      } else if (step.id === 'connect-stripe') {
        handleStripeConnect()
      } else if (step.href) {
        router.push(step.href)
      }
    }
  }

  const renderVerificationStatus = () => {
    if (!verificationStatus) return null

    return (
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Verification Status</CardTitle>
          <CardDescription>
            Estimated completion: {verificationStatus.estimatedCompletionDate 
              ? format(new Date(verificationStatus.estimatedCompletionDate), 'MMMM d, yyyy')
              : 'Calculating...'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Progress value={verificationStatus.overallProgress} className="mb-4" />
          
          {verificationStatus.remainingSteps.length > 0 && (
            <div className="space-y-4">
              <h4 className="font-medium">Remaining Steps:</h4>
              {verificationStatus.remainingSteps.map((step, index) => (
                <div key={index} className="flex items-center gap-2">
                  {step.status === 'completed' ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : step.status === 'in_progress' ? (
                    <Clock className="h-5 w-5 text-blue-500" />
                  ) : (
                    <Circle className="h-5 w-5 text-gray-400" />
                  )}
                  <span>{step.name}</span>
                </div>
              ))}
            </div>
          )}

          {verificationStatus.requiredDocuments.length > 0 && (
            <div className="mt-4">
              <h4 className="font-medium mb-2">Required Documents:</h4>
              {verificationStatus.requiredDocuments.map((doc, index) => (
                <div key={index} className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4" />
                  <span>{doc.description}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  const renderStep = (step: OnboardingStep, index: number) => {
    const isAvailable = isStepAvailable(index)
    const stepStatus = getStepStatus(step.id)
    
    return (
      <Card 
        key={step.id}
        className={`mb-4 ${!isAvailable ? 'opacity-50' : ''}`}
        onClick={() => isAvailable && handleStepClick(step)}
      >
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getStepIcon(stepStatus)}
              <CardTitle>{step.title}</CardTitle>
            </div>
            <div className="flex items-center text-sm text-muted-foreground">
              <Clock className="h-4 w-4 mr-1" />
              {step.timeEstimate}
            </div>
          </div>
          <CardDescription>{step.description}</CardDescription>
        </CardHeader>
        <CardContent>
          {step.requiredInfo && (
            <div className="text-sm">
              <h4 className="font-medium mb-2">Required Information:</h4>
              <ul className="list-disc list-inside space-y-1">
                {step.requiredInfo.map((info, i) => (
                  <li key={i}>{info}</li>
                ))}
              </ul>
            </div>
          )}
          
          {step.verificationChecklist && (
            <div className="text-sm mt-4">
              <h4 className="font-medium mb-2">Verification Checklist:</h4>
              <ul className="list-disc list-inside space-y-1">
                {step.verificationChecklist.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          )}
          
          {isAvailable && !step.completed && (
            <Button 
              className="mt-4"
              disabled={connecting || loadingStep === step.id}
              onClick={() => handleStepClick(step)}
            >
              {loadingStep === step.id ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  {getStepButton(step)}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6">
        {steps.map((step, index) => renderStep(step, index))}
      </div>
      {renderVerificationStatus()}
    </div>
  )
}