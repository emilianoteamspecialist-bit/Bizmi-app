import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { X } from "lucide-react"
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
    setStep(1)
  }, [isOpen, editingJob])

  if (!isOpen) return null

  const addSkill = (skill: string) => {
    if (!selectedSkills.includes(skill)) setSelectedSkills([...selectedSkills, skill])
  }
  const removeSkill = (skill: string) => setSelectedSkills(selectedSkills.filter((s) => s !== skill))

  const canAdvanceFromStep1 = !!form.title && !!form.description && !!form.duration
  const canAdvanceFromStep2 = selectedSkills.length > 0 && !!form.credits
  const canAdvanceFromStep3 = !!form.jobType && !!form.location && !!form.budgetMin && !!form.budgetMax

  const handleSubmit = () => {
    if (!idempotencyKeyRef.current) idempotencyKeyRef.current = crypto.randomUUID()

    const jobInput: JobInput = {
      title: form.title,
      description: form.description,
      skills: selectedSkills,
      budget_min: form.budgetMin ? Number.parseInt(form.budgetMin) : null,
      budget_max: form.budgetMax ? Number.parseInt(form.budgetMax) : null,
      duration: form.duration,
      location: form.location,
      job_type: form.jobType,
      credit_cost: form.credits,
    }

    const onDone = (result: { success: boolean; error?: string }) => {
      if (!result.success) {
        alert(`Error saving job: ${result.error}`)
        return
      }
      idempotencyKeyRef.current = null
      onSuccess()
    }

    if (editingJob) {
      updateJob.mutate({ jobId: editingJob.id, ...jobInput }, { onSuccess: onDone, onError: () => alert("Error saving job. Please try again.") })
    } else {
      createJob.mutate(
        { ...jobInput, idempotencyKey: idempotencyKeyRef.current },
        { onSuccess: onDone, onError: () => alert("Error saving job. Please try again.") }
      )
    }
  }

  const canAdvance = step === 1 ? canAdvanceFromStep1 : step === 2 ? canAdvanceFromStep2 : step === 3 ? canAdvanceFromStep3 : true

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50">
      <div className="fixed right-0 top-0 h-full w-full max-w-sm sm:max-w-md lg:max-w-2xl bg-card shadow-xl">
        <div className="h-full flex flex-col">
          <div className="flex items-center justify-between p-6 border-b border-border">
            <div>
              <h3 className="text-xl font-semibold text-foreground">{editingJob ? "Edit Job Post" : "Post a Job"}</h3>
              <p className="text-sm text-muted-foreground">
                Step {step} of 4 - {step === 1 ? "Job Details" : step === 2 ? "Skills & Credits" : step === 3 ? "Job Type & Budget" : "Review & Post"}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {step === 1 && (
              <div className="space-y-6">
                <div>
                  <Label className="text-sm font-medium mb-3 block">Job Title *</Label>
                  <Input
                    placeholder="e.g. Full-Stack Developer for E-commerce Platform"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium mb-3 block">Job Description *</Label>
                  <Textarea
                    rows={8}
                    placeholder="Describe your project in detail..."
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium mb-3 block">Duration *</Label>
                  <Input
                    placeholder="e.g. 2 weeks, 1 month, 3 months"
                    value={form.duration}
                    onChange={(e) => setForm({ ...form, duration: e.target.value })}
                  />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <div>
                  <Label className="text-sm font-medium mb-3 block">Required Skills *</Label>
                  <div className="border border-border rounded-lg p-4 max-h-80 overflow-y-auto">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {ALL_SKILLS.map((skill) => (
                        <label key={skill} className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-surface-2">
                          <input
                            type="checkbox"
                            checked={selectedSkills.includes(skill)}
                            onChange={(e) => (e.target.checked ? addSkill(skill) : removeSkill(skill))}
                          />
                          <span className="text-sm">{skill}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                {selectedSkills.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-3">Selected Skills ({selectedSkills.length}):</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedSkills.map((skill) => (
                        <Badge key={skill} variant="secondary">
                          {skill}
                          <button onClick={() => removeSkill(skill)} className="ml-2">
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <Label className="text-sm font-medium mb-3 block">Credits Required *</Label>
                  <Select value={form.credits.toString()} onValueChange={(v) => setForm({ ...form, credits: Number.parseInt(v) })}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select credits" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 Credits</SelectItem>
                      <SelectItem value="10">10 Credits</SelectItem>
                      <SelectItem value="15">15 Credits</SelectItem>
                      <SelectItem value="20">20 Credits (Maximum)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6">
                <div>
                  <Label className="text-sm font-medium mb-3 block">Job Type *</Label>
                  <Select value={form.jobType} onValueChange={(v) => setForm({ ...form, jobType: v })}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select job type" />
                    </SelectTrigger>
                    <SelectContent position="item-aligned">
                      <SelectItem value="Remote">Remote</SelectItem>
                      <SelectItem value="Hybrid">Hybrid</SelectItem>
                      <SelectItem value="On-site">On-site</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium mb-3 block">Location *</Label>
                  <Input placeholder="e.g. Lagos, Nigeria" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium mb-3 block">Min Budget (₦) *</Label>
                    <Input type="number" placeholder="100000" value={form.budgetMin} onChange={(e) => setForm({ ...form, budgetMin: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-sm font-medium mb-3 block">Max Budget (₦) *</Label>
                    <Input type="number" placeholder="500000" value={form.budgetMax} onChange={(e) => setForm({ ...form, budgetMax: e.target.value })} />
                  </div>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-6">
                <div className="bg-surface-2 p-6 rounded-lg border border-border">
                  <h4 className="font-semibold mb-4">Job Preview</h4>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">Title</p>
                      <p className="font-semibold">{form.title}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">Description</p>
                      <p className="text-sm whitespace-pre-wrap">{form.description}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-2">Required Skills ({selectedSkills.length})</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedSkills.map((skill) => (
                          <Badge key={skill} variant="outline" className="text-xs">
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-1">Budget Range</p>
                        <p className="font-semibold">
                          ₦ {Number.parseInt(form.budgetMin || "0").toLocaleString()} - ₦ {Number.parseInt(form.budgetMax || "0").toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-1">Duration</p>
                        <p className="font-semibold">{form.duration}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-1">Job Type</p>
                        <p className="font-semibold">{form.jobType}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-1">Location</p>
                        <p className="font-semibold">{form.location}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">Credits Required</p>
                      <p className="font-semibold">{form.credits} Credits</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-border p-6">
            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={() => (step > 1 ? setStep(step - 1) : onClose())}
              >
                {step === 1 ? "Cancel" : "Back"}
              </Button>
              <Button
                onClick={() => (step < 4 ? setStep(step + 1) : handleSubmit())}
                disabled={isPending || !canAdvance}
              >
                {step === 4 ? (isPending ? "Posting..." : "Post Job") : "Next"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
