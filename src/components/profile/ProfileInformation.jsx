import React, { useState, useRef, useEffect } from "react";
import { groonabackend } from "@/api/groonabackend";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Camera, Loader2, Save, User, Mail, Phone, MapPin, FileText, X, AlertCircle, Check } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";

// Predefined job titles
export const JOB_TITLES = [
  "Front-end Developer",
  "Back-end Developer",
  "Full-Stack Developer",
  "Software Tester",
  "System Architect",
  "UX/UI Designer",
  "Graphic Designer",
  "Business Analyst",
  "Project Manager",
  "Mobile App Developer",
  "DevOps Engineer"
];

// Predefined departments
export const DEPARTMENTS = [
  "Engineering",
  "QA",
  "Design and Architecture",
  "Management",
  "Cloud Computing"
];

export default function ProfileInformation({ user, onUpdate, isUpdating }) {
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    location: "",
    bio: "",
    job_title: "",
    department: "",
  });
  
  const [isUploading, setIsUploading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const fileInputRef = useRef(null);
  const [imagePreview, setImagePreview] = useState(null);

  // Track last user ID to detect actual user changes (not just data refreshes)
  const lastUserIdRef = useRef(null);

  // Initialize form data when user prop changes
  // Only reset if user ID actually changed (different user) or if no unsaved changes
  useEffect(() => {
    if (user) {
      const userIdChanged = lastUserIdRef.current !== user.id;
      
      // Only reset form if:
      // 1. User ID changed (different user), OR
      // 2. No unsaved changes (safe to reset)
      if (userIdChanged || !hasChanges) {
        const initialData = {
          full_name: user.full_name || "",
          email: user.email || "",
          phone: user.phone || "",
          location: user.location || "",
          bio: user.bio || "",
          job_title: user.job_title || "",
          department: user.department || "",
        };
        
        setFormData(initialData);
        setImagePreview(user.profile_image_url);
        setValidationErrors({});
        
        if (userIdChanged) {
          lastUserIdRef.current = user.id;
        }
      }
    }
  }, [user?.id, hasChanges]); // Only reset on user ID change or when no changes

  // Track changes
  useEffect(() => {
    if (!user) return;
    
    const changed = 
      formData.full_name !== (user.full_name || "") ||
      formData.email !== (user.email || "") ||
      formData.phone !== (user.phone || "") ||
      formData.location !== (user.location || "") ||
      formData.bio !== (user.bio || "") ||
      formData.job_title !== (user.job_title || "") ||
      formData.department !== (user.department || "");
    
    setHasChanges(changed);
  }, [formData, user]);

  const handleFieldChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear validation error for this field
    if (validationErrors[field]) {
      setValidationErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const validateForm = () => {
    const errors = {};

    // Name validation
    if (!formData.full_name?.trim()) {
      errors.full_name = "Name is required";
    } else if (formData.full_name.trim().length < 2) {
      errors.full_name = "Name must be at least 2 characters";
    } else if (formData.full_name.trim().length > 100) {
      errors.full_name = "Name must be less than 100 characters";
    }

    // Job Title validation (required)
    if (!formData.job_title?.trim()) {
      errors.job_title = "Job title is required";
    }

    // Department validation (required)
    if (!formData.department?.trim()) {
      errors.department = "Department is required";
    }

    // Email validation
    if (!formData.email?.trim()) {
      errors.email = "Email is required";
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        errors.email = "Please enter a valid email address";
      }
    }

    // Phone validation (optional but format check if provided)
    if (formData.phone && formData.phone.trim()) {
      const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/;
      if (!phoneRegex.test(formData.phone.replace(/\s/g, ''))) {
        errors.phone = "Please enter a valid phone number";
      }
    }

    // Bio validation
    if (formData.bio && formData.bio.length > 500) {
      errors.bio = "Bio must be less than 500 characters";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset file input
    e.target.value = '';

    // Validate file type
    const validTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!validTypes.includes(file.type)) {
      toast.error("Only JPG, PNG, GIF, and WebP images are allowed");
      return;
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error("Image size must be less than 5MB");
      return;
    }

    setIsUploading(true);
    try {
      // Upload file
      const { file_url } = await groonabackend.integrations.Core.UploadFile({ file });
      
      // Update profile immediately
      await onUpdate({ profile_image_url: file_url });
      
      // Update preview
      setImagePreview(file_url);
      
      toast.success("Profile image updated successfully!");
    } catch (error) {
      console.error('[ProfileInformation] Image upload failed:', error);
      toast.error("Failed to upload image: " + (error?.message || "Please try again"));
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate form
    if (!validateForm()) {
      toast.error("Please fix the errors before saving");
      return;
    }

    try {
      const emailChanged = formData.email !== user.email;
      
      // Prepare clean data (remove empty strings)
      const updateData = {};
      Object.keys(formData).forEach(key => {
        const value = formData[key]?.trim();
        if (value !== undefined && value !== null) {
          updateData[key] = value;
        }
      });
      
      // Call update
      await onUpdate(updateData);
      
      if (emailChanged) {
        toast.info("Email updated. Please check your inbox to verify your new address.", {
          duration: 6000,
        });
      }
    } catch (error) {
      // Error already handled by mutation
      console.error('[ProfileInformation] Submit error:', error);
    }
  };

  const handleReset = () => {
    if (user) {
      setFormData({
        full_name: user.full_name || "",
        email: user.email || "",
        phone: user.phone || "",
        location: user.location || "",
        bio: user.bio || "",
        job_title: user.job_title || "",
        department: user.department || "",
      });
      setValidationErrors({});
      setHasChanges(false);
    }
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const bioLength = formData.bio?.length || 0;
  const bioLimit = 500;
  const bioWarning = bioLength > bioLimit * 0.9;

  return (
    <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5 text-blue-600" />
          Profile Information
        </CardTitle>
        <CardDescription>
          Update your personal information and profile picture
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Profile Image Upload */}
        <div className="flex flex-col items-center gap-4">
          <div className="relative group">
            <Avatar className="h-32 w-32 border-4 border-slate-200 shadow-lg">
              <AvatarImage 
                src={imagePreview} 
                alt={user.full_name}
                key={`preview-${imagePreview}`}
              />
              <AvatarFallback className="text-3xl font-bold bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                {getInitials(user.full_name)}
              </AvatarFallback>
            </Avatar>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || isUpdating}
              className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer disabled:cursor-not-allowed"
            >
              {isUploading ? (
                <Loader2 className="h-8 w-8 text-white animate-spin" />
              ) : (
                <Camera className="h-8 w-8 text-white" />
              )}
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            onChange={handleImageUpload}
            className="hidden"
            disabled={isUploading || isUpdating}
          />
          <p className="text-sm text-slate-600 text-center">
            Click on the image to upload a new profile picture<br />
            <span className="text-xs text-slate-500">Max size: 5MB • Formats: JPG, PNG, GIF, WebP</span>
          </p>
        </div>

        {/* Profile Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="full_name" className="flex items-center gap-2">
                <User className="h-4 w-4 text-slate-600" />
                Full Name *
              </Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) => handleFieldChange('full_name', e.target.value)}
                placeholder="John Doe"
                disabled={isUpdating}
                className={validationErrors.full_name ? "border-red-500" : ""}
              />
              {validationErrors.full_name && (
                <p className="text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {validationErrors.full_name}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-slate-600" />
                Email Address *
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleFieldChange('email', e.target.value)}
                placeholder="john@example.com"
                disabled={isUpdating}
                className={validationErrors.email ? "border-red-500" : ""}
              />
              {validationErrors.email && (
                <p className="text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {validationErrors.email}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone" className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-slate-600" />
                Phone Number
              </Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => handleFieldChange('phone', e.target.value)}
                placeholder="+1 (555) 123-4567"
                disabled={isUpdating}
                className={validationErrors.phone ? "border-red-500" : ""}
              />
              {validationErrors.phone && (
                <p className="text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {validationErrors.phone}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="location" className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-slate-600" />
                Location
              </Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => handleFieldChange('location', e.target.value)}
                placeholder="San Francisco, CA"
                disabled={isUpdating}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="job_title">Job Title *</Label>
              <Select
                value={formData.job_title || ""}
                onValueChange={(value) => handleFieldChange('job_title', value)}
                disabled={isUpdating}
                required
              >
                <SelectTrigger id="job_title" className={validationErrors.job_title ? "border-red-500" : ""}>
                  <SelectValue placeholder="Select job title" />
                </SelectTrigger>
                <SelectContent>
                  {JOB_TITLES.map((title) => (
                    <SelectItem key={title} value={title}>
                      {title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {validationErrors.job_title && (
                <p className="text-xs text-red-600">{validationErrors.job_title}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="department">Department *</Label>
              <Select
                value={formData.department || ""}
                onValueChange={(value) => handleFieldChange('department', value)}
                disabled={isUpdating}
                required
              >
                <SelectTrigger id="department" className={validationErrors.department ? "border-red-500" : ""}>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map((dept) => (
                    <SelectItem key={dept} value={dept}>
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {validationErrors.department && (
                <p className="text-xs text-red-600">{validationErrors.department}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio" className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-slate-600" />
              Bio
            </Label>
            <Textarea
              id="bio"
              value={formData.bio}
              onChange={(e) => handleFieldChange('bio', e.target.value)}
              placeholder="Tell us about yourself..."
              rows={4}
              disabled={isUpdating}
              className={`resize-none ${validationErrors.bio ? "border-red-500" : ""}`}
              maxLength={bioLimit}
            />
            <div className="flex items-center justify-between">
              {validationErrors.bio ? (
                <p className="text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {validationErrors.bio}
                </p>
              ) : (
                <span className="text-xs text-slate-500">
                  Share a bit about your role, interests, or background
                </span>
              )}
              <span className={`text-xs ${bioWarning ? 'text-amber-600 font-medium' : 'text-slate-500'}`}>
                {bioLength} / {bioLimit}
              </span>
            </div>
          </div>

          {formData.email !== user?.email && (
            <Alert className="border-blue-200 bg-blue-50">
              <Mail className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-900">
                <strong>Email Change Notice:</strong> Changing your email will require verification. 
                You'll receive a confirmation link at your new email address.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col sm:flex-row justify-between gap-3 pt-4 border-t">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              {hasChanges && (
                <span className="flex items-center gap-1 text-amber-600 font-medium">
                  <AlertCircle className="h-3 w-3" />
                  Unsaved changes
                </span>
              )}
            </div>
            
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleReset}
                disabled={isUpdating || !hasChanges}
              >
                <X className="h-4 w-4 mr-2" />
                Reset
              </Button>
              <Button
                type="submit"
                disabled={isUpdating || !hasChanges || Object.keys(validationErrors).length > 0}
                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
              >
                {isUpdating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

