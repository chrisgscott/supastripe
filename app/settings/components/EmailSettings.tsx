import { User } from '@supabase/supabase-js';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface EmailSettingsProps {
  user: User;  // Supabase user object passed from parent
}

export default function EmailSettings({ user }: EmailSettingsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Notification Preferences</CardTitle>
        <CardDescription>Choose what emails you want to receive</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center space-x-2">
          <Switch id="cc-emails" />
          <Label htmlFor="cc-emails">CC me on all client emails</Label>
        </div>
      </CardContent>
    </Card>
  );
}