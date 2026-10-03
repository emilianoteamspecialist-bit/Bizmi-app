import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "../../components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "../../components/ui/separator"
import { Save, Shield, Bell, Mail, Lock, Eye, EyeOff, AlertTriangle } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { apiFetch } from "../../lib/api"
import { useAuth } from "../../contexts/AuthContext"
import { DeleteAccountDialog } from "../../components/DeleteAccountDialog"

export default function AgencySettings() {
  const { user, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const navigate = useNavigate()

  // Settings state
  const [settings, setSettings] = useState({
    // Account settings
    email: "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",

    // Notification settings
    emailNotifications: true,
    projectUpdates: true,
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

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      navigate("/login")
      return
    }
    setSettings((prev) => ({ ...prev, email: user.email || "" }))
    setLoading(false)
  }, [user, authLoading, navigate])

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

  // Confirmation is handled by the DeleteAccountDialog (type-to-confirm), so
  // this just performs the deletion.
  const handleDeleteAccount = async () => {
    try {
      setSaving(true)

      // Account deletion runs server-side with the service role: deleting the
      // auth user (not just the profile) is the only way to free the email for
      // re-signup, and the browser client can't touch auth.users.
      await apiFetch("/api/user/account", { method: "POST" })

      await supabase.auth.signOut()
      navigate("/")
      alert("Account deleted successfully")
    } catch (error) {
      console.error("Error deleting account:", error)
      alert(error instanceof Error ? error.message : "Error deleting account")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface">
        <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-foreground/5 rounded w-1/4 mb-6"></div>
            <div className="h-32 bg-foreground/5 rounded"></div>
            <div className="h-20 bg-foreground/5 rounded"></div>
            <div className="h-20 bg-foreground/5 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface pb-20">
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <header className="space-y-1 mb-6">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Account</p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground">Manage your account settings and preferences.</p>
        </header>

        <Tabs defaultValue="account" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="account">Account</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="privacy">Privacy</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
          </TabsList>

          <TabsContent value="account" className="space-y-6">
            <Card className="rounded-xl border border-border bg-card shadow-none">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
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

            <Card className="rounded-xl border border-border bg-card shadow-none">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
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
            <Card className="rounded-xl border border-border bg-card shadow-none">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
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
                    <Label>Project Updates</Label>
                    <p className="text-sm text-muted-foreground">Get notified about project milestones and updates</p>
                  </div>
                  <Switch
                    checked={settings.projectUpdates}
                    onCheckedChange={(checked) => setSettings({ ...settings, projectUpdates: checked })}
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
            <Card className="rounded-xl border border-border bg-card shadow-none">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <Shield className="h-5 w-5" />
                  Privacy Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Profile Visibility</Label>
                    <p className="text-sm text-muted-foreground">Make your profile visible to other users</p>
                  </div>
                  <Switch
                    checked={settings.profileVisibility}
                    onCheckedChange={(checked) => setSettings({ ...settings, profileVisibility: checked })}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Show Email Address</Label>
                    <p className="text-sm text-muted-foreground">Display your email on your public profile</p>
                  </div>
                  <Switch
                    checked={settings.showEmail}
                    onCheckedChange={(checked) => setSettings({ ...settings, showEmail: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Show Phone Number</Label>
                    <p className="text-sm text-muted-foreground">Display your phone number on your public profile</p>
                  </div>
                  <Switch
                    checked={settings.showPhone}
                    onCheckedChange={(checked) => setSettings({ ...settings, showPhone: checked })}
                  />
                </div>

                <Button disabled={saving} className="bg-primary hover:bg-primary-hover">
                  <Save className="h-4 w-4 mr-2" />
                  Save Privacy Settings
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="space-y-6">
            <Card className="rounded-xl border border-red-200 bg-card shadow-none">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base font-semibold text-red-600">
                  <AlertTriangle className="h-5 w-5" />
                  Danger Zone
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-red-600">Delete Account</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      Once you delete your account, there is no going back. Please be certain.
                    </p>
                    <DeleteAccountDialog onConfirm={handleDeleteAccount} loading={saving} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
