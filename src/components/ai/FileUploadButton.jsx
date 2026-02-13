import React, { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Paperclip, X, Loader2, File } from 'lucide-react';
import { groonabackend } from "@/api/groonabackend";
import { toast } from "sonner";

export default function FileUploadButton({ onFilesUploaded, maxFiles = 3, disabled = false }) {
  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const fileInputRef = useRef(null);

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    
    if (files.length === 0) return;
    
    if (uploadedFiles.length + files.length > maxFiles) {
      toast.error(`Maximum ${maxFiles} files allowed`);
      return;
    }

    setUploading(true);

    try {
      const uploadPromises = files.map(async (file) => {
        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
          throw new Error(`${file.name} is too large. Max size is 10MB`);
        }

        const { file_url } = await groonabackend.integrations.Core.UploadFile({ file });
        
        return {
          name: file.name,
          url: file_url,
          size: file.size,
          type: file.type
        };
      });

      const results = await Promise.all(uploadPromises);
      const newFiles = [...uploadedFiles, ...results];
      
      setUploadedFiles(newFiles);
      
      if (onFilesUploaded) {
        onFilesUploaded(newFiles.map(f => f.url));
      }

      toast.success(`${files.length} file(s) uploaded successfully`);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Failed to upload files');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveFile = (index) => {
    const newFiles = uploadedFiles.filter((_, idx) => idx !== index);
    setUploadedFiles(newFiles);
    
    if (onFilesUploaded) {
      onFilesUploaded(newFiles.map(f => f.url));
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileSelect}
        className="hidden"
        accept="image/*,.pdf,.doc,.docx,.txt,.csv,.json"
        disabled={disabled}
      />
      
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading || uploadedFiles.length >= maxFiles || disabled}
        className="text-slate-600 hover:text-blue-600"
      >
        {uploading ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Paperclip className="h-4 w-4 mr-2" />
        )}
        Attach {uploadedFiles.length > 0 && `(${uploadedFiles.length}/${maxFiles})`}
      </Button>

      {uploadedFiles.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {uploadedFiles.map((file, idx) => (
            <Badge
              key={idx}
              variant="outline"
              className="pl-2 pr-1 py-1 text-xs flex items-center gap-2 bg-blue-50 border-blue-200"
            >
              <File className="h-3 w-3 text-blue-600" />
              <span className="max-w-[120px] truncate">{file.name}</span>
              <span className="text-slate-500">({formatFileSize(file.size)})</span>
              <button
                onClick={() => handleRemoveFile(idx)}
                className="ml-1 hover:bg-blue-200 rounded p-0.5"
                disabled={disabled}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

