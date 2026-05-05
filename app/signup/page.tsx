"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Eye, EyeOff, User, Building2, Loader2, CheckCircle, AlertCircle, X, ArrowLeft, ShieldCheck, Sparkles, Search, ChevronRight, ChevronLeft } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { supabase, handleSupabaseError } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import { trackSignUp } from "@/lib/fbpixel"
import { ALL_SKILLS } from "@/lib/categories"

type AccountType = "freelancer" | "agency"

export default function SignUpPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [accountType, setAccountType] = useState<AccountType>("freelancer")
  const [currentStep, setCurrentStep] = useState(1)
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

  const router = useRouter()

  const handleSkillToggle = (skill: string) => {
    if (selectedSkills.includes(skill)) {
      setSelectedSkills(selectedSkills.filter((s) => s !== skill))
    } else if (selectedSkills.length < 10) {
      setSelectedSkills([...selectedSkills, skill])
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (signupStatus.type === "error") {
      setSignupStatus({ type: null, message: "" })
    }
  }

  const steps = accountType === "freelancer" 
    ? ["Account Type", "Details", "Skills", "Security"]
    : ["Account Type", "Details", "Security"]

  const validateCurrentStep = () => {
    if (currentStep === 1) return true

    if (currentStep === 2) {
      if (!formData.fullName.trim()) return false
      if (!formData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) return false
      if (accountType === "freelancer" && !formData.username.trim()) return false
      if (accountType === "agency" && (!formData.companyName.trim() || !formData.companySize)) return false
      return true
    }

    if (accountType === "freelancer" && currentStep === 3) {
      return selectedSkills.length > 0
    }

    // Security step validation (Step 4 for freelancer, Step 3 for agency)
    return formData.password.length >= 6 && formData.password === formData.confirmPassword
  }

  const handleNext = () => {
    if (validateCurrentStep()) {
      setCurrentStep((prev) => prev + 1)
      setSignupStatus({ type: null, message: "" })
    } else {
      setSignupStatus({ type: "error", message: "Please complete all required fields correctly." })
    }
  }

  const handleBack = () => {
    setCurrentStep((prev) => prev - 1)
    setSignupStatus({ type: null, message: "" })
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateCurrentStep()) {
      setSignupStatus({ type: "error", message: "Please ensure your passwords match and are at least 6 characters." })
      return
    }

    setIsLoading(true)
    setSignupStatus({ type: "info", message: "Creating your account..." })

    try {
      const userMetadata = {
        full_name: formData.fullName.trim(),
        account_type: accountType,
        ...(accountType === "freelancer" && {
          username: formData.username.trim(),
          skills: selectedSkills,
        }),
        ...(accountType === "agency" && {
          company_name: formData.companyName.trim(),
          company_size: formData.companySize,
        }),
      }

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
        let errorMessage = handleSupabaseError(authError)
        if (
          authError.message?.includes("User already registered") ||
          authError.message?.includes("email") ||
          authError.message?.includes("already") ||
          authError.code === "user_already_exists"
        ) {
          errorMessage = "Sorry, email already registered"
        }
        setSignupStatus({ type: "error", message: errorMessage })
      } else if (authData.user) {
        trackSignUp()
        const successMessage = accountType === "freelancer" 
          ? "🎉 Account created successfully! You've received 80 free credits! Please check your email to activate."
          : "✅ Account created successfully! Please check your email to activate your account."
        
        setSignupStatus({ type: "success", message: successMessage })
      }
    } catch (error) {
      console.error("💥 Unexpected signup error:", error)
      setSignupStatus({
        type: "error",
        message: "An unexpected error occurred. Please try again.",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const filteredSkills = AVAILABLE_SKILLS.filter(
    (skill) => skill.toLowerCase().includes(skillSearchTerm.toLowerCase()) && !selectedSkills.includes(skill),
  )

  const isFinalStep = currentStep === steps.length

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4 selection:bg-orange-100 selection:text-orange-900 py-20">
      <Link 
        href="/" 
        className="fixed top-8 left-8 flex items-center text-sm font-bold text-slate-500 hover:text-primary transition-colors z-50"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Home
      </Link>

      <div className="w-full max-w-[640px] space-y-8">
        <div className="text-center space-y-2">
          <Link href="/" className="inline-flex items-center space-x-2 group">
            <div className="w-12 h-12 flex items-center justify-center overflow-hidden rounded-2xl">
              <Image src="/favicon.ico" alt="Bizimi Logo" width={48} height={48} className="w-full h-full object-contain" />
            </div>
          </Link>
          <h1 className="text-primaryxl font-black tracking-tight text-slate-900 pt-4">Start Your Journey</h1>
          <p className="text-slate-500 font-medium max-w-sm mx-auto">Join the most secure marketplace for high-impact Nigerian talent.</p>
        </div>

        <Card className="border-slate-200 shadow-2xl shadow-slate-200/50 rounded-[2rem] overflow-hidden bg-white">
          <CardHeader className="px-8 pt-10 pb-0 border-b border-slate-50">
            {/* Stepper Progress */}
            <div className="flex gap-2 mb-8">
              {steps.map((step, idx) => {
                const isActive = currentStep >= idx + 1
                return (
                  <div key={step} className="flex-1">
                    <div className={`h-2 rounded-full transition-colors duration-300 ${isActive ? 'bg-primary' : 'bg-slate-100'}`} />
                    <p className={`text-[10px] mt-2 font-black uppercase tracking-widest transition-colors duration-300 ${isActive ? 'text-primary' : 'text-slate-300'}`}>
                      {step}
                    </p>
                  </div>
                )
              })}
            </div>

            {signupStatus.type && (
              <div className={`rounded-2xl p-4 flex items-start gap-3 mb-6 text-left border ${
                signupStatus.type === "success" ? "bg-green-50 border-green-100 text-green-800" :
                signupStatus.type === "error" ? "bg-red-50 border-red-100 text-red-800" :
                "bg-blue-50 border-blue-100 text-blue-800"
              }`}>
                {signupStatus.type === "success" && <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />}
                {signupStatus.type === "error" && <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />}
                {signupStatus.type === "info" && <Loader2 className="h-5 w-5 text-blue-500 animate-spin flex-shrink-0" />}
                <p className="text-sm font-bold leading-snug">{signupStatus.message}</p>
              </div>
            )}
          </CardHeader>

          <CardContent className="px-8 py-8">
            <form onSubmit={handleSignUp} className="space-y-8">
              
              {/* STEP 1: Account Type */}
              {currentStep === 1 && (
                <div className="space-y-4">
                  <div className="space-y-1 mb-6">
                     <h2 className="text-2xl font-black text-slate-900">Choose Account Type</h2>
                     <p className="text-slate-500 font-medium text-sm">How do you want to use Bizimi?</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setAccountType("freelancer")}
                      className={`relative p-6 rounded-2xl border-2 text-left transition-all ${
                        accountType === "freelancer" ? "border-primary bg-primary/10/50" : "border-slate-100 hover:border-orange-200"
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${
                        accountType === "freelancer" ? "bg-primary text-white" : "bg-slate-100 text-slate-500"
                      }`}>
                        <User className="h-5 w-5" />
                      </div>
                      <p className="font-black text-slate-900">Freelancer</p>
                      <p className="text-xs text-slate-500 font-medium mt-1">I want to work and earn.</p>
                      {accountType === "freelancer" && (
                        <div className="absolute top-4 right-4 bg-green-500 text-white p-1 rounded-full">
                          <CheckCircle className="h-3 w-3" />
                        </div>
                      )}
                      <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-100 text-green-700 rounded-lg text-[10px] font-black uppercase tracking-wider">
                        <Sparkles className="h-3 w-3" />
                        80 Free Credits
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAccountType("agency")}
                      className={`relative p-6 rounded-2xl border-2 text-left transition-all ${
                        accountType === "agency" ? "border-primary bg-primary/10/50" : "border-slate-100 hover:border-orange-200"
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${
                        accountType === "agency" ? "bg-primary text-white" : "bg-slate-100 text-slate-500"
                      }`}>
                        <Building2 className="h-5 w-5" />
                      </div>
                      <p className="font-black text-slate-900">Agency</p>
                      <p className="text-xs text-slate-500 font-medium mt-1">I want to hire talent.</p>
                      {accountType === "agency" && (
                        <div className="absolute top-4 right-4 bg-green-500 text-white p-1 rounded-full">
                          <CheckCircle className="h-3 w-3" />
                        </div>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2: Basic Info */}
              {currentStep === 2 && (
                <div className="space-y-4">
                  <div className="space-y-1 mb-6">
                     <h2 className="text-2xl font-black text-slate-900">Personal Details</h2>
                     <p className="text-slate-500 font-medium text-sm">Tell us a bit about yourself.</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="fullName" className="text-sm font-bold text-slate-700">Full Name</Label>
                      <Input
                        id="fullName"
                        placeholder="John Doe"
                        className="h-12 border-slate-200 rounded-xl focus:ring-primary focus:border-primary"
                        value={formData.fullName}
                        onChange={(e) => handleInputChange("fullName", e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-sm font-bold text-slate-700">Email Address</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="john@example.com"
                        className="h-12 border-slate-200 rounded-xl focus:ring-primary focus:border-primary"
                        value={formData.email}
                        onChange={(e) => handleInputChange("email", e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  {accountType === "freelancer" && (
                    <div className="space-y-2">
                      <Label htmlFor="username" className="text-sm font-bold text-slate-700">Username</Label>
                      <Input
                        id="username"
                        placeholder="johndoe_creative"
                        className="h-12 border-slate-200 rounded-xl focus:ring-primary focus:border-primary"
                        value={formData.username}
                        onChange={(e) => handleInputChange("username", e.target.value)}
                        required
                      />
                    </div>
                  )}

                  {accountType === "agency" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="companyName" className="text-sm font-bold text-slate-700">Company Name</Label>
                        <Input
                          id="companyName"
                          placeholder="Bizimi Creative"
                          className="h-12 border-slate-200 rounded-xl focus:ring-primary focus:border-primary"
                          value={formData.companyName}
                          onChange={(e) => handleInputChange("companyName", e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="companySize" className="text-sm font-bold text-slate-700">Company Size</Label>
                        <select
                          id="companySize"
                          className="w-full h-12 px-4 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                          value={formData.companySize}
                          onChange={(e) => handleInputChange("companySize", e.target.value)}
                          required
                        >
                          <option value="">Select size</option>
                          <option value="1-10">1-10 Employees</option>
                          <option value="11-50">11-50 Employees</option>
                          <option value="51-200">51-200 Employees</option>
                          <option value="200+">200+ Employees</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 3: Skills (Freelancer Only) */}
              {currentStep === 3 && accountType === "freelancer" && (
                <div className="space-y-4">
                  <div className="space-y-1 mb-6">
                     <h2 className="text-2xl font-black text-slate-900">Your Expertise</h2>
                     <p className="text-slate-500 font-medium text-sm">Select up to 10 skills that define your work.</p>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-black uppercase tracking-widest text-slate-400">Selected Skills</Label>
                    <span className="text-xs font-bold text-primary">{selectedSkills.length}/10</span>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-100 min-h-[60px]">
                    {selectedSkills.length === 0 && <span className="text-xs text-slate-400 font-medium m-2 italic">No skills selected yet.</span>}
                    {selectedSkills.map((skill) => (
                      <span
                        key={skill}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-900 rounded-lg text-xs font-bold shadow-sm"
                      >
                        {skill}
                        <button
                          type="button"
                          onClick={() => handleSkillToggle(skill)}
                          className="text-slate-400 hover:text-red-500 transition-colors"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>

                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      type="text"
                      placeholder="Search skills (e.g. Web Development)"
                      className="h-12 pl-11 border-slate-200 rounded-xl"
                      value={skillSearchTerm}
                      onChange={(e) => setSkillSearchTerm(e.target.value)}
                    />
                  </div>

                  <div className="max-h-[160px] overflow-y-auto p-2 bg-slate-50/50 rounded-2xl border border-slate-100 grid grid-cols-2 gap-2">
                    {filteredSkills.slice(0, 20).map((skill) => (
                      <button
                        key={skill}
                        type="button"
                        onClick={() => handleSkillToggle(skill)}
                        disabled={selectedSkills.length >= 10}
                        className="text-left px-3 py-2 text-xs font-bold bg-white border border-slate-100 rounded-lg hover:border-primary hover:text-primary transition-all disabled:opacity-30"
                      >
                        {skill}
                      </button>
                    ))}
                    {filteredSkills.length === 0 && (
                      <p className="col-span-2 text-center py-4 text-xs font-medium text-slate-400 italic">No skills found matching your search</p>
                    )}
                  </div>
                </div>
              )}

              {/* FINAL STEP: Security */}
              {isFinalStep && (
                <div className="space-y-4">
                  <div className="space-y-1 mb-6">
                     <h2 className="text-2xl font-black text-slate-900">Secure Your Account</h2>
                     <p className="text-slate-500 font-medium text-sm">Choose a strong password to protect your data.</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="password text-sm font-bold text-slate-700">Password</Label>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          className="h-12 border-slate-200 rounded-xl pr-12"
                          value={formData.password}
                          onChange={(e) => handleInputChange("password", e.target.value)}
                          required
                          minLength={6}
                        />
                        <button
                          type="button"
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword" className="text-sm font-bold text-slate-700">Confirm Password</Label>
                      <div className="relative">
                        <Input
                          id="confirmPassword"
                          type={showConfirmPassword ? "text" : "password"}
                          className="h-12 border-slate-200 rounded-xl pr-12"
                          value={formData.confirmPassword}
                          onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
                          required
                        />
                        <button
                          type="button"
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        >
                          {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="flex gap-4 pt-4 mt-8 border-t border-slate-50">
                {currentStep > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleBack}
                    className="h-14 px-6 rounded-2xl font-bold border-slate-200"
                    disabled={isLoading || signupStatus.type === 'success'}
                  >
                    <ChevronLeft className="w-5 h-5 mr-1" /> Back
                  </Button>
                )}
                
                {!isFinalStep ? (
                  <Button
                    type="button"
                    onClick={handleNext}
                    className="flex-1 bg-slate-900 hover:bg-slate-800 h-14 rounded-2xl text-lg font-black text-white shadow-xl shadow-slate-900/20"
                    disabled={!validateCurrentStep()}
                  >
                    Next Step <ChevronRight className="w-5 h-5 ml-1" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    className="flex-1 bg-primary hover:bg-primary-hover h-14 rounded-2xl text-lg font-black shadow-xl shadow-primary/25"
                    disabled={isLoading || !validateCurrentStep() || signupStatus.type === 'success'}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      `Complete Signup`
                    )}
                  </Button>
                )}
              </div>
            </form>

            <div className="mt-8 text-center">
              <p className="text-sm font-medium text-slate-500">
                Already have an account?{" "}
                <Link href="/login" className="text-primary font-bold hover:underline underline-offset-4">
                  Sign in instead
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Security Trust Footer */}
        <div className="flex items-center justify-center gap-2 text-slate-400 pb-10">
          <ShieldCheck className="h-4 w-4" />
          <span className="text-xs font-bold uppercase tracking-widest">Secure Platform Certification</span>
        </div>
      </div>
    </div>
  )
}
