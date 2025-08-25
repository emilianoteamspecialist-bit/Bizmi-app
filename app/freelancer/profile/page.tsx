'use client'

import type React from "react"
import { useState, useEffect } from "react"
import FreelancerNavbar from "@/components/freelancer-navbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Upload, Save, Edit } from 'lucide-react'
import { supabase } from "@/lib/supabase" // Assuming this is your client-side supabase instance
import { useRouter } from "next/navigation"

export default function FreelancerProfile() {
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [logoPreview, setLogoPreview] = useState<string>("")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const router = useRouter()

  // Form state
  const [formData, setFormData] = useState({
    full_name: "",
    bio: "",
    location: "",
    phone: "",
    website: "",
    hourly_rate: "",
    skills: "",
    experience_level: "",
  })

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push("/login")
        return
      }

      // Load profile data
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single()

      if (profileError) {
        console.error("Error loading profile:", profileError)
      } else if (profileData) {
        setProfile(profileData)
        setFormData({
          full_name: profileData.full_name || "",
          bio: profileData.bio || "",
          location: profileData.location || "",
          phone: profileData.phone || "",
          website: profileData.website || "",
          hourly_rate: profileData.hourly_rate || "",
          // Convert skills array to a comma-separated string for the form
          skills: Array.isArray(profileData.skills) ? profileData.skills.join(', ') : profileData.skills || "",
          experience_level: profileData.experience_level || "",
        })
      }

      // Load freelancer logo
      // Assuming 'freelancer_logos' table exists and stores base64 string or URL
      const { data: logoData } = await supabase
        .from("freelancer_logos")
        .select("logo_data")
        .eq("freelancer_id", user.id)
        .single()

      if (logoData) {
        setLogoPreview(logoData.logo_data)
      }
    } catch (error) {
      console.error("Error loading profile:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      const reader = new FileReader()
      reader.onload = (e) => {
        setLogoPreview(e.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      // Prepare update data
      const updateData = {
        // Ensure full_name is always a string, even if empty, to satisfy NOT NULL constraint
        full_name: formData.full_name, // Changed from formData.full_name || null
        bio: formData.bio || null,
        location: formData.location || null,
        phone: formData.phone || null,
        website: formData.website || null,
        // Convert hourly_rate to number or null
        hourly_rate: formData.hourly_rate ? Number.parseInt(formData.hourly_rate) : null,
        // Assuming skills is stored as text[] in DB, convert comma-separated string to array
        skills: formData.skills ? formData.skills.split(',').map(s => s.trim()).filter(s => s.length > 0) : null,
        experience_level: formData.experience_level || null,
        updated_at: new Date().toISOString(),
      }

      // Update profile with only the fields that exist in the profiles table
      const { error: profileError } = await supabase.from("profiles").update(updateData).eq("id", user.id)

      if (profileError) {
        console.error("Error updating profile:", profileError)
        alert("Error updating profile: " + profileError.message)
        return
      }

      // Handle logo upload if there's a new file
      if (selectedFile) {
        const reader = new FileReader()
        reader.onload = async (e) => {
          const logoData = e.target?.result as string // This will be a base64 string
          try {
            // First, delete any existing logo for this freelancer
            await supabase.from("freelancer_logos").delete().eq("freelancer_id", user.id)

            // Then insert the new logo
            const { error: logoError } = await supabase.from("freelancer_logos").insert({
              freelancer_id: user.id,
              logo_data: logoData, // Store base64 string directly
              file_name: selectedFile.name,
              file_size: selectedFile.size,
              mime_type: selectedFile.type,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })

            if (logoError) {
              console.error("Error saving logo:", logoError)
              alert("Error saving logo: " + logoError.message)
            } else {
              alert("Profile and logo updated successfully!")
              setSelectedFile(null)
              // Trigger navbar refresh (if FreelancerNavbar listens to this)
              localStorage.setItem("freelancer_profile_updated", Date.now().toString())
              window.dispatchEvent(new Event("freelancer_profile_updated"))
              // Reload the profile to get the updated logo
              loadProfile()
            }
          } catch (error) {
            console.error("Error processing logo:", error)
            alert("Error saving logo. Please try again.")
          }
        }
        reader.readAsDataURL(selectedFile)
      } else {
        alert("Profile updated successfully!")
        // Trigger navbar refresh
        localStorage.setItem("freelancer_profile_updated", Date.now().toString())
        window.dispatchEvent(new Event("freelancer_profile_updated"))
      }
      setIsEditing(false)
    } catch (error) {
      console.error("Error saving profile:", error)
      alert("Error updating profile. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <FreelancerNavbar />
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <FreelancerNavbar />
      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Freelancer Profile</h1>
          <div className="flex gap-2">
            {!isEditing ? (
              <Button onClick={() => setIsEditing(true)} className="bg-orange-500 hover:bg-orange-600">
                <Edit className="h-4 w-4 mr-2" />
                Edit Profile
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving} className="bg-orange-500 hover:bg-orange-600">
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
              </>
            )}
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-orange-500">Freelancer Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Logo Upload */}
            <div className="flex flex-col items-center space-y-4">
              <Avatar className="h-24 w-24">
                <AvatarImage src={logoPreview || "/placeholder.svg"} alt="Profile Picture" />
                <AvatarFallback className="text-2xl">{formData.full_name?.charAt(0) || "F"}</AvatarFallback>
              </Avatar>
              {isEditing && (
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                    id="logo-upload"
                  />
                  <Button
                    variant="outline"
                    onClick={() => document.getElementById("logo-upload")?.click()}
                    className="bg-transparent"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Change Picture
                  </Button>
                </div>
              )}
            </div>
            {/* Form Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">Full Name</Label>
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="Your full name"
                  disabled={!isEditing}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="City, Country"
                  disabled={!isEditing}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="Your phone number"
                  disabled={!isEditing}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  placeholder="https://yourwebsite.com"
                  disabled={!isEditing}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hourly_rate">Hourly Rate (₦)</Label>
                <Input
                  id="hourly_rate"
                  type="number"
                  value={formData.hourly_rate}
                  onChange={(e) => setFormData({ ...formData, hourly_rate: e.target.value })}
                  placeholder="5000"
                  disabled={!isEditing}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="experience_level">Experience Level</Label>
                <select
                  id="experience_level"
                  className="w-full p-2 border rounded-md disabled:bg-gray-100 disabled:cursor-not-allowed"
                  value={formData.experience_level}
                  onChange={(e) => setFormData({ ...formData, experience_level: e.target.value })}
                  disabled={!isEditing}
                >
                  <option value="">Select experience level</option>
                  <option value="beginner">Beginner (0-1 years)</option>
                  <option value="intermediate">Intermediate (2-4 years)</option>
                  <option value="expert">Expert (5+ years)</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="skills">Skills</Label>
              <Textarea
                id="skills"
                value={formData.skills}
                onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
                placeholder="List your skills separated by commas (e.g., React, Node.js, Python)"
                rows={3}
                disabled={!isEditing}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                placeholder="Tell us about yourself and your experience..."
                rows={4}
                disabled={!isEditing}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
