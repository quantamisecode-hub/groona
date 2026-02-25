import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, AlertCircle } from "lucide-react";

export default function CreateTicketDialog({ open, onOpenChange, onSubmit, isSubmitting }) {
  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm({
    defaultValues: {
      title: "",
      description: "",
      priority: "MEDIUM",
      category: "other",
      complexity: "MEDIUM" // Default
    }
  });

  const handleFormSubmit = (data) => {
    onSubmit(data);
    reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Create Support Ticket</DialogTitle>
          <DialogDescription>
            Describe your issue in detail. We'll categorize it and assign it to the right expert.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6 py-4">
          <div className="space-y-4">
            <div className="grid w-full gap-1.5">
              <Label htmlFor="title">Subject</Label>
              <Input 
                id="title" 
                placeholder="Brief summary of the issue" 
                {...register("title", { required: "Subject is required" })} 
              />
              {errors.title && <span className="text-red-500 text-xs">{errors.title.message}</span>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid w-full gap-1.5">
                <Label>Priority</Label>
                <Select onValueChange={(val) => setValue("priority", val)} defaultValue="MEDIUM">
                  <SelectTrigger>
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Low - General Question</SelectItem>
                    <SelectItem value="MEDIUM">Medium - Minor Issue</SelectItem>
                    <SelectItem value="HIGH">High - Major Feature Broken</SelectItem>
                    <SelectItem value="CRITICAL">Critical - System Down</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid w-full gap-1.5">
                <Label>Category</Label>
                <Select onValueChange={(val) => setValue("category", val)} defaultValue="other">
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dashboard">Dashboard</SelectItem>
                    <SelectItem value="projects">Projects</SelectItem>
                    <SelectItem value="tasks">Tasks</SelectItem>
                    <SelectItem value="timesheets">Timesheets</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid w-full gap-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea 
                id="description" 
                placeholder="Please provide steps to reproduce the issue..." 
                className="h-32"
                {...register("description", { required: "Description is required" })} 
              />
              {errors.description && <span className="text-red-500 text-xs">{errors.description.message}</span>}
            </div>
            
            <div className="bg-blue-50 p-3 rounded-lg flex gap-3 items-start text-sm text-blue-700">
              <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <div>
                <strong>Estimated Response Time:</strong><br/>
                Based on current load, you can expect a response within 2-4 hours for Medium priority tickets.
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700">
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Ticket"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}