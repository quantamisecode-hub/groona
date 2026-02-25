import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { groonabackend } from "@/api/groonabackend";
import { FileBarChart, Star, Trash2, Play, Calendar } from "lucide-react";
import { format, isValid } from "date-fns";
import { toast } from "sonner";
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

export default function SavedReports({ reports, onLoadReport }) {
  const queryClient = useQueryClient();
  const [deleteId, setDeleteId] = React.useState(null);

  const deleteMutation = useMutation({
    mutationFn: (id) => groonabackend.entities.ReportConfig.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-reports'] });
      toast.success('Report deleted');
      setDeleteId(null);
    },
    onError: (error) => {
      toast.error(`Failed to delete report: ${error.message}`);
    }
  });

  const toggleFavoriteMutation = useMutation({
    mutationFn: ({ id, is_favorite }) => groonabackend.entities.ReportConfig.update(id, { is_favorite }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-reports'] });
    },
  });

  const reportTypeColors = {
    timesheet: "bg-blue-100 text-blue-700",
    project: "bg-purple-100 text-purple-700",
    productivity: "bg-green-100 text-green-700",
    billing: "bg-amber-100 text-amber-700",
    custom: "bg-slate-100 text-slate-700",
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Just now';
    const date = new Date(dateString);
    return isValid(date) ? format(date, 'MMM d, yyyy') : 'Just now';
  };

  if (!reports || reports.length === 0) {
    return (
      <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60">
        <CardContent className="py-12 text-center">
          <FileBarChart className="h-16 w-16 mx-auto mb-4 text-slate-300" />
          <h3 className="text-xl font-semibold text-slate-900 mb-2">No Saved Reports</h3>
          <p className="text-slate-600">Create and save your first custom report to see it here</p>
        </CardContent>
      </Card>
    );
  }

  const favoriteReports = reports.filter(r => r.is_favorite);
  const otherReports = reports.filter(r => !r.is_favorite);

  return (
    <div className="space-y-6">
      {/* Favorite Reports */}
      {favoriteReports.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Star className="h-5 w-5 text-amber-500 fill-amber-500" />
            Favorite Reports
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {favoriteReports.map(report => (
              <Card key={report.id} className="bg-white/80 backdrop-blur-xl border-slate-200/60 hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <CardTitle className="text-base mb-2">{report.name}</CardTitle>
                      <Badge className={reportTypeColors[report.report_type] || reportTypeColors.custom}>
                        {report.report_type || 'custom'}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleFavoriteMutation.mutate({ id: report.id, is_favorite: false })}
                    >
                      <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {report.description && (
                    <p className="text-sm text-slate-600 line-clamp-2">{report.description}</p>
                  )}
                  
                  <div className="text-xs text-slate-500 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Created {formatDate(report.created_date)}
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      onClick={() => onLoadReport(report)}
                      className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600"
                    >
                      <Play className="h-3 w-3 mr-1" />
                      Load
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeleteId(report.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Other Reports */}
      {otherReports.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-slate-900">All Reports</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {otherReports.map(report => (
              <Card key={report.id} className="bg-white/80 backdrop-blur-xl border-slate-200/60 hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <CardTitle className="text-base mb-2">{report.name}</CardTitle>
                      <Badge className={reportTypeColors[report.report_type] || reportTypeColors.custom}>
                        {report.report_type || 'custom'}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleFavoriteMutation.mutate({ id: report.id, is_favorite: true })}
                    >
                      <Star className="h-4 w-4 text-slate-400" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {report.description && (
                    <p className="text-sm text-slate-600 line-clamp-2">{report.description}</p>
                  )}
                  
                  <div className="text-xs text-slate-500 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Created {formatDate(report.created_date)}
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      onClick={() => onLoadReport(report)}
                      className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600"
                    >
                      <Play className="h-3 w-3 mr-1" />
                      Load
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeleteId(report.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Report</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this saved report? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate(deleteId)}
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

