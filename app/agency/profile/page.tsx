"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Upload, Save, Edit, MapPin, Globe, Phone, Building2, User, Users, Camera } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"

export default function AgencyProfile() {
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [imagePreview, setImagePreview] = useState<string>("")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const router = useRouter()

  const [formData, setFormData] = useState({
    full_name: "",
    company_name: "",
    company_size: "",
    bio: "",
    location: "",
    phone: "",
    website: "",
  })

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push("/login")
        return
      }

      const { data: profileData } = await supabase.from("profiles").select("*").eq("id", user.id).single()
      if (profileData) {
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

      const { data: imageData } = await supabase.from("agency_image").select("image_data").eq("agency_id", user.id).single()
      if (imageData) setImagePreview(imageData.image_data)
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      const reader = new FileReader()
      reader.onload = (e) => setImagePreview(e.target?.result as string)
      reader.readAsDataURL(file)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

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

      const { error: profileError } = await supabase.from("profiles").update(updateData).eq("id", user.id)
      if (profileError) throw profileError

      if (selectedFile) {
        const reader = new FileReader()
        reader.onload = async (e) => {
          const imageData = e.target?.result as string
          await supabase.from("agency_image").delete().eq("agency_id", user.id)
          await supabase.from("agency_image").insert({
            agency_id: user.id,
            image_data: imageData,
            file_name: selectedFile.name,
            file_size: selectedFile.size,
            mime_type: selectedFile.type,
          })
          window.dispatchEvent(new Event("agency_profile_updated"))
          loadProfile()
        }
        reader.readAsDataURL(selectedFile)
      } else {
        window.dispatchEvent(new Event("agency_profile_updated"))
      }
      setIsEditing(false)
      alert("Agency profile updated successfully!")
    } catch (error) {
      console.error(error)
      alert("Error saving profile")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center font-bold text-slate-400">Loading Profile...</div>
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20 selection:bg-orange-100">
      
      <div className="max-w-5xl mx-auto py-12 px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Header Area */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-4">
           <div className="flex items-center gap-6">
              <div className="relative group">
                 <Avatar className="h-32 w-32 border-8 border-white shadow-2xl rounded-[2.5rem]">
                   <AvatarImage src={imagePreview} />
                   <AvatarFallback className="bg-slate-900 text-white text-4xl font-black uppercase">
                     {formData.company_name?.charAt(0) || formData.full_name?.charAt(0) || "A"}
                   </AvatarFallback>
                 </Avatar>
                 {isEditing && (
                   <label htmlFor="image-upload" className="absolute inset-0 bg-slate-900/60 rounded-[2.5rem] flex items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity">
                      <Camera className="text-white h-8 w-8" />
                      <input type="file" accept="image/*" onChange={handleImageSelect} className="hidden" id="image-upload" />
                   </label>
                 )}
              </div>
              <div className="space-y-1 pb-2">
                 <h1 className="text-4xl font-black text-slate-900 tracking-tight">{formData.company_name || formData.full_name || "New Agency"}</h1>
                 <p className="text-slate-400 font-bold flex items-center gap-2">
                    <MapPin className="h-4 w-4" /> {formData.location || "Location not set"}
                 </p>
              </div>
           </div>
           <div className="pb-2">
              {!isEditing ? (
                <Button onClick={() => setIsEditing(true)} className="bg-slate-900 hover:bg-slate-800 rounded-2xl h-14 px-8 font-black text-lg shadow-xl shadow-slate-200/50">
                  <Edit className="mr-2 h-5 w-5" /> Edit Profile
                </Button>
              ) : (
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setIsEditing(false)} className="rounded-2xl h-14 px-8 font-bold border-slate-200">
                    Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary-hover rounded-2xl h-14 px-8 font-black text-lg shadow-xl shadow-primary/25">
                    {saving ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              )}
           </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           {/* Sidebar Info */}
           <div className="space-y-6">
              <Card className="border-none shadow-xl shadow-slate-200/50 rounded-[2.5rem] bg-white overflow-hidden">
                 <CardHeader className="bg-slate-50 border-b border-slate-100 p-8">
                    <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-400">Company Overview</CardTitle>
                 </CardHeader>
                 <CardContent className="p-8 space-y-6">
                    <div className="space-y-4">
                       <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-50 rounded-xl"><Users className="h-4 w-4 text-blue-500" /></div>
                          <div>
                             <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Team Size</p>
                             <p className="font-black text-slate-900">{formData.company_size || "Not set"}</p>
                          </div>
                       </div>
                       <div className="flex items-center gap-3">
                          <div className="p-2 bg-primary/10 rounded-xl"><Globe className="h-4 w-4 text-primary" /></div>
                          <div className="min-w-0 flex-1">
                             <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Website</p>
                             <p className="font-bold text-slate-900 truncate">{formData.website || "No website"}</p>
                          </div>
                       </div>
                       <div className="flex items-center gap-3">
                          <div className="p-2 bg-green-50 rounded-xl"><Phone className="h-4 w-4 text-green-500" /></div>
                          <div>
                             <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Contact</p>
                             <p className="font-bold text-slate-900">{formData.phone || "No phone"}</p>
                          </div>
                       </div>
                    </div>
                 </CardContent>
              </Card>
           </div>

           {/* Main Form */}
           <div className="lg:col-span-2 space-y-6">
              <Card className="border-none shadow-xl shadow-slate-200/50 rounded-[2.5rem] bg-white">
                 <CardHeader className="p-10 pb-4">
                    <CardTitle className="text-2xl font-black text-slate-900">About Agency</CardTitle>
                    <CardDescription className="font-medium">Information visible to freelancers you hire.</CardDescription>
                 </CardHeader>
                 <CardContent className="p-10 pt-0 space-y-8">
                    <div className="space-y-6">
                       <div className="space-y-2">
                          <Label className="font-black uppercase tracking-widest text-[10px] text-slate-400">Agency Bio / About</Label>
                          <Textarea 
                            rows={6}
                            className="rounded-[1.5rem] border-slate-200 focus:ring-primary min-h-[160px] p-6 text-slate-600 font-medium leading-relaxed"
                            placeholder="Describe your company, what you do, and what you look for in talent..."
                            value={formData.bio}
                            onChange={(e) => setFormData({...formData, bio: e.target.value})}
                            disabled={!isEditing}
                          />
                       </div>

                       {isEditing && (
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                            <div className="space-y-2">
                               <Label className="font-bold text-slate-700">Company Name</Label>
                               <Input className="h-12 rounded-xl" value={formData.company_name} onChange={(e) => setFormData({...formData, company_name: e.target.value})} />
                            </div>
                            <div className="space-y-2">
                               <Label className="font-bold text-slate-700">Point of Contact</Label>
                               <Input className="h-12 rounded-xl" value={formData.full_name} onChange={(e) => setFormData({...formData, full_name: e.target.value})} />
                            </div>
                            <div className="space-y-2">
                               <Label className="font-bold text-slate-700">Location</Label>
                               <Input className="h-12 rounded-xl" value={formData.location} onChange={(e) => setFormData({...formData, location: e.target.value})} />
                            </div>
                            <div className="space-y-2">
                               <Label className="font-bold text-slate-700">Company Size</Label>
                               <select 
                                 className="w-full h-12 px-4 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                                 value={formData.company_size}
                                 onChange={(e) => setFormData({...formData, company_size: e.target.value})}
                               >
                                  <option value="">Select Size</option>
                                  <option value="1-10">1-10 Employees</option>
                                  <option value="11-50">11-50 Employees</option>
                                  <option value="51-200">51-200 Employees</option>
                                  <option value="200+">200+ Employees</option>
                               </select>
                            </div>
                            <div className="space-y-2">
                               <Label className="font-bold text-slate-700">Phone</Label>
                               <Input className="h-12 rounded-xl" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
                            </div>
                            <div className="space-y-2">
                               <Label className="font-bold text-slate-700">Website</Label>
                               <Input className="h-12 rounded-xl" value={formData.website} onChange={(e) => setFormData({...formData, website: e.target.value})} />
                            </div>
                         </div>
                       )}
                    </div>
                 </CardContent>
              </Card>
           </div>
        </div>
      </div>
    </div>
  )
}
