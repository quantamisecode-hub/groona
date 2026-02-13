import React, { useState } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Languages, Save } from "lucide-react";
import { toast } from "sonner";

export default function TerminologyManager() {
  const queryClient = useQueryClient();
  const [selectedIndustry, setSelectedIndustry] = useState('SOFTWARE');
  
  const defaultTerms = {
    SOFTWARE: {
      SPRINT: 'Sprint',
      TASK: 'Task',
      MILESTONE: 'Milestone',
      BACKLOG: 'Backlog',
      PROJECT: 'Project',
      TEAM: 'Team',
      STORY_POINTS: 'Story Points',
      VELOCITY: 'Velocity',
      BURNDOWN: 'Burndown'
    },
    MARKETING: {
      SPRINT: 'Campaign',
      TASK: 'Content',
      MILESTONE: 'Phase',
      BACKLOG: 'Content Pipeline',
      PROJECT: 'Campaign',
      TEAM: 'Agency Team',
      STORY_POINTS: 'Effort Points',
      VELOCITY: 'Campaign Progress',
      BURNDOWN: 'Campaign Timeline'
    }
  };

  const [terms, setTerms] = useState(defaultTerms);

  const { data: currentUser } = useQuery({
    queryKey: ['current-user-term'],
    queryFn: () => groonabackend.auth.me(),
  });

  const { data: termConfig } = useQuery({
    queryKey: ['terminology-config'],
    queryFn: async () => {
      const configs = await groonabackend.entities.SystemConfig.filter({ 
        config_type: 'TERMINOLOGY' 
      });
      if (configs.length > 0) {
        setTerms(configs[0].config_value);
        return configs[0];
      }
      return null;
    }
  });

  const saveTermsMutation = useMutation({
    mutationFn: async (newTerms) => {
      // 1. Save to SystemConfig for defaults
      let systemConfig;
      if (termConfig) {
        systemConfig = await groonabackend.entities.SystemConfig.update(termConfig.id, {
          config_value: newTerms,
          version: (termConfig.version || 1) + 1
        });
      } else {
        systemConfig = await groonabackend.entities.SystemConfig.create({
          config_key: 'default_terminology',
          config_type: 'TERMINOLOGY',
          config_value: newTerms,
          description: 'Default terminology mappings for all industries',
          is_active: true
        });
      }

      // 2. Update all existing tenants' terminology_map based on their company_type
      const tenants = await groonabackend.entities.Tenant.list();
      
      for (const tenant of tenants) {
        const companyType = tenant.company_type || 'SOFTWARE';
        const terminologyForType = newTerms[companyType];
        
        if (terminologyForType) {
          const updatedConfig = {
            ...(tenant.tenant_config || {}),
            terminology_map: terminologyForType
          };
          
          await groonabackend.entities.Tenant.update(tenant.id, {
            tenant_config: updatedConfig
          });
        }
      }

      return systemConfig;
    },
    onSuccess: async () => {
      await groonabackend.entities.SuperAdminAuditLog.create({
        admin_email: currentUser.email,
        admin_name: currentUser.full_name,
        action_type: 'TERMINOLOGY_UPDATE',
        target_entity: 'default_terminology',
        target_entity_name: 'Terminology Dictionary',
        previous_value: termConfig?.config_value,
        new_value: terms,
        severity: 'INFO'
      });
      queryClient.invalidateQueries({ queryKey: ['terminology-config'] });
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      toast.success('Terminology saved and applied to all tenants');
    },
    onError: (error) => {
      toast.error('Failed to save terminology: ' + error.message);
    }
  });

  const handleTermChange = (key, value) => {
    setTerms(prev => ({
      ...prev,
      [selectedIndustry]: {
        ...prev[selectedIndustry],
        [key]: value
      }
    }));
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Languages className="h-5 w-5" />
            Terminology Dictionary Manager
          </CardTitle>
          <Button size="sm" onClick={() => saveTermsMutation.mutate(terms)}>
            <Save className="h-4 w-4 mr-1" />
            Save Changes
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={selectedIndustry} onValueChange={setSelectedIndustry}>
          <TabsList className="grid grid-cols-2 w-full max-w-md">
            <TabsTrigger value="SOFTWARE">Software Development</TabsTrigger>
            <TabsTrigger value="MARKETING">Marketing Agency</TabsTrigger>
          </TabsList>

          <TabsContent value={selectedIndustry} className="mt-6">
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(terms[selectedIndustry] || {}).map(([key, value]) => (
                <div key={key}>
                  <Label className="text-xs text-slate-600">{key}</Label>
                  <Input
                    value={value}
                    onChange={(e) => handleTermChange(key, e.target.value)}
                    className="mt-1"
                  />
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-4">
              💡 These terms affect UI labels only. Backend APIs and database schema remain unchanged.
            </p>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

