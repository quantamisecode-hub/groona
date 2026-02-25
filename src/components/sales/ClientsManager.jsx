import React, { useState } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Users, Pencil, Trash2, Mail, Phone, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import ClientDialog from "@/components/sales/ClientDialog";

export default function ClientsManager() {
    const [search, setSearch] = useState("");
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingClient, setEditingClient] = useState(null);
    const queryClient = useQueryClient();

    const { data: user } = useQuery({
        queryKey: ['me'],
        queryFn: () => groonabackend.auth.me(),
    });

    const { data: clients = [], isLoading } = useQuery({
        queryKey: ['clients'],
        queryFn: async () => {
            const all = await groonabackend.entities.Client.list('-created_date');
            if (user?.tenant_id) {
                return all.filter(c => c.tenant_id === user.tenant_id);
            }
            return all;
        },
        enabled: !!user,
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => groonabackend.entities.Client.delete(id),
        onSuccess: () => {
            toast.success("Client deleted");
            queryClient.invalidateQueries(['clients']);
        }
    });

    const handleEdit = (client) => {
        setEditingClient(client);
        setDialogOpen(true);
    };

    const handleCreate = () => {
        setEditingClient(null);
        setDialogOpen(true);
    };

    const filteredClients = clients.filter(c => 
        c.name.toLowerCase().includes(search.toLowerCase()) || 
        (c.contact_email && c.contact_email.toLowerCase().includes(search.toLowerCase()))
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex gap-4 items-center bg-white p-2 rounded-lg border border-slate-200 shadow-sm flex-1 w-full md:max-w-md">
                    <Search className="h-4 w-4 text-slate-400 ml-2" />
                    <Input 
                        placeholder="Search clients..." 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="border-none shadow-none focus-visible:ring-0"
                    />
                </div>
                <Button onClick={handleCreate} className="bg-blue-600 hover:bg-blue-700 whitespace-nowrap">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Client
                </Button>
            </div>

            <Card>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="flex justify-center p-8">
                            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                        </div>
                    ) : filteredClients.length === 0 ? (
                        <div className="text-center py-12 text-slate-500">
                            No clients found.
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Company Name</TableHead>
                                    <TableHead>Industry / Size</TableHead>
                                    <TableHead>Contact Info</TableHead>
                                    <TableHead>Location</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredClients.map((client) => (
                                    <TableRow key={client.id}>
                                        <TableCell className="font-medium">
                                            <div className="flex items-center gap-2">
                                                <div className="h-8 w-8 rounded bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">
                                                    {client.name.substring(0, 2).toUpperCase()}
                                                </div>
                                                {client.name}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col gap-1">
                                                <span className="text-sm">{client.industry || '-'}</span>
                                                <Badge variant="outline" className="w-fit text-xs font-normal">
                                                    {client.size_band}
                                                </Badge>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="space-y-1 text-sm text-slate-600">
                                                {client.contact_email && (
                                                    <div className="flex items-center gap-2">
                                                        <Mail className="h-3 w-3" /> {client.contact_email}
                                                    </div>
                                                )}
                                                {client.contact_phone && (
                                                    <div className="flex items-center gap-2">
                                                        <Phone className="h-3 w-3" /> {client.contact_phone}
                                                    </div>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2 text-sm text-slate-600">
                                                {client.region && <><MapPin className="h-3 w-3" /> {client.region}</>}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end items-center gap-2">
                                                <Button variant="ghost" size="icon" onClick={() => handleEdit(client)}>
                                                    <Pencil className="h-4 w-4 text-slate-500" />
                                                </Button>
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    onClick={() => {
                                                        if(confirm('Are you sure you want to delete this client?')) {
                                                            deleteMutation.mutate(client.id);
                                                        }
                                                    }}
                                                    className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <ClientDialog 
                open={dialogOpen} 
                onOpenChange={setDialogOpen} 
                client={editingClient} 
            />
        </div>
    );
}

