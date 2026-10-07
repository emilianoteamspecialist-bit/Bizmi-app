import { useEffect, useRef, useState } from "react"
import { Check, Search, X } from "lucide-react"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FactList, SkillList } from "@/components/marketplace/primitives"
import { formatBudgetRange } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useCreateJobMutation, useUpdateJobMutation, type AgencyJob, type JobInput } from "@/lib/queries/jobs"
import { ALL_SKILLS } from "@/lib/categories"

const emptyForm = {
  title: "",
  description: "",
  budgetMin: "",
  budgetMax: "",
  duration: "",
  location: "",
  jobType: "",
  credits: 5,
}

const STEPS = ["Describe the job", "Skills and credits", "Budget and location", "Review"] as const

/**
 * The job composer: a four-step side sheet (brief, skills, budget, review).
 * Each step only asks for what that step needs, and Next stays disabled until
 * the step is complete. Errors show inline; nothing uses browser alerts.
 */
export default function PostJobModal({
  isOpen,
  onClose,
  editingJob,
  onSuccess,
}: {
  isOpen: boolean
  onClose: () => void
  editingJob: AgencyJob | null
  onSuccess: () => void
}) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState(emptyForm)
  const [selectedSkills, setSelectedSkills] = useState<string[]>([])
  const [skillFilter, setSkillFilter] = useState("")
  const [error, setError] = useState("")
  const idempotencyKeyRef = useRef<string | null>(null)

  const createJob = useCreateJobMutation()
  const updateJob = useUpdateJobMutation()
  const isPending = createJob.isPending || updateJob.isPending

  useEffect(() => {
    if (!isOpen) return
    if (editingJob) {
      setForm({
        title: editingJob.title,
        description: editingJob.description,
        budgetMin: editingJob.budget_min?.toString() ?? "",
        budgetMax: editingJob.budget_max?.toString() ?? "",
        duration: editingJob.duration,
        location: editingJob.location,
        jobType: editingJob.job_type,
        credits: editingJob.credit_cost,
      })
      setSelectedSkills(editingJob.skills || [])
    } else {
      setForm(emptyForm)
      setSelectedSkills([])
      idempotencyKeyRef.current = null
    }
    setSkillFilter("")
    setError("")
    setStep(1)
  }, [isOpen, editingJob])

  if (!isOpen) return null

  const toggleSkill = (skill: string, on: boolean) =>
    setSelectedSkills((prev) => (on ? (prev.includes(skill) ? prev : [...prev, skill]) : prev.filter((s) => s !== skill)))

  const budgetMin = Number(form.budgetMin)
  const budgetMax = Number(form.budgetMax)
  const budgetInverted = !!form.budgetMin && !!form.budgetMax && budgetMin > budgetMax

  const canAdvanceFromStep1 = !!form.title.trim() && !!form.description.trim() && !!form.duration.trim()
  const canAdvanceFromStep2 = selectedSkills.length > 0 && !!form.credits
  const canAdvanceFromStep3 = !!form.jobType && !!form.location.trim() && !!form.budgetMin && !!form.budgetMax && !budgetInverted
  const canAdvance = step === 1 ? canAdvanceFromStep1 : step === 2 ? canAdvanceFromStep2 : step === 3 ? canAdvanceFromStep3 : true

  const handleSubmit = () => {
    if (!idempotencyKeyRef.current) idempotencyKeyRef.current = crypto.randomUUID()
    setError("")

    const jobInput: JobInput = {
      title: form.title.trim(),
      description: form.description.trim(),
      skills: selectedSkills,
      budget_min: form.budgetMin ? Number.parseInt(form.budgetMin) : null,
      budget_max: form.budgetMax ? Number.parseInt(form.budgetMax) : null,
      duration: form.duration.trim(),
      location: form.location.trim(),
      job_type: form.jobType,
      credit_cost: form.credits,
    }

    const onDone = (result: { success: boolean; error?: string }) => {
      if (!result.success) {
        setError(`Couldn't save the job: ${result.error ?? "unknown error"}`)
        return
      }
      idempotencyKeyRef.current = null
      onSuccess()
    }
    const onError = () => setError("Couldn't save the job. Check your connection and try again.")

    if (editingJob) {
      updateJob.mutate({ jobId: editingJob.id, ...jobInput }, { onSuccess: onDone, onError })
    } else {
      createJob.mutate({ ...jobInput, idempotencyKey: idempotencyKeyRef.current }, { onSuccess: onDone, onError })
    }
  }

  const visibleSkills = skillFilter.trim() ? ALL_SKILLS.filter((s) => s.toLowerCase().includes(skillFilter.trim().toLowerCase())) : ALL_SKILLS
  const submitLabel = editingJob ? "Save changes" : "Post job"

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 bg-card p-0 sm:max-w-xl">
        <div className="border-b border-border px-5 py-5 pr-12 sm:px-6">
          <SheetTitle className="font-heading text-lg font-semibold text-foreground">{editingJob ? "Edit job post" : "Post a job"}</SheetTitle>
          <SheetDescription className="mt-0.5 text-sm text-muted-foreground">
            Step {step} of 4: {STEPS[step - 1]}
          </SheetDescription>
          <ol className="mt-4 grid grid-cols-4 gap-1.5" aria-hidden>
            {STEPS.map((label, i) => (
              <li key={label} className={cn("h-1 rounded-full", i < step ? "bg-primary" : "bg-surface-2")} />
            ))}
          </ol>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-6">
          {step === 1 && (
            <div className="space-y-5">
              <Field id="job-title" label="Job title" hint="A short, specific title gets better bids.">
                <Input
                  id="job-title"
                  placeholder="e.g. Full-Stack Developer for E-commerce Platform"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </Field>
              <Field id="job-description" label="Description" hint="What needs doing, what done looks like, and anything the freelancer needs to know.">
                <Textarea
                  id="job-description"
                  rows={8}
                  placeholder="Describe your project in detail..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </Field>
              <Field id="job-duration" label="Duration">
                <Input
                  id="job-duration"
                  placeholder="e.g. 2 weeks, 1 month, 3 months"
                  value={form.duration}
                  onChange={(e) => setForm({ ...form, duration: e.target.value })}
                />
              </Field>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <fieldset>
                <legend className="text-sm font-medium text-foreground">Skills needed</legend>
                <p className="mt-0.5 text-xs text-muted-foreground">Pick the skills a freelancer must have. {selectedSkills.length} selected.</p>
                {selectedSkills.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {selectedSkills.map((skill) => (
                      <span key={skill} className="inline-flex items-center gap-1 rounded-md bg-primary-soft px-2 py-1 text-xs font-medium text-primary">
                        {skill}
                        <button type="button" onClick={() => toggleSkill(skill, false)} aria-label={`Remove ${skill}`} className="rounded hover:text-foreground">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="relative mt-3">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <Input aria-label="Filter skills" placeholder="Filter skills" value={skillFilter} onChange={(e) => setSkillFilter(e.target.value)} className="pl-9" />
                </div>
                <div className="mt-2 max-h-72 overflow-y-auto rounded-md border border-border p-1">
                  {visibleSkills.length === 0 ? (
                    <p className="px-3 py-6 text-center text-sm text-muted-foreground">No skills match "{skillFilter}".</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2">
                      {visibleSkills.map((skill) => (
                        <label key={skill} className="flex cursor-pointer items-center gap-2 rounded px-2.5 py-2 text-sm hover:bg-surface-2">
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-primary"
                            checked={selectedSkills.includes(skill)}
                            onChange={(e) => toggleSkill(skill, e.target.checked)}
                          />
                          {skill}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </fieldset>
              <Field id="job-credits" label="Credits to apply" hint="Freelancers spend this many credits to send a bid. A higher cost means fewer, more committed bids.">
                <Select value={form.credits.toString()} onValueChange={(v) => setForm({ ...form, credits: Number.parseInt(v) })}>
                  <SelectTrigger id="job-credits" className="w-full">
                    <SelectValue placeholder="Select credits" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 credits</SelectItem>
                    <SelectItem value="10">10 credits</SelectItem>
                    <SelectItem value="15">15 credits</SelectItem>
                    <SelectItem value="20">20 credits (maximum)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <Field id="job-type" label="Work arrangement">
                <Select value={form.jobType} onValueChange={(v) => setForm({ ...form, jobType: v })}>
                  <SelectTrigger id="job-type" className="w-full">
                    <SelectValue placeholder="Select job type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Remote">Remote</SelectItem>
                    <SelectItem value="Hybrid">Hybrid</SelectItem>
                    <SelectItem value="On-site">On-site</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field id="job-location" label="Location">
                <Input id="job-location" placeholder="e.g. Lagos, Nigeria" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              </Field>
              <div>
                <div className="grid grid-cols-2 gap-3">
                  <Field id="job-budget-min" label="Minimum budget (₦)">
                    <Input id="job-budget-min" type="number" inputMode="numeric" min={0} placeholder="100000" value={form.budgetMin} onChange={(e) => setForm({ ...form, budgetMin: e.target.value })} />
                  </Field>
                  <Field id="job-budget-max" label="Maximum budget (₦)">
                    <Input id="job-budget-max" type="number" inputMode="numeric" min={0} placeholder="500000" value={form.budgetMax} onChange={(e) => setForm({ ...form, budgetMax: e.target.value })} />
                  </Field>
                </div>
                {budgetInverted ? (
                  <p role="alert" className="mt-2 text-xs text-destructive">
                    The minimum can't be more than the maximum.
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">The hired freelancer's bid is what you pay into escrow, so set a range you can fund.</p>
                )}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5">
              <div>
                <h3 className="font-heading text-base font-semibold text-foreground">{form.title}</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{form.description}</p>
              </div>
              <div>
                <p className="mb-2 text-sm font-medium text-foreground">Skills</p>
                <SkillList skills={selectedSkills} max={30} />
              </div>
              <div className="rounded-lg border border-border p-4">
                <FactList
                  items={[
                    { label: "Budget", value: formatBudgetRange(form.budgetMin, form.budgetMax) },
                    { label: "Duration", value: form.duration },
                    { label: "Arrangement", value: form.jobType },
                    { label: "Location", value: form.location },
                    { label: "Credits to apply", value: `${form.credits} credits` },
                  ]}
                />
              </div>
              <button type="button" onClick={() => setStep(1)} className="text-sm font-medium text-primary hover:underline">
                Edit details
              </button>
            </div>
          )}
        </div>

        <div className="border-t border-border px-5 py-4 sm:px-6">
          {error && (
            <p role="alert" className="mb-3 text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex justify-between gap-3">
            <Button variant="outline" onClick={() => (step > 1 ? setStep(step - 1) : onClose())}>
              {step === 1 ? "Cancel" : "Back"}
            </Button>
            <Button onClick={() => (step < 4 ? setStep(step + 1) : handleSubmit())} disabled={isPending || !canAdvance}>
              {step === 4 ? (
                isPending ? (
                  "Saving..."
                ) : (
                  <>
                    <Check /> {submitLabel}
                  </>
                )
              ) : (
                "Next"
              )}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <Label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </Label>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      <div className="mt-2">{children}</div>
    </div>
  )
}
