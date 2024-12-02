import { Card } from "@/components/ui/card"
import { ClipboardPenLineIcon } from 'lucide-react'
import ProfileSettings from "@/app/settings/components/ProfileSettings"
import { User } from "@supabase/supabase-js"
import { Database } from "@/types/supabase"

type Profile = Database['public']['Tables']['profiles']['Row']

interface OnboardingProfileReviewProps {
  user: User
  profile: Profile
}

export function OnboardingProfileReview({ user, profile }: OnboardingProfileReviewProps) {
  return (
    <Card className="p-6">
      <h3 className="font-semibold mb-4 flex items-center">
        <ClipboardPenLineIcon className="h-5 w-5 mr-2" />
        Review Your Profile
      </h3>
      <p className="text-sm text-muted-foreground mb-6">
        We&apos;ve imported your information from Stripe. Please review and update any details if needed.
      </p>
      <ProfileSettings user={user} profile={profile} />
    </Card>
  )
}
