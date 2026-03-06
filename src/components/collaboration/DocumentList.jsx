import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Eye, Edit, Trash2, Calendar, User, Sparkles, MoreHorizontal } from "lucide-react";
import { format } from "date-fns";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export default function DocumentList({ documents, onView, onEdit, onDelete, canEdit, canDelete, searchQuery = "", categoryFilter = "all" }) {
  const [deletingDoc, setDeletingDoc] = useState(null);

  const categoryColors = {
    general: "bg-stone-100 text-stone-700 border-stone-200",
    requirements: "bg-blue-50 text-blue-700 border-blue-200",
    technical: "bg-purple-50 text-purple-700 border-purple-200",
    meeting_notes: "bg-emerald-50 text-emerald-700 border-emerald-200",
    process: "bg-orange-50 text-orange-700 border-orange-200",
    guide: "bg-amber-50 text-amber-700 border-amber-200",
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.author_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === "all" || doc.category === categoryFilter;
    return matchesSearch && matchesCategory && !doc.is_archived;
  });

  const handleDelete = () => {
    if (deletingDoc) {
      onDelete(deletingDoc);
      setDeletingDoc(null);
    }
  };

  if (filteredDocuments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center border border-dashed border-slate-200 rounded-3xl bg-slate-50/50">
        <FileText className="h-12 w-12 mb-4 text-slate-300" />
        <h3 className="text-lg font-semibold text-slate-700">No documents found</h3>
        <p className="text-sm text-slate-500 mt-1 max-w-sm">Create your first document or try adjusting your search filters.</p>
      </div>
    );
  }

  return (
    <div className="space-y-1 pb-10">
      {/* Header Row */}
      <div className="grid grid-cols-[minmax(0,1fr)_120px_160px_120px_60px] md:grid-cols-[minmax(0,2fr)_140px_180px_140px_80px] gap-4 px-4 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100 mb-2">
        <div>Name</div>
        <div className="hidden sm:block">Category</div>
        <div className="hidden md:block">Author</div>
        <div className="text-right sm:text-left">Modified</div>
        <div className="text-right"></div>
      </div>

      {/* List Content */}
      <div className="flex flex-col gap-1">
        {filteredDocuments.map(doc => (
          <div
            key={doc.id}
            onClick={() => onView(doc)}
            className="group grid grid-cols-[minmax(0,1fr)_120px_160px_120px_60px] md:grid-cols-[minmax(0,2fr)_140px_180px_140px_80px] gap-4 items-center px-4 py-3 bg-white hover:bg-slate-50 border border-transparent hover:border-slate-200/60 rounded-xl cursor-pointer transition-all duration-200"
          >
            {/* Title & Icon */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                <FileText className="h-4 w-4" />
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-[14px] text-slate-900 truncate group-hover:text-blue-600 transition-colors">
                    {doc.title}
                  </span>
                  {doc.ai_generated && <Sparkles className="h-3 w-3 text-purple-500 flex-shrink-0" />}
                </div>
              </div>
            </div>

            {/* Category */}
            <div className="hidden sm:flex items-center">
              <Badge variant="outline" className={`text-[10px] px-2 py-0.5 capitalize font-medium ${categoryColors[doc.category] || categoryColors.general}`}>
                {doc.category.replace("_", " ")}
              </Badge>
            </div>

            {/* Author */}
            <div className="hidden md:flex items-center gap-2 min-w-0">
              <div className="h-6 w-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600 flex-shrink-0">
                {doc.author_name?.charAt(0).toUpperCase() || <User className="h-3 w-3" />}
              </div>
              <span className="text-[13px] text-slate-600 truncate">{doc.author_name}</span>
            </div>

            {/* Date */}
            <div className="text-[13px] text-slate-500 flex items-center justify-end sm:justify-start">
              {format(new Date(doc.last_edited_at || doc.updated_date || doc.created_date), "MMM d, yyyy")}
            </div>

            {/* Actions (Hover) */}
            <div className="flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity">
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-900 hover:bg-slate-200/50">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40 rounded-xl shadow-lg border-slate-100 p-1">
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onView(doc); }} className="text-[13px] cursor-pointer rounded-lg m-0.5">
                    <Eye className="h-3.5 w-3.5 mr-2" /> View
                  </DropdownMenuItem>
                  {canEdit && (
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(doc); }} className="text-[13px] cursor-pointer rounded-lg m-0.5">
                      <Edit className="h-3.5 w-3.5 mr-2" /> Edit
                    </DropdownMenuItem>
                  )}
                  {canDelete && (
                    <DropdownMenuItem
                      onClick={(e) => { e.stopPropagation(); setDeletingDoc(doc.id); }}
                      className="text-[13px] text-red-600 focus:text-red-600 focus:bg-red-50 cursor-pointer rounded-lg m-0.5"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ))}
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingDoc} onOpenChange={() => setDeletingDoc(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this document? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700 rounded-xl shadow-md">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
