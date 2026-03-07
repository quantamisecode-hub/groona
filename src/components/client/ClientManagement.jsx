import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { groonabackend, API_BASE } from "@/api/groonabackend";
import axios from "axios";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, MoreHorizontal, Search, UserPlus, Mail, Trash2, Edit2, KeyRound, Eye, Copy, Check, Building2 } from "lucide-react";
import { toast } from "sonner";
import InviteClientDialog from "./InviteClientDialog";
import EditClientDialog from "./EditClientDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useUser } from "@/components/shared/UserContext";

export default function ClientManagement({ tenantId }) {
  const { user: currentUser, effectiveTenantId } = useUser();
  const finalTenantId = tenantId || effectiveTenantId;
  const [searchTerm, setSearchTerm] = useState("");
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [deleteConfirmationUser, setDeleteConfirmationUser] = useState(null);
  const [resetPasswordData, setResetPasswordData] = useState(null);
  const [resetConfirmationClient, setResetConfirmationClient] = useState(null);
  const queryClient = useQueryClient();

  // Fetch Client Organizations
  const { data: organizations = [] } = useQuery({
    queryKey: ['organizations', finalTenantId],
    queryFn: async () => {
      if (!finalTenantId) return [];
      return groonabackend.entities.Client.filter({ tenant_id: finalTenantId });
    },
    enabled: !!finalTenantId
  });

  // Fetch Client Users (Users with custom_role = 'client')
  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['client-users', finalTenantId],
    queryFn: async () => {
      // Fetch users who are clients for this tenant
      const allClients = await groonabackend.entities.User.filter({ custom_role: 'client' });
      return finalTenantId ? allClients.filter(c => c.tenant_id === finalTenantId) : allClients;
    },
    enabled: !!finalTenantId
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (userId) => {
      const token = localStorage.getItem('auth_token');
      await axios.delete(`${API_BASE}/api/clients/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
    },
    onSuccess: () => {
      toast.success("Client user deleted successfully");
      queryClient.invalidateQueries(['client-users']);
    },
    onError: (err) => toast.error("Failed to delete client user")
  });

  // Reset Password Mutation
  const resetPasswordMutation = useMutation({
    mutationFn: async (client) => {
      const token = localStorage.getItem('auth_token');
      const res = await axios.post(`${API_BASE}/api/clients/reset-password`, { user_id: client.id }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return { password: res.data.new_password, email: client.email };
    },
    onSuccess: (data) => {
      setResetPasswordData(data); // Open dialog with password
      toast.success("Password reset and emailed!");
    },
    onError: () => toast.error("Failed to reset password")
  });

  const filteredClients = clients.filter(client =>
    client.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="space-y-1">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Client User Management</h2>
          <p className="text-xs sm:text-sm text-slate-500 font-medium leading-relaxed">
            Manage external client users, their organizations, and secure platform access.
          </p>
        </div>
        {currentUser?.custom_role !== 'project_manager' && (
          <Button
            onClick={() => setIsInviteOpen(true)}
            className="bg-gradient-to-r from-blue-600 to-slate-900 border-0 shadow-lg shadow-blue-500/20 hover:from-blue-700 hover:to-slate-950 hover:opacity-90 text-white h-11 rounded-lg px-6 font-bold transition-all active:scale-[0.98] w-full sm:w-auto flex items-center gap-2"
          >
            <UserPlus className="h-4.5 w-4.5" />
            <span>Invite Client Users</span>
          </Button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
        {/* Modern Search Bar */}
        <div className="flex items-center gap-2 bg-white border border-slate-200 shadow-sm rounded-lg p-1 px-3 h-11 w-full sm:w-80">
          <Search className="h-4 w-4 text-slate-400 flex-shrink-0" />
          <Input
            placeholder="Search by name or email..."
            className="h-9 w-full text-sm border-0 shadow-none focus-visible:ring-0 bg-transparent px-1"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {filteredClients.length > 0 && (
          <div className="flex items-center gap-2 px-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Showing {filteredClients.length} Users
            </span>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-32 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Loading Client Records...</p>
        </div>
      ) : filteredClients.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 px-4 bg-white rounded-[2rem] border border-slate-100 shadow-sm">
          <div className="h-20 w-20 rounded-full bg-slate-50 flex items-center justify-center text-slate-200 mb-6 transition-transform duration-500 hover:scale-110">
            <Building2 className="h-10 w-10" />
          </div>
          <div className="text-center max-w-xs mx-auto space-y-2 mb-8">
            <h3 className="text-[17px] font-bold text-slate-900 tracking-tight">No client users yet</h3>
            <p className="text-sm text-slate-500 font-medium leading-relaxed">Collaborate with your partners by inviting them to join your workspace projects.</p>
          </div>
          <Button
            onClick={() => setIsInviteOpen(true)}
            variant="outline"
            className="rounded-xl border-slate-200 text-slate-600 font-bold h-11 px-6 hover:bg-slate-50 active:scale-95 transition-all"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Invite Your First Client
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredClients.map((client) => {
            const org = organizations.find(o => String(o.id) === String(client.client_id || '')) || {};
            const initials = client.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';

            return (
              <div key={client.id} className="bg-white rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-blue-500/5 hover:border-blue-100 transition-all duration-500 p-6 flex flex-col gap-6 group">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Avatar className="h-12 w-12 rounded-2xl ring-2 ring-slate-50 transition-all duration-500 group-hover:ring-blue-50">
                        <AvatarImage src={client.profile_image_url} alt={client.full_name} className="object-cover" />
                        <AvatarFallback className="bg-purple-50 text-purple-600 font-black text-xs">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-lg bg-white shadow-sm border border-slate-100 flex items-center justify-center">
                        <Badge className={cn(
                          "h-2 w-2 rounded-full p-0 border-0",
                          client.status === 'active' ? "bg-emerald-500" : "bg-slate-300"
                        )} />
                      </div>
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-[15px] font-bold text-slate-900 truncate tracking-tight">{client.full_name}</h4>
                      <p className="text-xs font-medium text-slate-400 truncate mt-0.5">{client.email}</p>
                    </div>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 opacity-0 group-hover:opacity-100 transition-all">
                        <MoreHorizontal className="h-4.5 w-4.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="rounded-xl border-slate-100 shadow-xl min-w-[160px]">
                      <DropdownMenuLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-3 pt-3">Actions</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => setEditingClient(client)} className="rounded-lg m-1 py-2 font-medium">
                        <Edit2 className="mr-2 h-4 w-4" /> Edit Details
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setResetConfirmationClient(client)} className="rounded-lg m-1 py-2 font-medium">
                        <KeyRound className="mr-2 h-4 w-4" /> Reset Password
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-rose-600 focus:text-rose-600 rounded-lg m-1 py-2 font-medium" onClick={() => setDeleteConfirmationUser(client)}>
                        <Trash2 className="mr-2 h-4 w-4" /> Delete User
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="h-px bg-slate-50" />

                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="bg-slate-50 p-2 rounded-xl group-hover:bg-blue-50 transition-colors">
                        <Building2 className="h-4 w-4 text-slate-400 group-hover:text-blue-500" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest block">Organization</span>
                        <span className="text-xs font-bold text-slate-700 truncate block">{org.name || 'Personal Client'}</span>
                      </div>
                    </div>

                    <Badge variant="outline" className={cn(
                      "rounded-lg border-0 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest",
                      client.status === 'active' ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"
                    )}>
                      {client.status || 'Pending'}
                    </Badge>
                  </div>
                </div>

                <div className="mt-auto">
                  <Button
                    variant="ghost"
                    className="w-full h-10 rounded-xl bg-slate-50 hover:bg-blue-600 hover:text-white text-slate-600 font-bold text-[10px] uppercase tracking-widest transition-all active:scale-[0.98]"
                    onClick={() => setResetConfirmationClient(client)}
                  >
                    Security Settings
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* --- DIALOGS --- */}
      <InviteClientDialog
        open={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        onSuccess={() => queryClient.invalidateQueries(['client-users'])}
        tenantId={finalTenantId}
        organizations={organizations}
      />

      {editingClient && (
        <EditClientDialog
          client={editingClient}
          open={!!editingClient}
          onClose={() => setEditingClient(null)}
          onSuccess={() => queryClient.invalidateQueries(['client-users'])}
          organizations={organizations}
        />
      )}

      {/* Show Password Dialog (After Reset) */}
      <Dialog open={!!resetPasswordData} onOpenChange={() => setResetPasswordData(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-blue-600" /> New Password Generated
            </DialogTitle>
            <DialogDescription>
              The user's password has been reset. Copy it below.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-slate-50 p-4 rounded-lg border space-y-4">
            <div className="space-y-1">
              <span className="text-xs uppercase text-slate-500 font-bold">User Email</span>
              <p className="text-sm">{resetPasswordData?.email}</p>
            </div>
            <div className="space-y-1">
              <span className="text-xs uppercase text-slate-500 font-bold">New Password</span>
              <div className="flex gap-2">
                <code className="flex-1 bg-white border p-2 rounded font-mono text-blue-700 font-bold">
                  {resetPasswordData?.password}
                </code>
                <Button size="icon" variant="outline" onClick={() => {
                  navigator.clipboard.writeText(resetPasswordData?.password);
                  toast.success("Copied to clipboard");
                }}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex items-start gap-2 text-xs text-amber-600 bg-amber-50 p-2 rounded">
              <Mail className="h-4 w-4 mt-0.5" />
              <p>An email with these credentials has also been sent to the user.</p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setResetPasswordData(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirmationUser} onOpenChange={() => setDeleteConfirmationUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the user account for
              <span className="font-semibold text-slate-900"> {deleteConfirmationUser?.full_name} </span>
              and remove their access to all assigned projects.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
              onClick={() => {
                if (deleteConfirmationUser) {
                  deleteMutation.mutate(deleteConfirmationUser.id);
                  setDeleteConfirmationUser(null);
                }
              }}
            >
              Delete User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!resetConfirmationClient} onOpenChange={() => setResetConfirmationClient(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Password?</AlertDialogTitle>
            <AlertDialogDescription>
              This will generate a new password for
              <span className="font-semibold text-slate-900"> {resetConfirmationClient?.full_name} </span>
              and email it to them. You will also see the password immediately after.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => {
                if (resetConfirmationClient) {
                  resetPasswordMutation.mutate(resetConfirmationClient);
                  setResetConfirmationClient(null);
                }
              }}
            >
              Reset Password
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}

