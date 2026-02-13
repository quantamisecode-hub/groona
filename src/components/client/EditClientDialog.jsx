import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { groonabackend, API_BASE } from "@/api/groonabackend";
import axios from "axios";
import { toast } from "sonner";
import { Loader2, KeyRound, Copy, Layout } from "lucide-react";
import { useUser } from "@/components/shared/UserContext";

export default function EditClientDialog({ client, open, onClose, onSuccess, organizations = [] }) {
    const { effectiveTenantId } = useUser();
    const [name, setName] = useState('');
    const [clientId, setClientId] = useState('');
    const [status, setStatus] = useState('active');
    const [loading, setLoading] = useState(false);
    const [resetLoading, setResetLoading] = useState(false);
    const [newPassword, setNewPassword] = useState(null);

    // Filter out inactive organizations (unless it's the one currently selected)
    const activeOrganizations = organizations.filter(org => !org.status || org.status === 'active' || org.id === clientId);

    // Project Management State
    const [availableProjects, setAvailableProjects] = useState([]);
    const [selectedProjectIds, setSelectedProjectIds] = useState(new Set());
    const [projectsLoading, setProjectsLoading] = useState(true);

    useEffect(() => {
        if (client) {
            setName(client.name || client.full_name);
            setClientId(client.client_id || '');
            setStatus(client.status || 'active');
            setNewPassword(null);
            fetchProjectsAndAssignments();
        }
    }, [client, open]);

    const fetchProjectsAndAssignments = async () => {
        setProjectsLoading(true);
        try {
            const userId = client.client_user_id || client.id || client.user_id;

            // 1. Fetch all tenant projects
            const allProjects = await groonabackend.entities.Project.filter({ tenant_id: effectiveTenantId });
            setAvailableProjects(allProjects);

            // 2. Fetch current assignments for this client
            const assignments = await groonabackend.entities.ProjectClient.filter({ client_user_id: userId });
            const currentIds = new Set(assignments.map(a => a.project_id));
            setSelectedProjectIds(currentIds);

        } catch (error) {
            console.error("Error fetching projects:", error);
            toast.error("Failed to load project assignments");
        } finally {
            setProjectsLoading(false);
        }
    };

    const handleProjectToggle = (projectId) => {
        const newSelected = new Set(selectedProjectIds);
        if (newSelected.has(projectId)) {
            newSelected.delete(projectId);
        } else {
            newSelected.add(projectId);
        }
        setSelectedProjectIds(newSelected);
    };

    const handleSave = async () => {
        if (!clientId) {
            toast.error("Please select a client organization");
            return;
        }
        setLoading(true);
        const userId = client.client_user_id || client.id || client.user_id;
        const token = localStorage.getItem('auth_token');

        try {
            // Use custom endpoint to handle both user update and project syncing
            await axios.put(`${API_BASE}/api/clients/${userId}`, {
                full_name: name,
                client_id: clientId,
                status: status, // Send status
                email: client.email, // Passing email to keep it synced/safe
                project_ids: Array.from(selectedProjectIds)
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            toast.success("Client user updated successfully");
            onSuccess();
            onClose();
        } catch (e) {
            console.error(e);
            toast.error("Failed to update client user");
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async () => {
        if (!window.confirm("Are you sure? This will generate a new password and email it to the client user.")) return;

        setResetLoading(true);
        const userId = client.client_user_id || client.id || client.user_id;

        try {
            const token = localStorage.getItem('auth_token');
            const res = await axios.post(`${API_BASE}/api/clients/reset-password`, {
                user_id: userId
            }, { headers: { Authorization: `Bearer ${token}` } });

            setNewPassword(res.data.new_password);
            toast.success("Password reset successfully");
        } catch (e) {
            toast.error("Failed to reset password");
        } finally {
            setResetLoading(false);
        }
    };

    const selectedOrg = organizations.find(o => o.id === clientId);

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Edit Client User: {client?.email}</DialogTitle>
                    <DialogDescription>
                        Update client details, project assignments, and manage account status.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Edit Form */}
                    <div className="space-y-3">
                        <div className="space-y-2">
                            <Label>Client Organization</Label>
                            <Select value={clientId} onValueChange={setClientId}>
                                <SelectTrigger className="h-12">
                                    <SelectValue placeholder="Select client organization">
                                        {selectedOrg ? (
                                            <div className="flex items-center gap-3">
                                                <Avatar className="h-8 w-8 border border-slate-200">
                                                    <AvatarImage src={selectedOrg.logo_url} className="object-cover" />
                                                    <AvatarFallback className="bg-slate-100 text-slate-500 font-bold">
                                                        {selectedOrg.name.charAt(0).toUpperCase()}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <span className="font-medium">{selectedOrg.name}</span>
                                            </div>
                                        ) : "Select client organization"}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent className="max-h-60">
                                    {activeOrganizations.map(org => (
                                        <SelectItem key={org.id} value={org.id} className="py-2">
                                            <div className="flex items-center gap-3">
                                                <Avatar className="h-8 w-8 border border-slate-200">
                                                    <AvatarImage src={org.logo_url} className="object-cover" />
                                                    <AvatarFallback className="bg-slate-100 text-slate-500 font-bold">
                                                        {org.name.charAt(0).toUpperCase()}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <span className="font-medium">{org.name}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                    {activeOrganizations.length === 0 && <div className="p-3 text-sm text-center text-slate-500">No active organizations found</div>}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>User Name</Label>
                            <Input value={name} onChange={e => setName(e.target.value)} placeholder="User Name" />
                        </div>

                        <div className="space-y-2">
                            <Label>Account Status</Label>
                            <Select value={status} onValueChange={setStatus}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="active">
                                        <div className="flex items-center gap-2">
                                            <div className="h-2 w-2 rounded-full bg-green-500" />
                                            Active
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="inactive">
                                        <div className="flex items-center gap-2">
                                            <div className="h-2 w-2 rounded-full bg-red-500" />
                                            Inactive (Access Restricted)
                                        </div>
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <Label className="flex items-center gap-2">
                            <Layout className="h-4 w-4" /> Assigned Projects
                        </Label>

                        <div className="border rounded-lg p-3 max-h-[200px] overflow-y-auto space-y-2 bg-slate-50">
                            {projectsLoading ? (
                                <div className="flex items-center justify-center py-4">
                                    <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                                </div>
                            ) : availableProjects.filter(p => clientId && String(p.client) === String(clientId)).length === 0 ? (
                                <p className="text-sm text-slate-500 text-center py-2">
                                    {!clientId ? "Select a client organization first" : "No projects associated with this client organization."}
                                </p>
                            ) : (
                                availableProjects
                                    .filter(p => clientId && String(p.client) === String(clientId))
                                    .map(project => (
                                        <div key={project.id} className="flex items-center space-x-2 bg-white p-2 rounded border border-slate-100">
                                            <Checkbox
                                                id={`proj-${project.id}`}
                                                checked={selectedProjectIds.has(project.id)}
                                                onCheckedChange={() => handleProjectToggle(project.id)}
                                            />
                                            <Label
                                                htmlFor={`proj-${project.id}`}
                                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer w-full"
                                            >
                                                {project.name}
                                            </Label>
                                        </div>
                                    ))
                            )}
                        </div>
                        <p className="text-xs text-slate-500">
                            Selected projects will appear on the client user's dashboard.
                        </p>
                    </div>

                    <div className="h-px bg-slate-100" />

                    {/* Password Section */}
                    <div className="space-y-2">
                        <Label className="text-slate-900 font-semibold flex items-center gap-2">
                            <KeyRound className="h-4 w-4" /> Password Management
                        </Label>

                        {!newPassword ? (
                            <div className="flex justify-between items-center bg-slate-50 p-3 rounded border">
                                <span className="text-sm text-slate-500">Password is hidden (Secure)</span>
                                <Button variant="destructive" size="sm" onClick={handleResetPassword} disabled={resetLoading}>
                                    {resetLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reset Password"}
                                </Button>
                            </div>
                        ) : (
                            <div className="bg-green-50 border border-green-200 p-3 rounded space-y-2">
                                <p className="text-xs text-green-700 font-semibold uppercase">New Password Generated</p>
                                <div className="flex gap-2">
                                    <code className="flex-1 bg-white border border-green-200 p-2 rounded font-mono text-green-800">
                                        {newPassword}
                                    </code>
                                    <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => { navigator.clipboard.writeText(newPassword); toast.success('Copied') }}>
                                        <Copy className="h-4 w-4 text-green-700" />
                                    </Button>
                                </div>
                                <p className="text-xs text-green-600">The client has been emailed this password.</p>
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter className="mt-4">
                    <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
                    <Button onClick={handleSave} disabled={loading} className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-md">
                        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Save Changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

