import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Key, Plus, Copy, Trash2, Eye, EyeOff, Loader2, AlertCircle, Check, Shield } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

export default function ApiKeyManagement({ user, onUpdate, isUpdating }) {
  const [apiKeys, setApiKeys] = useState([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyDescription, setNewKeyDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [deletingKey, setDeletingKey] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [visibleKeys, setVisibleKeys] = useState({});
  const [justCreatedKey, setJustCreatedKey] = useState(null);

  // Initialize API keys from user data
  useEffect(() => {
    if (user?.api_keys && Array.isArray(user.api_keys)) {
      setApiKeys(user.api_keys);
    } else {
      setApiKeys([]);
    }
  }, [user?.id]);

  const generateApiKey = () => {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 15);
    const random2 = Math.random().toString(36).substring(2, 15);
    return `sk_live_${timestamp}${random}${random2}`.substring(0, 51);
  };

  const handleCreateKey = async () => {
    // Validation
    if (!newKeyName?.trim()) {
      toast.error("Please enter a name for the API key");
      return;
    }

    if (newKeyName.trim().length < 3) {
      toast.error("Key name must be at least 3 characters");
      return;
    }

    // Check for duplicate names
    if (apiKeys.some(k => k.name.toLowerCase() === newKeyName.trim().toLowerCase())) {
      toast.error("An API key with this name already exists");
      return;
    }

    setIsCreating(true);
    try {
      const newKey = {
        id: `key_${Date.now()}`,
        name: newKeyName.trim(),
        description: newKeyDescription.trim() || null,
        key: generateApiKey(),
        created_at: new Date().toISOString(),
        last_used: null,
        active: true,
      };

      const updatedKeys = [...apiKeys, newKey];
      
      // Update user with new API keys array
      await onUpdate({ api_keys: updatedKeys });
      
      // Update local state
      setApiKeys(updatedKeys);
      
      // Show the newly created key
      setJustCreatedKey(newKey.key);
      setVisibleKeys({ ...visibleKeys, [newKey.key]: true });
      
      // Close dialog and reset form
      setShowCreateDialog(false);
      setNewKeyName("");
      setNewKeyDescription("");
      
      toast.success("API key created successfully!", {
        description: "Make sure to copy it now - you won't be able to see it again!",
        duration: 8000,
      });
      
      // Auto-hide the just created key after 30 seconds
      setTimeout(() => {
        setJustCreatedKey(null);
        setVisibleKeys(prev => ({ ...prev, [newKey.key]: false }));
      }, 30000);
      
    } catch (error) {
      console.error('[ApiKeyManagement] Create key error:', error);
      toast.error("Failed to create API key: " + (error?.message || "Please try again"));
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteKey = async () => {
    if (!deletingKey) return;

    setIsDeleting(true);
    try {
      const updatedKeys = apiKeys.filter(k => k.id !== deletingKey.id);
      
      // Update user
      await onUpdate({ api_keys: updatedKeys });
      
      // Update local state
      setApiKeys(updatedKeys);
      setDeletingKey(null);
      
      toast.success("API key deleted successfully");
    } catch (error) {
      console.error('[ApiKeyManagement] Delete key error:', error);
      toast.error("Failed to delete API key: " + (error?.message || "Please try again"));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCopyKey = (key) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(key)
        .then(() => {
          toast.success("API key copied to clipboard", {
            icon: <Copy className="h-4 w-4" />,
          });
        })
        .catch(() => {
          toast.error("Failed to copy to clipboard");
        });
    } else {
      toast.error("Clipboard not supported in this browser");
    }
  };

  const toggleKeyVisibility = (keyId) => {
    setVisibleKeys(prev => ({ ...prev, [keyId]: !prev[keyId] }));
  };

  const maskKey = (key, keyId) => {
    if (visibleKeys[keyId]) return key;
    const prefix = key.substring(0, 10);
    const suffix = key.substring(key.length - 4);
    return `${prefix}${'•'.repeat(28)}${suffix}`;
  };

  const handleCloseCreateDialog = () => {
    setShowCreateDialog(false);
    setNewKeyName("");
    setNewKeyDescription("");
  };

  return (
    <>
      <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60 shadow-lg">
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5 text-blue-600" />
                API Keys
              </CardTitle>
              <CardDescription className="mt-2">
                Manage API keys for programmatic access to ProjectAI
              </CardDescription>
            </div>
            <Button
              onClick={() => setShowCreateDialog(true)}
              disabled={isUpdating}
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create New Key
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {apiKeys.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-lg bg-slate-50/50">
              <Key className="h-12 w-12 mx-auto mb-3 text-slate-300" />
              <h3 className="font-semibold text-slate-900 mb-2">No API Keys Yet</h3>
              <p className="text-slate-600 mb-4 text-sm max-w-md mx-auto">
                Create your first API key to start integrating ProjectAI with your applications
              </p>
              <Button
                variant="outline"
                onClick={() => setShowCreateDialog(true)}
                disabled={isUpdating}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Your First API Key
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {apiKeys.map((apiKey) => {
                const isJustCreated = justCreatedKey === apiKey.key;
                
                return (
                  <div
                    key={apiKey.id}
                    className={`flex flex-col gap-3 p-4 rounded-lg border-2 transition-all ${
                      isJustCreated
                        ? 'border-green-300 bg-green-50 shadow-md'
                        : 'border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-slate-900">{apiKey.name}</h4>
                          <Badge variant={apiKey.active ? "default" : "secondary"} className="text-xs">
                            {apiKey.active ? "Active" : "Inactive"}
                          </Badge>
                          {isJustCreated && (
                            <Badge className="bg-green-600 text-white text-xs">
                              Just Created
                            </Badge>
                          )}
                        </div>
                        {apiKey.description && (
                          <p className="text-xs text-slate-600 mb-2">{apiKey.description}</p>
                        )}
                        
                        {/* API Key Display */}
                        <div className="flex items-center gap-2 mt-2">
                          <div className="flex-1 flex items-center gap-2 font-mono text-xs bg-slate-100 px-3 py-2 rounded border border-slate-200 overflow-hidden">
                            <span className="flex-1 truncate">{maskKey(apiKey.key, apiKey.id)}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 flex-shrink-0"
                              onClick={() => toggleKeyVisibility(apiKey.id)}
                            >
                              {visibleKeys[apiKey.id] ? (
                                <EyeOff className="h-3 w-3" />
                              ) : (
                                <Eye className="h-3 w-3" />
                              )}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 flex-shrink-0"
                              onClick={() => handleCopyKey(apiKey.key)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        
                        <div className="flex flex-wrap gap-3 mt-2 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            Created {formatDistanceToNow(new Date(apiKey.created_at), { addSuffix: true })}
                          </span>
                          {apiKey.last_used ? (
                            <span className="flex items-center gap-1">
                              Last used {formatDistanceToNow(new Date(apiKey.last_used), { addSuffix: true })}
                            </span>
                          ) : (
                            <span className="text-amber-600">Never used</span>
                          )}
                        </div>
                      </div>
                      
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeletingKey(apiKey)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
                        disabled={isUpdating}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {isJustCreated && (
                      <Alert className="border-green-300 bg-green-100">
                        <Check className="h-4 w-4 text-green-700" />
                        <AlertDescription className="text-green-900 text-xs">
                          <strong>Important:</strong> Make sure to copy your API key now. 
                          For security reasons, it will be hidden after 30 seconds.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Security Information */}
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-semibold text-blue-900 text-sm mb-2 flex items-center gap-2">
              <Shield className="h-4 w-4" />
              API Security Best Practices
            </h4>
            <ul className="text-sm text-blue-800 space-y-1.5">
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-0.5">•</span>
                <span>Keep your API keys secure and never share them publicly or in client-side code</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-0.5">•</span>
                <span>Rotate keys regularly (every 90 days) for enhanced security</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-0.5">•</span>
                <span>Delete keys immediately if you suspect they've been compromised</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-0.5">•</span>
                <span>Use separate keys for different applications or environments (dev/prod)</span>
              </li>
            </ul>
          </div>

          {apiKeys.length > 0 && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700">
              <strong>Total API Keys:</strong> {apiKeys.length} active 
              {apiKeys.length >= 5 && (
                <span className="text-amber-600 ml-2">(Consider removing unused keys)</span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create API Key Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={handleCloseCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-blue-600" />
              Create New API Key
            </DialogTitle>
            <DialogDescription>
              Give your API key a descriptive name to help identify its purpose
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="key-name">
                Key Name *
              </Label>
              <Input
                id="key-name"
                placeholder="e.g., Production App, Mobile Client"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                disabled={isCreating}
                maxLength={50}
              />
              <p className="text-xs text-slate-500">
                Choose a name that describes where this key will be used
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="key-description">
                Description (Optional)
              </Label>
              <Input
                id="key-description"
                placeholder="e.g., API key for mobile app authentication"
                value={newKeyDescription}
                onChange={(e) => setNewKeyDescription(e.target.value)}
                disabled={isCreating}
                maxLength={200}
              />
            </div>

            <Alert className="border-amber-200 bg-amber-50">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-900 text-sm">
                <strong>Important:</strong> You'll only be able to see the full API key immediately after creation. 
                Make sure to copy and store it securely.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCloseCreateDialog}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateKey}
              disabled={isCreating || !newKeyName.trim()}
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Key className="h-4 w-4 mr-2" />
                  Create Key
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingKey} onOpenChange={() => !isDeleting && setDeletingKey(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-600" />
              Delete API Key?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Are you sure you want to delete the API key <strong>"{deletingKey?.name}"</strong>?
              </p>
              <p className="font-medium text-slate-900">
                This action cannot be undone. Applications using this key will immediately lose access.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteKey}
              className="bg-red-600 hover:bg-red-700"
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Yes, Delete Key'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}