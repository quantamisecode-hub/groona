import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Settings, Sun, Moon, Monitor, Loader2, Save, Layout, Minimize2, X, AlertCircle, Palette, Type, Zap } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";

export default function ThemeSettings({ user, onUpdate, isUpdating }) {
  const [preferences, setPreferences] = useState({
    theme: "system",
    compact_mode: false,
    sidebar_collapsed: false,
    reduce_animations: false,
    high_contrast: false,
  });
  
  const [hasChanges, setHasChanges] = useState(false);
  const [initialPreferences, setInitialPreferences] = useState({});

  // Initialize preferences from user data
  useEffect(() => {
    if (user?.theme_preferences) {
      const prefs = {
        theme: user.theme_preferences.theme || "system",
        compact_mode: user.theme_preferences.compact_mode || false,
        sidebar_collapsed: user.theme_preferences.sidebar_collapsed || false,
        reduce_animations: user.theme_preferences.reduce_animations || false,
        high_contrast: user.theme_preferences.high_contrast || false,
      };
      setPreferences(prefs);
      setInitialPreferences(prefs);
      setHasChanges(false);
    }
  }, [user?.id]);

  // Track changes
  useEffect(() => {
    const changed = JSON.stringify(preferences) !== JSON.stringify(initialPreferences);
    setHasChanges(changed);
  }, [preferences, initialPreferences]);

  // Apply theme changes in real-time
  useEffect(() => {
    applyTheme(preferences.theme);
  }, [preferences.theme]);

  const applyTheme = (theme) => {
    const root = document.documentElement;
    
    if (theme === "dark") {
      root.classList.add("dark");
    } else if (theme === "light") {
      root.classList.remove("dark");
    } else {
      // System theme
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (prefersDark) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      await onUpdate({ theme_preferences: preferences });
      setInitialPreferences(preferences);
      setHasChanges(false);
    } catch (error) {
      console.error('[ThemeSettings] Save error:', error);
      // Error already handled by mutation
    }
  };

  const handleReset = () => {
    setPreferences(initialPreferences);
    setHasChanges(false);
  };

  const handlePreferenceChange = (key, value) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
  };

  const themeOptions = [
    {
      value: "light",
      label: "Light",
      description: "Bright theme for well-lit environments",
      icon: Sun,
    },
    {
      value: "dark",
      label: "Dark",
      description: "Easy on the eyes in low-light",
      icon: Moon,
    },
    {
      value: "system",
      label: "System",
      description: "Match your device settings",
      icon: Monitor,
    },
  ];

  const interfaceOptions = [
    {
      key: "compact_mode",
      label: "Compact Mode",
      description: "Reduce spacing for a denser interface",
      icon: Minimize2,
    },
    {
      key: "sidebar_collapsed",
      label: "Collapsed Sidebar",
      description: "Start with sidebar minimized by default",
      icon: Layout,
    },
    {
      key: "reduce_animations",
      label: "Reduce Animations",
      description: "Minimize motion for better performance",
      icon: Zap,
    },
    {
      key: "high_contrast",
      label: "High Contrast",
      description: "Increase contrast for better readability",
      icon: Palette,
    },
  ];

  return (
    <Card className="bg-white/80 backdrop-blur-xl border-slate-200/60 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5 text-blue-600" />
          Theme & Appearance
        </CardTitle>
        <CardDescription>
          Customize how ProjectAI looks and feels to match your preferences
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Theme Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Sun className="h-4 w-4" />
              Color Theme
            </Label>
            <RadioGroup
              value={preferences.theme}
              onValueChange={(value) => handlePreferenceChange('theme', value)}
              className="grid grid-cols-1 md:grid-cols-3 gap-4"
            >
              {themeOptions.map((option) => {
                const Icon = option.icon;
                const isSelected = preferences.theme === option.value;
                
                return (
                  <div key={option.value} className="relative">
                    <RadioGroupItem
                      value={option.value}
                      id={option.value}
                      className="peer sr-only"
                      disabled={isUpdating}
                    />
                    <Label
                      htmlFor={option.value}
                      className={`flex flex-col items-center gap-3 p-5 rounded-lg border-2 cursor-pointer transition-all ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50 shadow-md'
                          : 'border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300'
                      } ${isUpdating ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <div className={`p-3 rounded-full ${
                        isSelected ? 'bg-blue-100' : 'bg-slate-100'
                      }`}>
                        <Icon className={`h-6 w-6 ${
                          isSelected ? 'text-blue-600' : 'text-slate-600'
                        }`} />
                      </div>
                      <div className="text-center">
                        <div className={`font-semibold text-sm mb-1 ${
                          isSelected ? 'text-blue-900' : 'text-slate-900'
                        }`}>
                          {option.label}
                        </div>
                        <div className="text-xs text-slate-600">
                          {option.description}
                        </div>
                      </div>
                      {isSelected && (
                        <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-blue-600 flex items-center justify-center">
                          <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 12 12">
                            <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      )}
                    </Label>
                  </div>
                );
              })}
            </RadioGroup>
          </div>

          <Separator />

          {/* Interface Options */}
          <div className="space-y-4">
            <Label className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Layout className="h-4 w-4" />
              Interface Options
            </Label>
            
            <div className="space-y-3">
              {interfaceOptions.map((option) => {
                const Icon = option.icon;
                
                return (
                  <div
                    key={option.key}
                    className="flex items-center justify-between p-4 rounded-lg border border-slate-200 bg-white hover:bg-slate-50/80 hover:border-slate-300 transition-all"
                  >
                    <div className="flex items-start gap-3 flex-1">
                      <Icon className="h-5 w-5 text-slate-600 mt-0.5" />
                      <div className="flex-1">
                        <Label
                          htmlFor={option.key}
                          className="text-sm font-medium text-slate-900 cursor-pointer"
                        >
                          {option.label}
                        </Label>
                        <p className="text-sm text-slate-600 mt-0.5">
                          {option.description}
                        </p>
                      </div>
                    </div>
                    <Switch
                      id={option.key}
                      checked={preferences[option.key]}
                      onCheckedChange={(checked) => handlePreferenceChange(option.key, checked)}
                      disabled={isUpdating}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {preferences.reduce_animations && (
            <Alert className="border-blue-200 bg-blue-50">
              <Zap className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-900 text-sm">
                Animations will be reduced throughout the app. Refresh the page to see changes.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col sm:flex-row justify-between gap-3 pt-4 border-t">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              {hasChanges && (
                <span className="flex items-center gap-1 text-amber-600 font-medium">
                  <AlertCircle className="h-3 w-3" />
                  Unsaved changes
                </span>
              )}
            </div>
            
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleReset}
                disabled={isUpdating || !hasChanges}
              >
                <X className="h-4 w-4 mr-2" />
                Reset
              </Button>
              <Button
                type="submit"
                disabled={isUpdating || !hasChanges}
                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
              >
                {isUpdating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Preferences
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}