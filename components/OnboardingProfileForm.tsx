'use client'

import { User } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Database } from '@/types/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import { Loader2 } from 'lucide-react'
import { VerificationWaiting } from '@/components/VerificationWaiting'
import { Skeleton } from '@/components/ui/skeleton'

type Profile = Database['public']['Tables']['profiles']['Row']

interface OnboardingProfileFormProps {
  user: User
  profile: Profile | null
  onComplete: () => void
}

// Helper function to convert null to empty string
const nullToString = (value: string | null): string => value || ''

export default function OnboardingProfileForm({ user, profile: initialProfile, onComplete }: OnboardingProfileFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [showVerification, setShowVerification] = useState(false)
  const [loadingProfile, setLoadingProfile] = useState(!initialProfile)
  const [profile, setProfile] = useState<Profile>({
    id: initialProfile?.id || user.id,
    created_at: initialProfile?.created_at || new Date().toISOString(),
    updated_at: initialProfile?.updated_at || new Date().toISOString(),
    first_name: initialProfile?.first_name || '',
    last_name: initialProfile?.last_name || '',
    business_name: initialProfile?.business_name || '',
    business_description: initialProfile?.business_description || null,
    business_type: initialProfile?.business_type || null,
    business_url: initialProfile?.business_url || '',
    support_email: initialProfile?.support_email || user.email || '',
    support_phone: initialProfile?.support_phone || null,
    address_line1: initialProfile?.address_line1 || '',
    address_line2: initialProfile?.address_line2 || null,
    address_city: initialProfile?.address_city || '',
    address_state: initialProfile?.address_state || '',
    address_postal_code: initialProfile?.address_postal_code || null,
    address_country: initialProfile?.address_country || null,
    is_onboarded: initialProfile?.is_onboarded || false,
    logo_url: initialProfile?.logo_url || null,
    stripe_account_id: initialProfile?.stripe_account_id || '',
  })

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await fetch(`/api/profile/${user.id}`)
        if (!response.ok) {
          throw new Error('Failed to fetch profile')
        }
        const { data } = await response.json()
        setProfile(data)
        setLoadingProfile(false)
      } catch (error) {
        console.error('Error fetching profile:', error)
        setTimeout(fetchProfile, 3000) // Retry after 3 seconds
      }
    }

    if (loadingProfile) {
      fetchProfile()
    }
  }, [loadingProfile, user.id])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProfile({ ...profile, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setProfile(prevProfile => ({ ...prevProfile, is_onboarded: true }))

    try {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(profile),
      })

      if (!response.ok) {
        throw new Error('Failed to update profile')
      }

      toast({
        title: 'Profile updated',
        description: 'Your profile has been successfully updated.',
      })

      // Check Stripe verification status
      const statusResponse = await fetch('/api/stripe-status')
      const statusData = await statusResponse.json()

      if (statusData.isFullyOnboarded) {
        onComplete()
      } else {
        setShowVerification(true)
      }
    } catch (error) {
      console.error('Error updating profile:', error)
      toast({
        title: 'Error',
        description: 'Failed to update profile. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCheckStatus = async () => {
    try {
      const response = await fetch('/api/stripe-status')
      const data = await response.json()

      if (data.isFullyOnboarded) {
        onComplete()
      } else {
        toast({
          title: 'Account still under review',
          description: 'Your account is still being reviewed. This usually takes 1-2 business days.',
        })
      }
    } catch (error) {
      console.error('Error checking status:', error)
      toast({
        title: 'Error',
        description: 'Failed to check verification status. Please try again.',
        variant: 'destructive',
      })
    }
  }

  if (loadingProfile) {
    return <Skeleton />
  }

  if (showVerification) {
    return (
      <VerificationWaiting 
        onCheckStatus={handleCheckStatus}
        user={user}
        profile={profile}
      />
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="first_name">First Name</Label>
          <Input
            id="first_name"
            name="first_name"
            value={nullToString(profile.first_name)}
            onChange={handleChange}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="last_name">Last Name</Label>
          <Input
            id="last_name"
            name="last_name"
            value={nullToString(profile.last_name)}
            onChange={handleChange}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="business_name">Business Name</Label>
          <Input
            id="business_name"
            name="business_name"
            value={nullToString(profile.business_name)}
            onChange={handleChange}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="business_url">Business URL</Label>
          <Input
            id="business_url"
            name="business_url"
            value={nullToString(profile.business_url)}
            onChange={handleChange}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="support_email">Support Email</Label>
          <Input
            id="support_email"
            name="support_email"
            type="email"
            value={nullToString(profile.support_email)}
            onChange={handleChange}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="support_phone">Support Phone</Label>
          <Input
            id="support_phone"
            name="support_phone"
            type="tel"
            value={nullToString(profile.support_phone)}
            onChange={handleChange}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="address_line1">Street Address</Label>
        <Input
          id="address_line1"
          name="address_line1"
          value={nullToString(profile.address_line1)}
          onChange={handleChange}
          required
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="address_city">City</Label>
          <Input
            id="address_city"
            name="address_city"
            value={nullToString(profile.address_city)}
            onChange={handleChange}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="address_state">State</Label>
          <Input
            id="address_state"
            name="address_state"
            value={nullToString(profile.address_state)}
            onChange={handleChange}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="address_postal_code">ZIP Code</Label>
          <Input
            id="address_postal_code"
            name="address_postal_code"
            value={nullToString(profile.address_postal_code)}
            onChange={handleChange}
            required
          />
        </div>
      </div>

      <Button 
        type="submit" 
        className="w-full" 
        disabled={loading}
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Saving...
          </>
        ) : (
          'Save & Continue'
        )}
      </Button>
    </form>
  )
}
