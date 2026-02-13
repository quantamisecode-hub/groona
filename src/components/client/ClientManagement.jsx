import React, { useState } from "react";
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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Client User Management</h2>
          <p className="text-slate-500">Manage client users and their access.</p>
        </div>
        {currentUser?.custom_role !== 'project_manager' && (
          <Button onClick={() => setIsInviteOpen(true)} className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-md transition-all hover:shadow-lg">
            <UserPlus className="h-4 w-4 mr-2" />
            Invite Client Users
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-medium">All Client Users</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-500" />
              <Input
                placeholder="Search users..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client Name</TableHead>
                <TableHead>User Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-400" />
                  </TableCell>
                </TableRow>
              ) : filteredClients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                    No client users found. Invite one to get started.
                  </TableCell>
                </TableRow>
              ) : (
                filteredClients.map((client) => {
                  const org = organizations.find(o => String(o.id) === String(client.client_id || '')) || {};
                  return (
                    <TableRow key={client.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8 border border-slate-200">
                            <AvatarImage src={org.logo_url} className="object-cover" />
                            <AvatarFallback className="bg-slate-100 text-slate-500 font-bold">
                              {org.name ? org.name.charAt(0).toUpperCase() : '?'}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium text-slate-700">
                            {org.name || 'N/A'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8 border-2 border-slate-200">
                            <AvatarImage src={client.profile_image_url} alt={client.full_name} />
                            <AvatarFallback className="bg-blue-100 text-blue-700 font-semibold">
                              {client.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          {client.full_name}
                        </div>
                      </TableCell>
                      <TableCell>{client.email}</TableCell>
                      <TableCell>
                        <Badge variant={client.status === 'active' ? 'default' : 'secondary'} className={client.status === 'active' ? 'bg-green-100 text-green-700 hover:bg-green-200' : ''}>
                          {client.status || 'Pending'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>

                            <DropdownMenuItem onClick={() => setEditingClient(client)}>
                              <Edit2 className="mr-2 h-4 w-4" /> Edit Details
                            </DropdownMenuItem>

                            <DropdownMenuItem onClick={() => setResetConfirmationClient(client)}>
                              <KeyRound className="mr-2 h-4 w-4" /> Reset & View Password
                            </DropdownMenuItem>

                            <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => setDeleteConfirmationUser(client)}>
                              <Trash2 className="mr-2 h-4 w-4" /> Delete User
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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

