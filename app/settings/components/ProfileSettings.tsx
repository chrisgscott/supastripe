import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { createClient } from '@/utils/supabase/client';

export default function ProfileSettings() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [profile, setProfile] = useState({
    first_name: '',
    last_name: '',
    business_name: '',
    business_type: '',
    business_description: '',
    support_email: '',
    support_phone: '',
    business_url: '',
    address_line1: '',
    address_line2: '',
    address_city: '',
    address_state: '',
    address_postal_code: '',
    address_country: '',
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    const supabase = createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) {
      console.error('Error fetching user:', userError);
      setError('Failed to fetch user information');
      return;
    }

    if (user) {
      setEmail(user.email || '');
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
        setError('Failed to fetch profile information');
      } else if (profileData) {
        setProfile(profileData);
      }
    }
  };

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
      .eq('id', (await supabase.auth.getUser()).data.user?.id);

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
        // Redirect to home page or login page after successful deletion
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
                  value={profile.first_name}
                  onChange={handleInputChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Last Name</Label>
                <Input
                  id="last_name"
                  name="last_name"
                  value={profile.last_name}
                  onChange={handleInputChange}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="business_name">Business Name</Label>
              <Input
                id="business_name"
                name="business_name"
                value={profile.business_name}
                onChange={handleInputChange}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="business_type">Business Type</Label>
                <Input
                  id="business_type"
                  name="business_type"
                  value={profile.business_type}
                  onChange={handleInputChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="business_url">Website URL</Label>
                <Input
                  id="business_url"
                  name="business_url"
                  type="url"
                  value={profile.business_url}
                  onChange={handleInputChange}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="business_description">Business Description</Label>
              <Input
                id="business_description"
                name="business_description"
                value={profile.business_description}
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
                  value={profile.support_email}
                  onChange={handleInputChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="support_phone">Support Phone</Label>
                <Input
                  id="support_phone"
                  name="support_phone"
                  type="tel"
                  value={profile.support_phone}
                  onChange={handleInputChange}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address_line1">Address Line 1</Label>
              <Input
                id="address_line1"
                name="address_line1"
                value={profile.address_line1}
                onChange={handleInputChange}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address_line2">Address Line 2</Label>
              <Input
                id="address_line2"
                name="address_line2"
                value={profile.address_line2}
                onChange={handleInputChange}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="address_city">City</Label>
                <Input
                  id="address_city"
                  name="address_city"
                  value={profile.address_city}
                  onChange={handleInputChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address_state">State</Label>
                <Input
                  id="address_state"
                  name="address_state"
                  value={profile.address_state}
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
                  value={profile.address_postal_code}
                  onChange={handleInputChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address_country">Country</Label>
                <Input
                  id="address_country"
                  name="address_country"
                  value={profile.address_country}
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

      <Card>
        <CardHeader>
          <CardTitle>Danger Zone</CardTitle>
          <CardDescription>Permanently delete your PayKit account</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-gray-600">
            <p>Deleting your PayKit account will:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Remove all your personal and business information from our system</li>
              <li>Disconnect your Stripe Connect account from our platform</li>
              <li>Cancel any ongoing payment plans (customers will not be charged further)</li>
              <li>Make it impossible to recover your account or data</li>
            </ul>
            <p className="mt-2">
              Note: This action will not delete your Stripe account. You'll still be able to access it directly through Stripe.
            </p>
          </div>
          {!showDeleteConfirmation ? (
            <Button variant="destructive" onClick={handleDeleteAccount}>Delete PayKit Account</Button>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-red-600">Are you absolutely sure you want to delete your account?</p>
              <div className="flex space-x-2">
                <Button variant="outline" onClick={() => setShowDeleteConfirmation(false)}>Cancel</Button>
                <Button variant="destructive" onClick={handleDeleteAccount}>Yes, Delete My Account</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
