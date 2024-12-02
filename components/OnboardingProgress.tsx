'use client'

import { User } from '@supabase/supabase-js'
import { createClient } from '@/utils/supabase/client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, ArrowRight, Check, BackpackIcon, MailIcon } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { VerificationWaiting } from "./VerificationWaiting"

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  timeEstimate: string;
  completed: boolean;
  href: string;
  requiredInfo: string[];
  status: 'completed' | 'not-started' | 'in-progress' | 'warning';
  button_text?: string;
}

export interface OnboardingProgressProps {
  user: User;
}

export default function OnboardingProgress({ user }: OnboardingProgressProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [loadingStep, setLoadingStep] = useState<string | null>(null)
  const [currentStepIndex, setCurrentStepIndex] = useState(1) // Start at step 2 (Stripe) since step 1 is complete
  const [steps, setSteps] = useState<OnboardingStep[]>([
    {
      id: 'create-account',
      title: 'Create Account',
      description: 'Create your account to get started',
      completed: true,
      href: '/login',
      timeEstimate: '1 min',
      requiredInfo: ['Email address', 'Password'],
      status: 'completed'
    },
    {
      id: 'connect-stripe',
      title: 'Connect Stripe',
      description: 'Connect your Stripe account to start accepting payments',
      completed: false,
      href: '#',
      timeEstimate: '5-10 min',
      requiredInfo: [
        'Basic business information',
        'Contact details (email and phone)',
        'Bank account for receiving payments',
        'Identity verification documents'
      ],
      status: 'not-started',
      button_text: 'Start Secure Connection to Stripe',
    },
    {
      id: 'create-plan',
      title: 'Create a Payment Plan',
      description: '🎉 Let\'s set up your first payment plan!',
      completed: false,
      href: '/new-plan',
      timeEstimate: '2 min',
      requiredInfo: [
        'Customer name',
        'Total amount due',
        'Payment frequency (monthly, yearly, etc.)'
      ],
      status: 'not-started',
      button_text: 'Create your First Payment Plan'
    }
  ])

  const checkProgress = async () => {
    try {
      const supabase = createClient()
      
      // Check if user has a Stripe account
      const { data: profile } = await supabase
        .from('profiles')
        .select('stripe_account_id, is_onboarded')
        .eq('id', user.id)
        .single()

      if (profile?.stripe_account_id) {
        setSteps((prevSteps: OnboardingStep[]) => {
          const newSteps = [...prevSteps]
          newSteps[1] = { ...newSteps[1], completed: true, status: 'completed' as const }
          if (profile.is_onboarded) {
            newSteps[2] = { ...newSteps[2], completed: true, status: 'completed' as const }
          }
          return newSteps
        })
        // Move to next incomplete step
        setCurrentStepIndex(profile.is_onboarded ? 2 : 1)
      }

      // Check if user has any payment plans
      const { data: plans } = await supabase
        .from('payment_plans')
        .select('id')
        .eq('user_id', user.id)
        .limit(1)

      if (plans && plans.length > 0) {
        setSteps((prevSteps: OnboardingStep[]) => {
          const newSteps = [...prevSteps]
          newSteps[2] = { ...newSteps[2], completed: true, status: 'completed' as const }
          return newSteps
        })
      }
    } catch (error) {
      console.error('Error checking progress:', error)
    }
  }

  const checkStripeStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/stripe-status');
      if (!response.ok) {
        throw new Error('Failed to fetch Stripe status');
      }

      const data = await response.json();
      console.log('Stripe Account Status (raw):', data);
      console.log('Current step index:', currentStepIndex);
      console.log('Current steps:', steps);

      setSteps(prevSteps => {
        const newSteps = [...prevSteps];
        const stripeStep = newSteps.find(s => s.id === 'connect-stripe');
        if (stripeStep) {
          console.log('Found stripe step:', stripeStep);
          
          if (data.isFullyOnboarded) {
            stripeStep.completed = true;
            stripeStep.status = 'completed';
            stripeStep.description = 'Your Stripe account is fully verified and ready to accept payments.';
            stripeStep.timeEstimate = 'Completed';
            stripeStep.requiredInfo = ['✓ All requirements completed'];
          } else if (data.accountId) {
            // Format requirements in a user-friendly way
            const formatRequirement = (req: string) => {
              return req
                .replace('business_profile.', '')
                .replace('tos_acceptance.', 'Terms of Service ')
                .replace('external_account', 'bank account')
                .split('_')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
            };

            if (data.requirements?.pastDue?.length > 0) {
              stripeStep.status = 'warning';
              const pastDueItems = data.requirements.pastDue
                .map(formatRequirement)
                .join(', ');
              stripeStep.description = `⚠️ Action Required: Please provide your ${pastDueItems}`;
              stripeStep.button_text = 'Complete Required Information';
              stripeStep.timeEstimate = '2-3 min';
              stripeStep.requiredInfo = data.requirements.pastDue.map(formatRequirement);
              console.log('Past due items:', pastDueItems);
            } else if (data.requirements?.currentlyDue?.length > 0) {
              stripeStep.status = 'in-progress';
              const currentlyDueItems = data.requirements.currentlyDue
                .map(formatRequirement)
                .join(', ');
              stripeStep.description = `To activate payments, please provide: ${currentlyDueItems}`;
              stripeStep.button_text = 'Continue Stripe Setup';
              stripeStep.timeEstimate = '3-5 min';
              stripeStep.requiredInfo = data.requirements.currentlyDue.map(formatRequirement);
              console.log('Currently due items:', currentlyDueItems);
            } else if (data.detailsSubmitted) {
              stripeStep.completed = true;
              stripeStep.status = 'in-progress';
              stripeStep.description = 'Your account is under review by Stripe. We\'ll email you when verification is complete.';
              stripeStep.button_text = 'Check Verification Status';
              stripeStep.timeEstimate = 'Under review (usually within 24 hours)';
              stripeStep.requiredInfo = ['✓ All information submitted', '⏳ Waiting for Stripe verification'];
            } else {
              stripeStep.status = 'not-started';
              stripeStep.description = 'Continue setting up your Stripe account to accept payments';
              stripeStep.button_text = 'Continue Stripe Setup';
            }
          }
          console.log('Updated stripe step:', stripeStep);
        }
        return newSteps;
      });

      // Only move to next step if fully onboarded
      if (data.isFullyOnboarded && currentStepIndex === 1) {
        console.log('Moving to next step - fully onboarded');
        setCurrentStepIndex(2);
      }
    } catch (error) {
      console.error('Error checking Stripe status:', error);
    }
  }, [currentStepIndex]);

  useEffect(() => {
    console.log('Checking Stripe status...');
    checkStripeStatus();
  }, [checkStripeStatus]);

  useEffect(() => {
    checkProgress()
  }, [])

  const markOnboardingComplete = async () => {
    try {
      // Update local state
      setSteps(prevSteps => {
        const newSteps = [...prevSteps];
        const planStep = newSteps.find(s => s.id === 'create-plan');
        if (planStep) {
          planStep.completed = true;
          planStep.status = 'completed';
        }
        return newSteps;
      });

      // Update Supabase
      const supabase = createClient();
      await supabase
        .from('profiles')
        .update({ 
          is_onboarded: true,
          onboarding_completed_at: new Date().toISOString()
        })
        .eq('id', user.id);

      // Update local storage
      localStorage.setItem('onboarding_complete', 'true');
      console.log('Successfully marked user as onboarded');
    } catch (error) {
      console.error('Error marking user as onboarded:', error);
      toast({
        title: 'Error',
        description: 'Failed to update onboarding status. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleStepClick = async (step: OnboardingStep) => {
    if (loadingStep) return;
    setLoadingStep(step.id);
    console.log('Starting step:', step.id);

    try {
      if (step.id === 'create-plan') {
        // Mark the step and onboarding as complete before redirecting
        await markOnboardingComplete();
        router.push(step.href);
        return;
      }

      if (step.id === 'connect-stripe') {
        // First check if we already have a Stripe account
        const statusResponse = await fetch('/api/stripe-status');
        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          if (statusData.accountId) {
            // If we have an account, create a new account link for continuing setup
            const linkRequestBody = {
              account: statusData.accountId,
              type: 'account_onboarding',
              refresh_url: window.location.origin + '/onboarding',
              return_url: window.location.origin + '/onboarding'
            };

            const linkResponse = await fetch('/api/account_link', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(linkRequestBody),
            });

            if (!linkResponse.ok) {
              throw new Error('Failed to create account link');
            }

            const linkData = await linkResponse.json();
            window.location.href = linkData.url;
            return;
          }
        }

        // If no existing account, create a new one
        console.log('Creating Stripe account...');
        // Create Stripe account
        const accountResponse = await fetch('/api/account', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          }
        });

        if (!accountResponse.ok) {
          const error = await accountResponse.json();
          console.error('Failed to create Stripe account:', error);
          throw new Error(error.error || 'Failed to create Stripe account');
        }

        const accountData = await accountResponse.json();
        console.log('Stripe account created:', accountData);

        if (!accountData.accountId) {
          console.error('No account ID in response:', accountData);
          throw new Error('Failed to get Stripe account ID');
        }

        console.log('Creating account link for account:', accountData.accountId);
        // Create account link
        const linkRequestBody = {
          account: accountData.accountId,
          type: 'account_onboarding',
          refresh_url: window.location.origin + '/onboarding',
          return_url: window.location.origin + '/onboarding'
        };
        console.log('Account link request body:', linkRequestBody);

        const linkResponse = await fetch('/api/account_link', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(linkRequestBody),
        });

        if (!linkResponse.ok) {
          const error = await linkResponse.json();
          console.error('Failed to create account link:', error);
          throw new Error(error.error || 'Failed to create account link');
        }

        const linkData = await linkResponse.json();
        console.log('Account link created:', linkData);

        console.log('Redirecting to Stripe onboarding:', linkData.url);
        window.location.href = linkData.url;
        return;
      }

      // Handle other steps
      console.log('Navigating to:', step.href);
      router.push(step.href);
    } catch (error) {
      console.error('Error handling step:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Something went wrong. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoadingStep(null);
    }
  };

  useEffect(() => {
    if (currentStepIndex === 2) {
      markOnboardingComplete();
    }
  }, [currentStepIndex]);

  const handleReset = async () => {
    try {
      setLoadingStep('connect-stripe');
      
      console.log('Disconnecting from Stripe...');
      const disconnectResponse = await fetch('/api/disconnect-stripe', { method: 'POST' });
      const disconnectData = await disconnectResponse.json();
      
      if (!disconnectResponse.ok) {
        throw new Error(disconnectData.error || 'Failed to disconnect');
      }
      
      console.log('Disconnect response:', disconnectData);

      // Reset the current step to the Stripe connection step
      setCurrentStepIndex(1);
      
      // Reset the steps state
      setSteps(prevSteps => {
        const newSteps = [...prevSteps];
        const stripeStep = newSteps.find(s => s.id === 'connect-stripe');
        if (stripeStep) {
          stripeStep.completed = false;
          stripeStep.status = 'not-started';
          stripeStep.description = 'Connect your Stripe account to start accepting payments';
          stripeStep.button_text = 'Start Secure Connection to Stripe';
        }
        return newSteps;
      });

      // Store a flag in sessionStorage to indicate we're resetting
      sessionStorage.setItem('stripe_reset', 'true');
      
      // Reload the page
      window.location.href = '/onboarding';
    } catch (error) {
      console.error('Error resetting Stripe connection:', error);
      alert('Error resetting connection: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setLoadingStep(null);
    }
  };

  // Check for reset flag on mount
  useEffect(() => {
    const resetFlag = sessionStorage.getItem('stripe_reset');
    if (resetFlag) {
      console.log('Found reset flag, resetting step...');
      sessionStorage.removeItem('stripe_reset');
      setCurrentStepIndex(1);
      checkStripeStatus();
    }
  }, []);

  const currentStep = steps[currentStepIndex]
  const progress = ((currentStepIndex / (steps.length - 1)) * 100)

  return (
    <div className="container max-w-3xl mx-auto px-5 py-12 font-sans">
      <div className="space-y-12">
        <div>
          <h1 className="text-2xl font-semibold">Welcome to PayKit</h1>
          <p className="text-muted-foreground">You're just a few minutes away from your first payment plan!</p>
        </div>

        {/* Progress bar and steps */}
        <div className="relative px-5">
          {/* Progress line */}
          <div className="absolute top-5 left-[80px] right-[80px]">
            <div className="h-[2px] bg-muted">
              <div 
                className="h-full bg-gray-300 dark:bg-foreground-600 dark:bg-emerald-500 transition-all duration-500 ease-in-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Step indicators */}
          <div className="relative flex justify-between">
            {steps.map((step, index) => {
              const isCompleted = index < currentStepIndex;
              const isCurrent = index === currentStepIndex;

              return (
                <div key={step.id} className="relative flex flex-col items-center">
                  <div 
                    className={cn(
                      "relative z-10 w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all duration-200",
                      isCompleted ? "border-emerald-600 dark:border-emerald-500 bg-emerald-600 dark:bg-emerald-500 text-white" :
                      isCurrent ? "border-blue-800 bg-blue-200 text-blue-800" : 
                      "border-gray-300 bg-gray-50 text-gray-500"
                    )}
                  >
                    {isCompleted ? (
                      <Check className={cn(
                        "h-5 w-5",
                        "text-white"
                      )} />
                    ) : (
                      <span className={cn(
                        "font-medium"
                      )}>{index + 1}</span>
                    )}
                  </div>

                  <div className="text-center mt-2">
                    <div className={cn(
                      "text-sm font-medium",
                      isCompleted ? "text-emerald-600 dark:text-emerald-500" :
                      isCurrent ? "text-blue-800" :
                      "text-gray-500"
                    )}>{step.title}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Current step card */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold">{currentStep.title}</h2>
                <p className="text-muted-foreground mt-1">{currentStep.description}</p>
              </div>

              {currentStep.requiredInfo && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Here's what you'll need:</h3>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {currentStep.requiredInfo.map((info, i) => (
                      <li key={i}>• {info}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              <div className="text-sm text-muted-foreground">
                Estimated time: {currentStep.timeEstimate}
              </div>

              {(currentStep.id === 'create-plan' || !currentStep.completed) && (
                <Button 
                  className="w-full"
                  size="lg"
                  disabled={loadingStep === currentStep.id}
                  onClick={() => handleStepClick(currentStep)}
                >
                  {loadingStep === currentStep.id ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {currentStep.id === 'connect-stripe' ? 'Connecting...' : 'Loading...'}
                    </>
                  ) : (
                    <>
                      {currentStep.button_text} <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* While you wait card - only show when waiting for verification */}
        {steps[1].status === 'in-progress' && steps[1].completed && (
          <VerificationWaiting onCheckStatus={checkStripeStatus} />
        )}

        {/* Reset button - only show when Stripe step is completed or in progress */}
        {(steps[1].completed || steps[1].status === 'in-progress') && (
          <div className="text-right">
            <button
              onClick={handleReset}
              disabled={loadingStep === 'connect-stripe'}
              className={cn(
                "px-3 py-1 text-sm border rounded-md transition-colors",
                loadingStep === 'connect-stripe'
                  ? "text-gray-400 border-gray-200 cursor-not-allowed"
                  : "text-gray-600 hover:text-gray-800 border-gray-300 hover:border-gray-400"
              )}
            >
              {loadingStep === 'connect-stripe' ? (
                <>
                  <Loader2 className="inline mr-2 h-3 w-3 animate-spin" />
                  Resetting...
                </>
              ) : (
                'Reset Stripe Connection'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}