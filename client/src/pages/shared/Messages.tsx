import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Send, MessageSquare, User, Search, ArrowLeft, MoreVertical, Upload, File, ImageIcon, X } from "lucide-react"
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
import { fileToBase64 } from "@/lib/file"

const ALLOWED_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]

// The conversation list and the message pane are both always mounted (only
// their Tailwind visibility classes differ) so that a wide viewport can show
// both panes at once. On narrow viewports only one pane is meant to be
// visible at a time via CSS. `matchMedia` lets us mirror that same "only one
// name visible at a time" rule in JS for the header's participant name,
// which otherwise would render twice (list row + header) whenever both
// panes are technically in the DOM simultaneously.
function useIsDesktopViewport() {
  const query = "(min-width: 640px)"
  const getMatches = () => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false
    try {
      return window.matchMedia(query).matches
    } catch {
      return false
    }
  }

  const [isDesktop, setIsDesktop] = useState(getMatches)

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return
    let mql: MediaQueryList
    try {
      mql = window.matchMedia(query)
    } catch {
      return
    }
    const handler = () => setIsDesktop(mql.matches)
    handler()
    mql.addEventListener("change", handler)
    return () => mql.removeEventListener("change", handler)
  }, [])

  return isDesktop
}

export default function Messages() {
  const { user } = useAuth()
  const currentUserId = user?.id ?? null

  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [newMessage, setNewMessage] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [showConversationList, setShowConversationList] = useState(true)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const didAutoSelect = useRef(false)

  const isDesktop = useIsDesktopViewport()

  const conversationsQuery = useConversationsQuery()
  const messagesQuery = useConversationMessagesQuery(selectedConversationId)
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

  useEffect(() => {
    if (selectedConversationId) markRead.mutate(selectedConversationId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConversationId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const filteredConversations = conversations.filter((c) =>
    searchTerm ? c.participant.full_name.toLowerCase().includes(searchTerm.toLowerCase()) : true
  )

  const selectedConversation = conversations.find((c) => c.id === selectedConversationId) ?? null
  // Only surface the participant's name in the header once it can't collide
  // with the same name already shown in the (always-mounted) list row: on a
  // desktop-width viewport both panes are visible together by design, and on
  // narrow viewports the detail pane only becomes the active view once the
  // user has explicitly opened it (showConversationList false).
  const showDetailHeaderName = isDesktop || (Boolean(selectedConversation) && !showConversationList)

  const handleSelect = (conversation: ConversationSummary) => {
    setSelectedConversationId(conversation.id)
    setShowConversationList(false)
  }

  const handleSend = () => {
    if (!newMessage.trim() || !selectedConversationId) return
    sendMessage.mutate(
      { conversationId: selectedConversationId, message_text: newMessage },
      { onSuccess: () => setNewMessage("") }
    )
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
      <div data-testid="messages-skeleton" className="min-h-screen bg-surface">
        <div className="max-w-7xl mx-auto py-8 px-4">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-foreground/5 rounded w-1/4 mb-6" />
            <div className="h-32 bg-foreground/5 rounded" />
            <div className="h-20 bg-foreground/5 rounded" />
            <div className="h-20 bg-foreground/5 rounded" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-[calc(100svh-4rem)] bg-surface flex flex-col overflow-hidden">
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <Card
          className={`w-full flex-shrink-0 border-r rounded-none flex flex-col overflow-y-auto ${
            selectedConversation && !showConversationList ? "hidden sm:flex" : "flex"
          } sm:w-80 md:w-96 lg:w-[400px]`}
        >
          <CardHeader className="border-b">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg font-semibold text-foreground">Messages</CardTitle>
            </div>
            <div className="relative mt-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search conversations..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent className="flex-1 p-0">
            {filteredConversations.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground text-sm">No conversations found.</div>
            ) : (
              filteredConversations.map((conversation) => (
                <div
                  key={conversation.id}
                  className={`flex items-center gap-3 p-4 cursor-pointer border-b border-border last:border-b-0 transition-colors hover:bg-surface-2 ${
                    selectedConversationId === conversation.id ? "bg-surface-2" : ""
                  }`}
                  onClick={() => handleSelect(conversation)}
                >
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={conversation.participant.avatar || undefined} alt={conversation.participant.full_name} />
                    <AvatarFallback className="bg-primary text-white flex items-center justify-center">
                      {conversation.participant.full_name.charAt(0) || <User className="h-6 w-6" />}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{conversation.participant.full_name}</p>
                    <p className="text-sm text-muted-foreground truncate mt-0.5">
                      {conversation.last_message_at
                        ? new Date(conversation.last_message_at).toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" })
                        : "No messages yet"}
                    </p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <div className={`flex-1 min-w-0 min-h-0 flex flex-col bg-card ${selectedConversation && !showConversationList ? "flex" : "hidden"} sm:flex`}>
          <CardHeader className="border-b flex-shrink-0 py-3 px-4 sm:py-4 sm:px-6">
            {selectedConversation ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Button variant="ghost" size="icon" className="sm:hidden" onClick={() => setShowConversationList(true)}>
                    <ArrowLeft className="h-5 w-5" />
                    <span className="sr-only">Back to conversations</span>
                  </Button>
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={selectedConversation.participant.avatar || undefined} alt={selectedConversation.participant.full_name} />
                    <AvatarFallback className="bg-primary text-white flex items-center justify-center">
                      {selectedConversation.participant.full_name.charAt(0) || <User className="h-5 w-5" />}
                    </AvatarFallback>
                  </Avatar>
                  <CardTitle className="text-lg font-semibold">
                    {showDetailHeaderName ? selectedConversation.participant.full_name : "Conversation"}
                  </CardTitle>
                </div>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="h-5 w-5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto max-w-xs text-sm p-2">Always engage with agency on Google meets</PopoverContent>
                </Popover>
              </div>
            ) : (
              <CardTitle className="text-lg text-muted-foreground">No conversation selected</CardTitle>
            )}
          </CardHeader>

          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-4">
              {messages.length === 0 && selectedConversation ? (
                <div className="text-center text-muted-foreground text-sm py-8">Start your conversation here!</div>
              ) : (
                messages.map((message) => (
                  <div key={message.id} className={`flex ${message.sender_id === currentUserId ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] sm:max-w-[75%] md:max-w-[70%] p-2 sm:p-3 rounded-2xl ${
                        message.sender_id === currentUserId ? "bg-primary text-white" : "bg-surface-2 text-foreground"
                      }`}
                    >
                      {message.file_url ? (
                        message.file_type?.startsWith("image/") ? (
                          <div>
                            <img
                              src={message.file_url}
                              alt={message.file_name ?? ""}
                              className="max-w-[200px] sm:max-w-[250px] md:max-w-[300px] h-auto rounded-md cursor-pointer object-cover"
                              onClick={() => window.open(message.file_url ?? undefined, "_blank", "noopener,noreferrer")}
                            />
                            <p className="text-xs mt-1 opacity-75">{message.file_name}</p>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 p-2 bg-black/10 rounded max-w-[250px] sm:max-w-[280px]">
                            <File className="h-4 w-4" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{message.file_name}</p>
                              <p className="text-xs opacity-75">{((message.file_size ?? 0) / 1024).toFixed(1)} KB</p>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0"
                              onClick={() => window.open(message.file_url ?? undefined, "_blank", "noopener,noreferrer")}
                            >
                              <Upload className="h-3 w-3" />
                            </Button>
                          </div>
                        )
                      ) : (
                        <p className="text-sm whitespace-pre-wrap">{message.message_text}</p>
                      )}
                      <span className="block text-xs mt-1 opacity-75">
                        {new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          <div className="p-4 border-t border-border bg-card flex-shrink-0">
            {selectedFile && (
              <div className="mb-3 p-3 bg-surface-2 rounded-lg flex items-center gap-2">
                {selectedFile.type.startsWith("image/") ? <ImageIcon className="h-4 w-4" /> : <File className="h-4 w-4" />}
                <span className="text-sm flex-1 truncate">{selectedFile.name}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0"
                  onClick={() => {
                    setSelectedFile(null)
                    if (fileInputRef.current) fileInputRef.current.value = ""
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
                <Button size="sm" onClick={handleSendFile} disabled={sendFile.isPending}>
                  {sendFile.isPending ? "Uploading..." : "Send"}
                </Button>
              </div>
            )}
            <div className="flex items-end gap-2">
              <input ref={fileInputRef} type="file" accept="image/*,.pdf,.doc,.docx" onChange={handleFileSelect} className="hidden" />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={!selectedConversationId}
                className="flex-shrink-0"
              >
                <Upload className="h-4 w-4" />
              </Button>
              <div className="flex-1 relative">
                <Textarea
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
                  className="flex-1 resize-none min-h-[40px]"
                  disabled={!selectedConversationId}
                />
              </div>
              <Button
                onClick={handleSend}
                disabled={!newMessage.trim() || !selectedConversationId}
                className="flex-shrink-0 w-10 h-10 rounded-full p-0"
                aria-label="Send message"
              >
                <Send className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
