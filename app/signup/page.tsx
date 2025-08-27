"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Eye,
  EyeOff,
  User,
  Building2,
  Loader2,
  Gift,
  CheckCircle,
  AlertCircle,
  X,
  Upload,
  FileText,
} from "lucide-react"
import Link from "next/link"
import { supabase, handleSupabaseError } from "@/lib/supabase"
import { useRouter } from "next/navigation"

type AccountType = "freelancer" | "agency"

const AVAILABLE_SKILLS = [
"Web Development",
      "Mobile App Development",
      "Frontend Development",
      "Backend Development",
      "Full-Stack Development",
      "UI/UX Design",
      "Software Development",
      "Game Development",
      "Blockchain Development",
      "Smart Contracts",
      "Cybersecurity",
      "Cloud Computing",
      "DevOps",
      "Database Management",
      "API Development",
      "WordPress Development",
      "Shopify Development",
      "E-commerce Development",
      "SaaS Development",
      "AR/VR Development",
      "Machine Learning",
      "Artificial Intelligence",
      "Data Science",
      "Django",
      "Express.js",
      "MongoDB",
      "MySQL",
      "PostgreSQL",
      "Firebase",
      "AWS",
      "Docker",
      "Git",
      "Figma",
      "Adobe XD",
      "Photoshop",
       "Mobile Development",
         "Flutter",
           "React Native",
      "Data Analysis",
      "Python Programming",
      "JavaScript Development",
      "React.js Development",
      "Node.js Development",
      "PHP Development",
      "Java Development",
      "C++ Development",
      "C# Development",
      "Go (Golang) Development",
      "Ruby on Rails Development",
      "Kotlin Development",
      "Swift (iOS) Development",
      "Android Development",
      "Flutter Development",
      "Rust Development",
      "Penetration Testing",
      "Ethical Hacking",
      "Bug Bounty Research",
      "IoT Development",
      "Embedded Systems",
      "Firmware Development",
      "Robotics Programming",
      "MATLAB",
      "Simulations & Modeling",
      "QA Testing / Software Testing",
      "Automation Scripting",
      "Web Scraping",
      "Chatbot Development",
      "API Integration",
      "CRM Development (Salesforce, HubSpot, Zoho)",
      "ERP Development (SAP, Oracle, Odoo)",
      "Game Design (Unity, Unreal Engine)",
      "Database Optimization",
      "Big Data Engineering",
      "Cloud Architecture (AWS, Azure, GCP)",
      "Server Management",
      "Linux System Administration",
      "Network Administration",
      "IT Support",
      "Graphic Design",
      "Logo Design",
      "Illustration",
      "Print Design",
      "Business Card Design",
      "Flyer & Brochure Design",
      "Poster Design",
      "Infographic Design",
      "UI/UX Wireframing",
      "Product Design",
      "Industrial Design",
      "Fashion Design",
      "Jewelry Design",
      "Interior Design",
      "Architecture Design",
      "3D Modeling",
      "3D Rendering",
      "Animation (2D/3D)",
      "Motion Graphics",
      "Character Design",
      "Video Editing",
      "Photography",
      "Photo Editing / Retouching",
      "Image Manipulation",
      "NFT Art",
      "Storyboarding",
      "T-shirt Design",
      "Merchandise Design",
      "Packaging Design",
      "Label Design",
      "Tattoo Design",
      "Book Cover Design",
      "Album Cover Design",
      "Presentation Design (PowerPoint, Keynote)",
      "Infographic Video Creation",
      "Architectural Visualization",
      "Landscape Design",
      "Set Design (Theater/Film)",
      "Story Illustration",
      "Typography Design",
      "Calligraphy",
      "Comic / Manga Art",
      "Caricature Drawing",
      "Content Writing",
      "Copywriting",
      "Creative Writing",
      "Technical Writing",
      "Blog Writing",
      "Ghostwriting",
      "Script Writing (Film/Video)",
      "Resume Writing",
      "Cover Letter Writing",
      "White Papers",
      "Academic Writing",
      "Research Writing",
      "Proofreading & Editing",
      "Grant Writing",
      "eBook Writing",
      "Speech Writing",
      "Song Lyrics Writing",
      "Product Descriptions",
      "Ad Copywriting",
      "Case Studies",
      "UX Writing",
      "Press Releases",
      "Medical Writing",
      "Legal Writing",
      "Grant Proposals",
      "Business Proposals",
      "Newsletter Writing",
      "Review Writing (Books, Products, Movies)",
      "Social Media Captions",
      "Digital Marketing",
      "SEO (Search Engine Optimization)",
      "SEM (Search Engine Marketing)",
      "Social Media Marketing",
      "Social Media Management",
      "Influencer Marketing",
      "Content Marketing",
      "Email Marketing",
      "Affiliate Marketing",
      "PPC Campaigns (Google, Facebook Ads)",
      "Marketing Strategy",
      "Brand Strategy",
      "Lead Generation",
      "Sales Funnel Design",
      "PR (Public Relations)",
      "Voice Over",
      "Music Production",
      "Audio Editing",
      "Podcast Editing",
      "Sound Design",
      "DJ Services",
      "Singing / Songwriting",
      "Acting",
      "Dance Choreography",
      "Comedy / Stand-up",
      "Video Production",
      "Storytelling",
      "Modeling",
      "Event Hosting",
      "Translation (All Languages)",
      "Transcription",
      "Subtitling / Captioning",
      "Language Tutoring",
      "Localization Services",
      "Sign Language",
      "Online Tutoring",
      "Test Preparation (SAT, IELTS, GRE, etc.)",
      "Academic Coaching",
      "Career Counseling",
      "Life Coaching",
      "Personal Development",
      "E-learning Course Creation",
      "Educational Content Writing",
      "Corporate Training",
      "Virtual Assistant",
      "Data Entry",
      "Customer Support",
      "Technical Support",
      "Project Management",
      "Business Consulting",
      "Financial Consulting",
      "Accounting & Bookkeeping",
      "HR & Recruiting",
      "Market Research",
      "Business Plan Writing",
      "Grant Proposal Writing",
      "Legal Writing",
      "Contract Drafting",
      "Intellectual Property",
      "Business Law",
      "Tax Law",
      "Immigration Law",
      "Paralegal Services",
      "CAD Design",
      "Civil Engineering",
      "Mechanical Engineering",
      "Electrical Engineering",
      "Architecture",
      "Structural Engineering",
      "Product Engineering",
      "Lifestyle Coaching",
      "Fitness Training",
      "Nutrition Coaching",
      "Cooking Lessons",
      "Travel Planning",
      "Astrology Services",
      "Gaming Coaching (eSports)",
      "Online Therapy / Counseling",
      "Others",
    
]

