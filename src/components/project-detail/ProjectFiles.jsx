import React, { useState } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Upload, File, Image, FileSpreadsheet, FileText, Presentation, 
  Code, Download, Trash2, Search, Loader2 
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

const categoryIcons = {
  document: FileText,
  image: Image,
  spreadsheet: FileSpreadsheet,
  presentation: Presentation,
  code: Code,
  design: File,
  other: File,
};

export default function ProjectFiles({ projectId }) {
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [currentUser, setCurrentUser] = useState(null);
  const queryClient = useQueryClient();

  React.useEffect(() => {
    groonabackend.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  const { data: files = [], isLoading } = useQuery({
    queryKey: ['project-files', projectId],
    queryFn: async () => {
      // Fetch files linked to this project. 
      // Ensure we select generic fields if model is ambiguous
      return await groonabackend.entities.ProjectFile.filter({ 
        project_id: projectId 
      }, '-created_date');
    },
    enabled: !!projectId,
  });

  const uploadFileMutation = useMutation({
    mutationFn: async (file) => {
      if (!currentUser) throw new Error("User not authenticated");
      setUploading(true);
      try {
        // 1. Upload the physical file
        const { file_url } = await groonabackend.integrations.Core.UploadFile({ file });
        
        if (!file_url) throw new Error("Upload failed, no URL returned");

        // Determine category
        let category = 'other';
        if (file.type.startsWith('image/')) category = 'image';
        else if (file.type.includes('spreadsheet') || file.type.includes('excel')) category = 'spreadsheet';
        else if (file.type.includes('presentation') || file.type.includes('powerpoint')) category = 'presentation';
        else if (file.type.includes('document') || file.type.includes('word') || file.type.includes('pdf')) category = 'document';
        else if (file.type.includes('code') || file.type.includes('text') || file.type.includes('javascript') || file.type.includes('json')) category = 'code';

        // 2. Create the Database Record
        // FIX: Using 'name' and 'tenant_id' to ensure strict schema compliance
        const fileRecord = await groonabackend.entities.ProjectFile.create({
          tenant_id: currentUser.tenant_id,  // REQUIRED for multi-tenancy
          project_id: projectId,             // REQUIRED link
          name: file.name,                   // Standard naming
          file_name: file.name,              // Fallback naming
          file_url: file_url,
          url: file_url,                     // Fallback url
          file_type: file.type,
          file_size: file.size,
          size: file.size,                   // Standard size naming
          category,
          uploaded_by: currentUser.email,
          uploaded_by_name: currentUser.full_name,
          created_date: new Date().toISOString(),
          is_archived: false
        });

        return fileRecord;
      } finally {
        setUploading(false);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-files', projectId] });
      toast.success('File uploaded successfully');
      // Reset file input
      const fileInput = document.getElementById('file-upload');
      if (fileInput) fileInput.value = '';
    },
    onError: (error) => {
      console.error('Upload error:', error);
      toast.error(`Failed to upload file: ${error.message}`);
    },
  });

  const deleteFileMutation = useMutation({
    mutationFn: (fileId) => groonabackend.entities.ProjectFile.delete(fileId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-files', projectId] });
      toast.success('File deleted');
    },
    onError: () => {
      toast.error('Failed to delete file');
    },
  });

  const handleFileUpload = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      uploadFileMutation.mutate(file);
    }
  };

  const filteredFiles = files.filter(file => {
    // Check both name fields for compatibility
    const name = file.name || file.file_name || "";
    const matchesSearch = name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || file.category === categoryFilter;
    const isNotArchived = !file.is_archived;
    return matchesSearch && matchesCategory && isNotArchived;
  });

  const formatFileSize = (bytes) => {
    if (!bytes) return "0 B";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const categories = ['all', 'document', 'image', 'spreadsheet', 'presentation', 'code', 'other'];

  return (
    <Card className="bg-white/60 backdrop-blur-xl border-slate-200/60">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <CardTitle className="flex items-center gap-2">
            <File className="h-5 w-5 text-slate-600" />
            Project Files
          </CardTitle>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-48"
              icon={<Search className="h-4 w-4" />}
            />
            <input
              type="file"
              id="file-upload"
              className="hidden"
              onChange={handleFileUpload}
              disabled={uploading}
            />
            <Button
              onClick={() => document.getElementById('file-upload')?.click()}
              disabled={uploading}
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
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
          </div>
        </div>
        <div className="flex gap-2 mt-4 flex-wrap">
          {categories.map(cat => (
            <Button
              key={cat}
              variant={categoryFilter === cat ? "default" : "outline"}
              size="sm"
              onClick={() => setCategoryFilter(cat)}
              className={categoryFilter === cat ? "bg-blue-600" : ""}
            >
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-slate-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="text-center py-12">
            <File className="h-16 w-16 mx-auto mb-4 text-slate-300" />
            <p className="text-slate-600 mb-2">
              {searchQuery || categoryFilter !== 'all' ? 'No files found' : 'No files uploaded yet'}
            </p>
            <p className="text-sm text-slate-500">Upload files to share with your team</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredFiles.map(file => {
              const Icon = categoryIcons[file.category] || File;
              // Use fallback for names and size for backward compatibility
              const fileName = file.name || file.file_name || "Untitled";
              const fileSize = file.size || file.file_size || 0;
              const fileUrl = file.file_url || file.url;

              return (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors group"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="p-2 rounded-lg bg-blue-100 flex-shrink-0">
                      <Icon className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 truncate">{fileName}</p>
                      <div className="flex items-center gap-3 text-xs text-slate-600 mt-1">
                        <span>{formatFileSize(fileSize)}</span>
                        <span>•</span>
                        <Badge variant="outline" className="text-xs capitalize">
                          {file.category}
                        </Badge>
                        <span>•</span>
                        <span>Uploaded by {file.uploaded_by_name || 'Unknown'}</span>
                        <span>•</span>
                        <span>{file.created_date ? format(new Date(file.created_date), 'MMM d, yyyy') : 'Recent'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => window.open(fileUrl, '_blank')}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        if (confirm('Are you sure you want to delete this file?')) {
                          deleteFileMutation.mutate(file.id);
                        }
                      }}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

