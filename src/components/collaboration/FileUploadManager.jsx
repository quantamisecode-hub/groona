import React, { useState, useRef } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, File, Loader2, Download, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { notificationService } from "../shared/notificationService";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function FileUploadManager({ projectId = null, files = [], onFileUploaded }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("document");
  const [selectedProjectId, setSelectedProjectId] = useState(projectId || "");
  const [deletingFile, setDeletingFile] = useState(null);
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();

  React.useEffect(() => {
    groonabackend.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  // CRITICAL: Get effective tenant ID (handles Super Admin viewing tenants)
  const effectiveTenantId = currentUser?.is_super_admin && currentUser?.active_tenant_id 
    ? currentUser.active_tenant_id 
    : currentUser?.tenant_id;

  // Fetch projects for the dropdown - filtered by tenant
  const { data: projects = [] } = useQuery({
    queryKey: ['projects', effectiveTenantId],
    queryFn: async () => {
      if (!effectiveTenantId) return [];
      return groonabackend.entities.Project.filter({ tenant_id: effectiveTenantId });
    },
    enabled: !!effectiveTenantId,
  });

  const uploadFileMutation = useMutation({
    mutationFn: async ({ file, description, category, projectId }) => {
      // Upload file
      const { file_url } = await groonabackend.integrations.Core.UploadFile({ file });

      // Check if uploader is admin
      const isAdmin = currentUser?.is_super_admin || currentUser?.role === 'admin';

      // Create file record - ensure tenant_id is set
      const fileRecord = await groonabackend.entities.ProjectFile.create({
        tenant_id: effectiveTenantId,
        project_id: projectId,
        file_name: file.name,
        file_url: file_url,
        file_type: file.type,
        file_size: file.size,
        uploaded_by: currentUser.email,
        uploaded_by_name: currentUser.full_name,
        uploaded_by_is_admin: isAdmin, // Store if uploader is admin for delete permissions
        description: description,
        category: category,
      });

      return { fileRecord, projectId };
    },
    onSuccess: async ({ fileRecord, projectId }) => {
      queryClient.invalidateQueries({ queryKey: ['project-files', effectiveTenantId] });
      toast.success("File uploaded successfully!");

      // Notify project team members
      if (projectId) {
        const project = projects.find(p => p.id === projectId);
        if (project && project.team_members) {
          const teamEmails = project.team_members
            .map(m => m.email)
            .filter(email => email !== currentUser.email);

          await notificationService.notifyProjectUpdate({
            project: { id: projectId, name: project.name },
            updateType: `uploaded file "${fileRecord.file_name}" to`,
            updatedBy: currentUser.full_name,
            updatedByEmail: currentUser.email,
            teamMembers: teamEmails,
            tenantId: effectiveTenantId
          });
        }
      }

      setSelectedFile(null);
      setDescription("");
      setCategory("document");
      setSelectedProjectId(projectId || "");
      if (onFileUploaded) onFileUploaded();
    },
    onError: (error) => {
      toast.error("Upload failed: " + error.message);
    },
  });

  const deleteFileMutation = useMutation({
    mutationFn: (fileId) => groonabackend.entities.ProjectFile.delete(fileId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-files', effectiveTenantId] });
      toast.success("File deleted");
      setDeletingFile(null);
    },
  });

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error("Please select a file");
      return;
    }

    if (!selectedProjectId) {
      toast.error("Please select a project");
      return;
    }

    if (!effectiveTenantId) {
      toast.error("User information not loaded. Please refresh the page.");
      return;
    }

    setUploading(true);
    try {
      await uploadFileMutation.mutateAsync({
        file: selectedFile,
        description,
        category,
        projectId: selectedProjectId,
      });
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  // Check if current user can delete a file
  const canDeleteFile = (file) => {
    if (!currentUser) return false;
    
    const isCurrentUserAdmin = currentUser.is_super_admin || currentUser.role === 'admin';
    const isUploadedByAdmin = file.uploaded_by_is_admin === true;
    const isUploadedByCurrentUser = file.uploaded_by === currentUser.email;

    // If admin uploaded → only admin can delete
    if (isUploadedByAdmin) {
      return isCurrentUserAdmin;
    }
    
    // If uploaded_by_is_admin is not set (backward compatibility for existing files)
    // Assume member uploaded, so admin OR the uploader can delete
    // If member uploaded → admin OR the uploader can delete
    return isCurrentUserAdmin || isUploadedByCurrentUser;
  };

  const categoryColors = {
    document: "bg-blue-100 text-blue-800",
    image: "bg-purple-100 text-purple-800",
    spreadsheet: "bg-green-100 text-green-800",
    presentation: "bg-orange-100 text-orange-800",
    code: "bg-slate-100 text-slate-800",
    design: "bg-pink-100 text-pink-800",
    other: "bg-slate-100 text-slate-800",
  };

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload New File
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Select File</Label>
            <div className="flex gap-2">
              <Input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="flex-1"
              >
                <Upload className="h-4 w-4 mr-2" />
                {selectedFile ? selectedFile.name : "Choose File"}
              </Button>
              {selectedFile && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedFile(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            {selectedFile && (
              <p className="text-xs text-slate-600">
                Size: {formatFileSize(selectedFile.size)}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Project *</Label>
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a project..." />
              </SelectTrigger>
              <SelectContent>
                {projects.map(project => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="document">Document</SelectItem>
                <SelectItem value="image">Image</SelectItem>
                <SelectItem value="spreadsheet">Spreadsheet</SelectItem>
                <SelectItem value="presentation">Presentation</SelectItem>
                <SelectItem value="code">Code</SelectItem>
                <SelectItem value="design">Design</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Description (Optional)</Label>
            <Input
              placeholder="Brief description of the file..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <Button
            onClick={handleUpload}
            disabled={!selectedFile || !selectedProjectId || uploading || !currentUser}
            className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload File
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Files List */}
      <Card>
        <CardHeader>
          <CardTitle>Uploaded Files ({files.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {files.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <File className="h-12 w-12 mx-auto mb-3 text-slate-300" />
              <p>No files uploaded yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <File className="h-5 w-5 text-blue-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-slate-900 truncate">
                        {file.file_name}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <span className={`px-2 py-0.5 rounded ${categoryColors[file.category]}`}>
                          {file.category}
                        </span>
                        <span>{formatFileSize(file.file_size)}</span>
                        <span>•</span>
                        <span>{format(new Date(file.created_date), "MMM d, yyyy")}</span>
                      </div>
                      {file.description && (
                        <p className="text-xs text-slate-600 mt-1 line-clamp-1">
                          {file.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(file.file_url, '_blank')}
                    >
                      <Download className="h-3 w-3" />
                    </Button>
                    {canDeleteFile(file) && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setDeletingFile(file.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingFile} onOpenChange={() => setDeletingFile(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete File</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this file? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteFileMutation.mutate(deletingFile)}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

