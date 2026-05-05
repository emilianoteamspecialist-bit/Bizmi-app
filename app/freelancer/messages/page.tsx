"use client"
import { useState, useEffect, useRef, useCallback } from "react"
import type React from "react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Send, MessageSquare, User, ShieldCheck, Zap, Search, ArrowLeft, MoreVertical, Upload, File, ImageIcon, X } from "lucide-react"
import { supabase } from "@/lib/supabase"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

export default function FreelancerMessagesPage() {
  const [conversations, setConversations] = useState<any[]>([])
  const [filteredConversations, setFilteredConversations] = useState<any[]>([])
  const [selectedConversation, setSelectedConversation] = useState<any>(null)
  const [messagesInConversation, setMessagesInConversation] = useState<any[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [showConversationList, setShowConversationList] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchConversations = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("conversations")
      .select(`
        id,
        last_message_at,
        participant1_id,
        participant2_id,
        participant1_profile:profiles!conversations_participant1_id_fkey (
          id,
          full_name,
          account_type,
          company_name,
          freelancer_logos(file_name),
          agency_logo(*)
        ),
        participant2_profile:profiles!conversations_participant2_id_fkey (
          id,
          full_name,
          account_type,
          company_name,
          freelancer_logos(file_name),
          agency_logo(*)
        )
      `)
      .or(`participant1_id.eq.${userId},participant2_id.eq.${userId}`)
      .order("last_message_at", { ascending: false, nullsFirst: false })
    if (error) {
      console.error("Error fetching conversations:", error)
      return []
    }
    console.log("Fetched conversations:", JSON.stringify(data, null, 2))
    return data || []
  }, [])

  const fetchMessages = useCallback(async (conversationId: string) => {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
    if (error) {
      console.error("Error fetching messages:", error)
      return []
    }
    return data || []
  }, [])

  // Helper function to get the profile of the other participant in a conversation
  const getParticipantProfile = useCallback((conversation: any, userId: string | null) => {
    if (!userId) return null
    const profile1 = conversation.participant1_profile
    const profile2 = conversation.participant2_profile

    let participant = null
    if (profile1 && profile1.id === userId) {
      participant = profile2
    } else if (profile2 && profile2.id === userId) {
      participant = profile1
    }

    if (!participant) {
      console.log("No participant found for conversation:", conversation)
      return {
        full_name: "Unknown User",
        avatar_url: "/placeholder.svg?height=40&width=40",
        fallback_char: "U",
        is_fallback: true,
      }
    }

    let avatarUrl = "/placeholder.svg?height=40&width=40"
    let displayName = participant.full_name || "Unknown User"
    let fallbackChar = displayName.charAt(0)
    let isFallback = false

    if (participant.account_type === "freelancer") {
      avatarUrl = participant.freelancer_logos?.[0]?.file_name || avatarUrl
      displayName = participant.full_name || "Freelancer"
      fallbackChar = displayName.charAt(0)
    } else if (participant.account_type === "agency") {
      // For freelancer viewing, the other participant is an agency.
      // We want to use the first letter of their company_name or full_name with a background color.
      avatarUrl = "" // Set to empty to force AvatarImage to not render
      displayName = participant.company_name || participant.full_name || "Agency"
      fallbackChar = (participant.company_name || participant.full_name)?.charAt(0) || "A"
      isFallback = true
    }

    console.log("Participant profile:", JSON.stringify(participant, null, 2))
    console.log("Constructed avatar URL:", avatarUrl)
    return {
      full_name: displayName,
      avatar_url: avatarUrl,
      fallback_char: fallbackChar,
      is_fallback: isFallback,
    }
  }, [])

  const markMessagesAsRead = useCallback(
    async (conversationId: string, userId: string) => {
      const { error } = await supabase
        .from("messages")
        .update({ is_read: true })
        .eq("conversation_id", conversationId)
        .eq("receiver_id", userId)
        .eq("is_read", false)
      if (error) {
        console.error("Error marking messages as read:", error)
      } else {
        console.log(`Messages in conversation ${conversationId} marked as read for user ${userId}`)
        const updatedConversations = await fetchConversations(userId)
        setConversations(updatedConversations)
        setFilteredConversations(updatedConversations)
      }
    },
    [fetchConversations],
  )

  // Initial load of user data and conversations
  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true)
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        setCurrentUserId(user.id)
        const fetchedConversations = await fetchConversations(user.id)
        setConversations(fetchedConversations)
        setFilteredConversations(fetchedConversations) // Initialize filtered list
        if (fetchedConversations.length > 0) {
          setSelectedConversation(fetchedConversations[0]) // Automatically select the first conversation
          markMessagesAsRead(fetchedConversations[0].id, user.id)
        }
      }
      setLoading(false)
    }
    loadInitialData()
  }, [fetchConversations, markMessagesAsRead])

  // Fetch messages for selected conversation and set up real-time subscription
  useEffect(() => {
    if (selectedConversation) {
      const loadMessages = async () => {
        const fetchedMessages = await fetchMessages(selectedConversation.id)
        setMessagesInConversation(fetchedMessages)
        if (currentUserId) {
          markMessagesAsRead(selectedConversation.id, currentUserId)
        }
      }
      loadMessages()
      const messageSubscription = supabase
        .channel(`messages_channel_${selectedConversation.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `conversation_id=eq.${selectedConversation.id}`,
          },
          (payload) => {
            setMessagesInConversation((prevMessages) => [...prevMessages, payload.new])
            if (currentUserId && payload.new.receiver_id === currentUserId) {
              markMessagesAsRead(selectedConversation.id, currentUserId)
            }
          },
        )
        .subscribe()
      return () => {
        supabase.removeChannel(messageSubscription)
      }
    } else {
      setMessagesInConversation([]) // Clear messages if no conversation is selected
    }
  }, [selectedConversation, fetchMessages, currentUserId, markMessagesAsRead])

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom()
  }, [messagesInConversation])

  // Filter conversations based on search term
  useEffect(() => {
    if (searchTerm === "") {
      setFilteredConversations(conversations)
    } else {
      const lowerCaseSearchTerm = searchTerm.toLowerCase()
      const filtered = conversations.filter((conv) => {
        const participant = getParticipantProfile(conv, currentUserId)
        return (
          participant?.full_name?.toLowerCase().includes(lowerCaseSearchTerm) ||
          conv.last_message_at?.toLowerCase().includes(lowerCaseSearchTerm)
        )
      })
      setFilteredConversations(filtered)
    }
  }, [searchTerm, conversations, currentUserId, getParticipantProfile])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !currentUserId) return
    const receiverId =
      selectedConversation.participant1_id === currentUserId
        ? selectedConversation.participant2_id
        : selectedConversation.participant1_id
    const { error } = await supabase.from("messages").insert({
      conversation_id: selectedConversation.id,
      sender_id: currentUserId,
      receiver_id: receiverId,
      message_text: newMessage,
      is_read: false,
    })
    if (error) {
      console.error("Error sending message:", error)
    } else {
      setNewMessage("")
      await supabase
        .from("conversations")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", selectedConversation.id)
      const updatedConversations = await fetchConversations(currentUserId)
      setConversations(updatedConversations)
      setFilteredConversations(updatedConversations)
    }
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/gif",
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ]
      if (allowedTypes.includes(file.type)) {
        setSelectedFile(file)
      } else {
        alert("Please select only images (JPEG, PNG, GIF) or documents (PDF, DOC, DOCX)")
      }
    }
  }

  const uploadFile = async (file: File) => {
    const fileExt = file.name.split(".").pop()
    const fileName = `${Math.random()}.${fileExt}`
    const filePath = `messages/${fileName}`

    const { data, error } = await supabase.storage.from("message-files").upload(filePath, file)

    if (error) {
      console.error("Error uploading file:", error)
      return null
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("message-files").getPublicUrl(filePath)

    return {
      url: publicUrl,
      name: file.name,
      type: file.type,
      size: file.size,
    }
  }

  const handleSendFile = async () => {
    if (!selectedFile || !selectedConversation || !currentUserId) return

    setUploading(true)
    const fileData = await uploadFile(selectedFile)

    if (fileData) {
      const receiverId =
        selectedConversation.participant1_id === currentUserId
          ? selectedConversation.participant2_id
          : selectedConversation.participant1_id

      const { error } = await supabase.from("messages").insert({
        conversation_id: selectedConversation.id,
        sender_id: currentUserId,
        receiver_id: receiverId,
        message_text: `File: ${fileData.name}`,
        file_url: fileData.url,
        file_name: fileData.name,
        file_type: fileData.type,
        file_size: fileData.size,
        is_read: false,
      })

      if (error) {
        console.error("Error sending file:", error)
      } else {
        setSelectedFile(null)
        if (fileInputRef.current) {
          fileInputRef.current.value = ""
        }
        await supabase
          .from("conversations")
          .update({ last_message_at: new Date().toISOString() })
          .eq("id", selectedConversation.id)

        const updatedConversations = await fetchConversations(currentUserId)
        setConversations(updatedConversations)
        setFilteredConversations(updatedConversations)
      }
    }
    setUploading(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        
        <div className="max-w-7xl mx-auto py-8 px-4">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-300 rounded w-1/4 mb-6"></div>
            <div className="h-32 bg-gray-300 rounded"></div>
            <div className="h-20 bg-gray-300 rounded"></div>
            <div className="h-20 bg-gray-300 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  const selectedParticipant = selectedConversation ? getParticipantProfile(selectedConversation, currentUserId) : null

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Conversations List */}
        <Card
          className={`w-full flex-shrink-0 border-r rounded-none flex flex-col overflow-y-auto
          ${selectedConversation && !showConversationList ? "hidden sm:flex" : "flex"}
          sm:w-80 md:w-96 lg:w-[400px]`}
        >
          <CardHeader className="border-b">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="h-6 w-6 text-orange-500" />
              <CardTitle className="text-xl font-bold">Messages</CardTitle>
            </div>
            <p className="text-sm text-muted-foreground">Chat with your agencies</p>
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
            <ScrollArea className="h-full">
              {filteredConversations.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground text-sm">No conversations found.</div>
              ) : (
                filteredConversations.map((conversation) => {
                  const participant = getParticipantProfile(conversation, currentUserId)
                  const lastMessageTime = conversation.last_message_at
                    ? new Date(conversation.last_message_at).toLocaleDateString("en-US", {
                        month: "numeric",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "No messages"
                  return (
                    <div
                      key={conversation.id}
                      className={`flex items-center gap-3 p-4 cursor-pointer border-b last:border-b-0 hover:bg-gray-100 dark:hover:bg-gray-800 ${
                        selectedConversation?.id === conversation.id ? "bg-gray-100 dark:bg-gray-800" : ""
                      }`}
                      onClick={() => {
                        setSelectedConversation(conversation)
                        setShowConversationList(false)
                        console.log("Selected conversation:", conversation)
                      }}
                    >
                      <Avatar className="h-12 w-12">
                        {/* Only render AvatarImage if it's NOT a fallback (i.e., there's an actual image URL) */}
                        {!participant?.is_fallback && (
                          <AvatarImage
                            src={participant?.avatar_url || "/placeholder.svg?height=48&width=48&query=user profile"}
                            alt={participant?.full_name || "User"}
                          />
                        )}
                        <AvatarFallback
                          className={
                            participant?.is_fallback ? "bg-orange-500 text-white flex items-center justify-center" : ""
                          }
                        >
                          {participant?.fallback_char || <User className="h-6 w-6" />}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center">
                          <p className="font-semibold truncate">{participant?.full_name || "Unknown User"}</p>
                          <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">{lastMessageTime}</span>
                        </div>
                        {/* Placeholder for rating and skill as per screenshot */}
                        <div className="flex items-center text-xs text-muted-foreground mt-0.5">
                          <span className="text-yellow-500 mr-1">★ 4.8</span>
                          <span className="bg-green-500 w-2 h-2 rounded-full mr-1"></span>
                          {/* <span className="truncate">React</span> */}
                        </div>
                        <p className="text-sm text-muted-foreground truncate mt-0.5">
                          {conversation.last_message_at ? "Bzimi-agency" : "No messages yet"}
                        </p>
                      </div>
                    </div>
                  )
                })
              )}
            </ScrollArea>
          </CardContent>
        </Card>
        {/* Right Panel - Message Thread */}
        <div
          className={`flex-1 flex flex-col bg-white dark:bg-gray-800
          ${selectedConversation ? "flex" : "hidden"} sm:flex`}
        >
          {/* Chat Header */}
          <CardHeader className="border-b flex-shrink-0 py-3 px-4 sm:py-4 sm:px-6">
            {selectedConversation ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="sm:hidden"
                    onClick={() => setShowConversationList(true)}
                  >
                    <ArrowLeft className="h-5 w-5" />
                    <span className="sr-only">Back to conversations</span>
                  </Button>
                  <Avatar className="h-10 w-10">
                    {/* Only render AvatarImage if it's NOT a fallback */}
                    {!selectedParticipant?.is_fallback && (
                      <AvatarImage
                        src={
                          selectedParticipant?.avatar_url || "/placeholder.svg?height=40&width=40&query=user profile"
                        }
                        alt={selectedParticipant?.full_name || "User"}
                      />
                    )}
                    <AvatarFallback
                      className={
                        selectedParticipant?.is_fallback
                          ? "bg-orange-500 text-white flex items-center justify-center"
                          : ""
                      }
                    >
                      {selectedParticipant?.fallback_char || <User className="h-5 w-5" />}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-lg font-semibold">
                      {selectedParticipant?.full_name || "Unknown User"}
                    </CardTitle>
                    <div className="flex items-center text-sm text-muted-foreground mt-0.5">
                      <span className="text-yellow-500 mr-1">★ 4.8</span>
                      <span className="bg-green-500 w-2 h-2 rounded-full mr-1"></span>
                      {/* <span>React</span> */}
                    </div>
                  </div>
                </div>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="animate-blink">
                      <MoreVertical className="h-5 w-5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto max-w-xs text-sm p-2">
                    {"Always engage with agency on Google meets"}
                  </PopoverContent>
                </Popover>
              </div>
            ) : (
              <CardTitle className="text-lg text-muted-foreground">No conversation selected</CardTitle>
            )}
          </CardHeader>
          {/* Messages Area */}
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {messagesInConversation.length === 0 && selectedConversation ? (
                <div className="text-center text-muted-foreground text-sm py-8">Start your conversation here!</div>
              ) : (
                messagesInConversation.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.sender_id === currentUserId ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] sm:max-w-[75%] md:max-w-[70%] p-2 sm:p-3 rounded-lg ${
                        message.sender_id === currentUserId
                          ? "bg-orange-500 text-white"
                          : "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white"
                      }`}
                    >
                      {message.file_url ? (
                        <div className="space-y-2">
                          {message.file_type?.startsWith("image/") ? (
                            <div>
                              <img
                                src={message.file_url || "/placeholder.svg"}
                                alt={message.file_name}
                                className="max-w-[200px] sm:max-w-[250px] md:max-w-[300px] h-auto rounded-md cursor-pointer object-cover"
                                onClick={() => window.open(message.file_url, "_blank")}
                              />
                              <p className="text-xs mt-1 opacity-75">{message.file_name}</p>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 p-2 bg-black/10 rounded max-w-[250px] sm:max-w-[280px]">
                              <File className="h-4 w-4" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{message.file_name}</p>
                                <p className="text-xs opacity-75">{(message.file_size / 1024).toFixed(1)} KB</p>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0"
                                onClick={() => window.open(message.file_url, "_blank")}
                              >
                                <Upload className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </div>
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
          </ScrollArea>
          {/* Message Input Area (Always visible) */}
          <div className="p-4 border-t bg-white dark:bg-gray-800 flex-shrink-0">
            {selectedFile && (
              <div className="mb-3 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center gap-2">
                {selectedFile.type.startsWith("image/") ? (
                  <ImageIcon className="h-4 w-4" />
                ) : (
                  <File className="h-4 w-4" />
                )}
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
                <Button
                  size="sm"
                  onClick={handleSendFile}
                  disabled={uploading}
                  className="bg-orange-500 hover:bg-orange-600"
                >
                  {uploading ? "Uploading..." : "Send"}
                </Button>
              </div>
            )}
            <div className="flex items-end gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf,.doc,.docx"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={!selectedConversation}
                className="flex-shrink-0"
              >
                <Upload className="h-4 w-4" />
              </Button>
              <div className="flex-1 relative">
                <Textarea
                  placeholder="Type your message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      handleSendMessage()
                    }
                  }}
                  rows={1}
                  className="flex-1 resize-none min-h-[40px]"
                  disabled={!selectedConversation}
                />
              </div>
              <Button
                onClick={handleSendMessage}
                disabled={!newMessage.trim() || !selectedConversation}
                className="bg-orange-500 hover:bg-orange-600 flex-shrink-0 w-10 h-10 rounded-full p-0"
              >
                <Send className="h-5 w-5" />
                <span className="sr-only">Send message</span>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-right">{newMessage.length}/1000 characters</p>
          </div>
        </div>
      </div>
    </div>
  )
}
