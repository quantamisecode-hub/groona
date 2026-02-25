import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { groonabackend } from "@/api/groonabackend";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function ClientDialog({ open, onOpenChange, client = null, onSuccess }) {
    const queryClient = useQueryClient();
    const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm();

    useEffect(() => {
        if (open) {
            if (client) {
                reset({
                    name: client.name,
                    industry: client.industry || "",
                    size_band: client.size_band || "Startup",
                    region: client.region || "",
                    contact_email: client.contact_email || "",
                    contact_phone: client.contact_phone || ""
                });
            } else {
                reset({
                    name: "",
                    industry: "",
                    size_band: "Startup",
                    region: "",
                    contact_email: "",
                    contact_phone: ""
                });
            }
        }
    }, [open, client, reset]);

    const mutation = useMutation({
        mutationFn: async (data) => {
            const user = await groonabackend.auth.me();
            if (client) {
                return groonabackend.entities.Client.update(client.id, { ...data });
            } else {
                return groonabackend.entities.Client.create({ ...data, tenant_id: user.tenant_id });
            }
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries(['clients']);
            toast.success(client ? "Client updated successfully" : "Client created successfully");
            if (onSuccess) onSuccess(data);
            onOpenChange(false);
        },
        onError: (error) => {
            toast.error(`Error: ${error.message}`);
        }
    });

    const onSubmit = (data) => {
        mutation.mutate(data);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{client ? "Edit Client" : "Create New Client"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Company Name *</Label>
                        <Input id="name" {...register("name", { required: "Name is required" })} placeholder="Acme Corp" />
                        {errors.name && <span className="text-xs text-red-500">{errors.name.message}</span>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="industry">Industry</Label>
                            <Input id="industry" {...register("industry")} placeholder="Technology" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="size_band">Size Band</Label>
                            <Select onValueChange={(val) => setValue("size_band", val)} defaultValue={client?.size_band || "Startup"}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select size" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Startup">Startup</SelectItem>
                                    <SelectItem value="SME">SME</SelectItem>
                                    <SelectItem value="Enterprise">Enterprise</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="region">Region/Location</Label>
                        <Input id="region" {...register("region")} placeholder="New York, USA" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="contact_email">Contact Email</Label>
                            <Input id="contact_email" type="email" {...register("contact_email")} placeholder="contact@acme.com" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="contact_phone">Contact Phone</Label>
                            <Input id="contact_phone" {...register("contact_phone")} placeholder="+1 555-0123" />
                        </div>
                    </div>

                    <DialogFooter className="pt-4">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {client ? "Update Client" : "Create Client"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

