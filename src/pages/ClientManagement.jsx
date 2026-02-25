import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { groonabackend } from '@/api/groonabackend';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Building2, MapPin, Mail, Phone, Upload, Loader2, X, Briefcase, Edit2 } from 'lucide-react';
import { toast } from "sonner";
import { useUser } from "../components/shared/UserContext";

export default function ClientManagement() {
    const { user, effectiveTenantId } = useUser();
    const queryClient = useQueryClient();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const fileInputRef = useRef(null);
    const [editingClientId, setEditingClientId] = useState(null);

    const [formData, setFormData] = useState({
        name: "",
        logo_url: "",
        gst_number: "",
        status: "active",
        address: { street: "", city: "", state: "", zip: "", country: "" },
        contact_person: { name: "", email: "", phone: "", designation: "" }
    });
    const [uploadingLogo, setUploadingLogo] = useState(false);

    // Fetch Clients
    const { data: clients = [], isLoading } = useQuery({
        queryKey: ['clients', effectiveTenantId],
        queryFn: async () => {
            if (!effectiveTenantId) return [];
            return groonabackend.entities.Client.filter({ tenant_id: effectiveTenantId }, '-created_at');
        },
        enabled: !!effectiveTenantId
    });

    // Create Client Mutation
    const createClientMutation = useMutation({
        mutationFn: async (data) => {
            return groonabackend.entities.Client.create({
                ...data,
                tenant_id: effectiveTenantId
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['clients', effectiveTenantId]);
            toast.success('Client registered successfully');
            handleCloseDialog();
        },
        onError: (error) => {
            toast.error(`Failed to register client: ${error.message}`);
        }
    });

    // Update Client Mutation
    const updateClientMutation = useMutation({
        mutationFn: async (data) => {
            if (!editingClientId) throw new Error("No client to update");
            return groonabackend.entities.Client.update(editingClientId, data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['clients', effectiveTenantId]);
            toast.success('Client updated successfully');
            handleCloseDialog();
        },
        onError: (error) => {
            toast.error(`Failed to update client: ${error.message}`);
        }
    });

    const resetForm = () => {
        setFormData({
            name: "",
            logo_url: "",
            gst_number: "",
            status: "active",
            address: { street: "", city: "", state: "", zip: "", country: "" },
            contact_person: { name: "", email: "", phone: "", designation: "" }
        });
        setEditingClientId(null);
    };

    const handleCloseDialog = () => {
        setIsDialogOpen(false);
        resetForm();
    };

    const handleEdit = (client) => {
        setEditingClientId(client.id);
        const address = client.address || {};
        const contact = client.contact_person || {};

        setFormData({
            name: client.name || "",
            logo_url: client.logo_url || "",
            gst_number: client.gst_number || "",
            status: client.status || "active",
            address: {
                street: address.street || "",
                city: address.city || "",
                state: address.state || "",
                zip: address.zip || "",
                country: address.country || ""
            },
            contact_person: {
                name: contact.name || "",
                email: contact.email || "",
                phone: contact.phone || "",
                designation: contact.designation || ""
            }
        });
        setIsDialogOpen(true);
    };

    const handleLogoUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            toast.error('Please upload an image file');
            return;
        }

        if (file.size > 2 * 1024 * 1024) {
            toast.error('Image size must be less than 2MB');
            return;
        }

        setUploadingLogo(true);
        try {
            const { file_url } = await groonabackend.integrations.Core.UploadFile({ file });
            setFormData(prev => ({ ...prev, logo_url: file_url }));
            toast.success('Logo uploaded successfully');
        } catch (error) {
            console.error('Logo upload error:', error);
            toast.error('Failed to upload logo');
        } finally {
            setUploadingLogo(false);
        }
    };

    const COUNTRIES = [
        "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", "Argentina", "Armenia", "Australia", "Austria", "Azerbaijan",
        "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi",
        "Cabo Verde", "Cambodia", "Cameroon", "Canada", "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros", "Congo", "Costa Rica", "Croatia", "Cuba", "Cyprus", "Czech Republic",
        "Denmark", "Djibouti", "Dominica", "Dominican Republic",
        "East Timor", "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", "Ethiopia",
        "Fiji", "Finland", "France",
        "European Union", "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau", "Guyana",
        "Haiti", "Honduras", "Hong Kong", "Hungary",
        "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy", "Ivory Coast",
        "Jamaica", "Japan", "Jordan",
        "Kazakhstan", "Kenya", "Kiribati", "Korea, North", "Korea, South", "Kosovo", "Kuwait", "Kyrgyzstan",
        "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg",
        "Macau", "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Mauritania", "Mauritius", "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar",
        "Namibia", "Nauru", "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Macedonia", "Norway",
        "Oman",
        "Pakistan", "Palau", "Palestine", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland", "Portugal", "Puerto Rico",
        "Qatar",
        "Romania", "Russia", "Rwanda",
        "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Sao Tome and Principe", "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa", "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland", "Syria",
        "Taiwan", "Tajikistan", "Tanzania", "Thailand", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan", "Tuvalu",
        "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "United States", "Uruguay", "Uzbekistan",
        "Vanuatu", "Vatican City", "Venezuela", "Vietnam",
        "Yemen",
        "Zambia", "Zimbabwe"
    ];

    const TAX_ID_LABELS = {
        "India": "GSTIN",
        "United States": "EIN",
        "United Kingdom": "VAT Number",
        "Canada": "BN / GST",
        "Australia": "ABN",
        "Germany": "Steuernummer / VAT",
        "France": "SIREN / VAT",
        "Italy": "P.IVA / Codice Fiscale",
        "Spain": "NIF / CIF",
        "Brazil": "CNPJ",
        "Mexico": "RFC",
        "Japan": "Corporate Number",
        "China": "USCI",
        "South Africa": "VAT Number",
        "Russia": "INN",
        "United Arab Emirates": "TRN",
        "Saudi Arabia": "VAT Number",
        "Netherlands": "BTW Number",
        "Sweden": "VAT Number",
        "Switzerland": "UID / VAT",
        "Singapore": "UEN / GST",
        "New Zealand": "GST Number",
        "Hong Kong": "BR Number",
        "Ireland": "VAT Number",
        "Israel": "VAT / ID",
        "Poland": "NIP",
        "Pakistan": "NTN / STRN",
        "Bangladesh": "BIN / TIN",
        "Philippines": "TIN",
        "Vietnam": "Tax Code / MST",
        "Indonesia": "NPWP",
        "Malaysia": "TIN",
        "Thailand": "Tax ID",
        "Egypt": "Tax Reg No",
        "Turkey": "Vergi No",
        "Argentina": "CUIT",
        "Chile": "RUT",
        "Colombia": "NIT",
        "Nigeria": "TIN",
        "Kenya": "PIN",
        "Portugal": "NIF",
        "Ukraine": "Tax Number / EDRPOU",
        "Belarus": "UNP",
        "Romania": "CIF / CUI",
        "Czech Republic": "DIC",
        "Hungary": "Adoszam",
        "Korea, South": "Business Reg No",
        "Taiwan": "Unified Business No",
        "Belgium": "VAT Number",
        "Austria": "UID",
        "Denmark": "CVR",
        "Finland": "Y-tunnus",
        "Norway": "Org Number",
        "Estonia": "Reg Code / KMKR",
        "Latvia": "PVN",
        "Lithuania": "PVM",
        "Slovakia": "DIC",
        "Slovenia": "Davcna st.",
        "Bulgaria": "UIC / BG",
        "Croatia": "OIB",
        "Greece": "AFM",
        "Cyprus": "TIC",
        "Luxembourg": "TVA",
        "Malta": "VAT Number",
        "Iceland": "VSK",
        "Serbia": "PIB",
        "Tunisia": "Matricule Fiscale",
        "Morocco": "ICE",
        "Sri Lanka": "TIN",
        "European Union": "VAT Number",
    };

    const getTaxLabel = () => {
        const country = formData.address.country;
        if (!country) return "Tax ID";
        return TAX_ID_LABELS[country] || "Tax ID";
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        // Validation
        if (!formData.name) return toast.error('Organization Name is required');
        if (!formData.status) return toast.error('Status is required');

        // Contact Person
        if (!formData.contact_person.email) return toast.error('Primary Contact Email is required');

        // Address
        if (!formData.address.street) return toast.error('Street Address is required');
        if (!formData.address.city) return toast.error('City is required');
        if (!formData.address.state) return toast.error('State/Province is required');
        if (!formData.address.country) return toast.error('Country is required');

        if (editingClientId) {
            updateClientMutation.mutate(formData);
        } else {
            createClientMutation.mutate(formData);
        }
    };

    const filteredClients = clients.filter(client =>
        (client.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (client.contact_person?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (client.contact_person?.email || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    const isPending = createClientMutation.isPending || updateClientMutation.isPending;

    return (
        <div className="flex flex-col bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20 w-full relative z-0 h-[calc(100vh-5rem)] overflow-hidden">
            <div className="max-w-[1800px] mx-auto w-full flex flex-col h-full relative" style={{ maxWidth: '100%' }}>
                {/* Sticky Header Section */}
                <div className="sticky top-0 z-20 bg-white border-b border-slate-200/60 shadow-sm flex-shrink-0">
                    <div className="px-4 md:px-6 lg:px-8 pt-4 md:pt-6 lg:pt-8 pb-4">
                        {/* Header */}
                        <div className="flex flex-row justify-between items-start gap-4 mb-4">
                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="h-10 w-10 md:h-12 md:w-12 rounded-xl flex items-center justify-center shadow-lg bg-gradient-to-br from-blue-500 to-indigo-600 shadow-blue-500/20 flex-shrink-0">
                                        <Briefcase className="h-5 w-5 md:h-6 md:w-6 text-white" />
                                    </div>
                                    <div>
                                        <h1 className="text-2xl md:text-4xl font-bold text-slate-900">Client Management</h1>
                                        <p className="text-xs md:text-base text-slate-600 hidden sm:block">
                                            Manage client organizations, billing details, and contacts.
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <Button
                                onClick={() => setIsDialogOpen(true)}
                                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-md transition-all hover:shadow-lg flex-shrink-0"
                            >
                                <Plus className="h-4 w-4 sm:mr-2" />
                                <span className="hidden sm:inline">Add Client</span>
                            </Button>
                        </div>

                        {/* Search Bar - Full Width for now since no tabs */}
                        <div className="relative max-w-md ml-auto">
                            <Input
                                placeholder="Search clients..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10 bg-white/80 backdrop-blur-xl h-9"
                            />
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 ßw-4 text-slate-400" />
                        </div>
                    </div>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto min-h-0">
                    <div className="px-3 pb-24 md:pb-32 pt-3">

                        {/* Client List */}
                        <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60 shadow-sm">
                            <CardHeader className="pb-4">
                                <CardTitle className="flex items-center gap-2 text-slate-800">
                                    <Building2 className="h-5 w-5 text-blue-600" />
                                    Registered Clients ({filteredClients.length})
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0 sm:p-6">
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="hover:bg-transparent border-slate-200">
                                                <TableHead className="font-semibold text-slate-700 min-w-[200px]">Organization</TableHead>
                                                <TableHead className="font-semibold text-slate-700">Status</TableHead>
                                                <TableHead className="font-semibold text-slate-700 min-w-[150px]">Location</TableHead>
                                                <TableHead className="font-semibold text-slate-700 min-w-[180px]">Contact Person</TableHead>
                                                <TableHead className="font-semibold text-slate-700 min-w-[120px]">GST / Tax ID</TableHead>
                                                <TableHead className="text-right font-semibold text-slate-700">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {isLoading ? (
                                                <TableRow>
                                                    <TableCell colSpan={6} className="h-24 text-center">
                                                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-500" />
                                                    </TableCell>
                                                </TableRow>
                                            ) : filteredClients.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={6} className="h-32 text-center text-slate-500">
                                                        <div className="flex flex-col items-center justify-center gap-2">
                                                            <Building2 className="h-8 w-8 text-slate-300" />
                                                            <p>No clients found. Add one to get started.</p>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                filteredClients.map((client) => (
                                                    <TableRow key={client.id} className="hover:bg-slate-50/80 transition-colors border-slate-100">
                                                        <TableCell>
                                                            <div className="flex items-center gap-3">
                                                                <Avatar className="h-10 w-10 border border-slate-200 bg-white shadow-sm">
                                                                    <AvatarImage src={client.logo_url} className="object-contain p-1" />
                                                                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold">
                                                                        {client.name ? client.name.substring(0, 2).toUpperCase() : 'CO'}
                                                                    </AvatarFallback>
                                                                </Avatar>
                                                                <div>
                                                                    <div className="font-semibold text-slate-900">{client.name}</div>
                                                                    <div className="text-xs text-slate-500 font-mono">ID: {client.id ? client.id.slice(-6) : 'N/A'}</div>
                                                                </div>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge variant={client.status === 'inactive' ? "secondary" : "default"} className={`${client.status === 'inactive' ? 'bg-slate-100 text-slate-500 hover:bg-slate-200' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'} capitalize shadow-none border-none`}>
                                                                {client.status || 'Active'}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex flex-col gap-1 text-sm text-slate-600">
                                                                <div className="flex items-center gap-1.5">
                                                                    <MapPin className="h-3.5 w-3.5 text-slate-400" />
                                                                    {client.address?.city || 'N/A'}, {client.address?.country || 'N/A'}
                                                                </div>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex flex-col gap-1 text-sm">
                                                                <div className="font-medium text-slate-900">{client.contact_person?.name || 'N/A'}</div>
                                                                <div className="text-slate-500 flex items-center gap-1.5 text-xs">
                                                                    <Mail className="h-3 w-3" /> {client.contact_person?.email || '-'}
                                                                </div>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-slate-600 font-mono text-sm">
                                                            <span className="bg-slate-100 px-2 py-1 rounded text-slate-700 border border-slate-200">
                                                                {client.gst_number || '-'}
                                                            </span>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="hover:text-blue-600 hover:bg-blue-50"
                                                                onClick={() => handleEdit(client)}
                                                            >
                                                                <Edit2 className="h-4 w-4 mr-1" /> Edit
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                {/* Registration Dialog */}
                <Dialog open={isDialogOpen} onOpenChange={(open) => {
                    if (!open) handleCloseDialog();
                    else setIsDialogOpen(true);
                }}>
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>{editingClientId ? 'Edit Client' : 'Register New Client'}</DialogTitle>
                            <DialogDescription>
                                {editingClientId ? 'Update client details and status.' : 'Add a new client organization to your system.'}
                            </DialogDescription>
                        </DialogHeader>

                        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
                            {/* Logo Upload */}
                            <div className="flex items-center gap-6 p-4 bg-slate-50 rounded-lg border border-slate-100">
                                <div className="relative group">
                                    <Avatar className="h-24 w-24 border-2 border-slate-200 bg-white shadow-sm">
                                        {formData.logo_url ? (
                                            <AvatarImage src={formData.logo_url} className="object-contain p-2" />
                                        ) : (
                                            <AvatarFallback className="bg-white">
                                                <Building2 className="h-8 w-8 text-slate-300" />
                                            </AvatarFallback>
                                        )}
                                    </Avatar>
                                    <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                                        <Upload className="h-6 w-6 text-white" />
                                    </div>
                                </div>
                                <div className="flex-1">
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        className="hidden"
                                        accept="image/*"
                                        onChange={handleLogoUpload}
                                    />
                                    <h3 className="font-medium text-slate-900">Organization Logo</h3>
                                    <p className="text-sm text-slate-500 mt-1">
                                        Upload a logo for branding. Max size 2MB. Recommended 256x256px.
                                    </p>
                                    <div className="flex gap-2 mt-3">
                                        <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploadingLogo}>
                                            {uploadingLogo ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                                            Upload Logo
                                        </Button>
                                        {formData.logo_url && (
                                            <Button type="button" variant="ghost" size="sm" className="text-red-600" onClick={() => setFormData(p => ({ ...p, logo_url: "" }))}>
                                                Remove
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="grid md:grid-cols-2 gap-6">
                                {/* Organization Details */}
                                <div className="space-y-4">
                                    <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                                        <Building2 className="h-4 w-4 text-blue-500" /> Organization Details
                                    </h3>
                                    <div className="space-y-2">
                                        <Label>Organization Name *</Label>
                                        <Input
                                            value={formData.name}
                                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                                            placeholder="e.g. Acme Corp"
                                            required
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>{getTaxLabel()}</Label>
                                            <Input
                                                value={formData.gst_number}
                                                onChange={e => setFormData({ ...formData, gst_number: e.target.value })}
                                                placeholder={getTaxLabel()}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Status *</Label>
                                            <Select
                                                value={formData.status}
                                                onValueChange={(value) => setFormData({ ...formData, status: value })}
                                                required
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select Status" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="active">Active</SelectItem>
                                                    <SelectItem value="inactive">Inactive</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </div>

                                {/* Contact Person */}
                                <div className="space-y-4">
                                    <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                                        <Briefcase className="h-4 w-4 text-purple-500" /> Primary Contact
                                    </h3>
                                    <div className="space-y-2">
                                        <Label>Contact Name</Label>
                                        <Input
                                            value={formData.contact_person.name}
                                            onChange={e => setFormData({ ...formData, contact_person: { ...formData.contact_person, name: e.target.value } })}
                                            placeholder="Full Name"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="space-y-2">
                                            <Label>Email *</Label>
                                            <Input
                                                type="email"
                                                value={formData.contact_person.email}
                                                onChange={e => setFormData({ ...formData, contact_person: { ...formData.contact_person, email: e.target.value } })}
                                                placeholder="email@company.com"
                                                required
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Phone</Label>
                                            <Input
                                                value={formData.contact_person.phone}
                                                onChange={e => setFormData({ ...formData, contact_person: { ...formData.contact_person, phone: e.target.value } })}
                                                placeholder="+1 (555) 000-0000"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Address */}
                                <div className="col-span-2 space-y-4 pt-2 border-t border-slate-100">
                                    <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                                        <MapPin className="h-4 w-4 text-green-500" /> Billing Address
                                    </h3>
                                    <div className="space-y-2">
                                        <Label>Street Address *</Label>
                                        <Input
                                            value={formData.address.street}
                                            onChange={e => setFormData({ ...formData, address: { ...formData.address, street: e.target.value } })}
                                            placeholder="123 Business Blvd"
                                            required
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div className="space-y-2">
                                            <Label>City *</Label>
                                            <Input
                                                value={formData.address.city}
                                                onChange={e => setFormData({ ...formData, address: { ...formData.address, city: e.target.value } })}
                                                placeholder="City"
                                                required
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>State/Province *</Label>
                                            <Input
                                                value={formData.address.state}
                                                onChange={e => setFormData({ ...formData, address: { ...formData.address, state: e.target.value } })}
                                                placeholder="State"
                                                required
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Zip/Postal Code</Label>
                                            <Input
                                                value={formData.address.zip}
                                                onChange={e => setFormData({ ...formData, address: { ...formData.address, zip: e.target.value } })}
                                                placeholder="Zip Code"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Country *</Label>
                                            <Select
                                                value={formData.address.country}
                                                onValueChange={(value) => setFormData({ ...formData, address: { ...formData.address, country: value } })}
                                                required
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select Country" />
                                                </SelectTrigger>
                                                <SelectContent className="max-h-[200px]">
                                                    {COUNTRIES.map((country) => (
                                                        <SelectItem key={country} value={country}>
                                                            {country}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={handleCloseDialog}>Cancel</Button>
                                <Button type="submit" disabled={isPending || uploadingLogo} className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-lg shadow-blue-500/25">
                                    {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                    {editingClientId ? 'Update Client' : 'Register Client'}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}
