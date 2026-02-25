import React, { useState, useEffect } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Save, RefreshCw, Clock, Target, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function SLAGuardrailsManager() {
  const [currentUser, setCurrentUser] = useState(null);
  const queryClient = useQueryClient();
  
  const [guardrails, setGuardrails] = useState({
    default_project_deadline_days: 90,
    default_task_completion_days: 14,
    max_sla_override_hours: 72,
    project_deadline_warning_threshold: 0.8, // 80% of time elapsed
    task_deadline_warning_threshold: 0.75, // 75% of time elapsed
    max_project_duration_days: 365,
    max_task_story_points: 13,
    enforce_strict_deadlines: false,
  });

  useEffect(() => {
    groonabackend.auth.me().then(setCurrentUser);
  }, []);

  // Fetch existing SLA guardrails
  const { data: existingGuardrails, isLoading } = useQuery({
    queryKey: ['sla-guardrails'],
    queryFn: async () => {
      const configs = await groonabackend.entities.SystemConfig.filter({
        config_type: 'GUARDRAILS',
        config_key: 'sla_guardrails'
      });
      return configs[0] || null;
    },
  });

  useEffect(() => {
    if (existingGuardrails?.config_value) {
      setGuardrails(existingGuardrails.config_value);
    }
  }, [existingGuardrails]);

  // Save guardrails mutation
  const saveGuardrailsMutation = useMutation({
    mutationFn: async (data) => {
      let result;
      if (existingGuardrails) {
        result = await groonabackend.entities.SystemConfig.update(existingGuardrails.id, {
          config_value: data,
        });
      } else {
        result = await groonabackend.entities.SystemConfig.create({
          config_key: 'sla_guardrails',
          config_type: 'GUARDRAILS',
          config_value: data,
          applies_to: 'ALL',
          description: 'System-wide SLA and deadline guardrails',
        });
      }

      // Log the action
      await groonabackend.entities.SuperAdminAuditLog.create({
        admin_email: currentUser.email,
        admin_name: currentUser.full_name,
        action_type: 'SYSTEM_CONFIG_UPDATE',
        target_entity: 'SystemConfig',
        target_entity_name: 'SLA Guardrails',
        previous_value: existingGuardrails?.config_value || {},
        new_value: data,
        reason: 'Updated SLA and system guardrails',
        severity: 'WARNING',
      });

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sla-guardrails'] });
      toast.success('SLA guardrails updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update guardrails: ' + error.message);
    },
  });

  const handleSave = () => {
    if (!currentUser) {
      toast.error('User not authenticated');
      return;
    }
    saveGuardrailsMutation.mutate(guardrails);
  };

  const handleReset = () => {
    setGuardrails({
      default_project_deadline_days: 90,
      default_task_completion_days: 14,
      max_sla_override_hours: 72,
      project_deadline_warning_threshold: 0.8,
      task_deadline_warning_threshold: 0.75,
      max_project_duration_days: 365,
      max_task_story_points: 13,
      enforce_strict_deadlines: false,
    });
    toast.info('Reset to default values');
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-slate-400" />
          <p className="text-slate-600">Loading guardrails...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-amber-600" />
                SLA & System Guardrails
              </CardTitle>
              <CardDescription className="mt-2">
                Configure default deadlines, task completion times, and SLA override limits for all tenants
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-amber-600">
              Global Configuration
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Project Deadlines Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b">
              <Target className="h-4 w-4 text-blue-600" />
              <h3 className="font-semibold text-slate-900">Project Deadlines</h3>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Default Project Deadline (Days)</Label>
                <Input
                  type="number"
                  min="1"
                  max="730"
                  value={guardrails.default_project_deadline_days}
                  onChange={(e) => setGuardrails({
                    ...guardrails,
                    default_project_deadline_days: parseInt(e.target.value) || 90
                  })}
                />
                <p className="text-xs text-slate-500">
                  Default deadline for new projects (1-730 days)
                </p>
              </div>

              <div className="space-y-2">
                <Label>Maximum Project Duration (Days)</Label>
                <Input
                  type="number"
                  min="30"
                  max="1825"
                  value={guardrails.max_project_duration_days}
                  onChange={(e) => setGuardrails({
                    ...guardrails,
                    max_project_duration_days: parseInt(e.target.value) || 365
                  })}
                />
                <p className="text-xs text-slate-500">
                  Maximum allowed project duration (30-1825 days)
                </p>
              </div>

              <div className="space-y-2">
                <Label>Project Warning Threshold (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="5"
                  value={guardrails.project_deadline_warning_threshold * 100}
                  onChange={(e) => setGuardrails({
                    ...guardrails,
                    project_deadline_warning_threshold: (parseInt(e.target.value) || 80) / 100
                  })}
                />
                <p className="text-xs text-slate-500">
                  Alert when project reaches this % of deadline
                </p>
              </div>
            </div>
          </div>

          {/* Task Completion Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b">
              <Clock className="h-4 w-4 text-green-600" />
              <h3 className="font-semibold text-slate-900">Task Completion Times</h3>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Default Task Deadline (Days)</Label>
                <Input
                  type="number"
                  min="1"
                  max="90"
                  value={guardrails.default_task_completion_days}
                  onChange={(e) => setGuardrails({
                    ...guardrails,
                    default_task_completion_days: parseInt(e.target.value) || 14
                  })}
                />
                <p className="text-xs text-slate-500">
                  Default deadline for new tasks (1-90 days)
                </p>
              </div>

              <div className="space-y-2">
                <Label>Task Warning Threshold (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="5"
                  value={guardrails.task_deadline_warning_threshold * 100}
                  onChange={(e) => setGuardrails({
                    ...guardrails,
                    task_deadline_warning_threshold: (parseInt(e.target.value) || 75) / 100
                  })}
                />
                <p className="text-xs text-slate-500">
                  Alert when task reaches this % of deadline
                </p>
              </div>

              <div className="space-y-2">
                <Label>Maximum Story Points</Label>
                <Input
                  type="number"
                  min="1"
                  max="100"
                  value={guardrails.max_task_story_points}
                  onChange={(e) => setGuardrails({
                    ...guardrails,
                    max_task_story_points: parseInt(e.target.value) || 13
                  })}
                />
                <p className="text-xs text-slate-500">
                  Maximum story points per task (1-100)
                </p>
              </div>
            </div>
          </div>

          {/* SLA Override Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <h3 className="font-semibold text-slate-900">SLA Override Limits</h3>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Maximum SLA Override (Hours)</Label>
                <Input
                  type="number"
                  min="1"
                  max="168"
                  value={guardrails.max_sla_override_hours}
                  onChange={(e) => setGuardrails({
                    ...guardrails,
                    max_sla_override_hours: parseInt(e.target.value) || 72
                  })}
                />
                <p className="text-xs text-slate-500">
                  Maximum hours a deadline can be extended (1-168 hours)
                </p>
              </div>

              <div className="space-y-2">
                <Label>Enforce Strict Deadlines</Label>
                <Select
                  value={guardrails.enforce_strict_deadlines ? "true" : "false"}
                  onValueChange={(value) => setGuardrails({
                    ...guardrails,
                    enforce_strict_deadlines: value === "true"
                  })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="false">No - Allow Overrides</SelectItem>
                    <SelectItem value="true">Yes - Strict Mode</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500">
                  Prevent deadline extensions beyond SLA limits
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={saveGuardrailsMutation.isPending}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Reset to Defaults
            </Button>
            <Button
              onClick={handleSave}
              disabled={saveGuardrailsMutation.isPending}
              className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700"
            >
              {saveGuardrailsMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Guardrails
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Information Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <Shield className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="space-y-2">
              <h4 className="font-semibold text-blue-900">How Guardrails Work</h4>
              <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                <li>Default values are applied to all new projects and tasks across tenants</li>
                <li>Warning thresholds trigger automatic notifications to users and admins</li>
                <li>SLA override limits prevent excessive deadline extensions</li>
                <li>Strict mode enforcement blocks any deadline changes beyond configured limits</li>
                <li>All guardrail changes are logged in the Super Admin audit trail</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

