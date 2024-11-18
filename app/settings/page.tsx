"use client"

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import ProfileSettings from './components/ProfileSettings'
import StripeSettings from './components/StripeSettings'
import EmailSettings from './components/EmailSettings'
import { Button } from '@/components/ui/button'
import { User } from '@supabase/supabase-js'
import { Database } from '@/types/supabase'
import DangerZone from './components/DangerZone'

type Profile = Database['public']['Tables']['profiles']['Row']
type StripeAccount = Database['public']['Tables']['stripe_accounts']['Row']

export default function SettingsPage() {
  const searchParams = useSearchParams()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userData, setUserData] = useState<User | null>(null)
  const [profileData, setProfileData] = useState<Profile | null>(null)
  const [stripeAccount, setStripeAccount] = useState<StripeAccount | null>(null)
  
  useEffect(() => {
    console.log('Settings page mounted');
    console.log('Current URL:', window.location.href);
    console.log('Current hash:', window.location.hash);
    
    // Wait for the page to fully render
    const timer = setTimeout(() => {
      const section = window.location.hash.slice(1);
      if (section) {
        console.log('Attempting to scroll to section:', section);
        const element = document.getElementById(section);
        console.log('Found element:', element);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      }
    }, 500); // Give the page time to render

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    async function loadData() {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError) throw userError
        if (!user) throw new Error('No user found')
        
        console.log('User data:', user);  // Add this
  
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()
        if (profileError) throw profileError
        
        console.log('Profile data:', profile);  // Add this
  
        const { data: stripeAcc, error: stripeError } = await supabase
          .from('stripe_accounts')
          .select('*')
          .eq('user_id', user.id)
          .single()
        if (stripeError && stripeError.code !== 'PGRST116') throw stripeError
        
        console.log('Stripe account data:', stripeAcc);  // Add this
  
        setUserData(user)
        setProfileData(profile)
        setStripeAccount(stripeAcc)
      } catch (err: any) {
        console.error('Error loading data:', err);  // Add this
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
  
    loadData()
  }, [supabase])

  useEffect(() => {
    const section = searchParams.get('section')
    if (section) {
      const element = document.getElementById(section)
      element?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [searchParams])

  if (loading) return <div>Loading...</div>
  if (!userData || !profileData) return <div>No user data found</div>

  return (
    <div className="container mx-auto p-10 pb-16 flex gap-10">
      {/* Navigation section remains the same */}
      <div className="w-64 flex-shrink-0">
        <div className="sticky top-10 space-y-2">
          <h2 className="text-xl font-semibold mb-4">Settings</h2>
          <nav className="flex flex-col space-y-1">
            <Button 
              variant="ghost" 
              className="justify-start"
              onClick={() => document.getElementById('profile')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Profile
            </Button>
            <Button 
              variant="ghost"
              className="justify-start"
              onClick={() => document.getElementById('payments')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Payments
            </Button>
            <Button 
              variant="ghost"
              className="justify-start"
              onClick={() => document.getElementById('notifications')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Email
            </Button>
            <Button 
              variant="ghost"
              className="justify-start"
              onClick={() => document.getElementById('danger-zone')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Account
            </Button> 
          </nav>
        </div>
      </div>

      {/* Settings section with proper typing */}
      <div className="flex-grow space-y-10">
        <section id="profile" className="space-y-4">
          <h3 className="text-lg font-semibold">Profile Settings</h3>
          <ProfileSettings user={userData} profile={profileData} />
        </section>

        <section id="payments" className="space-y-4">
          <h3 className="text-lg font-semibold">Payment Settings</h3>
          <StripeSettings 
            stripeAccount={stripeAccount}
            profile={profileData}
            user={userData}
            error={error}
          />
        </section>

        <section id="notifications" className="space-y-4">
          <h3 className="text-lg font-semibold">Email Settings</h3>
          <EmailSettings user={userData} />
        </section>
        
        <section id="danger-zone" className="space-y-4">
          <h3 className="text-lg font-semibold">Danger Zone</h3>
          <DangerZone user={userData} />
        </section>
      </div>
    </div>
  )
}