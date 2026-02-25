import React, { useState, useEffect, useRef } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, MessageSquare, Users, Search, Phone, Video, Settings, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useUser } from "@/components/shared/UserContext";
import ChatSidebar from "../components/chat/ChatSidebar";
import ChatWindow from "../components/chat/ChatWindow";
import NewChatDialog from "../components/chat/NewChatDialog";
import { toast } from "sonner";

export default function ChatPage() {
  const { user: currentUser, effectiveTenantId } = useUser();
  const [selectedConversationId, setSelectedConversationId] = useState(null);
  const [showNewChatDialog, setShowNewChatDialog] = useState(false);
  const [isMobileView, setIsMobileView] = useState(false);
  
  // Handle responsive view
  useEffect(() => {
    const handleResize = () => {
      setIsMobileView(window.innerWidth < 768);
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleSelectConversation = (conversationId) => {
    setSelectedConversationId(conversationId);
  };

  const handleBackToSidebar = () => {
    setSelectedConversationId(null);
  };

  if (!currentUser) return null;

  return (
    <div className="h-[calc(100vh-65px)] flex bg-slate-50">
      {/* Sidebar - Hidden on mobile if conversation selected */}
      <div className={`${
        isMobileView && selectedConversationId ? 'hidden' : 'flex'
      } w-full md:w-80 lg:w-96 flex-col border-r border-slate-200 bg-white h-full`}>
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white/50 backdrop-blur-sm">
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-blue-600" />
            Messages
          </h1>
          <Button 
            size="icon" 
            variant="ghost" 
            onClick={() => setShowNewChatDialog(true)}
            className="h-8 w-8 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-600"
          >
            <Plus className="w-5 h-5" />
          </Button>
        </div>
        
        <ChatSidebar 
          currentUser={currentUser}
          selectedConversationId={selectedConversationId}
          onSelectConversation={handleSelectConversation}
          tenantId={effectiveTenantId}
        />
      </div>

      {/* Chat Window - Hidden on mobile if no conversation selected */}
      <div className={`${
        isMobileView && !selectedConversationId ? 'hidden' : 'flex'
      } flex-1 flex-col h-full bg-slate-50/50`}>
        {selectedConversationId ? (
          <ChatWindow 
            conversationId={selectedConversationId}
            currentUser={currentUser}
            onBack={handleBackToSidebar}
            tenantId={effectiveTenantId}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8">
            <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6 shadow-inner">
              <MessageSquare className="w-10 h-10 text-slate-300" />
            </div>
            <h2 className="text-xl font-semibold text-slate-700 mb-2">No Chat Selected</h2>
            <p className="text-center max-w-xs text-slate-500">
              Select a conversation from the sidebar or start a new chat to begin messaging.
            </p>
            <Button 
              className="mt-6 bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => setShowNewChatDialog(true)}
            >
              Start New Conversation
            </Button>
          </div>
        )}
      </div>

      <NewChatDialog 
        open={showNewChatDialog} 
        onOpenChange={setShowNewChatDialog}
        currentUser={currentUser}
        tenantId={effectiveTenantId}
        onConversationCreated={(id) => {
          setSelectedConversationId(id);
          setShowNewChatDialog(false);
        }}
      />
    </div>
  );
}

