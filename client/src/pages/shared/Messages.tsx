import { useEffect, useRef, useState } from "react"
import { Link, useLocation, useSearchParams } from "react-router-dom"
import { ArrowLeft, File, ImageIcon, MessageSquare, Paperclip, Search, Send, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useAuth } from "@/contexts/AuthContext"
import {
  useConversationsQuery,
  useConversationMessagesQuery,
  useSendMessageMutation,
  useSendFileMessageMutation,
  useMarkReadMutation,
  useRealtimeMessages,
  type ConversationSummary,
} from "@/lib/queries/messages"
import { formatKobo, useMyEscrowsQuery } from "@/lib/queries/escrow"
import { fileToBase64 } from "@/lib/file"
import { formatTimeAgo } from "@/lib/format"
import { cn } from "@/lib/utils"
import EscrowStatusBadge from "@/components/shared/EscrowStatusBadge"

const ALLOWED_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]

function ParticipantAvatar({ participant, size = "md" }: { participant: ConversationSummary["participant"]; size?: "sm" | "md" | "lg" }) {
  const cls = size === "lg" ? "h-14 w-14" : size === "sm" ? "h-8 w-8" : "h-10 w-10"
  return (
    <Avatar className={cls}>
      <AvatarImage src={participant.avatar || undefined} alt="" />
      <AvatarFallback className="bg-surface-2 font-semibold text-foreground">{participant.full_name?.charAt(0)?.toUpperCase() || "?"}</AvatarFallback>
    </Avatar>
  )
}

