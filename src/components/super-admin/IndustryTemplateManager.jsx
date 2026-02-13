import React, { useState } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Lock, Unlock, Code, Megaphone } from "lucide-react";
import { toast } from "sonner";

export default function IndustryTemplateManager() {
  const queryClient = useQueryClient();
  const [selectedIndustry, setSelectedIndustry] = useState('SOFTWARE');

  const { data: templates = [] } = useQuery({
    queryKey: ['project-templates-all'],
    queryFn: () => groonabackend.entities.ProjectTemplate.list(),
  });

  const { data: currentUser } = useQuery({
    queryKey: ['current-user-tm'],
    queryFn: () => groonabackend.auth.me(),
  });

  const toggleLockMutation = useMutation({
    mutationFn: async ({ template, isLocked }) => {
      return await groonabackend.entities.ProjectTemplate.update(template.id, {
        is_global: isLocked,
        is_public: !isLocked
      });
    },
    onSuccess: async (_, { template, isLocked }) => {
      await groonabackend.entities.SuperAdminAuditLog.create({
        admin_email: currentUser.email,
        admin_name: currentUser.full_name,
        action_type: 'TEMPLATE_MODIFIED',
        target_entity: template.id,
        target_entity_name: template.name,
        previous_value: { is_global: template.is_global },
        new_value: { is_global: isLocked },
        reason: `Template ${isLocked ? 'locked' : 'unlocked'}`,
        severity: 'INFO'
      });
      queryClient.invalidateQueries({ queryKey: ['project-templates-all'] });
      toast.success(`Template ${isLocked ? 'locked' : 'unlocked'}`);
    }
  });

  const softwareTemplates = templates.filter(t => 
    t.category === 'software_development' || 
    ['agile_scrum', 'kanban', 'waterfall'].includes(t.name?.toLowerCase().replace(/\s+/g, '_'))
  );

  const marketingTemplates = templates.filter(t => 
    t.category === 'marketing' || 
    ['social_media_campaign', 'seo_campaign', 'paid_ads_campaign'].includes(t.name?.toLowerCase().replace(/\s+/g, '_'))
  );

  const displayTemplates = selectedIndustry === 'SOFTWARE' ? softwareTemplates : marketingTemplates;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Industry Template Management
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={selectedIndustry} onValueChange={setSelectedIndustry}>
          <TabsList className="grid grid-cols-2 w-full max-w-md">
            <TabsTrigger value="SOFTWARE" className="flex items-center gap-2">
              <Code className="h-4 w-4" />
              Software
            </TabsTrigger>
            <TabsTrigger value="MARKETING" className="flex items-center gap-2">
              <Megaphone className="h-4 w-4" />
              Marketing
            </TabsTrigger>
          </TabsList>

          <TabsContent value={selectedIndustry} className="mt-6">
            <div className="space-y-4">
              {displayTemplates.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">
                  No templates found for this industry
                </p>
              ) : (
                displayTemplates.map(template => (
                  <Card key={template.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-slate-900">{template.name}</h4>
                            {template.is_global && (
                              <Badge variant="secondary" className="flex items-center gap-1">
                                <Lock className="h-3 w-3" />
                                Locked
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-slate-600 mt-1">{template.description}</p>
                          <div className="flex gap-2 mt-2">
                            <Badge variant="outline">{template.category || 'custom'}</Badge>
                            <Badge variant="outline">Used {template.usage_count || 0} times</Badge>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => toggleLockMutation.mutate({ 
                            template, 
                            isLocked: !template.is_global 
                          })}
                        >
                          {template.is_global ? (
                            <>
                              <Unlock className="h-4 w-4 mr-1" />
                              Unlock
                            </>
                          ) : (
                            <>
                              <Lock className="h-4 w-4 mr-1" />
                              Lock
                            </>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

