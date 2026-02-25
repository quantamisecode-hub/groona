import React, { useState, useEffect, useRef } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send, Paperclip, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export default function ChatRoom({ roomId = "general", roomTitle = "General Chat", projectId = null }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [message, setMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    groonabackend.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  // Fetch messages
  const { data: messages = [] } = useQuery({
    queryKey: ['chat-messages', roomId],
    queryFn: () => groonabackend.entities.ChatMessage.filter({ chat_room: roomId }, '-created_date', 100),
    refetchInterval: 3000, // Refresh every 3 seconds
  });

  // Fetch online users in this room
  const { data: onlineUsers = [] } = useQuery({
    queryKey: ['presence', roomId],
    queryFn: async () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const users = await groonabackend.entities.UserPresence.filter({
        last_seen: { $gte: fiveMinutesAgo },
        current_chat_room: roomId,
      });
      return users.filter(u => u.user_email !== currentUser?.email);
    },
    refetchInterval: 15000, // Refresh every 15 seconds
    enabled: !!currentUser,
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (messageData) => {
      return await groonabackend.entities.ChatMessage.create(messageData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-messages', roomId] });
      setMessage("");
      setIsTyping(false);
      updatePresence(false);
    },
  });

  // Update presence
  const updatePresence = async (typing = false) => {
    if (!currentUser) return;

    try {
      const existingPresence = await groonabackend.entities.UserPresence.filter({
        user_email: currentUser.email,
      });

      const presenceData = {
        user_email: currentUser.email,
        user_name: currentUser.full_name,
        status: 'online',
        last_seen: new Date().toISOString(),
        current_chat_room: roomId,
        is_typing: typing,
        typing_in_room: typing ? roomId : null,
      };

      if (existingPresence.length > 0) {
        await groonabackend.entities.UserPresence.update(existingPresence[0].id, presenceData);
      } else {
        await groonabackend.entities.UserPresence.create(presenceData);
      }
    } catch (error) {
      console.error("Presence update failed:", error);
    }
  };

  // Handle typing
  useEffect(() => {
    if (message.trim() && !isTyping) {
      setIsTyping(true);
      updatePresence(true);
    } else if (!message.trim() && isTyping) {
      setIsTyping(false);
      updatePresence(false);
    }
  }, [message]);

  // Update presence on mount and cleanup
  useEffect(() => {
    if (currentUser) {
      updatePresence(false);

      const interval = setInterval(() => updatePresence(false), 30000); // Heartbeat every 30s

      return () => {
        clearInterval(interval);
        updatePresence(false);
      };
    }
  }, [currentUser, roomId]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = () => {
    if (!message.trim() || !currentUser) return;

    sendMessageMutation.mutate({
      content: message.trim(),
      sender_email: currentUser.email,
      sender_name: currentUser.full_name,
      chat_room: roomId,
      project_id: projectId,
      message_type: 'text',
    });
  };

  const getInitials = (name) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
  };

  const typingUsers = onlineUsers.filter(u => u.is_typing && u.typing_in_room === roomId);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{roomTitle}</CardTitle>
          {onlineUsers.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <div className="flex -space-x-2">
                {onlineUsers.slice(0, 3).map((user, i) => (
                  <Avatar key={i} className="h-6 w-6 border-2 border-white">
                    <AvatarFallback className="text-xs bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                      {getInitials(user.user_name)}
                    </AvatarFallback>
                  </Avatar>
                ))}
              </div>
              <span>{onlineUsers.length} online</span>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0">
        {/* Messages */}
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="space-y-4">
            {messages.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <p>No messages yet</p>
                <p className="text-sm mt-1">Be the first to start the conversation!</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isOwnMessage = msg.sender_email === currentUser?.email;
                return (
                  <div
                    key={msg.id}
                    className={`flex gap-3 ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'}`}
                  >
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarFallback className={`text-xs font-bold ${
                        isOwnMessage 
                          ? 'bg-gradient-to-br from-blue-500 to-purple-600 text-white'
                          : 'bg-slate-200 text-slate-700'
                      }`}>
                        {getInitials(msg.sender_name)}
                      </AvatarFallback>
                    </Avatar>

                    <div className={`flex-1 max-w-[70%] ${isOwnMessage ? 'items-end' : 'items-start'} flex flex-col`}>
                      {!isOwnMessage && (
                        <span className="text-xs font-medium text-slate-700 mb-1">
                          {msg.sender_name}
                        </span>
                      )}
                      <div
                        className={`rounded-2xl px-4 py-2 ${
                          isOwnMessage
                            ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white'
                            : 'bg-slate-100 text-slate-900'
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                      </div>
                      <span className="text-xs text-slate-500 mt-1">
                        {format(new Date(msg.created_date), 'h:mm a')}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>

        {/* Typing Indicator */}
        {typingUsers.length > 0 && (
          <div className="px-4 py-2 text-xs text-slate-600 italic border-t">
            {typingUsers[0].user_name} is typing...
          </div>
        )}

        {/* Input */}
        <div className="p-4 border-t">
          <div className="flex gap-2">
            <Input
              placeholder="Type a message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              disabled={sendMessageMutation.isPending}
            />
            <Button
              onClick={handleSendMessage}
              disabled={!message.trim() || sendMessageMutation.isPending}
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
            >
              {sendMessageMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