export default function Messages() {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const role = pathname.startsWith("/agency") ? "agency" : "freelancer"
  const currentUserId = user?.id ?? null
  const [searchParams] = useSearchParams()
  const requestedConversation = searchParams.get("conversationId")
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(requestedConversation)
  const [newMessage, setNewMessage] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [showConversationList, setShowConversationList] = useState(!requestedConversation)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const didAutoSelect = useRef(!!requestedConversation)

  const conversationsQuery = useConversationsQuery()
  const messagesQuery = useConversationMessagesQuery(selectedConversationId)
  const escrowsQuery = useMyEscrowsQuery()
  const sendMessage = useSendMessageMutation()
  const sendFile = useSendFileMessageMutation()
  const markRead = useMarkReadMutation()
  useRealtimeMessages(selectedConversationId)

  const conversations = conversationsQuery.data?.conversations ?? []
  const messages = messagesQuery.data?.messages ?? []

  useEffect(() => {
    if (didAutoSelect.current) return
    if (conversations.length === 0) return
    didAutoSelect.current = true
    setSelectedConversationId(conversations[0].id)
  }, [conversations])

  // A link from a notification (?conversationId=) opens that conversation.
  useEffect(() => {
    if (requestedConversation) {
      setSelectedConversationId(requestedConversation)
      setShowConversationList(false)
    }
  }, [requestedConversation])

  useEffect(() => {
    if (selectedConversationId) markRead.mutate(selectedConversationId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConversationId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView?.({ behavior: "smooth" })
  }, [messages])

  const filteredConversations = conversations.filter((c) => (searchTerm ? c.participant.full_name.toLowerCase().includes(searchTerm.toLowerCase()) : true))
  const selectedConversation = conversations.find((c) => c.id === selectedConversationId) ?? null
  // Contracts with the other participant give the conversation context.
  const sharedContracts = selectedConversation
    ? (escrowsQuery.data?.escrows ?? []).filter((e) => (role === "agency" ? e.freelancer_id : e.agency_id) === selectedConversation.participant.id)
    : []

  const handleSelect = (conversation: ConversationSummary) => {
    setSelectedConversationId(conversation.id)
    setShowConversationList(false)
  }

  const handleSend = () => {
    if (!newMessage.trim() || !selectedConversationId) return
    sendMessage.mutate({ conversationId: selectedConversationId, message_text: newMessage }, { onSuccess: () => setNewMessage("") })
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      alert("Please select only images (JPEG, PNG, GIF) or documents (PDF, DOC, DOCX)")
      return
    }
    setSelectedFile(file)
  }

  const handleSendFile = async () => {
    if (!selectedFile || !selectedConversationId) return
    const { data, mimeType } = await fileToBase64(selectedFile)
    sendFile.mutate(
      { conversationId: selectedConversationId, data, fileName: selectedFile.name, mimeType },
      {
        onSuccess: () => {
          setSelectedFile(null)
          if (fileInputRef.current) fileInputRef.current.value = ""
        },
      }
    )
  }

  if (conversationsQuery.isLoading) {
    return (
      <div data-testid="messages-skeleton" className="mx-auto flex h-[calc(100svh-3.5rem)] max-w-[1280px] gap-0 p-4 sm:p-6" aria-label="Loading messages">
        <div className="w-80 space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-md bg-surface-2" />
          ))}
        </div>
        <div className="ml-4 hidden flex-1 animate-pulse rounded-lg bg-surface-2 sm:block" />
      </div>
    )
  }

  const showThread = !!selectedConversation && !showConversationList

  return (
    <div className="mx-auto h-[calc(100svh-3.5rem)] max-w-[1280px] p-0 sm:p-4 lg:p-6">
      <div className="flex h-full overflow-hidden border-border bg-card sm:rounded-lg sm:border">
        {/* Conversation list */}
        <section
          data-testid="conversation-list"
          aria-label="Conversations"
          className={cn("w-full shrink-0 flex-col border-r border-border sm:flex sm:w-72 lg:w-80", showThread ? "hidden" : "flex")}
        >
          <div className="border-b border-border p-3">
            <h1 className="mb-2 px-1 font-heading text-base font-semibold text-foreground">Messages</h1>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <input
                type="search"
                aria-label="Search conversations"
                placeholder="Search conversations..."
                className="h-9 w-full rounded-md border border-transparent bg-surface-2 pl-9 pr-3 text-sm focus:border-primary focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/20"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <ul className="flex-1 overflow-y-auto">
            {filteredConversations.length === 0 ? (
              <li className="p-6 text-center text-sm text-muted-foreground">No conversations found.</li>
            ) : (
              filteredConversations.map((conversation) => {
                const active = selectedConversationId === conversation.id
                return (
                  <li key={conversation.id}>
                    <button
                      onClick={() => handleSelect(conversation)}
                      aria-current={active ? "true" : undefined}
                      className={cn(
                        "flex w-full items-center gap-3 border-l-2 px-3 py-3 text-left transition-colors hover:bg-surface-2",
                        active ? "border-primary bg-surface-2" : "border-transparent"
                      )}
                    >
                      <ParticipantAvatar participant={conversation.participant} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-foreground">{conversation.participant.full_name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {conversation.last_message_at ? formatTimeAgo(conversation.last_message_at) : "No messages yet"}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })
            )}
          </ul>
        </section>

        {/* Active conversation */}
        <section aria-label="Conversation" className={cn("min-w-0 flex-1 flex-col sm:flex", showThread ? "flex" : "hidden")}>
          <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-3 sm:px-4">
            {selectedConversation ? (
              <>
                <Button variant="ghost" size="icon" className="h-9 w-9 sm:hidden" onClick={() => setShowConversationList(true)}>
                  <ArrowLeft className="h-5 w-5" />
                  <span className="sr-only">Back to conversations</span>
                </Button>
                <ParticipantAvatar participant={selectedConversation.participant} size="sm" />
                <h2 className="truncate text-sm font-semibold text-foreground">{selectedConversation.participant.full_name}</h2>
              </>
            ) : (
              <h2 className="text-sm text-muted-foreground">No conversation selected</h2>
            )}
          </div>

          <div className="flex-1 overflow-y-auto bg-surface p-4">
            <div className="space-y-3">
              {!selectedConversation ? (
                <div className="flex flex-col items-center py-16 text-center text-sm text-muted-foreground">
                  <MessageSquare className="mb-2 h-6 w-6" aria-hidden />
                  Choose a conversation to read it.
                </div>
              ) : messages.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">No messages yet — say hello.</div>
              ) : (
                messages.map((message) => {
                  const mine = message.sender_id === currentUserId
                  return (
                    <div key={message.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                      <div className={cn("max-w-[85%] rounded-lg px-3 py-2 sm:max-w-[70%]", mine ? "bg-primary text-primary-foreground" : "border border-border bg-card text-foreground")}>
                        {message.file_url ? (
                          message.file_type?.startsWith("image/") ? (
                            <a href={message.file_url} target="_blank" rel="noopener noreferrer" className="block">
                              <img src={message.file_url} alt={message.file_name ?? "Image attachment"} className="h-auto max-w-[240px] rounded object-cover" />
                              <span className="mt-1 block text-xs opacity-75">{message.file_name}</span>
                            </a>
                          ) : (
                            <a href={message.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                              <File className="h-4 w-4 shrink-0" aria-hidden />
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-medium underline-offset-2 hover:underline">{message.file_name}</span>
                                <span className="block text-xs opacity-75">{((message.file_size ?? 0) / 1024).toFixed(1)} KB</span>
                              </span>
                            </a>
                          )
                        ) : (
                          <p className="whitespace-pre-wrap text-sm">{message.message_text}</p>
                        )}
                        <span className="mt-1 block text-[11px] opacity-70">{new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          <div className="shrink-0 border-t border-border bg-card p-3">
            {selectedFile && (
              <div className="mb-2 flex items-center gap-2 rounded-md bg-surface-2 p-2">
                {selectedFile.type.startsWith("image/") ? <ImageIcon className="h-4 w-4" /> : <File className="h-4 w-4" />}
                <span className="flex-1 truncate text-sm">{selectedFile.name}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  aria-label="Remove attachment"
                  onClick={() => {
                    setSelectedFile(null)
                    if (fileInputRef.current) fileInputRef.current.value = ""
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" onClick={handleSendFile} disabled={sendFile.isPending}>
                  {sendFile.isPending ? "Uploading…" : "Send file"}
                </Button>
              </div>
            )}
            <div className="flex items-end gap-2">
              <input ref={fileInputRef} type="file" accept="image/*,.pdf,.doc,.docx" onChange={handleFileSelect} className="hidden" />
              <Button type="button" variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()} disabled={!selectedConversationId} className="shrink-0" aria-label="Attach a file">
                <Paperclip className="h-4 w-4" />
              </Button>
              <Textarea
                aria-label="Message"
                placeholder="Type your message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                rows={1}
                className="min-h-[40px] flex-1 resize-none"
                disabled={!selectedConversationId}
              />
              <Button onClick={handleSend} disabled={!newMessage.trim() || !selectedConversationId} size="icon" className="shrink-0" aria-label="Send message">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </section>

        {/* Context panel */}
        {selectedConversation && (
          <aside aria-label="Conversation details" className="hidden w-72 shrink-0 flex-col overflow-y-auto border-l border-border xl:flex">
            <div className="flex flex-col items-center border-b border-border px-4 py-6 text-center">
              <ParticipantAvatar participant={selectedConversation.participant} size="lg" />
              <p className="mt-2 text-sm font-semibold text-foreground">{selectedConversation.participant.full_name}</p>
              <p className="text-xs text-muted-foreground">{role === "agency" ? "Freelancer" : "Agency"}</p>
            </div>
            <div className="p-4">
              <h3 className="text-xs font-semibold text-muted-foreground">Contracts together</h3>
              {sharedContracts.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">No contracts with {selectedConversation.participant.full_name.split(" ")[0]} yet.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {sharedContracts.map((c) => (
                    <li key={c.id} className="rounded-md border border-border p-3">
                      <p className="truncate text-sm font-medium text-foreground">{c.job_title ?? "Job"}</p>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <span className="text-xs tabular-nums text-muted-foreground">{formatKobo(c.amount_kobo)}</span>
                        <EscrowStatusBadge status={c.status_v2} />
                      </div>
                      {(c.status_v2 === "funded" || c.status_v2 === "disputed" || c.status_v2 === "released") && (
                        <Link to={`/workspace/${c.job_id}`} className="mt-2 inline-block text-xs font-medium text-primary hover:underline">
                          Open workspace
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-4 text-xs text-muted-foreground">Keep conversations and payments on Bizimi so escrow protects both of you.</p>
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}
