'use client'

import { User } from '@supabase/supabase-js'
import { createClient } from '@/utils/supabase/client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowRight, Check, Loader2 } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { Database } from '@/types/supabase'
import { cn } from '@/lib/utils'
import OnboardingProfileForm from '@/components/OnboardingProfileForm'

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

type Profile = Database['public']['Tables']['profiles']['Row'];

interface StripeStatusResponse {
  isFullyOnboarded?: boolean;
  accountId?: string;
  detailsSubmitted?: boolean;
  requirements?: {
    pastDue?: string[];
    currentlyDue?: string[];
  };
}

export default function OnboardingProgress({ user }: OnboardingProgressProps) {
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()
  const [loadingStep, setLoadingStep] = useState<string | null>(null)
  const [currentStepIndex, setCurrentStepIndex] = useState(1)
  const [profile, setProfile] = useState<Profile | null>(null)
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
      id: 'confirm-profile',
      title: 'Confirm Business Profile',
      description: 'Review and confirm your business information',
      completed: false,
      href: '#',
      timeEstimate: '2 min',
      requiredInfo: [
        'Business name and URL',
        'Support contact information',
        'Business address'
      ],
      status: 'not-started',
      button_text: 'Review Business Profile',
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
      // Check if user has a Stripe account
      const response = await fetch(`/api/profile/${user.id}`);

      if (!response.ok) {
        throw new Error('Failed to fetch profile');
      }

      const { data } = await response.json();
      const profile = data;

      if (profile?.stripe_account_id) {
        setSteps((prevSteps: OnboardingStep[]) => {
          const newSteps = [...prevSteps]
          newSteps[1] = { ...newSteps[1], completed: true, status: 'completed' as const }
          if (profile.is_onboarded) {
            newSteps[2] = { ...newSteps[2], completed: true, status: 'completed' as const }
            newSteps[3] = { ...newSteps[3], completed: true, status: 'completed' as const }
          }
          return newSteps
        })
        // Move to next incomplete step
        setCurrentStepIndex(profile.is_onboarded ? 3 : 1)
      }

      // Check if user has any payment plans
      const { data: plans, error: plansError } = await supabase
        .from('payment_plans')
        .select('id')
        .filter('user_id', 'eq', user.id)
        .limit(1)
        .maybeSingle()

      if (plansError) {
        console.error('Error fetching payment plans:', plansError)
        return
      }

      if (plans) {
        setSteps((prevSteps: OnboardingStep[]) => {
          const newSteps = [...prevSteps]
          newSteps[3] = { ...newSteps[3], completed: true, status: 'completed' as const }
          return newSteps
        })
      }
    } catch (error) {
      console.error('Error checking progress:', error)
    }
  }

  const checkStripeStatus = useCallback(async () => {
    console.log('[checkStripeStatus] Starting check...');
    try {
      const response = await fetch('/api/stripe-status');
      if (!response.ok) {
        throw new Error('Failed to fetch Stripe status');
      }

      // Log the raw response
      const responseText = await response.text();
      console.log('[checkStripeStatus] Raw response:', responseText);
      
      // Try to parse as JSON
      let stripeStatus: StripeStatusResponse;
      try {
        stripeStatus = JSON.parse(responseText);
      } catch (e) {
        console.error('[checkStripeStatus] Failed to parse response as JSON:', e);
        throw new Error('Invalid JSON response from server');
      }

      console.log('[checkStripeStatus] Status:', {
        accountId: stripeStatus.accountId,
        isFullyOnboarded: stripeStatus.isFullyOnboarded,
        detailsSubmitted: stripeStatus.detailsSubmitted,
        requirements: stripeStatus.requirements
      });

      // Only update the step if we have an accountId or the account is fully onboarded
      if (stripeStatus.accountId || stripeStatus.isFullyOnboarded) {
        console.log('[checkStripeStatus] Updating steps due to existing account');
        setSteps(prevSteps => {
          const newSteps = [...prevSteps];
          const stripeStep = newSteps.find(s => s.id === 'connect-stripe');
          if (stripeStep) {
            const oldStatus = { ...stripeStep };
            console.log('[checkStripeStatus] Current stripe step:', oldStatus);
            
            if (stripeStatus.isFullyOnboarded) {
              stripeStep.completed = true;
              stripeStep.status = 'completed';
              stripeStep.description = 'Your Stripe account is fully verified and ready to accept payments.';
              stripeStep.timeEstimate = 'Completed';
              stripeStep.requiredInfo = ['✓ All requirements completed'];
            } else if (stripeStatus.accountId && stripeStatus.requirements) {
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

              const { pastDue = [], currentlyDue = [] } = stripeStatus.requirements;

              if (pastDue.length > 0) {
                stripeStep.status = 'warning';
                const pastDueItems = pastDue
                  .map(formatRequirement)
                  .join(', ');
                stripeStep.description = `⚠️ Action Required: Please provide your ${pastDueItems}`;
                stripeStep.button_text = 'Complete Required Information';
                stripeStep.timeEstimate = '2-3 min';
                stripeStep.requiredInfo = pastDue.map(formatRequirement);
                console.log('Past due items:', pastDueItems);
              } else if (currentlyDue.length > 0) {
                stripeStep.status = 'in-progress';
                const currentlyDueItems = currentlyDue
                  .map(formatRequirement)
                  .join(', ');
                stripeStep.description = `To activate payments, please provide: ${currentlyDueItems}`;
                stripeStep.button_text = 'Continue Stripe Setup';
                stripeStep.timeEstimate = '3-5 min';
                stripeStep.requiredInfo = currentlyDue.map(formatRequirement);
                console.log('Currently due items:', currentlyDueItems);
              } else if (stripeStatus.detailsSubmitted) {
                stripeStep.completed = true;
                stripeStep.status = 'in-progress';
                stripeStep.description = 'Your account is under review by Stripe. We\'ll email you when verification is complete.';
                stripeStep.button_text = 'Check Verification Status';
                stripeStep.timeEstimate = 'Under review (usually within 24 hours)';
                stripeStep.requiredInfo = ['✓ All information submitted', '⏳ Waiting for Stripe verification'];
              }
            }
            console.log('[checkStripeStatus] Updated stripe step:', stripeStep);
          }
          return newSteps;
        });
      }
    } catch (error) {
      console.error('[checkStripeStatus] Error checking Stripe status:', error);
    }
  }, [currentStepIndex]);

  useEffect(() => {
    console.log('[checkStripeStatus] Checking Stripe status...');
    checkStripeStatus();
  }, [checkStripeStatus]);

  useEffect(() => {
    const fetchProfile = async () => {
      console.log('Fetching profile for user:', user.id);
      try {
        const response = await fetch(`/api/profile/${user.id}`);

        if (!response.ok) {
          throw new Error('Failed to fetch profile');
        }

        const { data } = await response.json();
        console.log('Fetched profile:', data);
        setProfile(data);
        
        // Move checkProgress here so it uses the latest profile data
        if (data) {
          await checkProgress();
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
        toast({
          title: 'Error',
          description: 'Failed to fetch profile. Please try refreshing the page.',
          variant: 'destructive'
        });
      }
    };

    fetchProfile();
  }, [user.id]);

  const markOnboardingComplete = async () => {
    try {
      const response = await fetch(`/api/profile/${user.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          is_onboarded: true,
          onboarding_completed_at: new Date().toISOString()
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update profile');
      }

      // Re-fetch profile to get latest state
      const profileResponse = await fetch(`/api/profile/${user.id}`);
      if (!profileResponse.ok) {
        throw new Error('Failed to fetch updated profile');
      }
      
      const { data: updatedProfile } = await profileResponse.json();
      setProfile(updatedProfile);

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

      // Update local storage
      localStorage.setItem('onboarding_complete', 'true');
      console.log('Successfully marked user as onboarded');
      
      // Force a progress check with the new profile data
      await checkProgress();
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
      } else if (step.id === 'confirm-profile') {
        // Profile step is handled by the form component
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
    if (currentStepIndex === 3) {
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
      console.log('[Reset Effect] Found reset flag, resetting step...');
      sessionStorage.removeItem('stripe_reset');
      
      // Reset the current step and its status
      setSteps(prevSteps => {
        const newSteps = [...prevSteps];
        const stripeStep = newSteps.find(s => s.id === 'connect-stripe');
        if (stripeStep) {
          stripeStep.completed = false;
          stripeStep.status = 'not-started';
          stripeStep.button_text = 'Start Secure Connection to Stripe';
        }
        return newSteps;
      });
      
      setCurrentStepIndex(1);
      console.log('[Reset Effect] Current step index set to:', 1);
      
      // Delay the Stripe status check to ensure our reset takes effect
      setTimeout(() => {
        checkStripeStatus();
      }, 1000);
    }
  }, []);

  const currentStep = steps[currentStepIndex]
  console.log('[Render] Current step:', { 
    id: currentStep?.id, 
    completed: currentStep?.completed, 
    button_text: currentStep?.button_text 
  });
  console.log('[Render] Current step index:', currentStepIndex);

  const progress = ((currentStepIndex / (steps.length - 1)) * 100)

  const checkOnboardingStatus = useCallback(async () => {
    const { data: profileData, error }: { data: Profile | null, error: any } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (error) {
      console.error('Error fetching profile:', error)
      return
    }

    if (profileData) {
      setProfile(profileData)

      // Update steps based on profile data
      setSteps(prevSteps => {
        const newSteps = [...prevSteps]
        
        // Update Connect Stripe step
        const stripeStep = newSteps.find(step => step.id === 'connect-stripe')
        if (stripeStep && profileData.stripe_account_id) {
          stripeStep.status = 'completed'
          stripeStep.completed = true
        }

        // Update Business Info step
        const businessStep = newSteps.find(step => step.id === 'business-info')
        if (businessStep && profileData.business_name && profileData.business_description) {
          businessStep.status = 'completed'
          businessStep.completed = true
        }

        // Update Support Info step
        const supportStep = newSteps.find(step => step.id === 'support-info')
        if (supportStep && profileData.support_email && profileData.support_phone) {
          supportStep.status = 'completed'
          supportStep.completed = true
        }

        return newSteps
      })
    }
  }, [user.id, supabase])

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
          <div className="absolute top-5 inset-x-10">
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

              {currentStep.id === 'confirm-profile' ? (
                <div className="mt-6">
                  <OnboardingProfileForm
                    user={user}
                    profile={profile}
                    onComplete={() => {
                      setSteps(prevSteps => {
                        const newSteps = [...prevSteps];
                        const profileStep = newSteps.find(s => s.id === 'confirm-profile');
                        if (profileStep) {
                          profileStep.completed = true;
                          profileStep.status = 'completed';
                        }
                        return newSteps;
                      });
                      setCurrentStepIndex(3);
                    }}
                  />
                </div>
              ) : (
                <>
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
                    <>
                      {console.log('[Button Render] Condition check:', {
                        stepId: currentStep.id,
                        completed: currentStep.completed,
                        shouldShow: currentStep.id === 'create-plan' || !currentStep.completed
                      })}
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
                    </>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* While you wait card - only show when waiting for verification */}
        {steps[1].status === 'in-progress' && steps[1].completed && (
          <VerificationWaiting 
            onCheckStatus={checkStripeStatus} 
            user={user}
            profile={profile}
          />
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

interface VerificationWaitingProps {
  onCheckStatus: () => void;
  user: User;
  profile: Profile | null;
}

const VerificationWaiting = ({ onCheckStatus, user, profile }: VerificationWaitingProps): JSX.Element => {
  return (
    <Card className="mt-4">
      <CardContent className="pt-6">
        <h3 className="text-lg font-medium">While you wait...</h3>
        <p className="text-sm text-muted-foreground mt-2">
          We'll email you when your account is verified. In the meantime, you can:
        </p>
        <ul className="list-disc list-inside text-sm text-muted-foreground mt-2">
          <li>Complete your profile information</li>
          <li>Explore our documentation</li>
          <li>Set up your development environment</li>
        </ul>
        <Button
          variant="outline"
          className="mt-4"
          onClick={onCheckStatus}
        >
          Check Verification Status
        </Button>
      </CardContent>
    </Card>
  );
}