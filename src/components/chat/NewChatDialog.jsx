import React, { useState } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Users, Check, Loader2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

export default function NewChatDialog({ open, onOpenChange, currentUser, tenantId, onConversationCreated }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [groupName, setGroupName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Fetch users
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['users-for-chat', tenantId],
    queryFn: () => groonabackend.entities.UserProfile.list(), // Assuming UserProfile exists or use users endpoint if available
  });

  // Filter users
  const filteredUsers = users.filter(u => 
    u.user_email !== currentUser.email && 
    (u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
     u.user_email?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const toggleUser = (user) => {
    if (selectedUsers.find(u => u.user_email === user.user_email)) {
      setSelectedUsers(selectedUsers.filter(u => u.user_email !== user.user_email));
    } else {
      setSelectedUsers([...selectedUsers, user]);
    }
  };

  const handleCreateChat = async (type) => {
    if (selectedUsers.length === 0) {
      toast.error("Select at least one user");
      return;
    }
    if (type === 'group' && !groupName) {
      toast.error("Enter a group name");
      return;
    }

    setIsCreating(true);
    try {
      const participants = [currentUser.email, ...selectedUsers.map(u => u.user_email)];
      const participantDetails = [
        { email: currentUser.email, name: currentUser.full_name, avatar_url: currentUser.profile_image_url },
        ...selectedUsers.map(u => ({ email: u.user_email, name: u.full_name, avatar_url: u.profile_image_url }))
      ];

      const conversation = await groonabackend.entities.Conversation.create({
        tenant_id: tenantId,
        type: type,
        name: type === 'group' ? groupName : null,
        participants: participants,
        participant_details: participantDetails,
        created_by: currentUser.email,
        admins: type === 'group' ? [currentUser.email] : [],
        last_message_at: new Date().toISOString()
      });

      onConversationCreated(conversation.id);
      toast.success("Chat started!");
      setSelectedUsers([]);
      setGroupName("");
    } catch (error) {
      console.error(error);
      toast.error("Failed to create chat");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Message</DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="direct" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="direct">Direct Message</TabsTrigger>
            <TabsTrigger value="group">Group Chat</TabsTrigger>
          </TabsList>
          
          {/* Common Search */}
          <div className="mt-4 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Search people..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9" 
            />
          </div>

          {/* User List */}
          <ScrollArea className="h-60 mt-4 border rounded-md p-2">
            {usersLoading ? (
              <div className="flex justify-center p-4"><Loader2 className="animate-spin" /></div>
            ) : filteredUsers.length === 0 ? (
              <p className="text-center text-slate-500 p-4">No users found</p>
            ) : (
              <div className="space-y-1">
                {filteredUsers.map(user => {
                  const isSelected = selectedUsers.find(u => u.user_email === user.user_email);
                  return (
                    <div 
                      key={user.user_email}
                      onClick={() => toggleUser(user)}
                      className={`flex items-center justify-between p-2 rounded cursor-pointer hover:bg-slate-100 ${isSelected ? 'bg-blue-50 hover:bg-blue-50' : ''}`}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={user.profile_image_url} />
                          <AvatarFallback>{user.full_name?.[0]}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium text-slate-900">{user.full_name}</p>
                          <p className="text-xs text-slate-500">{user.user_email}</p>
                        </div>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-blue-600" />}
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          <TabsContent value="direct">
            <div className="mt-4 flex justify-end">
              <Button 
                onClick={() => handleCreateChat('direct')} 
                disabled={selectedUsers.length !== 1 || isCreating}
                className="w-full"
              >
                {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Start Chat"}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="group">
            <div className="mt-4 space-y-4">
              <Input 
                placeholder="Group Name" 
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                {selectedUsers.map(u => (
                  <Badge key={u.user_email} variant="secondary" className="flex items-center gap-1">
                    {u.full_name}
                    <X className="w-3 h-3 cursor-pointer" onClick={() => toggleUser(u)} />
                  </Badge>
                ))}
              </div>
              <Button 
                onClick={() => handleCreateChat('group')} 
                disabled={selectedUsers.length < 1 || !groupName || isCreating}
                className="w-full"
              >
                {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Group"}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

