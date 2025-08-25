"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Upload, Save, Edit } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import AgencyNavbar from "@/components/agency-navbar"

export default function AgencyProfile() {
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [imagePreview, setImagePreview] = useState<string>("")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const router = useRouter()

  // Form state
  const [formData, setFormData] = useState({
    full_name: "",
    company_name: "",
    company_size: "",
    bio: "",
    location: "",
    phone: "",
    website: "",
  })

  const [newService, setNewService] = useState("")

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
          company_name: profileData.company_name || "",
          company_size: profileData.company_size || "",
          bio: profileData.bio || "",
          location: profileData.location || "",
          phone: profileData.phone || "",
          website: profileData.website || "",
        })
      }

      // Load agency image
      const { data: imageData } = await supabase
        .from("agency_image")
        .select("image_data")
        .eq("agency_id", user.id)
        .single()

      if (imageData) {
        setImagePreview(imageData.image_data)
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
        setImagePreview(e.target?.result as string)
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

      // Prepare update data, converting empty strings to null for potential integer fields
      const updateData = {
        full_name: formData.full_name || null,
        company_name: formData.company_name || null,
        company_size: formData.company_size || null,
        bio: formData.bio || null,
        location: formData.location || null,
        phone: formData.phone || null,
        website: formData.website || null,
        updated_at: new Date().toISOString(),
      }

      // Update profile with only the fields that exist in the profiles table
      const { error: profileError } = await supabase.from("profiles").update(updateData).eq("id", user.id)

      if (profileError) {
        console.error("Error updating profile:", profileError)
        alert("Error updating profile: " + profileError.message)
        return
      }

      // Handle image upload if there's a new file
      if (selectedFile) {
        const reader = new FileReader()
        reader.onload = async (e) => {
          const imageData = e.target?.result as string

          try {
            // First, delete any existing image
            await supabase.from("agency_image").delete().eq("agency_id", user.id)

            // Then insert the new image
            const { error: imageError } = await supabase.from("agency_image").insert({
              agency_id: user.id,
              image_data: imageData,
              file_name: selectedFile.name,
              file_size: selectedFile.size,
              mime_type: selectedFile.type,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })

            if (imageError) {
              console.error("Error saving image:", imageError)
              alert("Error saving image: " + imageError.message)
            } else {
              alert("Profile and image updated successfully!")
              setSelectedFile(null)
              // Trigger navbar refresh
              localStorage.setItem("agency_profile_updated", Date.now().toString())
              window.dispatchEvent(new Event("agency_profile_updated"))
              // Reload the profile to get the updated image
              loadProfile()
            }
          } catch (error) {
            console.error("Error processing image:", error)
            alert("Error saving image. Please try again.")
          }
        }
        reader.readAsDataURL(selectedFile)
      } else {
        alert("Profile updated successfully!")
        // Trigger navbar refresh
        localStorage.setItem("agency_profile_updated", Date.now().toString())
        window.dispatchEvent(new Event("agency_profile_updated"))
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
        <AgencyNavbar />
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
      <AgencyNavbar />

      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Agency Profile</h1>
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
            <CardTitle className="text-2xl font-bold text-orange-500">Agency Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Image Upload */}
            <div className="flex flex-col items-center space-y-4">
              <Avatar className="h-24 w-24">
                <AvatarImage src={imagePreview || "/placeholder.svg"} alt="Agency Profile" />
                <AvatarFallback className="text-2xl">
                  {formData.company_name?.charAt(0) || formData.full_name?.charAt(0) || "A"}
                </AvatarFallback>
              </Avatar>
              {isEditing && (
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                    id="image-upload"
                  />
                  <Button
                    variant="outline"
                    onClick={() => document.getElementById("image-upload")?.click()}
                    className="bg-transparent"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Change Profile Image
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
                <Label htmlFor="company_name">Company Name</Label>
                <Input
                  id="company_name"
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  placeholder="Your company name"
                  disabled={!isEditing}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="company_size">Company Size</Label>
                <select
                  id="company_size"
                  className="w-full p-2 border rounded-md disabled:bg-gray-100 disabled:cursor-not-allowed"
                  value={formData.company_size}
                  onChange={(e) => setFormData({ ...formData, company_size: e.target.value })}
                  disabled={!isEditing}
                >
                  <option value="">Select company size</option>
                  <option value="1-10">1-10 employees</option>
                  <option value="11-50">11-50 employees</option>
                  <option value="51-200">51-200 employees</option>
                  <option value="201-500">201-500 employees</option>
                  <option value="500+">500+ employees</option>
                </select>
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">About Company</Label>
              <Textarea
                id="bio"
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                placeholder="Tell us about your company..."
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
