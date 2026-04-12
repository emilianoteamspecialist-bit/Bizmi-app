"use client"

import { useEffect, useState, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ShieldAlert, Send, Upload, Clock, CheckCircle } from "lucide-react"

interface Dispute {
  id: string
  job_id: string
  initiator_id: string
  respondent_id: string
  dispute_type: string
  status: string
  amount_disputed: number
  description: string
  created_at: string
  resolution_outcome?: string
  job?: { title: string }
  initiator?: { full_name: string }
  respondent?: { full_name: string }
}

interface Message {
  id: string
  sender_id: string
  message: string
  created_at: string
  sender?: { full_name: string }
}

export default function DisputeRoom() {
  const params = useParams()
  const router = useRouter()
  const disputeId = params.id as string

  const [dispute, setDispute] = useState<Dispute | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [newMessage, setNewMessage] = useState("")
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    checkAuthAndLoad()
  }, [disputeId])

  useEffect(() => {
    // Scroll to bottom when messages update
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const checkAuthAndLoad = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }
      setCurrentUserId(session.user.id)
      await loadDisputeData()
      await loadMessages()

      // Subscribe to new messages
      const channel = supabase
        .channel(`dispute_messages:${disputeId}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'dispute_messages',
          filter: `dispute_id=eq.${disputeId}`
        }, (payload) => {
          // Add new message if it's not from us (we add ours optimistically)
          if (payload.new.sender_id !== session.user.id) {
             loadMessages() // reload to get sender names, could optimize later
          }
        })
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }

    } catch (error) {
      console.error("Error loading room:", error)
    } finally {
      setLoading(false)
    }
  }

  const loadDisputeData = async () => {
    const { data, error } = await supabase
      .from('disputes')
      .select(`
        *,
        job:jobs(title),
        initiator:profiles!disputes_initiator_id_fkey(full_name),
        respondent:profiles!disputes_respondent_id_fkey(full_name)
      `)
      .eq('id', disputeId)
      .single()
      
    if (error) {
      console.error("Error loading dispute:", error)
      return
    }
    setDispute(data)
  }

  const loadMessages = async () => {
    const { data, error } = await supabase
      .from('dispute_messages')
      .select(`
        id, sender_id, message, created_at,
        sender:profiles!dispute_messages_sender_id_fkey(full_name)
      `)
      .eq('dispute_id', disputeId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error("Error loading messages:", error)
      return
    }
    setMessages(data || [])
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !currentUserId || sending) return

    setSending(true)
    try {
      const { data, error } = await supabase
        .from('dispute_messages')
        .insert({
          dispute_id: disputeId,
          sender_id: currentUserId,
          message: newMessage.trim()
        })
        .select(`
          id, sender_id, message, created_at,
          sender:profiles!dispute_messages_sender_id_fkey(full_name)
        `)
        .single()

      if (error) throw error

      setMessages(prev => [...prev, data])
      setNewMessage("")
    } catch (error) {
      console.error("Error sending message:", error)
    } finally {
      setSending(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'in_platform_review':
        return <Badge variant="outline" className="text-yellow-600 border-yellow-200 bg-yellow-50"><Clock className="w-3 h-3 mr-1"/> Platform Review Phase</Badge>
      case 'admin_intervention':
        return <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50"><ShieldAlert className="w-3 h-3 mr-1"/> Admin Intervention</Badge>
      case 'resolved':
        return <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50"><CheckCircle className="w-3 h-3 mr-1"/> Resolved</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading Dispute Room...</div>
  }

  if (!dispute) {
    return <div className="min-h-screen flex items-center justify-center text-red-500">Dispute not found or you don't have access.</div>
  }

  const isResolved = dispute.status === 'resolved'
  const otherPartyName = currentUserId === dispute.initiator_id ? dispute.respondent?.full_name : dispute.initiator?.full_name

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-8 px-4">
      <div className="max-w-4xl w-full">
        {/* Header Card */}
        <Card className="mb-6 border-orange-200 shadow-sm">
          <CardHeader className="bg-orange-50/50 pb-4 border-b">
            <div className="flex flex-col md:flex-row justify-between md:items-start gap-4">
              <div>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <ShieldAlert className="text-orange-500 h-6 w-6" />
                  Dispute Room
                </CardTitle>
                <CardDescription className="mt-1 text-base">
                  Job: <strong>{dispute.job?.title}</strong>
                </CardDescription>
                <div className="mt-2 text-sm text-gray-600">
                  <span className="mr-4">Type: <strong className="capitalize">{dispute.dispute_type.replace('_', ' ')}</strong></span>
                  <span>Amount in escrow: <strong>₦{dispute.amount_disputed.toLocaleString()}</strong></span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                {getStatusBadge(dispute.status)}
                <div className="text-xs text-gray-500 text-right">
                  Started: {new Date(dispute.created_at).toLocaleDateString()}
                  <br />
                  Other party: <strong>{otherPartyName}</strong>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4 bg-white">
            <h3 className="text-sm font-semibold text-gray-700 mb-1">Original Complaint</h3>
            <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded border">
              {dispute.description}
            </p>
            {isResolved && dispute.resolution_outcome && (
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded text-green-800 text-sm">
                <strong>Resolution Decision:</strong> The admin has closed this dispute with outcome: <span className="uppercase">{dispute.resolution_outcome.replace('_', ' ')}</span>.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Chat Interface */}
        <Card className="flex flex-col shadow-sm border-gray-200" style={{ height: '600px' }}>
          <CardHeader className="border-b py-3 px-4 bg-white shrink-0">
            <CardTitle className="text-lg">Discussion & Evidence</CardTitle>
            <CardDescription className="text-xs">
              Use this chat to communicate and resolve the issue. If not resolved in 3-7 days, an admin will review this chat to make a decision.
            </CardDescription>
          </CardHeader>
          
          <CardContent className="flex-1 overflow-y-auto p-4 bg-gray-50/50 space-y-4">
            {messages.map((msg) => {
              const isMe = msg.sender_id === currentUserId
              return (
                <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  <div className={`text-xs text-gray-500 mb-1 ${isMe ? 'mr-1' : 'ml-1'}`}>
                    {isMe ? 'You' : msg.sender?.full_name} • {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </div>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${isMe ? 'bg-orange-500 text-white rounded-br-none' : 'bg-white border text-gray-800 rounded-bl-none shadow-sm'}`}>
                    <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                  </div>
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </CardContent>

          {!isResolved && (
            <div className="p-3 bg-white border-t shrink-0">
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <Button type="button" variant="outline" size="icon" className="shrink-0" title="Upload Evidence (Coming soon)">
                  <Upload className="h-4 w-4" />
                </Button>
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type your message..."
                  className="flex-1"
                  disabled={sending}
                />
                <Button type="submit" className="bg-orange-500 hover:bg-orange-600 shrink-0" disabled={sending || !newMessage.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
