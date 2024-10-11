import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export default async function ProfilePage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()

  // Extra auth check, if desired
  if (!user) {
    redirect('/sign-in')
  }

  // Fetch profile data for the authenticated user
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (error) {
    console.error('Error fetching profile:', error)
    return <div>Error loading profile data</div>
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">User Profile</h1>
      {profile ? (
        <div>
          <p><strong>First Name:</strong> {profile.first_name}</p>
          <p><strong>Last Name:</strong> {profile.last_name}</p>
          <p><strong>Onboarded:</strong> {profile.is_onboarded ? 'Yes' : 'No'}</p>
          <p><strong>Created At:</strong> {new Date(profile.created_at).toLocaleString()}</p>
          <p><strong>Last Updated:</strong> {new Date(profile.updated_at).toLocaleString()}</p>
        </div>
      ) : (
        <p>No profile data found.</p>
      )}
    </div>
  )
}