export default function SignUpPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [accountType, setAccountType] = useState<AccountType>("freelancer")
  const [isLoading, setIsLoading] = useState(false)
  const [signupStatus, setSignupStatus] = useState<{
    type: "success" | "error" | "info" | null
    message: string
  }>({ type: null, message: "" })
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    username: "",
    companyName: "",
    companySize: "",
  })

  const [selectedSkills, setSelectedSkills] = useState<string[]>([])
  const [skillSearchTerm, setSkillSearchTerm] = useState("")

  const [identityData, setIdentityData] = useState({
    ninNumber: "",
    frontIdFile: null as File | null,
    backIdFile: null as File | null,
  })

  const router = useRouter()

  const handleSkillToggle = (skill: string) => {
    if (selectedSkills.includes(skill)) {
      setSelectedSkills(selectedSkills.filter((s) => s !== skill))
    } else if (selectedSkills.length < 10) {
      setSelectedSkills([...selectedSkills, skill])
    }
  }

  const handleFileUpload = (file: File, type: "front" | "back") => {
    if (file.size > 5 * 1024 * 1024) {
      // 5MB limit
      setSignupStatus({ type: "error", message: "File size must be less than 5MB" })
      return
    }

    if (!file.type.startsWith("image/")) {
      setSignupStatus({ type: "error", message: "Please upload an image file" })
      return
    }

    setIdentityData((prev) => ({
      ...prev,
      [type === "front" ? "frontIdFile" : "backIdFile"]: file,
    }))
  }

  const validateNIN = (nin: string) => {
    return /^[0-9]{11}$/.test(nin)
  }

  const isFormValid = () => {
    // Basic required fields for all account types
    const basicFieldsValid =
      formData.fullName.trim() !== "" &&
      formData.email.trim() !== "" &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email) &&
      formData.password.length >= 6 &&
      formData.password === formData.confirmPassword

    if (!basicFieldsValid) return false

    // Additional validation for freelancers
    if (accountType === "freelancer") {
      const freelancerFieldsValid =
        formData.username.trim() !== "" &&
        selectedSkills.length > 0 &&
        identityData.ninNumber.trim() !== "" &&
        validateNIN(identityData.ninNumber) &&
        identityData.frontIdFile !== null &&
        identityData.backIdFile !== null

      return freelancerFieldsValid
    }

    // Additional validation for agencies
    if (accountType === "agency") {
      const agencyFieldsValid = formData.companyName.trim() !== "" && formData.companySize !== ""

      return agencyFieldsValid
    }

    return true
  }

  const validateForm = () => {
    if (!formData.fullName.trim()) {
      setSignupStatus({ type: "error", message: "Full name is required" })
      return false
    }
    if (!formData.email.trim()) {
      setSignupStatus({ type: "error", message: "Email is required" })
      return false
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setSignupStatus({ type: "error", message: "Please enter a valid email address" })
      return false
    }
    if (accountType === "freelancer") {
      if (!formData.username.trim()) {
        setSignupStatus({ type: "error", message: "Username is required for freelancers" })
        return false
      }
      if (selectedSkills.length === 0) {
        setSignupStatus({ type: "error", message: "Please select at least one skill" })
        return false
      }
      if (!identityData.ninNumber.trim()) {
        setSignupStatus({ type: "error", message: "NIN number is required" })
        return false
      }
      if (!validateNIN(identityData.ninNumber)) {
        setSignupStatus({ type: "error", message: "NIN must be exactly 11 digits" })
        return false
      }
      if (!identityData.frontIdFile || !identityData.backIdFile) {
        setSignupStatus({ type: "error", message: "Please upload both front and back of your national ID" })
        return false
      }
    }
    if (accountType === "agency") {
      if (!formData.companyName.trim()) {
        setSignupStatus({ type: "error", message: "Company name is required for agencies" })
        return false
      }
      if (!formData.companySize) {
        setSignupStatus({ type: "error", message: "Company size is required for agencies" })
        return false
      }
    }
    if (formData.password.length < 6) {
      setSignupStatus({ type: "error", message: "Password must be at least 6 characters long" })
      return false
    }
    if (formData.password !== formData.confirmPassword) {
      setSignupStatus({ type: "error", message: "Passwords don't match" })
      return false
    }
    return true
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setSignupStatus({ type: null, message: "" })

    try {
      if (!validateForm()) {
        setIsLoading(false)
        return
      }

      if (accountType === "freelancer") {
        const { data: existingNIN } = await supabase
          .from("Freelancer_identitie")
          .select("nin_number")
          .eq("nin_number", identityData.ninNumber)
          .single()

        if (existingNIN) {
          setSignupStatus({ type: "error", message: "This NIN number is already registered" })
          setIsLoading(false)
          return
        }
      }

      const userMetadata = {
        full_name: formData.fullName.trim(),
        account_type: accountType,
        ...(accountType === "freelancer" && { username: formData.username.trim() }),
        ...(accountType === "agency" && {
          company_name: formData.companyName.trim(),
          company_size: formData.companySize,
        }),
      }

      setSignupStatus({ type: "info", message: "Creating your account..." })

      const redirectUrl = `${window.location.origin}/login?confirmed=true`

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email.trim(),
        password: formData.password,
        options: {
          emailRedirectTo: redirectUrl,
          data: userMetadata,
        },
      })

      if (authError) {
        const errorMessage = handleSupabaseError(authError)
        setSignupStatus({ type: "error", message: errorMessage })
      } else if (authData.user && accountType === "freelancer") {
        setSignupStatus({ type: "info", message: "Uploading identity documents..." })

        const userId = authData.user.id
        if (!userId) {
          throw new Error("User ID not available")
        }

        // Upload front ID
        const frontFileName = `${userId}/front-id-${Date.now()}.${identityData.frontIdFile!.name.split(".").pop()}`
        const { data: frontUpload, error: frontError } = await supabase.storage
          .from("identity-documents")
          .upload(frontFileName, identityData.frontIdFile!)

        if (frontError) throw frontError

        // Upload back ID
        const backFileName = `${userId}/back-id-${Date.now()}.${identityData.backIdFile!.name.split(".").pop()}`
        const { data: backUpload, error: backError } = await supabase.storage
          .from("identity-documents")
          .upload(backFileName, identityData.backIdFile!)

        if (backError) throw backError

        // Get public URLs
        const { data: frontUrl } = supabase.storage.from("identity-documents").getPublicUrl(frontFileName)
        const { data: backUrl } = supabase.storage.from("identity-documents").getPublicUrl(backFileName)

        // Save identity data
        const { error: identityError } = await supabase.from("Freelancer_identitie").insert({
          user_id: userId,
          nin_number: identityData.ninNumber,
          front_id_url: frontUrl.publicUrl,
          back_id_url: backUrl.publicUrl,
        })

        if (identityError) throw identityError

        // Save skills
        const skillsData = selectedSkills.map((skill) => ({
          user_id: userId,
          skill_name: skill,
        }))

        const { error: skillsError } = await supabase.from("freelancer_skills").insert(skillsData)

        if (skillsError) throw skillsError

        const successMessage =
          "🎉 Account created successfully! You've received 80 free credits! Please check your email and click the confirmation link to activate your account."
        setSignupStatus({ type: "success", message: successMessage })

        // Clear form
        setFormData({
          fullName: "",
          email: "",
          password: "",
          confirmPassword: "",
          username: "",
          companyName: "",
          companySize: "",
        })
        setSelectedSkills([])
        setIdentityData({ ninNumber: "", frontIdFile: null, backIdFile: null })
      } else if (authData.user) {
        const successMessage =
          "✅ Account created successfully! Please check your email and click the confirmation link to activate your account."
        setSignupStatus({ type: "success", message: successMessage })

        setFormData({
          fullName: "",
          email: "",
          password: "",
          confirmPassword: "",
          username: "",
          companyName: "",
          companySize: "",
        })
      } else {
        setSignupStatus({ type: "error", message: "An unexpected error occurred during signup. Please try again." })
      }
    } catch (error) {
      console.error("💥 Unexpected signup error:", error)
      setSignupStatus({
        type: "error",
        message: "An unexpected error occurred. Please try again or contact support.",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (signupStatus.type === "error") {
      setSignupStatus({ type: null, message: "" })
    }
  }

  const filteredSkills = AVAILABLE_SKILLS.filter(
    (skill) => skill.toLowerCase().includes(skillSearchTerm.toLowerCase()) && !selectedSkills.includes(skill),
  )

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-orange-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-orange-500">Join Bizimi</CardTitle>
          <CardDescription>Create your account and start your journey</CardDescription>

          {signupStatus.type && (
            <div
              className={`rounded-lg p-3 flex items-start gap-2 mt-2 text-left ${
                signupStatus.type === "success"
                  ? "bg-green-50 border border-green-200"
                  : signupStatus.type === "error"
                    ? "bg-red-50 border border-red-200"
                    : "bg-blue-50 border border-blue-200"
              }`}
            >
              {signupStatus.type === "success" && (
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
              )}
              {signupStatus.type === "error" && <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />}
              {signupStatus.type === "info" && <Gift className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />}
              <span
                className={`text-sm ${
                  signupStatus.type === "success"
                    ? "text-green-700"
                    : signupStatus.type === "error"
                      ? "text-red-700"
                      : "text-blue-700"
                }`}
              >
                {signupStatus.message}
              </span>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignUp} className="space-y-6">
            {/* Account Type Selection */}
            <div className="space-y-3">
              <Label>I want to join as:</Label>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  type="button"
                  variant={accountType === "freelancer" ? "default" : "outline"}
                  className={`h-20 flex flex-col items-center justify-center space-y-2 ${
                    accountType === "freelancer" ? "bg-orange-500 hover:bg-orange-600" : "hover:bg-orange-50"
                  }`}
                  onClick={() => setAccountType("freelancer")}
                  disabled={isLoading}
                >
                  <User className="h-6 w-6" />
                  <div className="text-center">
                    <span className="text-sm">Freelancer</span>
                    <div className="flex items-center gap-1 text-xs text-green-600">
                      <Gift className="h-3 w-3" />
                      <span>+80 credits</span>
                    </div>
                  </div>
                </Button>
                <Button
                  type="button"
                  variant={accountType === "agency" ? "default" : "outline"}
                  className={`h-20 flex flex-col items-center justify-center space-y-2 ${
                    accountType === "agency" ? "bg-orange-500 hover:bg-orange-600" : "hover:bg-orange-50"
                  }`}
                  onClick={() => setAccountType("agency")}
                  disabled={isLoading}
                >
                  <Building2 className="h-6 w-6" />
                  <span className="text-sm">Agency</span>
                </Button>
              </div>
            </div>

            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name *</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Enter your full name"
                  value={formData.fullName}
                  onChange={(e) => handleInputChange("fullName", e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>

              {accountType === "freelancer" && (
                <div className="space-y-2">
                  <Label htmlFor="username">Username *</Label>
                  <Input
                    id="username"
                    type="text"
                    placeholder="Choose a unique username"
                    value={formData.username}
                    onChange={(e) => handleInputChange("username", e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>
              )}

              {accountType === "agency" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="companyName">Company Name *</Label>
                    <Input
                      id="companyName"
                      type="text"
                      placeholder="Enter your company name"
                      value={formData.companyName}
                      onChange={(e) => handleInputChange("companyName", e.target.value)}
                      required
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="companySize">Company Size *</Label>
                    <select
                      id="companySize"
                      className="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      value={formData.companySize}
                      onChange={(e) => handleInputChange("companySize", e.target.value)}
                      required
                      disabled={isLoading}
                    >
                      <option value="">Select company size</option>
                      <option value="1-10">1-10 employees</option>
                      <option value="11-50">11-50 employees</option>
                      <option value="51-200">51-200 employees</option>
                      <option value="201-500">201-500 employees</option>
                      <option value="500+">500+ employees</option>
                    </select>
                  </div>
                </>
              )}
            </div>

            {accountType === "freelancer" && (
              <div className="space-y-4">
                <div>
                  <Label>Select Your Skills * (Max 10)</Label>
                  <p className="text-sm text-gray-600">Choose skills that best describe your expertise</p>
                </div>

                {/* Selected Skills */}
                {selectedSkills.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedSkills.map((skill) => (
                      <span
                        key={skill}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm"
                      >
                        {skill}
                        <button
                          type="button"
                          onClick={() => handleSkillToggle(skill)}
                          className="hover:bg-orange-200 rounded-full p-0.5"
                          disabled={isLoading}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Skill Search */}
                <Input
                  type="text"
                  placeholder="Search skills..."
                  value={skillSearchTerm}
                  onChange={(e) => setSkillSearchTerm(e.target.value)}
                  disabled={isLoading}
                />

                {/* Available Skills */}
                <div className="max-h-40 overflow-y-auto border rounded-md p-2">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {filteredSkills.slice(0, 12).map((skill) => (
                      <button
                        key={skill}
                        type="button"
                        onClick={() => handleSkillToggle(skill)}
                        disabled={selectedSkills.length >= 10 || isLoading}
                        className="text-left p-2 text-sm border rounded hover:bg-orange-50 hover:border-orange-300 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {skill}
                      </button>
                    ))}
                  </div>
                  {filteredSkills.length === 0 && skillSearchTerm && (
                    <p className="text-sm text-gray-500 text-center py-4">
                      No skills found matching "{skillSearchTerm}"
                    </p>
                  )}
                </div>
                <p className="text-sm text-gray-600">Selected: {selectedSkills.length}/10 skills</p>
              </div>
            )}

            {accountType === "freelancer" && (
              <div className="space-y-4">
                <div>
                  <Label>Identity Verification *</Label>
                  <p className="text-sm text-gray-600">Upload your national ID and provide your NIN for verification</p>
                </div>

                {/* NIN Number */}
                <div className="space-y-2">
                  <Label htmlFor="ninNumber">NIN Number * (11 digits)</Label>
                  <Input
                    id="ninNumber"
                    type="text"
                    placeholder="Enter your 11-digit NIN"
                    value={identityData.ninNumber}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, "").slice(0, 11)
                      setIdentityData((prev) => ({ ...prev, ninNumber: value }))
                    }}
                    maxLength={11}
                    required
                    disabled={isLoading}
                  />
                  {identityData.ninNumber && !validateNIN(identityData.ninNumber) && (
                    <p className="text-sm text-red-600">NIN must be exactly 11 digits</p>
                  )}
                </div>

                {/* ID Upload */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Front ID */}
                  <div className="space-y-2">
                    <Label>Front of National ID *</Label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                      {identityData.frontIdFile ? (
                        <div className="space-y-2">
                          <FileText className="h-8 w-8 mx-auto text-green-600" />
                          <p className="text-sm text-green-600">{identityData.frontIdFile.name}</p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setIdentityData((prev) => ({ ...prev, frontIdFile: null }))}
                            disabled={isLoading}
                          >
                            Remove
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Upload className="h-8 w-8 mx-auto text-gray-400" />
                          <p className="text-sm text-gray-600">Upload front of ID</p>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) handleFileUpload(file, "front")
                            }}
                            className="hidden"
                            id="frontId"
                            disabled={isLoading}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => document.getElementById("frontId")?.click()}
                            disabled={isLoading}
                          >
                            Choose File
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Back ID */}
                  <div className="space-y-2">
                    <Label>Back of National ID *</Label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                      {identityData.backIdFile ? (
                        <div className="space-y-2">
                          <FileText className="h-8 w-8 mx-auto text-green-600" />
                          <p className="text-sm text-green-600">{identityData.backIdFile.name}</p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setIdentityData((prev) => ({ ...prev, backIdFile: null }))}
                            disabled={isLoading}
                          >
                            Remove
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Upload className="h-8 w-8 mx-auto text-gray-400" />
                          <p className="text-sm text-gray-600">Upload back of ID</p>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) handleFileUpload(file, "back")
                            }}
                            className="hidden"
                            id="backId"
                            disabled={isLoading}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => document.getElementById("backId")?.click()}
                            disabled={isLoading}
                          >
                            Choose File
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Email and Password */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email address"
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Password *</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Create a password (min 6 characters)"
                      value={formData.password}
                      onChange={(e) => handleInputChange("password", e.target.value)}
                      required
                      disabled={isLoading}
                      minLength={6}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8"
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={isLoading}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password *</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Confirm your password"
                      value={formData.confirmPassword}
                      onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
                      required
                      disabled={isLoading}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      disabled={isLoading}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
              disabled={isLoading || !isFormValid()}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Account...
                </>
              ) : (
                `Create ${accountType === "agency" ? "Agency" : "Freelancer"} Account`
              )}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            <span className="text-muted-foreground">Already have an account? </span>
            <Link href="/login" className="text-orange-500 hover:underline">
              Sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
