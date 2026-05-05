"use client"

import { useEffect, useState, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { 
  CheckCircle, 
  Send, 
  Github, 
  ExternalLink, 
  FileText, 
  Layout, 
  MessageSquare, 
  History,
  AlertCircle,
  Loader2,
  Lock
} from "lucide-react"

interface Submission {
  id: string
  job_id: string
  freelancer_id: string
  agency_id: string
  submission_type: string
  content: any
  status: string
  submitted_at: string
  freelancer?: { full_name: string }
  agency?: { full_name: string }
}

interface Comment {
  id: string
  sender_id: string
  message: string
  created_at: string
  sender?: { full_name: string }
}

export default function ProjectWorkspace() {
  const params = useParams()
  const router = useRouter()
  const jobId = params.job_id as string

  const [job, setJob] = useState<any>(null)
  const [submission, setSubmission] = useState<Submission | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isAgency, setIsAgency] = useState(false)
  
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [newComment, setNewComment] = useState("")
  
  // Submission Form State
  const [subType, setSubType] = useState("general")
  const [formContent, setFormContent] = useState({
    github_url: "",
    figma_url: "",
    drive_link: "",
    notes: "",
    links: [] as string[]
  })

  useEffect(() => {
    checkAuthAndLoad()
  }, [jobId])

  const checkAuthAndLoad = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }
      
      const uid = session.user.id
      setCurrentUserId(uid)

      // Load Job
      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .select('*, agency:profiles!jobs_agency_id_fkey(full_name)')
        .eq('id', jobId)
        .single()
      
      if (jobError) throw jobError
      setJob(jobData)
      setIsAgency(jobData.agency_id === uid)

      // Load Submission
      await loadSubmissionData()
    } catch (error) {
      console.error("Error loading workspace:", error)
    } finally {
      setLoading(false)
    }
  }

  const loadSubmissionData = async () => {
    const res = await fetch(`/api/submissions?jobId=${jobId}`)
    const data = await res.json()
    if (data.submission) {
      setSubmission(data.submission)
      setSubType(data.submission.submission_type)
      setFormContent(data.submission.content)
      loadComments(data.submission.id)
    }
  }

  const loadComments = async (subId: string) => {
    const res = await fetch(`/api/submissions/${subId}/comment`)
    const data = await res.json()
    setComments(data.comments || [])
  }

  const handleSubmitProject = async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      const { data: proposal } = await supabase
        .from('proposals')
        .select('freelancer_id')
        .eq('job_id', jobId)
        .eq('status', 'accepted')
        .single();

      const res = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: jobId,
          freelancer_id: currentUserId,
          agency_id: job.agency_id,
          submission_type: subType,
          content: formContent
        })
      })

      if (!res.ok) throw new Error("Submission failed")
      
      alert("Project submitted for approval!")
      await loadSubmissionData()
    } catch (error) {
      console.error(error)
      alert("Failed to submit project")
    } finally {
      setSubmitting(false)
    }
  }

  const handleApprove = async () => {
    if (!submission || !confirm("Are you sure you want to approve this project? This will release the funds from escrow.")) return
    
    try {
      const res = await fetch(`/api/submissions/${submission.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: jobId })
      })

      if (!res.ok) throw new Error("Approval failed")
      
      alert("Project approved successfully! Funds have been released.")
      router.refresh()
      await loadSubmissionData()
    } catch (error) {
      console.error(error)
      alert("Failed to approve project")
    }
  }

  const handlePostComment = async (isRevision = false) => {
    if (!newComment.trim() || !submission) return
    
    try {
      const res = await fetch(`/api/submissions/${submission.id}/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender_id: currentUserId,
          message: newComment.trim(),
          is_revision_request: isRevision
        })
      })

      if (!res.ok) throw new Error("Comment failed")
      
      setNewComment("")
      loadComments(submission.id)
      if (isRevision) {
        alert("Revision requested.")
        loadSubmissionData()
      }
    } catch (error) {
      console.error(error)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'submitted': return <Badge className="bg-blue-500">Pending Review</Badge>
      case 'changes_requested': return <Badge variant="destructive">Changes Requested</Badge>
      case 'approved': return <Badge className="bg-green-500">Approved & Released</Badge>
      default: return <Badge variant="outline">Not Submitted</Badge>
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin mr-2"/> Loading Workspace...</div>

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Main Workspace Column */}
        <div className="lg:col-span-2 space-y-6">
          <header className="flex justify-between items-start mb-2">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">{job?.title}</h1>
              <p className="text-slate-500 mt-1">Agency: {job?.agency?.full_name}</p>
            </div>
            {submission && getStatusBadge(submission.status)}
          </header>

          <Card className="border-orange-200">
            <CardHeader className="bg-primary/10/50">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Project Submission
              </CardTitle>
              <CardDescription>
                Deliver your work here. Choose the tab that fits your project type.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <Tabs value={subType} onValueChange={setSubType}>
                <TabsList className="grid w-full grid-cols-4 mb-6">
                  <TabsTrigger value="tech" disabled={isAgency || submission?.status === 'approved'}><Github className="w-4 h-4 mr-2"/> Tech</TabsTrigger>
                  <TabsTrigger value="design" disabled={isAgency || submission?.status === 'approved'}><Layout className="w-4 h-4 mr-2"/> Design</TabsTrigger>
                  <TabsTrigger value="writing" disabled={isAgency || submission?.status === 'approved'}><FileText className="w-4 h-4 mr-2"/> Writing</TabsTrigger>
                  <TabsTrigger value="general" disabled={isAgency || submission?.status === 'approved'}><History className="w-4 h-4 mr-2"/> General</TabsTrigger>
                </TabsList>

                {/* TECH TAB */}
                <TabsContent value="tech" className="space-y-4">
                  <div className="space-y-2">
                    <Label>GitHub Repository URL</Label>
                    <div className="flex gap-2">
                      <Input 
                        placeholder="https://github.com/user/repo" 
                        value={formContent.github_url || ""}
                        onChange={(e) => setFormContent({...formContent, github_url: e.target.value})}
                        disabled={isAgency || submission?.status === 'approved'}
                      />
                      {formContent.github_url && <Button variant="outline" size="icon" asChild><a href={formContent.github_url} target="_blank"><ExternalLink className="h-4 w-4"/></a></Button>}
                    </div>
                  </div>
                </TabsContent>

                {/* DESIGN TAB */}
                <TabsContent value="design" className="space-y-4">
                  <div className="space-y-2">
                    <Label>Figma / Design Link</Label>
                    <div className="flex gap-2">
                      <Input 
                        placeholder="https://figma.com/file/..." 
                        value={formContent.figma_url || ""}
                        onChange={(e) => setFormContent({...formContent, figma_url: e.target.value})}
                        disabled={isAgency || submission?.status === 'approved'}
                      />
                      {formContent.figma_url && <Button variant="outline" size="icon" asChild><a href={formContent.figma_url} target="_blank"><ExternalLink className="h-4 w-4"/></a></Button>}
                    </div>
                  </div>
                </TabsContent>

                {/* WRITING TAB */}
                <TabsContent value="writing" className="space-y-4">
                  <div className="space-y-2">
                    <Label>Google Docs / Drive Link</Label>
                    <div className="flex gap-2">
                      <Input 
                        placeholder="https://docs.google.com/..." 
                        value={formContent.drive_link || ""}
                        onChange={(e) => setFormContent({...formContent, drive_link: e.target.value})}
                        disabled={isAgency || submission?.status === 'approved'}
                      />
                      {formContent.drive_link && <Button variant="outline" size="icon" asChild><a href={formContent.drive_link} target="_blank"><ExternalLink className="h-4 w-4"/></a></Button>}
                    </div>
                  </div>
                </TabsContent>

                {/* GENERAL / NOTES */}
                <TabsContent value="general" className="space-y-4">
                  <div className="space-y-2">
                    <Label>Submission Notes & Deliverables</Label>
                    <Textarea 
                      rows={6}
                      placeholder="Describe what you've delivered, list any links, or provide access instructions..." 
                      value={formContent.notes || ""}
                      onChange={(e) => setFormContent({...formContent, notes: e.target.value})}
                      disabled={isAgency || submission?.status === 'approved'}
                    />
                  </div>
                </TabsContent>

                <div className="mt-8 pt-6 border-t flex items-center justify-between">
                  <p className="text-xs text-slate-500 max-w-md italic">
                    By submitting, you certify that you have completed the project requirements. The client will have 3-7 days to review.
                  </p>
                  {!isAgency && submission?.status !== 'approved' && (
                    <Button onClick={handleSubmitProject} disabled={submitting} className="bg-primary hover:bg-primary-hover px-8">
                      {submitting ? <Loader2 className="animate-spin mr-2"/> : <Send className="w-4 h-4 mr-2"/>}
                      {submission ? 'Update Submission' : 'Submit for Approval'}
                    </Button>
                  )}
                  {isAgency && submission?.status === 'submitted' && (
                    <Button onClick={handleApprove} className="bg-green-600 hover:bg-green-700 px-8">
                      <CheckCircle className="w-4 h-4 mr-2"/>
                      Approve & Release Funds
                    </Button>
                  )}
                  {submission?.status === 'approved' && (
                    <div className="flex items-center text-green-600 font-semibold gap-2">
                      <Lock className="w-4 h-4"/>
                      Project Finalized
                    </div>
                  )}
                </div>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar: Feedback Thread */}
        <div className="flex flex-col h-[700px]">
          <Card className="flex flex-col h-full shadow-md border-slate-200">
            <CardHeader className="border-b py-3 px-4 bg-white shrink-0">
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-slate-400" />
                Feedback Thread
              </CardTitle>
            </CardHeader>
            
            <CardContent className="flex-1 overflow-y-auto p-4 bg-slate-50/50 space-y-4">
              {!submission ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 p-4">
                  <AlertCircle className="w-10 h-10 mb-2 opacity-20"/>
                  <p className="text-sm">Submit your project to start the feedback thread.</p>
                </div>
              ) : comments.length === 0 ? (
                <div className="text-center text-slate-400 text-sm mt-8">No comments yet.</div>
              ) : (
                comments.map((c) => {
                  const isMe = c.sender_id === currentUserId
                  return (
                    <div key={c.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                      <div className={`text-xs text-slate-500 mb-1 ${isMe ? 'mr-1' : 'ml-1'}`}>
                        {c.sender?.full_name}
                      </div>
                      <div className={`max-w-[90%] rounded-lg px-3 py-2 text-sm ${isMe ? 'bg-slate-800 text-white' : 'bg-white border shadow-sm'}`}>
                        {c.message}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1">{new Date(c.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                    </div>
                  )
                })
              )}
            </CardContent>

            {submission && submission.status !== 'approved' && (
              <div className="p-3 bg-white border-t shrink-0 space-y-2">
                <Textarea 
                  placeholder="Type feedback or notes..." 
                  className="text-sm min-h-[80px]"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button 
                    className="flex-1 text-xs" 
                    onClick={() => handlePostComment(false)}
                    disabled={!newComment.trim()}
                    variant="outline"
                  >
                    Post Message
                  </Button>
                  {isAgency && (
                    <Button 
                      className="flex-1 text-xs" 
                      variant="destructive"
                      onClick={() => handlePostComment(true)}
                      disabled={!newComment.trim()}
                    >
                      Request Revisions
                    </Button>
                  )}
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
