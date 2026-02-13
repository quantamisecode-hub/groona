import React, { useState, useEffect, useRef } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send, Paperclip, MoreVertical, ArrowLeft, Phone, Video, Image as ImageIcon, X, Loader2, Trash2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Sound effect
const NOTIFICATION_SOUND = "https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3";

export default function ChatWindow({ conversationId, currentUser, onBack, tenantId }) {
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();
  const audioRef = useRef(new Audio(NOTIFICATION_SOUND));

  // Fetch Conversation Details
  const { data: conversation } = useQuery({
    queryKey: ['conversation', conversationId],
    queryFn: () => groonabackend.entities.Conversation.filter({ id: conversationId }).then(res => res[0]),
    enabled: !!conversationId,
  });

  // Fetch Messages
  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ['chat-messages', conversationId],
    queryFn: () => groonabackend.entities.ChatMessage.filter(
      { conversation_id: conversationId }, 
      'created_date', // Oldest first for chat history
      100
    ),
    enabled: !!conversationId,
    refetchInterval: 2000, // Poll for new messages frequently for "realtime" feel
  });

  // Play sound on new message
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      // If the last message is new (within last 3 seconds) and not from me
      const isRecent = new Date(lastMessage.created_date) > new Date(Date.now() - 3000);
      if (isRecent && lastMessage.sender_email !== currentUser.email) {
        audioRef.current.play().catch(e => console.log("Audio play failed", e));
      }
      scrollToBottom();
    }
  }, [messages.length, currentUser.email]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, conversationId]);

  const sendMessageMutation = useMutation({
    mutationFn: async (messageData) => {
      // Create the message
      const msg = await groonabackend.entities.ChatMessage.create({
        tenant_id: tenantId,
        conversation_id: conversationId,
        sender_email: currentUser.email,
        sender_name: currentUser.full_name,
        sender_avatar_url: currentUser.profile_image_url,
        ...messageData
      });

      // Update conversation last message
      await groonabackend.entities.Conversation.update(conversationId, {
        last_message: messageData.content || (messageData.file_url ? "Sent an attachment" : "Sent a message"),
        last_message_at: new Date().toISOString(),
        last_sender_email: currentUser.email
      });

      return msg;
    },
    onSuccess: () => {
      setNewMessage("");
      queryClient.invalidateQueries({ queryKey: ['chat-messages', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    }
  });

  const deleteMessageMutation = useMutation({
    mutationFn: async (messageId) => {
      await groonabackend.entities.ChatMessage.update(messageId, { 
        is_deleted: true,
        content: "This message was deleted" 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-messages', conversationId] });
      toast.success("Message deleted");
    }
  });

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!newMessage.trim() && !uploadingFile) return;

    setIsSending(true);
    try {
      await sendMessageMutation.mutateAsync({
        content: newMessage,
        message_type: 'text'
      });
    } catch (error) {
      toast.error("Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFile(true);
    try {
      // 1. Upload file
      const { file_url } = await groonabackend.integrations.Core.UploadFile({ file }); // Assuming integration exists, otherwise use other method
      
      // 2. Send message with file
      await sendMessageMutation.mutateAsync({
        content: "", // Optional caption logic could go here
        message_type: file.type.startsWith('image/') ? 'image' : 'file',
        file_url: file_url,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type
      });
      
    } catch (error) {
      console.error("Upload failed", error);
      toast.error("Failed to upload file");
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const getConversationName = () => {
    if (!conversation) return "Loading...";
    if (conversation.type === 'group') return conversation.name;
    const otherParticipant = conversation.participant_details?.find(p => p.email !== currentUser.email);
    return otherParticipant?.name || "Chat";
  };

  const getConversationAvatar = () => {
    if (!conversation) return null;
    if (conversation.type === 'group') return null;
    const otherParticipant = conversation.participant_details?.find(p => p.email !== currentUser.email);
    return otherParticipant?.avatar_url;
  };

  if (!conversationId) return null;

  return (
    <div className="flex flex-col h-full bg-white/50 backdrop-blur-sm">
      {/* Chat Header */}
      <div className="h-16 px-4 border-b border-slate-200 flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="md:hidden -ml-2" onClick={onBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          
          <Avatar className="h-10 w-10 border border-slate-200 shadow-sm">
            <AvatarImage src={getConversationAvatar()} />
            <AvatarFallback className={conversation?.type === 'group' ? "bg-indigo-100 text-indigo-600" : "bg-blue-100 text-blue-600"}>
              {conversation?.type === 'group' ? <Users className="w-5 h-5" /> : getConversationName().charAt(0)}
            </AvatarFallback>
          </Avatar>
          
          <div>
            <h2 className="font-bold text-slate-900 text-sm md:text-base">{getConversationName()}</h2>
            {conversation?.type === 'group' ? (
              <p className="text-xs text-slate-500">{conversation.participants.length} members</p>
            ) : (
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <p className="text-xs text-slate-500">Online</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="text-slate-400 hover:text-blue-600">
            <Phone className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="icon" className="text-slate-400 hover:text-blue-600">
            <Video className="w-5 h-5" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-600">
                <MoreVertical className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>View Details</DropdownMenuItem>
              <DropdownMenuItem>Mute Notifications</DropdownMenuItem>
              <DropdownMenuItem className="text-red-600">Block / Report</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 p-4 bg-slate-50/50">
        <div className="space-y-4 min-h-full flex flex-col justify-end">
          {messagesLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-20 text-slate-400">
              <p>No messages yet. Start the conversation!</p>
            </div>
          ) : (
            messages.map((msg, index) => {
              const isMe = msg.sender_email === currentUser.email;
              const showAvatar = index === 0 || messages[index - 1].sender_email !== msg.sender_email;
              
              if (msg.is_deleted) {
                return (
                  <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} group`}>
                    <div className={`flex max-w-[80%] md:max-w-[70%] gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                      <div className="w-8 flex-shrink-0 flex flex-col justify-end">
                        {showAvatar ? (
                          <Avatar className="w-8 h-8 border border-white shadow-sm opacity-50">
                            <AvatarImage src={msg.sender_avatar_url} />
                            <AvatarFallback className="text-xs">{msg.sender_name?.[0]}</AvatarFallback>
                          </Avatar>
                        ) : <div className="w-8" />}
                      </div>
                      
                      <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                        <div className={`
                          px-4 py-2.5 rounded-2xl shadow-sm text-sm relative italic text-slate-500 border border-slate-100 bg-slate-50
                          ${isMe ? 'rounded-tr-none' : 'rounded-tl-none'}
                        `}>
                          <p>This message was deleted</p>
                          <span className="text-[10px] block mt-1 text-right opacity-70">
                            {format(new Date(msg.created_date), 'HH:mm')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} group`}>
                  <div className={`flex max-w-[80%] md:max-w-[70%] gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className="w-8 flex-shrink-0 flex flex-col justify-end">
                      {showAvatar ? (
                        <Avatar className="w-8 h-8 border border-white shadow-sm">
                          <AvatarImage src={msg.sender_avatar_url} />
                          <AvatarFallback className="text-xs">{msg.sender_name?.[0]}</AvatarFallback>
                        </Avatar>
                      ) : <div className="w-8" />}
                    </div>
                    
                    <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                      {showAvatar && (
                        <span className="text-xs text-slate-500 ml-1 mb-1">{msg.sender_name}</span>
                      )}
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <div className={`
                            px-4 py-2.5 rounded-2xl shadow-sm text-sm relative cursor-pointer
                            ${isMe 
                              ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-tr-none' 
                              : 'bg-white border border-slate-100 text-slate-800 rounded-tl-none'
                            }
                          `}>
                            {msg.message_type === 'image' && msg.file_url && (
                              <div className="mb-2 rounded-lg overflow-hidden">
                                <img src={msg.file_url} alt="Shared" className="max-w-full h-auto max-h-64 object-cover" />
                              </div>
                            )}
                            
                            {msg.message_type === 'file' && msg.file_url && (
                              <div className={`flex items-center gap-2 p-2 rounded mb-1 ${isMe ? 'bg-blue-800/30' : 'bg-slate-100'}`}>
                                <Paperclip className="w-4 h-4" />
                                <a href={msg.file_url} target="_blank" rel="noopener noreferrer" className="underline truncate max-w-[150px]">
                                  {msg.file_name || "Attached File"}
                                </a>
                              </div>
                            )}

                            {msg.content && <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>}
                            
                            <span className={`text-[10px] block mt-1 text-right opacity-70`}>
                              {format(new Date(msg.created_date), 'HH:mm')}
                            </span>
                          </div>
                        </DropdownMenuTrigger>
                        {isMe && (
                          <DropdownMenuContent align={isMe ? "end" : "start"}>
                            <DropdownMenuItem 
                              className="text-red-600 focus:text-red-600 cursor-pointer"
                              onClick={() => deleteMessageMutation.mutate(msg.id)}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete Message
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        )}
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-slate-200">
        <form onSubmit={handleSendMessage} className="flex items-end gap-2 max-w-4xl mx-auto">
          <div className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl flex items-center px-2 py-1 focus-within:ring-2 focus-within:ring-blue-100 focus-within:border-blue-400 transition-all">
            <Button 
              type="button" 
              variant="ghost" 
              size="icon" 
              className="text-slate-400 hover:text-slate-600 h-8 w-8 rounded-full"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingFile}
            >
              {uploadingFile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
            </Button>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              onChange={handleFileUpload} 
            />
            
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-2 py-2 h-auto max-h-32"
              autoComplete="off"
            />
            
            <Button 
              type="button" 
              variant="ghost" 
              size="icon" 
              className="text-slate-400 hover:text-slate-600 h-8 w-8 rounded-full"
            >
              <ImageIcon className="w-4 h-4" />
            </Button>
          </div>
          
          <Button 
            type="submit" 
            size="icon" 
            disabled={(!newMessage.trim() && !uploadingFile) || isSending}
            className="h-10 w-10 rounded-full bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-200 transition-all hover:scale-105 active:scale-95"
          >
            {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 ml-0.5" />}
          </Button>
        </form>
      </div>
    </div>
  );
}

