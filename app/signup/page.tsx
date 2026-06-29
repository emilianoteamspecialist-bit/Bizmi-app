"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Eye, EyeOff, User, Building2, Megaphone, Loader2, CheckCircle, AlertCircle, X, ArrowLeft, ShieldCheck, Sparkles, Search, ChevronRight, ChevronLeft } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { supabase, handleSupabaseError } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import { trackSignUp } from "@/lib/fbpixel"
import { ALL_SKILLS } from "@/lib/categories"

type AccountType = "freelancer" | "agency" | "influencer"

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
    socialHandle: "",
  })

  const [selectedSkills, setSelectedSkills] = useState<string[]>([])
  const [skillSearchTerm, setSkillSearchTerm] = useState("")
  // Referral attribution: capture ?ref=CODE and keep it through the multi-step
  // flow (sessionStorage) so it survives navigation; it's sent in the sign-up
  // metadata and applied once the user first lands authenticated.
  const [refCode, setRefCode] = useState<string | null>(null)

  const router = useRouter()

  useEffect(() => {
    try {
      const fromUrl = new URLSearchParams(window.location.search).get("ref")
      const stored = sessionStorage.getItem("bizimi_ref")
      const code = (fromUrl || stored || "").trim()
      if (code) {
        setRefCode(code)
        sessionStorage.setItem("bizimi_ref", code)
      }
    } catch {
      /* sessionStorage / URL unavailable */
    }
  }, [])

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
        ...(accountType === "influencer" && {
          social_handle: formData.socialHandle.trim(),
        }),
        // Referral attribution applied once the user first lands authenticated.
        ...(refCode ? { ref_code: refCode } : {}),
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

  const filteredSkills = ALL_SKILLS.filter(
    (skill) => skill.toLowerCase().includes(skillSearchTerm.toLowerCase()) && !selectedSkills.includes(skill),
  )

  const isFinalStep = currentStep === steps.length

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-surface p-4 py-12 sm:py-16 selection:bg-primary/20 selection:text-primary">
      <Link
        href="/"
        className="fixed top-6 left-6 z-50 flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to home
      </Link>

      <div className="w-full max-w-3xl space-y-6">
        <div className="space-y-2 text-center">
          <Link href="/" className="inline-flex items-center justify-center">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl">
              <Image src="/favicon.ico" alt="Bizimi Logo" width={48} height={48} className="h-full w-full object-contain" />
            </div>
          </Link>
          <h1 className="pt-2 text-3xl font-semibold tracking-tight text-foreground">Start your journey</h1>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            Join the most secure marketplace for high-impact Nigerian talent.
          </p>
        </div>

        <Card className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          <CardHeader className="px-6 sm:px-8 pt-8 pb-0">
            {/* Stepper */}
            <div className="flex gap-2 mb-7">
              {steps.map((step, idx) => {
                const isActive = currentStep >= idx + 1
                return (
                  <div key={step} className="flex-1">
                    <div className={`h-1.5 rounded-full transition-colors duration-300 ${isActive ? "bg-primary" : "bg-surface-2"}`} />
                    <p className={`mt-2 text-[10px] font-semibold uppercase tracking-wider transition-colors duration-300 ${isActive ? "text-primary" : "text-muted-foreground"}`}>
                      {step}
                    </p>
                  </div>
                )
              })}
            </div>

            {signupStatus.type && (
              <div
                className={`mb-6 flex items-start gap-3 rounded-xl border p-3.5 text-left ${
                  signupStatus.type === "success"
                    ? "bg-success/10 border-success/20 text-success"
                    : signupStatus.type === "error"
                      ? "bg-destructive/10 border-destructive/20 text-destructive"
                      : "bg-primary/10 border-primary/20 text-primary"
                }`}
              >
                {signupStatus.type === "success" && <CheckCircle className="h-5 w-5 flex-shrink-0" />}
                {signupStatus.type === "error" && <AlertCircle className="h-5 w-5 flex-shrink-0" />}
                {signupStatus.type === "info" && <Loader2 className="h-5 w-5 flex-shrink-0 animate-spin" />}
                <p className="text-sm font-medium leading-snug">{signupStatus.message}</p>
              </div>
            )}
          </CardHeader>

          <CardContent className="px-6 sm:px-8 py-8">
            <form onSubmit={handleSignUp} className="space-y-8">
              {/* STEP 1: Account Type */}
              {currentStep === 1 && (
                <div className="space-y-4">
                  <div className="space-y-1 mb-5">
                    <h2 className="text-xl font-semibold text-foreground">Choose account type</h2>
                    <p className="text-sm text-muted-foreground">How do you want to use Bizimi?</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => setAccountType("freelancer")}
                      className={`relative p-5 rounded-xl border text-left transition-all ${
                        accountType === "freelancer" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                      }`}
                    >
                      <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl ${
                        accountType === "freelancer" ? "bg-primary text-white" : "bg-surface-2 text-muted-foreground"
                      }`}>
                        <User className="h-5 w-5" />
                      </div>
                      <p className="font-semibold text-foreground">Freelancer</p>
                      <p className="mt-1 text-xs text-muted-foreground">I want to work and earn.</p>
                      {accountType === "freelancer" && (
                        <div className="absolute top-3.5 right-3.5 rounded-full bg-primary p-1 text-white">
                          <CheckCircle className="h-3 w-3" />
                        </div>
                      )}
                      <div className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-success/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-success">
                        <Sparkles className="h-3 w-3" />
                        80 Free Credits
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAccountType("agency")}
                      className={`relative p-5 rounded-xl border text-left transition-all ${
                        accountType === "agency" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                      }`}
                    >
                      <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl ${
                        accountType === "agency" ? "bg-primary text-white" : "bg-surface-2 text-muted-foreground"
                      }`}>
                        <Building2 className="h-5 w-5" />
                      </div>
                      <p className="font-semibold text-foreground">Agency</p>
                      <p className="mt-1 text-xs text-muted-foreground">I want to hire talent.</p>
                      {accountType === "agency" && (
                        <div className="absolute top-3.5 right-3.5 rounded-full bg-primary p-1 text-white">
                          <CheckCircle className="h-3 w-3" />
                        </div>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAccountType("influencer")}
                      className={`relative p-5 rounded-xl border text-left transition-all ${
                        accountType === "influencer" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                      }`}
                    >
                      <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl ${
                        accountType === "influencer" ? "bg-primary text-white" : "bg-surface-2 text-muted-foreground"
                      }`}>
                        <Megaphone className="h-5 w-5" />
                      </div>
                      <p className="font-semibold text-foreground">Influencer</p>
                      <p className="mt-1 text-xs text-muted-foreground">I want to promote and earn.</p>
                      {accountType === "influencer" && (
                        <div className="absolute top-3.5 right-3.5 rounded-full bg-primary p-1 text-white">
                          <CheckCircle className="h-3 w-3" />
                        </div>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2: Details */}
              {currentStep === 2 && (
                <div className="space-y-4">
                  <div className="space-y-1 mb-5">
                    <h2 className="text-xl font-semibold text-foreground">Personal details</h2>
                    <p className="text-sm text-muted-foreground">Tell us a bit about yourself.</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="fullName" className="text-sm font-medium text-foreground">Full name</Label>
                      <Input id="fullName" placeholder="John Doe" className="h-11" value={formData.fullName} onChange={(e) => handleInputChange("fullName", e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-sm font-medium text-foreground">Email address</Label>
                      <Input id="email" type="email" placeholder="john@example.com" className="h-11" value={formData.email} onChange={(e) => handleInputChange("email", e.target.value)} required />
                    </div>
                  </div>

                  {accountType === "freelancer" && (
                    <div className="space-y-2">
                      <Label htmlFor="username" className="text-sm font-medium text-foreground">Username</Label>
                      <Input id="username" placeholder="johndoe_creative" className="h-11" value={formData.username} onChange={(e) => handleInputChange("username", e.target.value)} required />
                    </div>
                  )}

                  {accountType === "agency" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="companyName" className="text-sm font-medium text-foreground">Company name</Label>
                        <Input id="companyName" placeholder="Bizimi Creative" className="h-11" value={formData.companyName} onChange={(e) => handleInputChange("companyName", e.target.value)} required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="companySize" className="text-sm font-medium text-foreground">Company size</Label>
                        <select
                          id="companySize"
                          className="h-11 w-full rounded-md border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
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

                  {accountType === "influencer" && (
                    <div className="space-y-2">
                      <Label htmlFor="socialHandle" className="text-sm font-medium text-foreground">
                        Social handle <span className="font-normal text-muted-foreground">(optional)</span>
                      </Label>
                      <Input id="socialHandle" placeholder="@yourhandle" className="h-11" value={formData.socialHandle} onChange={(e) => handleInputChange("socialHandle", e.target.value)} />
                    </div>
                  )}
                </div>
              )}

              {/* STEP 3: Skills (Freelancer Only) */}
              {currentStep === 3 && accountType === "freelancer" && (
                <div className="space-y-4">
                  <div className="space-y-1 mb-5">
                    <h2 className="text-xl font-semibold text-foreground">Your expertise</h2>
                    <p className="text-sm text-muted-foreground">Select up to 10 skills that define your work.</p>
                  </div>

                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Selected skills</Label>
                    <span className="text-xs font-semibold text-primary tabular-nums">{selectedSkills.length}/10</span>
                  </div>

                  <div className="flex min-h-[60px] flex-wrap gap-2 rounded-xl border border-border bg-surface-2 p-3">
                    {selectedSkills.length === 0 && <span className="m-2 text-xs italic text-muted-foreground">No skills selected yet.</span>}
                    {selectedSkills.map((skill) => (
                      <span key={skill} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground">
                        {skill}
                        <button type="button" onClick={() => handleSkillToggle(skill)} className="text-muted-foreground transition-colors hover:text-destructive">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>

                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input type="text" placeholder="Search skills (e.g. Web Development)" className="h-11 pl-10" value={skillSearchTerm} onChange={(e) => setSkillSearchTerm(e.target.value)} />
                  </div>

                  <div className="grid max-h-[160px] grid-cols-2 gap-2 overflow-y-auto rounded-xl border border-border bg-surface-2/60 p-2">
                    {filteredSkills.slice(0, 20).map((skill) => (
                      <button
                        key={skill}
                        type="button"
                        onClick={() => handleSkillToggle(skill)}
                        disabled={selectedSkills.length >= 10}
                        className="rounded-lg border border-border bg-card px-3 py-2 text-left text-xs font-medium transition-all hover:border-primary hover:text-primary disabled:opacity-40"
                      >
                        {skill}
                      </button>
                    ))}
                    {filteredSkills.length === 0 && (
                      <p className="col-span-2 py-4 text-center text-xs italic text-muted-foreground">No skills found matching your search</p>
                    )}
                  </div>
                </div>
              )}

              {/* FINAL STEP: Security */}
              {isFinalStep && (
                <div className="space-y-4">
                  <div className="space-y-1 mb-5">
                    <h2 className="text-xl font-semibold text-foreground">Secure your account</h2>
                    <p className="text-sm text-muted-foreground">Choose a strong password to protect your data.</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="password" className="text-sm font-medium text-foreground">Password</Label>
                      <div className="relative">
                        <Input id="password" type={showPassword ? "text" : "password"} className="h-11 pr-11" value={formData.password} onChange={(e) => handleInputChange("password", e.target.value)} required minLength={6} />
                        <button type="button" className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowPassword(!showPassword)}>
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">Confirm password</Label>
                      <div className="relative">
                        <Input id="confirmPassword" type={showConfirmPassword ? "text" : "password"} className="h-11 pr-11" value={formData.confirmPassword} onChange={(e) => handleInputChange("confirmPassword", e.target.value)} required />
                        <button type="button" className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                          {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation */}
              <div className="flex gap-3 border-t border-border pt-5 mt-6">
                {currentStep > 1 && (
                  <Button type="button" variant="outline" onClick={handleBack} className="h-12 rounded-xl px-5 font-medium" disabled={isLoading || signupStatus.type === "success"}>
                    <ChevronLeft className="mr-1 h-4 w-4" /> Back
                  </Button>
                )}

                {!isFinalStep ? (
                  <Button
                    type="button"
                    onClick={handleNext}
                    className="h-12 flex-1 rounded-xl bg-foreground text-base font-semibold text-background hover:bg-foreground/90"
                    disabled={!validateCurrentStep()}
                  >
                    Next step <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    className="h-12 flex-1 rounded-xl bg-primary text-base font-semibold hover:bg-primary-hover"
                    disabled={isLoading || !validateCurrentStep() || signupStatus.type === "success"}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Processing…
                      </>
                    ) : (
                      "Complete signup"
                    )}
                  </Button>
                )}
              </div>
            </form>

            <div className="mt-7 text-center">
              <p className="text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link href="/login" className="font-medium text-primary hover:underline underline-offset-4">
                  Sign in instead
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-center gap-2 pb-10 text-muted-foreground">
          <ShieldCheck className="h-4 w-4" />
          <span className="text-xs font-medium uppercase tracking-wide">Secure platform certification</span>
        </div>
      </div>
    </div>
  )
}
