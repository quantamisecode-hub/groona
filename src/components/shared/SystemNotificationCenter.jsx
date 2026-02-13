import React, { useState, useEffect } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Bell, 
  X, 
  CreditCard, 
  Sparkles, 
  Settings, 
  AlertTriangle, 
  Megaphone,
  ExternalLink,
  CheckCheck
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Link } from "react-router-dom";

export default function SystemNotificationCenter({ currentUser }) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['system-notifications', currentUser?.email],
    queryFn: async () => {
      const allNotifications = await groonabackend.entities.SystemNotification.filter(
        { is_active: true },
        '-created_date'
      );
      
      // Filter notifications based on audience and tenant
      return allNotifications.filter(n => {
        // Check if expired
        if (n.expires_at && new Date(n.expires_at) < new Date()) return false;
        
        // Check if user dismissed it
        if (n.dismissed_by?.includes(currentUser?.email)) return false;
        
        // Check audience
        if (n.target_audience === 'all') return true;
        if (n.target_audience === 'admins' && (currentUser?.role === 'admin' || currentUser?.is_super_admin)) return true;
        if (n.target_audience === 'users' && currentUser?.role === 'user') return true;
        if (n.target_audience === 'specific_tenant' && n.tenant_id === currentUser?.tenant_id) return true;
        
        // Global notifications (no tenant_id)
        if (!n.tenant_id) return true;
        
        return false;
      });
    },
    enabled: !!currentUser,
    refetchInterval: 60000, // Refresh every minute
  });

  const dismissMutation = useMutation({
    mutationFn: async (notificationId) => {
      const notification = notifications.find(n => n.id === notificationId);
      if (notification) {
        const dismissedBy = [...(notification.dismissed_by || []), currentUser.email];
        await groonabackend.entities.SystemNotification.update(notificationId, { dismissed_by: dismissedBy });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-notifications'] });
    },
  });

  const dismissAllMutation = useMutation({
    mutationFn: async () => {
      const promises = notifications.map(n => {
        const dismissedBy = [...(n.dismissed_by || []), currentUser.email];
        return groonabackend.entities.SystemNotification.update(n.id, { dismissed_by: dismissedBy });
      });
      await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-notifications'] });
    },
  });

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'subscription':
        return <CreditCard className="h-5 w-5 text-purple-600" />;
      case 'feature':
        return <Sparkles className="h-5 w-5 text-blue-600" />;
      case 'system':
        return <Settings className="h-5 w-5 text-slate-600" />;
      case 'alert':
        return <AlertTriangle className="h-5 w-5 text-amber-600" />;
      case 'announcement':
        return <Megaphone className="h-5 w-5 text-green-600" />;
      default:
        return <Bell className="h-5 w-5 text-slate-600" />;
    }
  };

  const getCategoryColor = (category, priority) => {
    if (priority === 'critical') return 'bg-red-50 border-red-200';
    if (priority === 'high') return 'bg-amber-50 border-amber-200';
    
    switch (category) {
      case 'subscription':
        return 'bg-purple-50 border-purple-200';
      case 'feature':
        return 'bg-blue-50 border-blue-200';
      case 'system':
        return 'bg-slate-50 border-slate-200';
      case 'alert':
        return 'bg-amber-50 border-amber-200';
      case 'announcement':
        return 'bg-green-50 border-green-200';
      default:
        return 'bg-slate-50 border-slate-200';
    }
  };

  const getPriorityBadge = (priority) => {
    switch (priority) {
      case 'critical':
        return <Badge className="bg-red-600 text-white text-xs">Critical</Badge>;
      case 'high':
        return <Badge className="bg-amber-600 text-white text-xs">Important</Badge>;
      default:
        return null;
    }
  };

  const filteredNotifications = activeTab === 'all' 
    ? notifications 
    : notifications.filter(n => n.category === activeTab);

  const unreadCount = notifications.length;

  const categories = [
    { value: 'all', label: 'All' },
    { value: 'subscription', label: 'Subscription' },
    { value: 'feature', label: 'Features' },
    { value: 'system', label: 'System' },
    { value: 'alert', label: 'Alerts' },
    { value: 'announcement', label: 'News' },
  ];

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center bg-red-600 text-white text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md p-0">
        <SheetHeader className="p-4 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notifications
            </SheetTitle>
            {notifications.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => dismissAllMutation.mutate()}
                className="text-xs"
                disabled={dismissAllMutation.isPending}
              >
                <CheckCheck className="h-3 w-3 mr-1" />
                Dismiss All
              </Button>
            )}
          </div>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="px-4 pt-3 border-b">
            <TabsList className="w-full grid grid-cols-6 h-8">
              {categories.map(cat => (
                <TabsTrigger 
                  key={cat.value} 
                  value={cat.value}
                  className="text-xs px-2"
                >
                  {cat.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <ScrollArea className="h-[calc(100vh-180px)]">
            <TabsContent value={activeTab} className="m-0 p-4">
              {isLoading ? (
                <div className="text-center py-12 text-slate-500">
                  <div className="animate-spin h-8 w-8 border-2 border-slate-300 border-t-slate-600 rounded-full mx-auto mb-3" />
                  <p>Loading notifications...</p>
                </div>
              ) : filteredNotifications.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <Bell className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                  <p>No notifications</p>
                  <p className="text-sm mt-1">You're all caught up!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredNotifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-4 rounded-lg border transition-all hover:shadow-md ${getCategoryColor(notification.category, notification.priority)}`}
                    >
                      <div className="flex gap-3">
                        <div className="flex-shrink-0 mt-0.5">
                          {getCategoryIcon(notification.category)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-semibold text-sm text-slate-900">
                                {notification.title}
                              </h4>
                              {getPriorityBadge(notification.priority)}
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 flex-shrink-0"
                              onClick={() => dismissMutation.mutate(notification.id)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                          <p className="text-sm text-slate-700 mt-1 break-words">
                            {notification.message}
                          </p>
                          <div className="flex items-center justify-between mt-3">
                            <p className="text-xs text-slate-500">
                              {formatDistanceToNow(new Date(notification.created_date), { 
                                addSuffix: true 
                              })}
                            </p>
                            {notification.action_url && (
                              <Link 
                                to={notification.action_url}
                                onClick={() => setOpen(false)}
                              >
                                <Button size="sm" variant="outline" className="h-7 text-xs">
                                  {notification.action_label || 'View'}
                                  <ExternalLink className="h-3 w-3 ml-1" />
                                </Button>
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

