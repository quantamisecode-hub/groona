import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { groonabackend } from '@/api/groonabackend';
import { cn } from '@/lib/utils';
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
        <div className="flex flex-col bg-[#f8f9fa] w-full min-h-screen animate-in fade-in duration-500">
            <div className="max-w-[1800px] mx-auto w-full flex flex-col h-full px-4 md:px-8 pt-8 pb-12">
                {/* Header Section */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 mb-10">
                    <div className="space-y-1">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 md:h-12 md:w-12 rounded-2xl flex items-center justify-center shadow-lg bg-gradient-to-br from-blue-600 to-slate-900 shadow-blue-500/10">
                                <Building2 className="h-5 w-5 md:h-6 md:w-6 text-white" />
                            </div>
                            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Client Organizations</h1>
                        </div>
                        <p className="text-sm text-slate-500 font-medium pl-1">
                            Manage partner organizations, billing records, and primary contacts.
                        </p>
                    </div>
                    <Button
                        onClick={() => setIsDialogOpen(true)}
                        className="bg-gradient-to-r from-blue-600 to-slate-900 border-0 shadow-lg shadow-blue-500/20 hover:from-blue-700 hover:to-slate-950 hover:opacity-90 text-white h-11 rounded-lg px-6 font-bold transition-all active:scale-[0.98] w-full sm:w-auto flex items-center gap-2"
                    >
                        <Plus className="h-4.5 w-4.5" />
                        <span>Register New Client</span>
                    </Button>
                </div>

                {/* Search & Filter Bar */}
                <div className="flex flex-col sm:flex-row items-center gap-4 mb-8">
                    <div className="relative w-full sm:w-96 group">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                        <Input
                            placeholder="Search by company, person or email..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 h-11 rounded-xl border-slate-200 bg-white/80 backdrop-blur-sm focus:ring-blue-500/20 focus:border-blue-500 shadow-sm"
                        />
                    </div>
                    <div className="flex items-center gap-2 px-1">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            {filteredClients.length} Organizations Registered
                        </span>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-hidden">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-32 gap-3">
                            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Fetching Client Directory...</p>
                        </div>
                    ) : filteredClients.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 px-4 bg-white rounded-[2rem] border border-slate-100 shadow-sm mx-auto max-w-2xl">
                            <div className="h-20 w-20 rounded-full bg-slate-50 flex items-center justify-center text-slate-200 mb-6 transition-transform duration-500 hover:scale-110">
                                <Building2 className="h-10 w-10" />
                            </div>
                            <div className="text-center max-w-xs mx-auto space-y-2 mb-8">
                                <h3 className="text-[17px] font-bold text-slate-900 tracking-tight">No registered clients</h3>
                                <p className="text-sm text-slate-500 font-medium leading-relaxed">Start buildng your client directory to manage billing and project assignments.</p>
                            </div>
                            <Button
                                onClick={() => setIsDialogOpen(true)}
                                variant="outline"
                                className="rounded-xl border-slate-200 text-slate-600 font-bold h-11 px-6 hover:bg-slate-50 active:scale-95 transition-all"
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                Add Your First Client
                            </Button>
                        </div>
                    ) : (
                        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col h-full">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader className="bg-slate-50/50">
                                        <TableRow className="hover:bg-transparent border-slate-100">
                                            <TableHead className="py-5 font-black text-[10px] uppercase tracking-widest text-slate-400 pl-8">Organization</TableHead>
                                            <TableHead className="py-5 font-black text-[10px] uppercase tracking-widest text-slate-400">Condition</TableHead>
                                            <TableHead className="py-5 font-black text-[10px] uppercase tracking-widest text-slate-400">Primary Contact</TableHead>
                                            <TableHead className="py-5 font-black text-[10px] uppercase tracking-widest text-slate-400">Tax ID</TableHead>
                                            <TableHead className="py-5 font-black text-[10px] uppercase tracking-widest text-slate-400">Billing Location</TableHead>
                                            <TableHead className="py-5 font-black text-[10px] uppercase tracking-widest text-slate-400 text-right pr-8">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredClients.map((client) => {
                                            const initials = client.name ? client.name.substring(0, 2).toUpperCase() : 'CO';
                                            return (
                                                <TableRow key={client.id} className="group hover:bg-slate-50/50 transition-colors border-slate-50 last:border-0 pointer-events-auto">
                                                    <TableCell className="py-4 pl-8">
                                                        <div className="flex items-center gap-4">
                                                            <Avatar className="h-11 w-11 rounded-full bg-white shadow-sm flex-shrink-0 border border-slate-100">
                                                                <AvatarImage src={client.logo_url} className="object-contain p-2" />
                                                                <AvatarFallback className="bg-blue-50 text-blue-600 font-black text-xs">
                                                                    {initials}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                            <div className="min-w-0">
                                                                <h4 className="text-[14px] font-bold text-slate-900 truncate tracking-tight uppercase tracking-tight">{client.name}</h4>
                                                                <p className="text-[11px] font-medium text-slate-400 truncate mt-0.5">Org ID: {client.id ? client.id.slice(-8) : 'N/A'}</p>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="py-4">
                                                        <Badge variant="outline" className={cn(
                                                            "rounded-full border-0 px-3 py-1 text-[10px] font-black uppercase tracking-widest",
                                                            client.status === 'active' ? "bg-emerald-500/10 text-emerald-600" : "bg-slate-100 text-slate-500"
                                                        )}>
                                                            <div className={cn(
                                                                "h-1.5 w-1.5 rounded-full mr-2",
                                                                client.status === 'active' ? "bg-emerald-500" : "bg-slate-400"
                                                            )} />
                                                            {client.status || 'Active'}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="py-4">
                                                        <div className="space-y-1">
                                                            <p className="text-xs font-bold text-slate-700">{client.contact_person?.name || 'N/A'}</p>
                                                            <div className="flex items-center gap-1.5">
                                                                <Mail className="h-3 w-3 text-slate-400" />
                                                                <span className="text-[11px] font-medium text-slate-500 truncate max-w-[150px]">{client.contact_person?.email || 'No email'}</span>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="py-4 font-mono text-[11px] font-bold text-slate-500">
                                                        {client.gst_number || '--'}
                                                    </TableCell>
                                                    <TableCell className="py-4">
                                                        <div className="flex items-center gap-2">
                                                            <MapPin className="h-3.5 w-3.5 text-slate-400" />
                                                            <span className="text-xs font-bold text-slate-600">
                                                                {client.address?.city || 'City'}, {client.address?.country || 'Country'}
                                                            </span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="py-4 text-right pr-8">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-9 w-9 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all active:scale-95"
                                                            onClick={() => handleEdit(client)}
                                                        >
                                                            <Edit2 className="h-4.5 w-4.5" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    )}
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
    );
}
