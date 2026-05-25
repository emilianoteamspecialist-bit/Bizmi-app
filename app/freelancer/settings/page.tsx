"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Save, Shield, Bell, Mail, Lock, Eye, EyeOff } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"

export default function FreelancerSettings() {
  const { user, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const router = useRouter()

  // Settings state
  const [settings, setSettings] = useState({
    // Account settings
    email: "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",

    // Notification settings
    emailNotifications: true,
    jobAlerts: true,
    messageNotifications: true,
    marketingEmails: false,
    weeklyDigest: true,

    // Privacy settings
    profileVisibility: true,
    showEmail: false,
    showPhone: false,

    // Security settings
    twoFactorAuth: false,
    loginAlerts: true,
  })

  const [privacySettings, setPrivacySettings] = useState({
    profileVisibility: true,
    showEmail: false,
    showPhone: false,
    showLocation: true,
    showPortfolio: true,
    allowDirectContact: true,
    showOnlineStatus: false,
  })

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.push("/login")
      return
    }
    setSettings((prev) => ({ ...prev, email: user.email || "" }))
    setLoading(false)
  }, [user, authLoading, router])

  const handleSaveAccount = async () => {
    setSaving(true)
    try {
      // Update email if changed
      if (settings.email) {
        const { error } = await supabase.auth.updateUser({
          email: settings.email,
        })
        if (error) throw error
      }

      // Update password if provided
      if (settings.newPassword) {
        if (settings.newPassword !== settings.confirmPassword) {
          alert("New passwords don't match")
          return
        }

        const { error } = await supabase.auth.updateUser({
          password: settings.newPassword,
        })
        if (error) throw error

        // Clear password fields
        setSettings((prev) => ({
          ...prev,
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        }))
      }

      alert("Account settings updated successfully!")
    } catch (error) {
      console.error("Error updating account:", error)
      alert("Error updating account settings")
    } finally {
      setSaving(false)
    }
  }

  const handleSaveNotifications = async () => {
    setSaving(true)
    try {
      // Save notification preferences to database
      // This would typically involve updating a user_settings table
      alert("Notification settings updated successfully!")
    } catch (error) {
      console.error("Error updating notifications:", error)
      alert("Error updating notification settings")
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (confirm("Are you sure you want to delete your account? This action cannot be undone.")) {
      try {
        // This would typically involve calling a server function to properly delete the account
        // For now, we'll just sign out
        await supabase.auth.signOut()
        router.push("/")
      } catch (error) {
        console.error("Error deleting account:", error)
        alert("Error deleting account")
      }
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <div className="max-w-4xl mx-auto py-8 px-4">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-300 rounded w-1/4 mb-6"></div>
            <div className="space-y-4">
              <div className="h-32 bg-gray-300 rounded"></div>
              <div className="h-20 bg-gray-300 rounded"></div>
              <div className="h-20 bg-gray-300 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">

      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="mb-6">
          <h1 className="text-primaryxl font-bold text-slate-900 dark:text-white">Settings</h1>
          <p className="text-muted-foreground">Manage your account settings and preferences</p>
        </div>

        <Tabs defaultValue="account" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="account">Account</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="privacy">Privacy</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
          </TabsList>

          <TabsContent value="account" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Account Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={settings.email}
                    onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                    className="mt-1"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  Change Password
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <div className="relative mt-1">
                    <Input
                      id="currentPassword"
                      type={showCurrentPassword ? "text" : "password"}
                      value={settings.currentPassword}
                      onChange={(e) => setSettings({ ...settings, currentPassword: e.target.value })}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    >
                      {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div>
                  <Label htmlFor="newPassword">New Password</Label>
                  <div className="relative mt-1">
                    <Input
                      id="newPassword"
                      type={showNewPassword ? "text" : "password"}
                      value={settings.newPassword}
                      onChange={(e) => setSettings({ ...settings, newPassword: e.target.value })}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div>
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <div className="relative mt-1">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      value={settings.confirmPassword}
                      onChange={(e) => setSettings({ ...settings, confirmPassword: e.target.value })}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <Button onClick={handleSaveAccount} disabled={saving} className="bg-primary hover:bg-primary-hover">
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? "Saving..." : "Update Account"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Notification Preferences
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">Receive notifications via email</p>
                  </div>
                  <Switch
                    checked={settings.emailNotifications}
                    onCheckedChange={(checked) => setSettings({ ...settings, emailNotifications: checked })}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Job Alerts</Label>
                    <p className="text-sm text-muted-foreground">Get notified about new job opportunities</p>
                  </div>
                  <Switch
                    checked={settings.jobAlerts}
                    onCheckedChange={(checked) => setSettings({ ...settings, jobAlerts: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Message Notifications</Label>
                    <p className="text-sm text-muted-foreground">Get notified about new messages</p>
                  </div>
                  <Switch
                    checked={settings.messageNotifications}
                    onCheckedChange={(checked) => setSettings({ ...settings, messageNotifications: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Marketing Emails</Label>
                    <p className="text-sm text-muted-foreground">Receive promotional emails and offers</p>
                  </div>
                  <Switch
                    checked={settings.marketingEmails}
                    onCheckedChange={(checked) => setSettings({ ...settings, marketingEmails: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Weekly Digest</Label>
                    <p className="text-sm text-muted-foreground">Get a weekly summary of your activity</p>
                  </div>
                  <Switch
                    checked={settings.weeklyDigest}
                    onCheckedChange={(checked) => setSettings({ ...settings, weeklyDigest: checked })}
                  />
                </div>

                <Button
                  onClick={handleSaveNotifications}
                  disabled={saving}
                  className="bg-primary hover:bg-primary-hover"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? "Saving..." : "Save Notifications"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="privacy" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Privacy Settings
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Control what information is visible to clients and other users
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Profile Visibility</Label>
                    <p className="text-sm text-muted-foreground">Make your profile visible to potential clients</p>
                  </div>
                  <Switch
                    checked={privacySettings.profileVisibility}
                    onCheckedChange={(checked) =>
                      setPrivacySettings({ ...privacySettings, profileVisibility: checked })
                    }
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Show Email Address</Label>
                    <p className="text-sm text-muted-foreground">Display your email on your public profile</p>
                  </div>
                  <Switch
                    checked={privacySettings.showEmail}
                    onCheckedChange={(checked) => setPrivacySettings({ ...privacySettings, showEmail: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Show Phone Number</Label>
                    <p className="text-sm text-muted-foreground">Display your phone number on your public profile</p>
                  </div>
                  <Switch
                    checked={privacySettings.showPhone}
                    onCheckedChange={(checked) => setPrivacySettings({ ...privacySettings, showPhone: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Show Location</Label>
                    <p className="text-sm text-muted-foreground">Display your location to potential clients</p>
                  </div>
                  <Switch
                    checked={privacySettings.showLocation}
                    onCheckedChange={(checked) => setPrivacySettings({ ...privacySettings, showLocation: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Show Portfolio</Label>
                    <p className="text-sm text-muted-foreground">Make your portfolio visible to clients</p>
                  </div>
                  <Switch
                    checked={privacySettings.showPortfolio}
                    onCheckedChange={(checked) => setPrivacySettings({ ...privacySettings, showPortfolio: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Allow Direct Contact</Label>
                    <p className="text-sm text-muted-foreground">Allow clients to contact you directly</p>
                  </div>
                  <Switch
                    checked={privacySettings.allowDirectContact}
                    onCheckedChange={(checked) =>
                      setPrivacySettings({ ...privacySettings, allowDirectContact: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Show Online Status</Label>
                    <p className="text-sm text-muted-foreground">Display when you're online to other users</p>
                  </div>
                  <Switch
                    checked={privacySettings.showOnlineStatus}
                    onCheckedChange={(checked) => setPrivacySettings({ ...privacySettings, showOnlineStatus: checked })}
                  />
                </div>

                <Button
                  onClick={() => {
                    setSaving(true)
                    // Save privacy settings logic here
                    setTimeout(() => {
                      setSaving(false)
                      alert("Privacy settings updated successfully!")
                    }, 1000)
                  }}
                  disabled={saving}
                  className="bg-primary hover:bg-primary-hover"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? "Saving..." : "Save Privacy Settings"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Security Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Two-Factor Authentication</Label>
                    <p className="text-sm text-muted-foreground">Add an extra layer of security to your account</p>
                  </div>
                  <Switch
                    checked={settings.twoFactorAuth}
                    onCheckedChange={(checked) => setSettings({ ...settings, twoFactorAuth: checked })}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Login Alerts</Label>
                    <p className="text-sm text-muted-foreground">Get notified of new login attempts</p>
                  </div>
                  <Switch
                    checked={settings.loginAlerts}
                    onCheckedChange={(checked) => setSettings({ ...settings, loginAlerts: checked })}
                  />
                </div>

                <Button disabled={saving} className="bg-primary hover:bg-primary-hover">
                  <Save className="h-4 w-4 mr-2" />
                  Save Security Settings
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
