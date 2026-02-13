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
      console.log('[Collaboration] Creating document with data:', data);

      const doc = await groonabackend.entities.Document.create({
        ...data,
        tenant_id: effectiveTenantId,
        author_email: currentUser.email,
        author_name: currentUser.full_name,
        last_edited_by: currentUser.email,
        last_edited_at: new Date().toISOString(),
      });

      console.log('[Collaboration] Document created:', doc);

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
      } catch (activityError) {
        console.error('[Collaboration] Activity creation failed:', activityError);
      }

      return doc;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', effectiveTenantId] });
      setView('list');
      toast.success("Document created successfully!");
    },
    onError: (error) => {
      console.error('[Collaboration] Document creation error:', error);
      toast.error("Failed to create document: " + (error.message || "Unknown error"));
    },
  });

  // Update document mutation
  const updateDocumentMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      console.log('[Collaboration] Updating document:', id, data);

      const doc = await groonabackend.entities.Document.update(id, {
        ...data,
        last_edited_by: currentUser.email,
        last_edited_at: new Date().toISOString(),
      });

      console.log('[Collaboration] Document updated:', doc);

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
      } catch (activityError) {
        console.error('[Collaboration] Activity update failed:', activityError);
      }

      return doc;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', effectiveTenantId] });
      setView('list');
      toast.success("Document updated successfully!");
    },
    onError: (error) => {
      console.error('[Collaboration] Document update error:', error);
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
      <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20 overflow-hidden w-full relative" style={{ maxWidth: '100vw', left: 0, right: 0 }}>
        <div className="max-w-7xl mx-auto w-full flex flex-col h-full overflow-x-hidden relative min-h-0" style={{ maxWidth: '100%' }}>
          <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setView('list'); }} className="flex flex-col h-full min-h-0">
            {/* Sticky Header Section */}
            <div className="sticky top-0 z-40 bg-white border-b border-slate-200/60 shadow-sm shrink-0">
              <div className="px-4 md:px-6 lg:px-8 pt-4 md:pt-6 lg:pt-8 pb-4">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                  <div>
                    <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
                      Collaboration Hub
                    </h1>
                    <p className="text-slate-600">
                      Create documents, share files, and chat with your team in real-time
                    </p>
                  </div>
                </div>

                {/* Tabs and Controls */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <TabsList className="bg-white/80 backdrop-blur-xl">
                    <TabsTrigger value="documents" className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Documents
                    </TabsTrigger>
                    <TabsTrigger value="files" className="flex items-center gap-2">
                      <Upload className="h-4 w-4" />
                      Files
                    </TabsTrigger>
                  </TabsList>

                  {activeTab === 'documents' && (
                    <div className="flex items-center gap-3 ml-auto">
                      <div className="relative w-[200px]">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                          placeholder="Search documents..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10 h-9"
                        />
                      </div>

                      <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                        <SelectTrigger className="w-[140px] h-9">
                          <SelectValue placeholder="Categories" />
                        </SelectTrigger>
                        <SelectContent>
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
                        <Button
                          onClick={() => { setSelectedDocument(null); setView('create'); }}
                          className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 h-9"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Create Document
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden">
              <div className="px-4 md:px-6 lg:px-8 pb-4 md:pb-6 lg:pb-8 pt-4">
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
                  {/* Allow all team members to upload files, not just those with can_upload_files permission */}
                  <FileUploadManager
                    files={files}
                    onFileUploaded={() => queryClient.invalidateQueries({ queryKey: ['project-files', effectiveTenantId] })}
                  />
                </TabsContent>
              </div>
            </div>
          </Tabs>
        </div>
      </div>
    </OnboardingProvider>
  );
}

