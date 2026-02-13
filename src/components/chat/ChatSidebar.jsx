import React, { useState, useMemo } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Search, Loader2, Users } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";

export default function ChatSidebar({ currentUser, selectedConversationId, onSelectConversation, tenantId }) {
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch conversations
  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ['conversations', currentUser.email, tenantId],
    queryFn: async () => {
      // Fetch conversations where the user is a participant
      // Note: This is a simplified query. In a real app, you'd likely have a more specific filter or a dedicated endpoint.
      // Since we can't query array contains easily with simple filters in some systems, we might filter client side if dataset is small, 
      // or assume the backend supports it. Here we'll fetch and filter.
      const allConvos = await groonabackend.entities.Conversation.filter({ tenant_id: tenantId }, '-last_message_at', 50);
      return allConvos.filter(c => c.participants && c.participants.includes(currentUser.email));
    },
    refetchInterval: 5000, // Poll for new conversations/updates
  });

  const filteredConversations = useMemo(() => {
    if (!searchQuery) return conversations;
    return conversations.filter(c => {
      const name = c.name || c.participant_details?.find(p => p.email !== currentUser.email)?.name || "Unknown";
      return name.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [conversations, searchQuery, currentUser.email]);

  const getConversationName = (conversation) => {
    if (conversation.type === 'group') return conversation.name;
    const otherParticipant = conversation.participant_details?.find(p => p.email !== currentUser.email);
    return otherParticipant?.name || conversation.participants.find(p => p !== currentUser.email) || "Unknown User";
  };

  const getConversationAvatar = (conversation) => {
    if (conversation.type === 'group') return null;
    const otherParticipant = conversation.participant_details?.find(p => p.email !== currentUser.email);
    return otherParticipant?.avatar_url;
  };

  const getInitials = (name) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-40">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input 
            placeholder="Search messages..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-slate-50 border-slate-200 focus:bg-white transition-all" 
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filteredConversations.length === 0 ? (
          <div className="text-center text-slate-400 p-6 text-sm">
            {searchQuery ? "No conversations found" : "No conversations yet"}
          </div>
        ) : (
          <div className="space-y-1 p-2">
            {filteredConversations.map((conversation) => {
              const name = getConversationName(conversation);
              const avatarUrl = getConversationAvatar(conversation);
              const isSelected = selectedConversationId === conversation.id;
              const isGroup = conversation.type === 'group';
              const lastMessageTime = conversation.last_message_at ? formatDistanceToNow(new Date(conversation.last_message_at), { addSuffix: false }) : "";
              
              // Hacky unread check: if last message wasn't sent by me and I haven't "read" it (in a real app we'd track read status properly per user)
              // For now, bold the text if last message sender is not me
              const isUnread = conversation.last_sender_email && conversation.last_sender_email !== currentUser.email; // Simplified logic

              return (
                <div
                  key={conversation.id}
                  onClick={() => onSelectConversation(conversation.id)}
                  className={`
                    flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200
                    ${isSelected 
                      ? 'bg-blue-50 border-blue-100 shadow-sm' 
                      : 'hover:bg-slate-50 border border-transparent'
                    }
                  `}
                >
                  <div className="relative">
                    <Avatar className={`h-10 w-10 border-2 ${isSelected ? 'border-blue-200' : 'border-white shadow-sm'}`}>
                      <AvatarImage src={avatarUrl} />
                      <AvatarFallback className={isGroup ? "bg-indigo-100 text-indigo-600" : "bg-blue-100 text-blue-600"}>
                        {isGroup ? <Users className="w-5 h-5" /> : getInitials(name)}
                      </AvatarFallback>
                    </Avatar>
                    {/* Online indicator could go here */}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <h3 className={`text-sm truncate ${isUnread ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>
                        {name}
                      </h3>
                      {conversation.last_message_at && (
                        <span className="text-[10px] text-slate-400 flex-shrink-0 ml-2">
                          {lastMessageTime.replace('about ', '')}
                        </span>
                      )}
                    </div>
                    <p className={`text-xs truncate ${isUnread ? 'text-slate-800 font-medium' : 'text-slate-500'}`}>
                      {conversation.last_sender_email === currentUser.email && "You: "}
                      {conversation.last_message || "No messages yet"}
                    </p>
                  </div>
                  
                  {isUnread && (
                    <div className="w-2.5 h-2.5 bg-blue-600 rounded-full shadow-sm shadow-blue-200"></div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

