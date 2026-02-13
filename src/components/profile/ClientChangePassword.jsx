import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { groonabackend } from "@/api/groonabackend";
import { toast } from "sonner";
import { Loader2, Lock } from "lucide-react";

export default function ClientChangePassword() {
  const [loading, setLoading] = useState(false);
  const [passwords, setPasswords] = useState({
    current: "",
    new: "",
    confirm: ""
  });

  const handleChange = async (e) => {
    e.preventDefault();
    if (passwords.new !== passwords.confirm) {
      toast.error("New passwords do not match");
      return;
    }
    if (passwords.new.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (!passwords.current) {
        toast.error("Please enter your current password");
        return;
    }

    setLoading(true);
    try {
      // Use the dedicated changePassword method which calls the real backend route
      await groonabackend.auth.changePassword(passwords.current, passwords.new);
      
      toast.success("Password updated successfully");
      setPasswords({ current: "", new: "", confirm: "" });
      
      // Optional: Logout to force re-login
      // groonabackend.auth.logout();
    } catch (error) {
      // Handle error safely
      const msg = error.response?.data?.msg || error.message || "Failed to update password";
      toast.error(msg);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-slate-500"/>
            Change Password
        </CardTitle>
        <CardDescription>Update your login password</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleChange} className="space-y-4">
           {/* Added Current Password Field */}
           <div className="space-y-2">
            <Label>Current Password</Label>
            <Input 
              type="password" 
              value={passwords.current}
              onChange={e => setPasswords({...passwords, current: e.target.value})}
              required
              placeholder="Enter current password"
            />
          </div>

          <div className="space-y-2">
            <Label>New Password</Label>
            <Input 
              type="password" 
              value={passwords.new}
              onChange={e => setPasswords({...passwords, new: e.target.value})}
              required
              placeholder="Enter new password"
            />
          </div>
          <div className="space-y-2">
            <Label>Confirm New Password</Label>
            <Input 
              type="password" 
              value={passwords.confirm}
              onChange={e => setPasswords({...passwords, confirm: e.target.value})}
              required
              placeholder="Confirm new password"
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update Password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

