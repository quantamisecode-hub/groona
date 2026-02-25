import React, { useState } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Loader2, 
  Bell,
  CreditCard,
  Sparkles,
  Settings,
  AlertTriangle,
  Megaphone
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import SystemNotificationDialog from "../components/notifications/SystemNotificationDialog";
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

export default function SystemNotificationManager() {
  const [currentUser, setCurrentUser] = useState(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingNotification, setEditingNotification] = useState(null);
  const [deletingNotification, setDeletingNotification] = useState(null);
  const queryClient = useQueryClient();

  React.useEffect(() => {
    groonabackend.auth.me().then(setCurrentUser);
  }, []);

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['all-system-notifications'],
    queryFn: () => groonabackend.entities.SystemNotification.list('-created_date'),
    enabled: !!currentUser?.is_super_admin,
  });

  const createMutation = useMutation({
    mutationFn: (data) => groonabackend.entities.SystemNotification.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-system-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['system-notifications'] });
      setShowCreateDialog(false);
      toast.success('Notification created and sent!');
    },
    onError: (error) => {
      toast.error('Failed to create notification', { description: error.message });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => groonabackend.entities.SystemNotification.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-system-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['system-notifications'] });
      setEditingNotification(null);
      toast.success('Notification updated!');
    },
    onError: (error) => {
      toast.error('Failed to update notification', { description: error.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => groonabackend.entities.SystemNotification.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-system-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['system-notifications'] });
      setDeletingNotification(null);
      toast.success('Notification deleted!');
    },
    onError: (error) => {
      toast.error('Failed to delete notification', { description: error.message });
    },
  });

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'subscription': return <CreditCard className="h-4 w-4 text-purple-600" />;
      case 'feature': return <Sparkles className="h-4 w-4 text-blue-600" />;
      case 'system': return <Settings className="h-4 w-4 text-slate-600" />;
      case 'alert': return <AlertTriangle className="h-4 w-4 text-amber-600" />;
      case 'announcement': return <Megaphone className="h-4 w-4 text-green-600" />;
      default: return <Bell className="h-4 w-4 text-slate-600" />;
    }
  };

  const getPriorityBadge = (priority) => {
    switch (priority) {
      case 'critical': return <Badge className="bg-red-600">Critical</Badge>;
      case 'high': return <Badge className="bg-amber-600">High</Badge>;
      case 'medium': return <Badge variant="secondary">Medium</Badge>;
      case 'low': return <Badge variant="outline">Low</Badge>;
      default: return null;
    }
  };

  if (!currentUser?.is_super_admin) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600">Access denied. Super Admin privileges required.</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">System Notifications</h1>
          <p className="text-slate-600">Send announcements and alerts to users</p>
        </div>
        <Button
          onClick={() => setShowCreateDialog(true)}
          className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Notification
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      ) : notifications.length === 0 ? (
        <Card className="bg-white/60 backdrop-blur-xl border-slate-200/60">
          <CardContent className="py-20 text-center">
            <Bell className="h-12 w-12 mx-auto mb-4 text-slate-300" />
            <p className="text-slate-600 mb-4">No notifications created yet.</p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Notification
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {notifications.map((notification) => (
            <Card key={notification.id} className={`bg-white/60 backdrop-blur-xl border-slate-200/60 ${!notification.is_active && 'opacity-60'}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-1">{getCategoryIcon(notification.category)}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-slate-900">{notification.title}</h3>
                        {getPriorityBadge(notification.priority)}
                        <Badge variant="outline" className="capitalize">{notification.category}</Badge>
                        <Badge variant={notification.is_active ? "default" : "secondary"}>
                          {notification.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-600 mt-1">{notification.message}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                        <span>Audience: {notification.target_audience}</span>
                        <span>Created: {format(new Date(notification.created_date), 'MMM d, yyyy')}</span>
                        {notification.expires_at && (
                          <span>Expires: {format(new Date(notification.expires_at), 'MMM d, yyyy')}</span>
                        )}
                        <span>Dismissed by: {notification.dismissed_by?.length || 0} users</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingNotification(notification)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => setDeletingNotification(notification)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <SystemNotificationDialog
        open={showCreateDialog || !!editingNotification}
        onClose={() => {
          setShowCreateDialog(false);
          setEditingNotification(null);
        }}
        notification={editingNotification}
        onSubmit={(data) => {
          if (editingNotification) {
            updateMutation.mutate({ id: editingNotification.id, data });
          } else {
            createMutation.mutate(data);
          }
        }}
        loading={createMutation.isPending || updateMutation.isPending}
      />

      <AlertDialog open={!!deletingNotification} onOpenChange={() => setDeletingNotification(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Notification</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingNotification?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate(deletingNotification.id)}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

