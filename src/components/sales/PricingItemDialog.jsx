import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

export default function PricingItemDialog({ open, onOpenChange, item = null, onSave, isLoading }) {
    const { register, handleSubmit, reset, setValue, watch } = useForm();
    const quantity = watch('quantity', 1);
    const unitPrice = watch('unit_price', 0);
    const currency = watch('currency', 'USD'); // Only for display if needed

    useEffect(() => {
        if (open) {
            if (item) {
                reset({
                    item_name: item.item_name,
                    description: item.description || "",
                    quantity: item.quantity,
                    unit_type: item.unit_type || "fixed",
                    unit_price: item.unit_price
                });
            } else {
                reset({
                    item_name: "",
                    description: "",
                    quantity: 1,
                    unit_type: "fixed",
                    unit_price: 0
                });
            }
        }
    }, [open, item, reset]);

    const onSubmit = (data) => {
        onSave({
            ...data,
            subtotal: Number(data.quantity) * Number(data.unit_price)
        });
    };

    const subtotal = (Number(quantity) * Number(unitPrice)).toFixed(2);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{item ? "Edit Pricing Item" : "Add Pricing Item"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="item_name">Item Name *</Label>
                        <Input id="item_name" {...register("item_name", { required: "Item name is required" })} placeholder="e.g. Development Phase 1" />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea id="description" {...register("description")} placeholder="Details about this line item..." className="h-20" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="quantity">Quantity</Label>
                            <Input 
                                id="quantity" 
                                type="number" 
                                step="0.01" 
                                {...register("quantity", { required: true, min: 0.01 })} 
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="unit_type">Unit Type</Label>
                            <Select onValueChange={(val) => setValue("unit_type", val)} defaultValue={item?.unit_type || "fixed"}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="fixed">Fixed Price</SelectItem>
                                    <SelectItem value="hours">Hours</SelectItem>
                                    <SelectItem value="month">Months</SelectItem>
                                    <SelectItem value="license">Licenses</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="unit_price">Unit Price</Label>
                            <div className="relative">
                                <span className="absolute left-3 top-2.5 text-slate-500">$</span>
                                <Input 
                                    id="unit_price" 
                                    type="number" 
                                    step="0.01" 
                                    className="pl-7"
                                    {...register("unit_price", { required: true, min: 0 })} 
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Subtotal (Preview)</Label>
                            <div className="h-10 px-3 py-2 rounded-md border border-slate-200 bg-slate-50 font-semibold text-right">
                                {subtotal}
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="pt-4">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={isLoading}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {item ? "Update Item" : "Add Item"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}