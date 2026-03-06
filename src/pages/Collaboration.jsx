import React, { useState } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FileText, Upload, Plus, Shield, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useHasPermission } from "../components/shared/usePermissions";
import DocumentList from "../components/collaboration/DocumentList";
import DocumentEditor from "../components/collaboration/DocumentEditor";
import DocumentViewer from "../components/collaboration/DocumentViewer";
import FileUploadManager from "../components/collaboration/FileUploadManager";
import { toast } from "sonner";
import { OnboardingProvider } from "../components/onboarding/OnboardingProvider";
import FeatureOnboarding from "../components/onboarding/FeatureOnboarding";
import { useUser } from "../components/shared/UserContext";

export default function CollaborationPage() {
  // Use global user context to prevent loading spinner on navigation
  const { user: currentUser, effectiveTenantId } = useUser();

  const [activeTab, setActiveTab] = useState("documents");
  const [view, setView] = useState("list"); // list, create, edit, view
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const queryClient = useQueryClient();

  // Permissions
  const canCreateDocs = useHasPermission('can_create_documents');
  const canEditDocs = useHasPermission('can_edit_documents');
  const canDeleteDocs = useHasPermission('can_delete_documents');
  const canUploadFiles = useHasPermission('can_upload_files');

  // Fetch documents with real-time updates - filtered by tenant
  const { data: documents = [] } = useQuery({
    queryKey: ['documents', effectiveTenantId],
    queryFn: async () => {
      if (!effectiveTenantId) return [];
      return groonabackend.entities.Document.filter({ tenant_id: effectiveTenantId }, '-updated_date');
    },
    enabled: !!effectiveTenantId,
    refetchInterval: 5000,
  });

  // Fetch projects for document association - filtered by tenant
  const { data: projects = [] } = useQuery({
    queryKey: ['projects', effectiveTenantId],
    queryFn: async () => {
      if (!effectiveTenantId) return [];
      return groonabackend.entities.Project.filter({ tenant_id: effectiveTenantId }, '-updated_date');
    },
    enabled: !!effectiveTenantId,
    refetchInterval: 5000,
  });

  // Fetch files with real-time updates - filtered by tenant
  const { data: files = [] } = useQuery({
    queryKey: ['project-files', effectiveTenantId],
    queryFn: async () => {
      if (!effectiveTenantId) return [];
      return groonabackend.entities.ProjectFile.filter({ tenant_id: effectiveTenantId }, '-created_date');
    },
    enabled: !!effectiveTenantId,
    refetchInterval: 5000,
  });

  // Create document mutation
  const createDocumentMutation = useMutation({
    mutationFn: async (data) => {
      const doc = await groonabackend.entities.Document.create({
        ...data,
        tenant_id: effectiveTenantId,
        author_email: currentUser.email,
        author_name: currentUser.full_name,
        last_edited_by: currentUser.email,
        last_edited_at: new Date().toISOString(),
      });
      // Create activity
      try {
        await groonabackend.entities.Activity.create({
          tenant_id: effectiveTenantId,
          action: 'created',
          entity_type: 'document',
          entity_id: doc.id,
          entity_name: doc.title,
          project_id: data.project_id || undefined,
          user_email: currentUser.email,
          user_name: currentUser.full_name,
        });
      } catch (activityError) { }
      return doc;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', effectiveTenantId] });
      setView('list');
      toast.success("Document created successfully!");
    },
    onError: (error) => {
      toast.error("Failed to create document: " + (error.message || "Unknown error"));
    },
  });

  // Update document mutation
  const updateDocumentMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const doc = await groonabackend.entities.Document.update(id, {
        ...data,
        last_edited_by: currentUser.email,
        last_edited_at: new Date().toISOString(),
      });
      // Create activity
      try {
        await groonabackend.entities.Activity.create({
          tenant_id: effectiveTenantId,
          action: 'updated',
          entity_type: 'document',
          entity_id: id,
          entity_name: doc.title,
          project_id: data.project_id || undefined,
          user_email: currentUser.email,
          user_name: currentUser.full_name,
        });
      } catch (activityError) { }
      return doc;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', effectiveTenantId] });
      setView('list');
      toast.success("Document updated successfully!");
    },
    onError: (error) => {
      toast.error("Failed to update document: " + (error.message || "Unknown error"));
    },
  });

  // Delete document mutation
  const deleteDocumentMutation = useMutation({
    mutationFn: async (id) => {
      await groonabackend.entities.Document.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', effectiveTenantId] });
      toast.success("Document deleted");
    },
  });

  // View document (increment view count)
  const viewDocumentMutation = useMutation({
    mutationFn: async (doc) => {
      await groonabackend.entities.Document.update(doc.id, {
        views_count: (doc.views_count || 0) + 1,
      });
      return doc;
    },
    onSuccess: (doc) => {
      queryClient.invalidateQueries({ queryKey: ['documents', effectiveTenantId] });
      setSelectedDocument(doc);
      setView('view');
    },
  });

  const handleSaveDocument = async (data) => {
    if (selectedDocument) {
      await updateDocumentMutation.mutateAsync({ id: selectedDocument.id, data });
    } else {
      await createDocumentMutation.mutateAsync(data);
    }
  };

  const handleViewDocument = (doc) => {
    viewDocumentMutation.mutate(doc);
  };

  const handleEditDocument = (doc) => {
    setSelectedDocument(doc);
    setView('edit');
  };

  const handleDeleteDocument = (id) => {
    deleteDocumentMutation.mutate(id);
  };

  if (!currentUser) {
    return null; // Don't show loader, assume context handles initial load or is ready
  }

  const userRole = currentUser?.is_super_admin || currentUser?.role === 'admin' ? 'admin' : 'user';

  return (
    <OnboardingProvider currentUser={currentUser} featureArea="collaboration">
      <FeatureOnboarding
        currentUser={currentUser}
        featureArea="collaboration"
        userRole={userRole}
      />
      <div className="flex flex-col bg-[#f8f9fa] w-full relative z-0 min-h-screen overflow-hidden">
        <div className="max-w-[1400px] mx-auto w-full flex flex-col relative h-full">
          <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setView('list'); }} className="flex flex-col h-full">
            {/* Sticky Header Section */}
            <div className="sticky top-0 z-30 bg-[#f8f9fa] flex-shrink-0 pt-8 pb-4">
              <div className="px-6 md:px-12 lg:px-16">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-6">
                  <div className="space-y-1">
                    <h1 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">
                      Collaboration
                    </h1>
                    <p className="text-[15px] font-medium text-slate-500">
                      Create documents, share files, and organize team knowledge
                    </p>
                  </div>

                  {/* Tab Toggles (Apple Style Pill) */}
                  <TabsList className="bg-slate-200/60 p-1 rounded-2xl h-12 shadow-inner border border-slate-200/50">
                    <TabsTrigger
                      value="documents"
                      className="flex items-center gap-2 rounded-xl h-10 px-6 font-semibold data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm transition-all duration-300"
                    >
                      <FileText className="h-4 w-4" />
                      Documents
                    </TabsTrigger>
                    <TabsTrigger
                      value="files"
                      className="flex items-center gap-2 rounded-xl h-10 px-6 font-semibold data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm transition-all duration-300"
                    >
                      <Upload className="h-4 w-4" />
                      Files
                    </TabsTrigger>
                  </TabsList>
                </div>

                {/* Filter & Action Controls */}
                {activeTab === 'documents' && (
                  <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 w-full">
                    <div className="relative w-full sm:w-[320px]">
                      <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        placeholder="Search documents by title..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 h-11 bg-white border-slate-200/80 focus-visible:ring-blue-500/20 focus-visible:border-blue-500 transition-all rounded-[14px] text-[15px] placeholder:text-slate-400 shadow-sm"
                      />
                    </div>

                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                      <SelectTrigger className="w-full sm:w-[160px] h-11 bg-white border-slate-200/80 shadow-sm hover:border-slate-300 transition-colors rounded-[14px] text-[15px]">
                        <SelectValue placeholder="Categories" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-slate-100 shadow-xl">
                        <SelectItem value="all">All Categories</SelectItem>
                        <SelectItem value="general">General</SelectItem>
                        <SelectItem value="requirements">Requirements</SelectItem>
                        <SelectItem value="technical">Technical</SelectItem>
                        <SelectItem value="meeting_notes">Meeting Notes</SelectItem>
                        <SelectItem value="process">Process</SelectItem>
                        <SelectItem value="guide">Guide</SelectItem>
                      </SelectContent>
                    </Select>

                    {canCreateDocs && (
                      <div className="md:ml-auto w-full sm:w-auto mt-2 sm:mt-0">
                        <Button
                          onClick={() => { setSelectedDocument(null); setView('create'); }}
                          className="w-full sm:w-auto h-11 rounded-lg bg-gradient-to-r from-blue-600 to-slate-900 border-0 shadow-lg shadow-blue-500/20 hover:from-blue-700 hover:to-slate-950 hover:opacity-90 text-white font-bold transition-all active:scale-95 gap-2 px-6"
                        >
                          <Plus className="h-4 w-4" />
                          New Document
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto min-h-0 bg-[#f8f9fa]">
              <div className="px-6 md:px-12 lg:px-16 pt-6 pb-24 md:pb-32">
                {/* Documents Tab */}
                <TabsContent value="documents" className="mt-0">
                  {view === 'list' && (
                    <DocumentList
                      documents={documents}
                      onView={handleViewDocument}
                      onEdit={handleEditDocument}
                      onDelete={handleDeleteDocument}
                      canEdit={canEditDocs}
                      canDelete={canDeleteDocs}
                      searchQuery={searchQuery}
                      categoryFilter={categoryFilter}
                    />
                  )}

                  {(view === 'create' || view === 'edit') && (
                    <DocumentEditor
                      document={selectedDocument}
                      onSave={handleSaveDocument}
                      onCancel={() => setView('list')}
                      projects={projects}
                    />
                  )}

                  {view === 'view' && (
                    <DocumentViewer
                      document={selectedDocument}
                      onBack={() => setView('list')}
                      onEdit={handleEditDocument}
                      canEdit={canEditDocs}
                    />
                  )}
                </TabsContent>

                {/* Files Tab */}
                <TabsContent value="files" className="mt-0">
                  <div className="bg-white border text-center border-slate-200/60 rounded-[24px] shadow-sm p-2 w-full">
                    {/* Allow all team members to upload files, not just those with can_upload_files permission */}
                    <FileUploadManager
                      files={files}
                      onFileUploaded={() => queryClient.invalidateQueries({ queryKey: ['project-files', effectiveTenantId] })}
                    />
                  </div>
                </TabsContent>
              </div>
            </div>
          </Tabs>
        </div>
      </div>
    </OnboardingProvider>
  );
}