import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Eye, Edit, Trash2, Calendar, User, Sparkles } from "lucide-react";
import { format } from "date-fns";
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

export default function DocumentList({ documents, onView, onEdit, onDelete, canEdit, canDelete, searchQuery = "", categoryFilter = "all" }) {
  const [deletingDoc, setDeletingDoc] = useState(null);

  const categoryColors = {
    general: "bg-slate-100 text-slate-800",
    requirements: "bg-blue-100 text-blue-800",
    technical: "bg-purple-100 text-purple-800",
    meeting_notes: "bg-green-100 text-green-800",
    process: "bg-orange-100 text-orange-800",
    guide: "bg-amber-100 text-amber-800",
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

  return (
    <div className="space-y-4">
      {/* Document Cards */}
      {filteredDocuments.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <FileText className="h-12 w-12 mx-auto mb-3 text-slate-300" />
            <p className="text-slate-600">No documents found</p>
            <p className="text-sm text-slate-500 mt-1">Create your first document to get started</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDocuments.map(doc => (
            <Card key={doc.id} className="hover:shadow-lg transition-all cursor-pointer group">
              <CardContent className="p-4 space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    <FileText className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-900 line-clamp-2 text-sm group-hover:text-blue-600 transition-colors">
                        {doc.title}
                      </h3>
                    </div>
                  </div>
                  {doc.ai_generated && (
                    <Sparkles className="h-4 w-4 text-purple-600 flex-shrink-0" />
                  )}
                </div>

                {/* Metadata */}
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {/* Added 'capitalize' class here */}
                    <Badge className={`text-xs capitalize ${categoryColors[doc.category]}`}>
                      {doc.category.replace("_", " ")}
                    </Badge>
                    {doc.tags?.slice(0, 2).map((tag, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-600">
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      <span className="truncate max-w-[120px]">{doc.author_name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>{format(new Date(doc.created_date), "MMM d")}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2 border-t border-slate-100">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onView(doc)}
                    className="flex-1 text-xs"
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    View
                  </Button>
                  {canEdit && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onEdit(doc)}
                      className="flex-1 text-xs"
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                  )}
                  {canDelete && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDeletingDoc(doc.id)}
                      className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingDoc} onOpenChange={() => setDeletingDoc(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this document? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
