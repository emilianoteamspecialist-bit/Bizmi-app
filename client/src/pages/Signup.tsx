import type React from "react"
import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Eye, EyeOff, User, Building2, Loader2, CheckCircle, X, Sparkles, Search, ChevronRight, ChevronLeft } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { trackSignUp } from "@/lib/fbpixel"
import { ALL_SKILLS } from "@/lib/categories"
import { cn } from "@/lib/utils"
import { AuthShell, FormMessage } from "@/components/marketplace/AuthShell"

type AccountType = "freelancer" | "agency"

function handleSupabaseError(error: any): string {
  if (error.code === "PGRST116") return "Table does not exist. Please contact support."
  if (error.code === "23505") return "This email or username is already taken."
  if (error.code === "23503") return "Database constraint error. Please try again."
  if (error.code === "42501" || error.message?.includes("row-level security policy")) return "Permission denied. Please try again."
  return error.message || "An unexpected error occurred."
}

export default function Signup() {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [accountType, setAccountType] = useState<AccountType>("freelancer")
  const [currentStep, setCurrentStep] = useState(1)
  const [isLoading, setIsLoading] = useState(false)

  const [signupStatus, setSignupStatus] = useState<{ type: "success" | "error" | "info" | null; message: string }>({
    type: null,
    message: "",
  })

  const [formData, setFormData] = useState({
    fullName: "", email: "", password: "", confirmPassword: "",
    username: "", companyName: "", companySize: "", socialHandle: "",
  })

  const [selectedSkills, setSelectedSkills] = useState<string[]>([])
  const [skillSearchTerm, setSkillSearchTerm] = useState("")
  const [refCode, setRefCode] = useState<string | null>(null)

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
    if (signupStatus.type === "error") setSignupStatus({ type: null, message: "" })
  }

  const steps = accountType === "freelancer" ? ["Account type", "Details", "Skills", "Password"] : ["Account type", "Details", "Password"]

  const validateCurrentStep = () => {
    if (currentStep === 1) return true

    if (currentStep === 2) {
      if (!formData.fullName.trim()) return false
      if (!formData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) return false
      if (accountType === "freelancer" && !formData.username.trim()) return false
      if (accountType === "agency" && (!formData.companyName.trim() || !formData.companySize)) return false
      return true
    }

    if (accountType === "freelancer" && currentStep === 3) return selectedSkills.length > 0

    return formData.password.length >= 6 && formData.password === formData.confirmPassword
  }

  const handleNext = () => {
    if (validateCurrentStep()) {
      setCurrentStep((prev) => prev + 1)
      setSignupStatus({ type: null, message: "" })
    } else {
      setSignupStatus({ type: "error", message: "Fill in every field on this step to continue." })
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
        ...(accountType === "freelancer" && { username: formData.username.trim(), skills: selectedSkills }),
        ...(accountType === "agency" && { company_name: formData.companyName.trim(), company_size: formData.companySize }),
        ...(refCode ? { ref_code: refCode } : {}),
      }

      const redirectUrl = `${window.location.origin}/auth/callback`

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email.trim(),
        password: formData.password,
        options: { emailRedirectTo: redirectUrl, data: userMetadata },
      })

      if (authError) {
        let errorMessage = handleSupabaseError(authError)
        if (
          authError.message?.includes("User already registered") ||
          authError.message?.includes("email") ||
          authError.message?.includes("already") ||
          (authError as any).code === "user_already_exists"
        ) {
          errorMessage = "An account with this email already exists. Sign in instead."
        }
        setSignupStatus({ type: "error", message: errorMessage })
      } else if (authData.user) {
        trackSignUp()
        const successMessage =
          accountType === "freelancer"
            ? "Account created, with 80 free credits. Check your email and open the link to activate it."
            : "Account created. Check your email and open the link to activate it."
        setSignupStatus({ type: "success", message: successMessage })
      }
    } catch (error) {
      console.error("💥 Unexpected signup error:", error)
      setSignupStatus({ type: "error", message: "An unexpected error occurred. Please try again." })
    } finally {
      setIsLoading(false)
    }
  }

  const filteredSkills = ALL_SKILLS.filter(
    (skill) => skill.toLowerCase().includes(skillSearchTerm.toLowerCase()) && !selectedSkills.includes(skill)
  )

  const isFinalStep = currentStep === steps.length

  const accountOption = (type: AccountType, Icon: typeof User, title: string, blurb: string, extra?: React.ReactNode) => {
    const selected = accountType === type
    return (
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        onClick={() => setAccountType(type)}
        className={cn(
          "relative rounded-lg border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          selected ? "border-primary bg-primary-soft" : "border-border hover:border-foreground/30"
        )}
      >
        <span className={cn("flex h-9 w-9 items-center justify-center rounded-md", selected ? "bg-primary text-white" : "bg-surface-2 text-muted-foreground")}>
          <Icon className="h-4 w-4" />
        </span>
        <p className="mt-3 font-semibold text-foreground">{title}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{blurb}</p>
        {extra}
        {selected && <CheckCircle className="absolute right-3 top-3 h-4 w-4 text-primary" aria-hidden />}
      </button>
    )
  }

  return (
    <AuthShell
      width="wide"
      title="Create your Bizimi account"
      description="Find work or hire Nigerian freelancers, with every payment held in escrow."
      topRight={
        <>
          Have an account?{" "}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <ol className="mb-6 flex gap-2" aria-label={`Step ${currentStep} of ${steps.length}`}>
        {steps.map((step, idx) => {
          const reached = currentStep >= idx + 1
          return (
            <li key={step} className="flex-1">
              <div className={cn("h-1 rounded-full transition-colors", reached ? "bg-primary" : "bg-surface-2")} />
              <p className={cn("mt-1.5 hidden text-xs sm:block", currentStep === idx + 1 ? "font-medium text-foreground" : "text-muted-foreground")}>{step}</p>
            </li>
          )
        })}
      </ol>

      {signupStatus.type && (
        <div className="mb-5">
          <FormMessage tone={signupStatus.type}>
            <span className="inline-flex items-start gap-2">
              {signupStatus.type === "info" && <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />}
              {signupStatus.message}
            </span>
          </FormMessage>
        </div>
      )}

      <form onSubmit={handleSignUp} className="space-y-6">
        {currentStep === 1 && (
          <div>
            <StepHeading title="Choose account type" description="How do you want to use Bizimi?" />
            <div role="radiogroup" aria-label="Account type" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {accountOption(
                "freelancer",
                User,
                "Freelancer",
                "Find work and get paid through escrow.",
                <p className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-success">
                  <Sparkles className="h-3 w-3" aria-hidden /> 80 free credits to start bidding
                </p>
              )}
              {accountOption("agency", Building2, "Agency", "Post jobs and hire vetted freelancers.")}
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-4">
            <StepHeading title="Personal details" description="This is how you'll appear to others on Bizimi." />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="fullName">Full name</Label>
                <Input id="fullName" autoComplete="name" placeholder="John Doe" value={formData.fullName} onChange={(e) => handleInputChange("fullName", e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email address</Label>
                <Input id="email" type="email" autoComplete="email" placeholder="john@example.com" value={formData.email} onChange={(e) => handleInputChange("email", e.target.value)} required />
              </div>
            </div>

            {accountType === "freelancer" && (
              <div className="space-y-1.5">
                <Label htmlFor="username">Username</Label>
                <Input id="username" autoComplete="username" placeholder="johndoe_creative" value={formData.username} onChange={(e) => handleInputChange("username", e.target.value)} required />
              </div>
            )}

            {accountType === "agency" && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="companyName">Company name</Label>
                  <Input id="companyName" autoComplete="organization" placeholder="Bizimi Creative" value={formData.companyName} onChange={(e) => handleInputChange("companyName", e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="companySize">Company size</Label>
                  <select
                    id="companySize"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={formData.companySize}
                    onChange={(e) => handleInputChange("companySize", e.target.value)}
                    required
                  >
                    <option value="">Select size</option>
                    <option value="1-10">1–10 employees</option>
                    <option value="11-50">11–50 employees</option>
                    <option value="51-200">51–200 employees</option>
                    <option value="200+">200+ employees</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        )}

        {currentStep === 3 && accountType === "freelancer" && (
          <div className="space-y-3">
            <StepHeading title="Your expertise" description="Pick up to 10 skills. Agencies search and filter by these." />

            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-foreground">Selected</span>
              <span className="tabular-nums text-muted-foreground">{selectedSkills.length}/10</span>
            </div>
            <div className="flex min-h-[52px] flex-wrap gap-1.5 rounded-md border border-border bg-surface p-2.5">
              {selectedSkills.length === 0 && <span className="px-1 py-1 text-sm text-muted-foreground">No skills selected yet.</span>}
              {selectedSkills.map((skill) => (
                <span key={skill} className="inline-flex items-center gap-1 rounded-md bg-primary-soft px-2 py-1 text-xs font-medium text-primary">
                  {skill}
                  <button type="button" onClick={() => handleSkillToggle(skill)} aria-label={`Remove ${skill}`} className="hover:text-foreground">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input type="text" aria-label="Search skills" placeholder="Search skills (e.g. Web Development)" className="pl-9" value={skillSearchTerm} onChange={(e) => setSkillSearchTerm(e.target.value)} />
            </div>

            <div className="grid max-h-44 grid-cols-1 gap-1.5 overflow-y-auto rounded-md border border-border p-1.5 sm:grid-cols-2">
              {filteredSkills.slice(0, 20).map((skill) => (
                <button
                  key={skill}
                  type="button"
                  onClick={() => handleSkillToggle(skill)}
                  disabled={selectedSkills.length >= 10}
                  className="rounded px-2.5 py-2 text-left text-sm text-foreground transition-colors hover:bg-surface-2 disabled:opacity-40"
                >
                  {skill}
                </button>
              ))}
              {filteredSkills.length === 0 && <p className="col-span-full py-4 text-center text-sm text-muted-foreground">No skills match "{skillSearchTerm}".</p>}
            </div>
          </div>
        )}

        {isFinalStep && (
          <div className="space-y-4">
            <StepHeading title="Secure your account" description="Use at least 6 characters. A longer password is safer." />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <PasswordField id="password" label="Password" autoComplete="new-password" value={formData.password} onChange={(v) => handleInputChange("password", v)} shown={showPassword} onToggle={() => setShowPassword(!showPassword)} />
              <PasswordField
                id="confirmPassword"
                label="Confirm password"
                autoComplete="new-password"
                value={formData.confirmPassword}
                onChange={(v) => handleInputChange("confirmPassword", v)}
                shown={showConfirmPassword}
                onToggle={() => setShowConfirmPassword(!showConfirmPassword)}
              />
            </div>
            {formData.confirmPassword && formData.password !== formData.confirmPassword && <p className="text-sm text-destructive">The passwords don't match yet.</p>}
          </div>
        )}

        <div className="flex gap-3 border-t border-border pt-5">
          {currentStep > 1 && (
            <Button type="button" variant="outline" onClick={handleBack} disabled={isLoading || signupStatus.type === "success"}>
              <ChevronLeft /> Back
            </Button>
          )}

          {!isFinalStep ? (
            <Button type="button" onClick={handleNext} className="flex-1" disabled={!validateCurrentStep()}>
              Next step <ChevronRight />
            </Button>
          ) : (
            <Button type="submit" className="flex-1" disabled={isLoading || !validateCurrentStep() || signupStatus.type === "success"}>
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin" /> Creating account…
                </>
              ) : (
                "Create account"
              )}
            </Button>
          )}
        </div>
      </form>
    </AuthShell>
  )
}

function StepHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-4">
      <h2 className="font-heading text-lg font-semibold text-foreground">{title}</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

function PasswordField({
  id,
  label,
  autoComplete,
  value,
  onChange,
  shown,
  onToggle,
}: {
  id: string
  label: string
  autoComplete: string
  value: string
  onChange: (v: string) => void
  shown: boolean
  onToggle: () => void
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input id={id} type={shown ? "text" : "password"} autoComplete={autoComplete} className="pr-10" value={value} onChange={(e) => onChange(e.target.value)} required minLength={6} />
        <button
          type="button"
          className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:text-foreground"
          onClick={onToggle}
          aria-label={shown ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
        >
          {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  )
}
