import { ProfileSettingsProps } from './types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { createClient } from '@/utils/supabase/client';
import { useState } from 'react';
import { Database } from '@/types/supabase';

type Profile = Database['public']['Tables']['profiles']['Row'];

const nullToEmpty = (value: string | null): string => value || '';

export default function ProfileSettings({ user, profile: initialProfile }: ProfileSettingsProps) {
  const [email, setEmail] = useState(user.email || '');
  const [password, setPassword] = useState('');
  const [profile, setProfile] = useState<Profile>(initialProfile);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);

  const handleUpdateCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setError('');

    try {
      const response = await fetch('/api/update-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: password || undefined }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(data.message);
        setPassword('');
      } else {
        setError(data.error || 'An error occurred while updating credentials');
      }
    } catch (error) {
      setError('An unexpected error occurred');
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setError('');

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from('profiles')
      .update(profile)
      .eq('id', user.id);

    if (updateError) {
      console.error('Error updating profile:', updateError);
      setError('Failed to update profile');
    } else {
      setMessage('Profile updated successfully');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setProfile(prev => ({ ...prev, [name]: value }));
  };

  const handleDeleteAccount = async () => {
    if (!showDeleteConfirmation) {
      setShowDeleteConfirmation(true);
      return;
    }

    try {
      const response = await fetch('/api/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (response.ok) {
        window.location.href = '/';
      } else {
        setError(data.error || 'An error occurred while deleting your account');
      }
    } catch (error) {
      setError('An unexpected error occurred');
    }
  };

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Account Credentials</CardTitle>
          <CardDescription>Update your email and password</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdateCredentials} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit">Update Credentials</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>Update your business profile</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdateProfile} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">First Name</Label>
                <Input
                  id="first_name"
                  name="first_name"
                  value={nullToEmpty(profile.first_name)}
                  onChange={handleInputChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Last Name</Label>
                <Input
                  id="last_name"
                  name="last_name"
                  value={nullToEmpty(profile.last_name)}
                  onChange={handleInputChange}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="business_name">Business Name</Label>
              <Input
                id="business_name"
                name="business_name"
                value={nullToEmpty(profile.business_name)}
                onChange={handleInputChange}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="business_type">Business Type</Label>
                <Input
                  id="business_type"
                  name="business_type"
                  value={nullToEmpty(profile.business_type)}
                  onChange={handleInputChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="business_url">Website URL</Label>
                <Input
                  id="business_url"
                  name="business_url"
                  type="url"
                  value={nullToEmpty(profile.business_url)}
                  onChange={handleInputChange}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="business_description">Business Description</Label>
              <Input
                id="business_description"
                name="business_description"
                value={nullToEmpty(profile.business_description)}
                onChange={handleInputChange}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="support_email">Support Email</Label>
                <Input
                  id="support_email"
                  name="support_email"
                  type="email"
                  value={nullToEmpty(profile.support_email)}
                  onChange={handleInputChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="support_phone">Support Phone</Label>
                <Input
                  id="support_phone"
                  name="support_phone"
                  type="tel"
                  value={nullToEmpty(profile.support_phone)}
                  onChange={handleInputChange}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address_line1">Address Line 1</Label>
              <Input
                id="address_line1"
                name="address_line1"
                value={nullToEmpty(profile.address_line1)}
                onChange={handleInputChange}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address_line2">Address Line 2</Label>
              <Input
                id="address_line2"
                name="address_line2"
                value={nullToEmpty(profile.address_line2)}
                onChange={handleInputChange}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="address_city">City</Label>
                <Input
                  id="address_city"
                  name="address_city"
                  value={nullToEmpty(profile.address_city)}
                  onChange={handleInputChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address_state">State</Label>
                <Input
                  id="address_state"
                  name="address_state"
                  value={nullToEmpty(profile.address_state)}
                  onChange={handleInputChange}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="address_postal_code">Postal Code</Label>
                <Input
                  id="address_postal_code"
                  name="address_postal_code"
                  value={nullToEmpty(profile.address_postal_code)}
                  onChange={handleInputChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address_country">Country</Label>
                <Input
                  id="address_country"
                  name="address_country"
                  value={nullToEmpty(profile.address_country)}
                  onChange={handleInputChange}
                />
              </div>
            </div>
            <Button type="submit">Save Profile</Button>
          </form>
        </CardContent>
      </Card>

      {message && <Alert className="mt-4"><AlertDescription>{message}</AlertDescription></Alert>}
      {error && <Alert variant="destructive" className="mt-4"><AlertDescription>{error}</AlertDescription></Alert>}
    </div>
  );
}