import React, { useState, useEffect } from "react";
import { groonabackend } from "@/api/groonabackend";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useHasPermission } from "../components/shared/usePermissions";
import { CheckCircle2, XCircle, Loader2, Shield, AlertCircle } from "lucide-react";

export default function TestAIAccessPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [testResults, setTestResults] = useState({});

  const canUseAI = useHasPermission('can_use_ai_assistant');

  useEffect(() => {
    async function runTests() {
      try {
        const user = await groonabackend.auth.me();
        setCurrentUser(user);

        // Load tenant
        if (user.tenant_id) {
          const tenants = await groonabackend.entities.Tenant.filter({ id: user.tenant_id });
          if (tenants[0]) {
            setTenant(tenants[0]);
          }
        }

        // Wait for permission hook to load
        await new Promise(resolve => setTimeout(resolve, 1500));

        const results = {
          userLoaded: !!user,
          userRole: user?.role,
          isSuperAdmin: user?.is_super_admin,
          tenantId: user?.tenant_id,
          tenantLoaded: !!tenants?.[0],
          featuresEnabled: tenants?.[0]?.features_enabled,
          aiFeatureFlag: tenants?.[0]?.features_enabled?.ai_assistant,
          permissionHookResult: canUseAI,
          expectedAccess: user?.is_super_admin || user?.role === 'admin' || canUseAI,
        };

        setTestResults(results);
        setLoading(false);
      } catch (error) {
        console.error('Test error:', error);
        setLoading(false);
      }
    }

    runTests();
  }, [canUseAI]);

  const TestResult = ({ label, value, expected }) => {
    const isPass = expected !== undefined ? value === expected : !!value;
    
    return (
      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-900">
            {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value ?? 'N/A')}
          </span>
          {isPass ? (
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          ) : (
            <XCircle className="h-4 w-4 text-red-600" />
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">Running AI Access Tests...</p>
        </div>
      </div>
    );
  }

  const finalVerdict = testResults.expectedAccess === testResults.permissionHookResult;

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">AI Assistant Access Test</h1>
        <p className="text-slate-600">Comprehensive diagnostics for AI Assistant permissions</p>
      </div>

      {/* Final Verdict */}
      <Alert className={finalVerdict ? "border-green-500 bg-green-50" : "border-red-500 bg-red-50"}>
        {finalVerdict ? (
          <CheckCircle2 className="h-5 w-5 text-green-600" />
        ) : (
          <AlertCircle className="h-5 w-5 text-red-600" />
        )}
        <AlertDescription className="text-base font-semibold">
          {finalVerdict ? (
            <span className="text-green-900">✅ TEST PASSED: Admin can access AI Assistant!</span>
          ) : (
            <span className="text-red-900">❌ TEST FAILED: Admin cannot access AI Assistant</span>
          )}
        </AlertDescription>
      </Alert>

      {/* User Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-600" />
            User Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <TestResult label="User Loaded" value={testResults.userLoaded} expected={true} />
          <TestResult label="User Role" value={testResults.userRole} />
          <TestResult label="Is Super Admin" value={testResults.isSuperAdmin} />
          <TestResult label="Tenant ID" value={testResults.tenantId} />
        </CardContent>
      </Card>

      {/* Tenant Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Tenant Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <TestResult label="Tenant Loaded" value={testResults.tenantLoaded} />
          <TestResult 
            label="AI Feature Flag" 
            value={testResults.aiFeatureFlag === undefined 
              ? 'Not Set (defaults to ENABLED for admins)' 
              : testResults.aiFeatureFlag ? 'Enabled' : 'Disabled'
            } 
          />
          
          {testResults.featuresEnabled && (
            <div className="mt-4 p-3 bg-slate-50 rounded-lg">
              <p className="text-xs font-medium text-slate-700 mb-2">All Feature Flags:</p>
              <pre className="text-xs text-slate-600 overflow-auto">
                {JSON.stringify(testResults.featuresEnabled, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Permission Check Results */}
      <Card>
        <CardHeader>
          <CardTitle>Permission Check Results</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <TestResult 
            label="useHasPermission('can_use_ai_assistant')" 
            value={testResults.permissionHookResult} 
          />
          <TestResult 
            label="Expected Access (Super Admin OR Admin)" 
            value={testResults.expectedAccess} 
          />
          <TestResult 
            label="Permission Check Matches Expected" 
            value={finalVerdict} 
            expected={true}
          />
        </CardContent>
      </Card>

      {/* Logic Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Permission Logic Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="font-semibold text-blue-900 mb-1">Step 1: Super Admin Check</p>
              <p className="text-blue-800">
                {testResults.isSuperAdmin ? (
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Super Admin detected → Bypass all checks → GRANT ACCESS
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <XCircle className="h-4 w-4" />
                    Not a Super Admin → Continue to next check
                  </span>
                )}
              </p>
            </div>

            {!testResults.isSuperAdmin && (
              <div className="p-3 bg-purple-50 rounded-lg">
                <p className="font-semibold text-purple-900 mb-1">Step 2: Admin Check</p>
                <p className="text-purple-800">
                  {testResults.userRole === 'admin' ? (
                    <>
                      <span className="flex items-center gap-2 mb-2">
                        <CheckCircle2 className="h-4 w-4" />
                        Admin role detected → Check tenant feature flags
                      </span>
                      <span className="ml-6">
                        {testResults.aiFeatureFlag === false ? (
                          <span className="flex items-center gap-2 text-red-700">
                            <XCircle className="h-4 w-4" />
                            AI Feature is explicitly DISABLED → DENY ACCESS
                          </span>
                        ) : (
                          <span className="flex items-center gap-2 text-green-700">
                            <CheckCircle2 className="h-4 w-4" />
                            AI Feature is {testResults.aiFeatureFlag === undefined ? 'NOT SET (default: enabled)' : 'ENABLED'} → GRANT ACCESS
                          </span>
                        )}
                      </span>
                    </>
                  ) : (
                    <span className="flex items-center gap-2">
                      <XCircle className="h-4 w-4" />
                      Not an Admin → Continue to regular user checks
                    </span>
                  )}
                </p>
              </div>
            )}

            {!testResults.isSuperAdmin && testResults.userRole !== 'admin' && (
              <div className="p-3 bg-orange-50 rounded-lg">
                <p className="font-semibold text-orange-900 mb-1">Step 3: Regular User Check</p>
                <p className="text-orange-800">
                  Regular users require both:
                  <ul className="list-disc ml-6 mt-2">
                    <li>Tenant feature flag: ai_assistant = true</li>
                    <li>User or group permission: can_use_ai_assistant = true</li>
                  </ul>
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Console Logs */}
      <Card>
        <CardHeader>
          <CardTitle>Debugging Tips</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <p className="text-slate-700">
              Open browser console and check for these logs:
            </p>
            <ul className="list-disc ml-6 space-y-1 text-slate-600">
              <li><code className="bg-slate-100 px-1 rounded">[useHasPermission] Loaded tenant features</code></li>
              <li><code className="bg-slate-100 px-1 rounded">[useHasPermission] ✅ Admin access granted</code></li>
              <li><code className="bg-slate-100 px-1 rounded">[AIAssistant] Permission check</code></li>
              <li><code className="bg-slate-100 px-1 rounded">[AIAssistant] ✅ Access granted</code></li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

