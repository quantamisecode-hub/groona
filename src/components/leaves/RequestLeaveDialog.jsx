import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

const leaveSchema = z.object({
  leave_type: z.enum(["vacation", "sick", "personal", "public_holiday", "other"]),
  start_date: z.date({ required_error: "Start date is required" }),
  end_date: z.date({ required_error: "End date is required" }),
  reason: z.string().min(1, "Reason is required"),
});

export default function RequestLeaveDialog({ open, onClose, onSubmit, loading }) {
  const form = useForm({
    resolver: zodResolver(leaveSchema),
    defaultValues: {
      leave_type: "vacation",
      reason: "",
    },
  });

  const handleSubmit = (data) => {
    onSubmit({
      ...data,
      start_date: format(data.start_date, "yyyy-MM-dd"),
      end_date: format(data.end_date, "yyyy-MM-dd"),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[440px] border-none rounded-[16px] p-0 shadow-2xl overflow-hidden bg-white">
          <DialogHeader className="px-6 py-6 border-b border-slate-100 flex flex-row items-center gap-4 space-y-0 text-left">
            <div className="h-10 w-10 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400">
              <CalendarIcon className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-[17px] font-black text-slate-800 tracking-tight leading-none">Request Leave</DialogTitle>
              <p className="text-[13px] font-medium text-slate-400 mt-1.5">Schedule your time off for approval.</p>
            </div>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="p-6 space-y-6">
              <FormField
                control={form.control}
                name="leave_type"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <FormLabel className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Leave Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-11 bg-slate-50 border-slate-200/60 rounded-[10px] text-[13px] font-bold shadow-none focus:bg-white transition-all">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="rounded-[10px] border-slate-200">
                        <SelectItem value="vacation" className="text-[13px] font-medium">Vacation</SelectItem>
                        <SelectItem value="sick" className="text-[13px] font-medium">Sick Leave</SelectItem>
                        <SelectItem value="personal" className="text-[13px] font-medium">Personal</SelectItem>
                        <SelectItem value="public_holiday" className="text-[13px] font-medium">Public Holiday</SelectItem>
                        <SelectItem value="other" className="text-[13px] font-medium">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-[11px] font-bold text-red-500 ml-1" />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="start_date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col space-y-2">
                      <FormLabel className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Start Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "h-11 pl-3 text-left text-[13px] font-bold bg-slate-50/50 border-slate-100 rounded-[10px] shadow-sm hover:bg-white transition-all",
                                !field.value && "text-slate-400 font-medium"
                              )}
                            >
                              {field.value ? (
                                format(field.value, "MMM d, yyyy")
                              ) : (
                                <span>Pick date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-30" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 border-none rounded-[16px] shadow-2xl overflow-hidden" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) =>
                              date < new Date(new Date().setHours(0, 0, 0, 0))
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage className="text-[11px] font-bold text-red-500 ml-1" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="end_date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col space-y-2">
                      <FormLabel className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">End Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "h-11 pl-3 text-left text-[13px] font-bold bg-slate-50/50 border-slate-100 rounded-[10px] shadow-sm hover:bg-white transition-all",
                                !field.value && "text-slate-400 font-medium"
                              )}
                            >
                              {field.value ? (
                                format(field.value, "MMM d, yyyy")
                              ) : (
                                <span>Pick date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-30" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 border-none rounded-[16px] shadow-2xl overflow-hidden" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) =>
                              date < new Date(new Date().setHours(0, 0, 0, 0))
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage className="text-[11px] font-bold text-red-500 ml-1" />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <FormLabel className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Reason for Leave</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Briefly explain your request..."
                        className="min-h-[100px] bg-slate-50 border-slate-200/60 rounded-[12px] text-[13px] font-medium p-4 focus:bg-white transition-all leading-relaxed resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-[11px] font-bold text-red-500 ml-1" />
                  </FormItem>
                )}
              />

              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <Button type="button" variant="outline" onClick={onClose} className="flex-1 h-11 rounded-[10px] font-bold text-[13px] border-slate-200 text-slate-600 hover:bg-slate-50">
                  Cancel
                </Button>
                <Button type="submit" disabled={loading} className="flex-1 h-11 bg-slate-900 hover:bg-slate-800 text-white rounded-[10px] font-black text-[13px] shadow-lg shadow-slate-200">
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Submit Request
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}