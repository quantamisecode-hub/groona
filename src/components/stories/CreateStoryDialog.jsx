import React, { useState, useEffect } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useUser } from "@/components/shared/UserContext";
import { toast } from "sonner";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { BookOpen, AlignLeft, FolderKanban, Circle, Flag, Target, Calendar as CalendarIcon, Users, AlertTriangle, Link2, ClipboardList, Wand2, Loader2, Siren } from "lucide-react";

// Story point options with hours mapping
const storyPointOptions = [
  { value: 0, label: "0 Points (0 hours)" },
  { value: 1, label: "1 Point (2 hours)" },
  { value: 2, label: "2 Points (4 hours)" },
  { value: 3, label: "3 Points (8 hours)" },
  { value: 5, label: "5 Points (16 hours)" },
  { value: 8, label: "8 Points (32 hours)" },
  { value: 13, label: "13 Points (64 hours)" },
];

// Helper to calculate hours from points
const getHoursFromPoints = (points) => {
  const map = { 0: 0, 1: 2, 2: 4, 3: 8, 5: 16, 8: 32, 13: 64 };
  return map[points] || 0;
};

// Helper to convert markdown to HTML
const markdownToHTML = (text) => {
  if (!text) return '';

  // Split into lines for processing
  const lines = text.split('\n');
  let result = [];
  let inList = false;
  let inParagraph = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();

    // Skip empty lines
    if (!line) {
      if (inList) {
        result.push('</ul>');
        inList = false;
      }
      if (inParagraph) {
        result.push('</p>');
        inParagraph = false;
      }
      continue;
    }

    // Check for headers
    if (line.match(/^###\s/)) {
      if (inList) {
        result.push('</ul>');
        inList = false;
      }
      if (inParagraph) {
        result.push('</p>');
        inParagraph = false;
      }
      line = line.replace(/^###\s/, '');
      // Process bold/italic in headers
      line = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      result.push(`<h3>${line}</h3>`);
      continue;
    } else if (line.match(/^##\s/)) {
      if (inList) {
        result.push('</ul>');
        inList = false;
      }
      if (inParagraph) {
        result.push('</p>');
        inParagraph = false;
      }
      line = line.replace(/^##\s/, '');
      line = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      result.push(`<h2>${line}</h2>`);
      continue;
    } else if (line.match(/^#\s/)) {
      if (inList) {
        result.push('</ul>');
        inList = false;
      }
      if (inParagraph) {
        result.push('</p>');
        inParagraph = false;
      }
      line = line.replace(/^#\s/, '');
      line = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      result.push(`<h1>${line}</h1>`);
      continue;
    }

    // Check for bullet points
    const bulletMatch = line.match(/^[\*\-\+]\s(.+)$/);
    if (bulletMatch) {
      if (inParagraph) {
        result.push('</p>');
        inParagraph = false;
      }
      if (!inList) {
        result.push('<ul>');
        inList = true;
      }
      let bulletContent = bulletMatch[1];
      // Process bold/italic in bullet points
      bulletContent = bulletContent.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      bulletContent = bulletContent.replace(/\*(.*?)\*/g, '<em>$1</em>');
      result.push(`<li>${bulletContent}</li>`);
      continue;
    }

    // Regular paragraph text
    if (inList) {
      result.push('</ul>');
      inList = false;
    }
    if (!inParagraph) {
      result.push('<p>');
      inParagraph = true;
    }

    // Process bold/italic in paragraphs
    line = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    line = line.replace(/\*(.*?)\*/g, '<em>$1</em>');
    result.push(line + ' ');
  }

  // Close any open tags
  if (inList) {
    result.push('</ul>');
  }
  if (inParagraph) {
    result.push('</p>');
  }

  return result.join('');
};

// Helper to check if text contains markdown syntax
const containsMarkdown = (text) => {
  if (!text) return false;
  // Check for markdown patterns: bold (**text**), headers (# text), bullets (* text, - text)
  // Also check for nested patterns like * **text**
  return /(\*\*.*?\*\*|^#+\s|^[\*\-\+]\s|[\*\-\+]\s\*\*)/gm.test(text);
};

export default function CreateStoryDialog({ open, onClose, projectId, epicId, story, sprint, onSuccess }) {
  const { user: currentUser } = useUser();
  const isEditMode = !!story;
  const quillRef = React.useRef(null);

  // Generate a unique key for the editor to force re-render when story changes
  const editorKey = React.useMemo(() => {
    if (!open) return 'closed';
    const storyId = story?.id || story?._id;
    const storyIdentifier = isEditMode ? (storyId || 'edit') : 'new';
    return `story-editor-${storyIdentifier}`;
  }, [open, isEditMode, story?.id, story?._id]);

  // Initialize form data directly from the story prop
  const [formData, setFormData] = useState(() => {
    if (story) {
      let description = story.description || "";
      let criteria = story.acceptance_criteria || "";

      // Convert markdown to HTML logic for initial load
      if (description && typeof description === 'string' && containsMarkdown(description)) {
        description = markdownToHTML(description);
      }
      if (criteria && typeof criteria === 'string' && containsMarkdown(criteria)) {
        criteria = markdownToHTML(criteria);
      }

      return {
        title: story.title || "",
        description: description || "",
        acceptance_criteria: criteria || "",
        status: story.status || "todo",
        priority: story.priority || "medium",
        story_points: story.story_points ? String(story.story_points) : "0",
        assigned_to: story.assigned_to || [],
        due_date: story.due_date ? story.due_date.split('T')[0] : "",
        labels: story.labels || [],
        epic_id: story.epic_id || "",
      };
    }
    return {
      title: "",
      description: "",
      acceptance_criteria: "",
      status: "todo",
      priority: "medium",
      story_points: "0",
      assigned_to: [],
      due_date: "",
      labels: [],
      epic_id: epicId || "",
    };
  });

  // Story impediment state
  const [storyImpedimentData, setStoryImpedimentData] = useState({
    title: "",
    description: "",
    severity: "medium",
  });
  const [selectedStoryImpedimentId, setSelectedStoryImpedimentId] = useState("");
  const [isStoryReportImpediment, setIsStoryReportImpediment] = useState(false);
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);

  // We no longer need the complex useEffect for population because 
  // the parent component's 'key' prop handles the remount and fresh initialization.
  useEffect(() => {
    if (!open) {
      // Small cleanup just in case, though remount should handle it
      setStoryImpedimentData({ title: "", description: "", severity: "medium" });
      setSelectedStoryImpedimentId("");
      setIsStoryReportImpediment(false);
    }
  }, [open]);


  // AI Generation for Story Description
  const handleGenerateDescription = async () => {
    if (!formData.title?.trim()) {
      toast.error("Please enter a Story Title first.");
      return;
    }

    setIsGeneratingDescription(true);
    try {
      const prompt = `You are a senior product manager. Based on the story title "${formData.title}" and any initial description provided ("${formData.description || ''}"), generate a brief, concise user story description.

      The description should be a short paragraph explaining the feature from a user's perspective (the "what" and "why").
      Do NOT use structured headers or long lists.
      Keep it simple and direct.
      
      Output only the description text (no JSON, no markdown formatting, just plain descriptive text).`;

      const response = await groonabackend.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            description: { type: "string" }
          }
        }
      });

      const generatedDescription = response.description || response;
      setFormData(prev => ({ ...prev, description: generatedDescription }));
      toast.success("Story description generated successfully!");
    } catch (error) {
      console.error("AI Generation Error:", error);
      toast.error("Failed to generate story description. Please check your connection.");
    } finally {
      setIsGeneratingDescription(false);
    }
  };




  const effectiveTenantId = currentUser?.is_super_admin && currentUser?.active_tenant_id
    ? currentUser.active_tenant_id
    : currentUser?.tenant_id;

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const projects = await groonabackend.entities.Project.list();
      return projects.find(p => (p.id === projectId) || (p._id === projectId));
    },
    enabled: !!projectId && open,
  });

  const { data: epics = [] } = useQuery({
    queryKey: ['epics', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      return await groonabackend.entities.Epic.filter({ project_id: projectId });
    },
    enabled: !!projectId && open,
  });

  // Get team members from project
  const { data: teamMembers = [] } = useQuery({
    queryKey: ['project-team-members', projectId],
    queryFn: async () => {
      if (!projectId || !project?.team_members) return [];
      const allUsers = await groonabackend.entities.User.list();
      // Filter to only include users who are team members of this project
      return project.team_members
        .map(member => {
          const user = allUsers.find(u => u.email === member.email);
          // Filter out users with custom_role === 'client'
          if (user && user.custom_role === 'client') return null;
          return user ? { ...user, role: member.role } : null;
        })
        .filter(Boolean);
    },
    enabled: open && !!projectId && !!project?.team_members,
  });

  // Fetch impediments for the project
  const { data: storyProjectImpediments = [] } = useQuery({
    queryKey: ['impediments', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      return await groonabackend.entities.Impediment.filter({ project_id: projectId });
    },
    enabled: !!projectId && open,
  });

  // Fetch active rework alarms
  const { data: reworkAlarms = [] } = useQuery({
    queryKey: ['rework-alarms', effectiveTenantId],
    queryFn: async () => {
      if (!effectiveTenantId) return [];
      return await groonabackend.entities.Notification.filter({
        tenant_id: effectiveTenantId,
        type: 'high_rework_alarm',
        status: 'OPEN'
      });
    },
    enabled: open && !!effectiveTenantId,
    refetchInterval: 30000, // Refetch every 30s
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      toast.error('Story title is required');
      return;
    }

    if (!effectiveTenantId) {
      toast.error('Tenant context is missing');
      return;
    }

    try {
      const storyData = {
        tenant_id: effectiveTenantId,
        workspace_id: project?.workspace_id || "",
        project_id: projectId,
        title: formData.title.trim(),
        description: formData.description.trim() || "",
        acceptance_criteria: formData.acceptance_criteria?.trim() || "",
        status: formData.status,
        priority: formData.priority,
        story_points: formData.story_points ? Number(formData.story_points) : 0,
        assigned_to: formData.assigned_to || [],
        reporter: currentUser?.email,
        due_date: formData.due_date || undefined,
        labels: formData.labels,
        epic_id: formData.epic_id || undefined,
        sprint_id: undefined,
        custom_fields: {
          ...(story?.custom_fields || {}),
          estimated_hours: formData.story_points ? getHoursFromPoints(Number(formData.story_points)) : 0,
        },
      };

      if (isEditMode) {
        await groonabackend.entities.Story.update(story.id || story._id, storyData);
        toast.success('Story updated successfully!');
        if (onSuccess) onSuccess({ ...story, ...storyData });
      } else {
        const newStory = await groonabackend.entities.Story.create(storyData);

        // Handle impediment if checkbox is checked
        if (isStoryReportImpediment) {
          if (selectedStoryImpedimentId && selectedStoryImpedimentId !== "new" && selectedStoryImpedimentId !== "") {
            // Link story to existing impediment
            try {
              await groonabackend.entities.Impediment.update(selectedStoryImpedimentId, {
                story_id: newStory.id || newStory._id,
                epic_id: formData.epic_id || undefined,
              });
              toast.success('Story created and linked to impediment successfully!');
            } catch (error) {
              console.error('Error linking story to impediment:', error);
              toast.error('Story created but failed to link to impediment');
            }
          } else if (storyImpedimentData.title && storyImpedimentData.title.trim()) {
            // Create new impediment with story
            try {
              const impedimentPayload = {
                tenant_id: effectiveTenantId,
                workspace_id: project?.workspace_id || "",
                project_id: projectId,
                story_id: newStory.id || newStory._id,
                epic_id: formData.epic_id || undefined,
                title: storyImpedimentData.title.trim(),
                description: storyImpedimentData.description || "",
                severity: storyImpedimentData.severity,
                status: "open",
                reported_by: currentUser?.email,
                reported_by_name: currentUser?.full_name || currentUser?.email,
              };
              await groonabackend.entities.Impediment.create(impedimentPayload);
              toast.success('Story and impediment created successfully!');
            } catch (error) {
              console.error('Error creating impediment:', error);
              toast.error('Story created but failed to create impediment');
            }
          } else {
            toast.success('Story created successfully!');
          }
        } else {
          toast.success('Story created successfully!');
        }

        // Reset form only in create mode
        setFormData({
          title: "",
          description: "",
          status: "todo",
          priority: "medium",
          story_points: "0",
          assigned_to: [],
          due_date: "",
          labels: [],
          epic_id: epicId || "",
        });

        // Reset impediment state
        setStoryImpedimentData({ title: "", description: "", severity: "medium" });
        setSelectedStoryImpedimentId("");
        setIsStoryReportImpediment(false);

        if (onSuccess) onSuccess(newStory);
      }
      onClose();
    } catch (error) {
      console.error('Error creating story:', error);
      toast.error(`Failed to create story: ${error.message || 'Please try again.'}`);
    }
  };

  const toggleAssignee = (email) => {
    // Check if user has high rework block
    const isBlocked = reworkAlarms.some(alarm => alarm.recipient_email === email);
    if (isBlocked) {
      toast.error(`Cannot assign: ${email} has an active High Rework alarm.`);
      return;
    }

    setFormData(prev => ({
      ...prev,
      assigned_to: prev.assigned_to.includes(email)
        ? prev.assigned_to.filter(e => e !== email)
        : [...prev.assigned_to, email]
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] sm:max-w-xl max-h-[90vh] overflow-y-auto bg-white">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-slate-900">
            {isEditMode ? 'Edit Story' : 'Create New Story'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {isEditMode ? 'Edit the details of this story' : 'Create a new story for your project'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          <div className="space-y-2">
            <Label htmlFor="title" className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-green-500" />
              Story Title *
            </Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Enter story title"
              required
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="description" className="flex items-center gap-2">
                <AlignLeft className="h-4 w-4 text-slate-600" />
                Description
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleGenerateDescription}
                disabled={isGeneratingDescription || !formData.title?.trim()}
                className="text-xs"
              >
                {isGeneratingDescription ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Wand2 className="h-3 w-3 mr-1" />
                    Draft with AI
                  </>
                )}
              </Button>
            </div>
            <div className="border rounded-lg overflow-hidden resize-y min-h-[150px] max-h-[500px] flex flex-col relative bg-white">
              <div className="flex-1 overflow-y-auto">
                <ReactQuill
                  key={editorKey}
                  theme="snow"
                  value={formData.description || ""}
                  onChange={(value) => {
                    setFormData({ ...formData, description: value });
                  }}
                  onFocus={(range, source, editor) => {
                    // Ensure markdown is converted when editor is focused
                    if (editor && editor.root) {
                      const content = editor.root.innerHTML;
                      const plainText = content.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
                      if (containsMarkdown(plainText) && !content.includes('<strong>') && !content.includes('<ul>') && !content.includes('<h')) {
                        const html = markdownToHTML(plainText);
                        if (html !== content) {
                          editor.root.innerHTML = html;
                          setFormData({ ...formData, description: html });
                        }
                      }
                    }
                  }}
                  onBlur={(range, source, editor) => {
                    // Convert markdown to HTML when editor loses focus
                    if (editor && editor.root) {
                      const content = editor.root.innerHTML;
                      const plainText = content.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
                      if (containsMarkdown(plainText) && !content.includes('<strong>') && !content.includes('<ul>') && !content.includes('<h')) {
                        const html = markdownToHTML(plainText);
                        if (html !== content) {
                          editor.root.innerHTML = html;
                          setFormData({ ...formData, description: html });
                        }
                      }
                    }
                  }}
                  placeholder="Type markdown and it will auto-convert: **bold**, * bullet points, # headers"
                  modules={{
                    toolbar: [
                      [{ header: [1, 2, 3, false] }],
                      ["bold", "italic", "underline", "strike"],
                      [{ list: "ordered" }, { list: "bullet" }],
                      [{ color: [] }, { background: [] }],
                      ["link", "code-block"],
                      ["clean"],
                    ],
                  }}
                  style={{ minHeight: "150px", border: "none" }}
                />
              </div>
              <div className="h-2 bg-slate-100 cursor-ns-resize hover:bg-slate-200 transition-colors flex items-center justify-center border-t border-slate-200">
                <div className="w-12 h-1 bg-slate-300 rounded"></div>
              </div>
            </div>


          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <FolderKanban className="h-4 w-4 text-purple-500" />
              Epic (Optional)
            </Label>
            <Select
              value={formData.epic_id || "none"}
              onValueChange={(value) => setFormData({ ...formData, epic_id: value === "none" ? "" : value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select epic (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Epic</SelectItem>
                {epics.map((epic) => (
                  <SelectItem key={epic.id || epic._id} value={epic.id || epic._id}>
                    {epic.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Circle className="h-4 w-4 text-blue-500" />
                Status
              </Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">To Do</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="in_review">In Review</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Flag className="h-4 w-4 text-red-500" />
                Priority
              </Label>
              <Select
                value={formData.priority}
                onValueChange={(value) => setFormData({ ...formData, priority: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="story_points" className="flex items-center gap-2">
                <Target className="h-4 w-4 text-orange-500" />
                Story Points
                {sprint?.locked_date && isEditMode && (
                  <span className="text-xs text-amber-600 ml-2">(Sprint locked - cannot change)</span>
                )}
              </Label>
              <Select
                value={String(formData.story_points || 0)}
                onValueChange={(value) => {
                  const points = parseInt(value);
                  setFormData({ ...formData, story_points: String(points) });
                }}
                disabled={!!sprint?.locked_date && isEditMode}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select story points" />
                </SelectTrigger>
                <SelectContent>
                  {storyPointOptions.map(option => (
                    <SelectItem key={option.value} value={String(option.value)}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="due_date" className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-pink-500" />
                Due Date
              </Label>
              <Input
                id="due_date"
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Users className="h-4 w-4 text-indigo-500" />
              Assign To
            </Label>
            <div className="border rounded-md p-3 max-h-32 overflow-y-auto">
              {teamMembers.length === 0 ? (
                <p className="text-sm text-gray-500">No team members available</p>
              ) : (
                <div className="space-y-2">
                  {teamMembers.map((user) => {
                    const hasReworkAlarm = reworkAlarms.some(alarm => alarm.recipient_email === user.email);
                    return (
                      <label
                        key={user.id}
                        className={`flex items-center justify-between p-1 rounded hover:bg-slate-50 transition-colors ${hasReworkAlarm ? 'opacity-70 cursor-not-allowed bg-red-50/30' : 'cursor-pointer'}`}
                      >
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            checked={formData.assigned_to.includes(user.email)}
                            onCheckedChange={() => toggleAssignee(user.email)}
                            disabled={hasReworkAlarm}
                          />
                          <span className={`text-sm ${hasReworkAlarm ? 'text-slate-500 font-medium' : ''}`}>
                            {user.full_name || "Unknown User"}
                          </span>
                        </div>
                        {hasReworkAlarm && (
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full animate-pulse">
                            <Siren className="h-3 w-3" />
                            ASSIGNMENT FROZEN
                          </div>
                        )}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Acceptance Criteria */}
          <div className="space-y-2 mt-4">
            <Label htmlFor="acceptance_criteria" className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-emerald-600" />
              Acceptance Criteria
            </Label>
            <div className="border rounded-lg overflow-hidden resize-y min-h-[150px] max-h-[500px] flex flex-col relative bg-white">
              <div className="flex-1 overflow-y-auto">
                <ReactQuill
                  theme="snow"
                  value={formData.acceptance_criteria || ""}
                  onChange={(value) => {
                    setFormData({ ...formData, acceptance_criteria: value });
                  }}
                  modules={{
                    toolbar: [
                      [{ header: [1, 2, 3, false] }],
                      ["bold", "italic", "underline", "strike"],
                      [{ list: "ordered" }, { list: "bullet" }],
                      [{ color: [] }, { background: [] }],
                      ["link", "code-block"],
                      ["clean"],
                    ],
                  }}
                  style={{ minHeight: "150px", border: "none" }}
                  placeholder="Define success criteria..."
                />
              </div>
            </div>
          </div>

          {/* Report Impediment Section for Story */}
          <div className="space-y-4 border-t pt-6">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="report-story-impediment"
                checked={isStoryReportImpediment}
                onCheckedChange={(checked) => setIsStoryReportImpediment(checked === true)}
              />
              <Label htmlFor="report-story-impediment" className="font-normal cursor-pointer text-sm font-semibold">
                Report Impediment
              </Label>
            </div>

            {isStoryReportImpediment && (
              <div className="space-y-4 bg-red-50 border border-red-200 rounded-lg p-4">
                <div>
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <Link2 className="h-4 w-4 text-amber-500" />
                    Link to Existing Impediment
                  </Label>
                  <Select
                    value={selectedStoryImpedimentId || "new"}
                    onValueChange={(value) => setSelectedStoryImpedimentId(value === "new" ? "" : value)}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select existing impediment or create new" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">Create New Impediment</SelectItem>
                      {storyProjectImpediments
                        .filter(imp => imp.status !== 'resolved')
                        .map(impediment => (
                          <SelectItem key={impediment.id || impediment._id} value={impediment.id || impediment._id}>
                            {impediment.title}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedStoryImpedimentId === "" && (
                  <>
                    <div>
                      <Label htmlFor="story-impediment-title" className="text-sm font-semibold flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                        Impediment Title *
                      </Label>
                      <Input
                        id="story-impediment-title"
                        value={storyImpedimentData.title}
                        onChange={(e) => setStoryImpedimentData({ ...storyImpedimentData, title: e.target.value })}
                        placeholder="Brief description of the impediment"
                        required
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label htmlFor="story-impediment-description" className="text-sm font-semibold flex items-center gap-2">
                        <AlignLeft className="h-4 w-4 text-red-600" />
                        Description
                      </Label>
                      <Textarea
                        id="story-impediment-description"
                        value={storyImpedimentData.description}
                        onChange={(e) => setStoryImpedimentData({ ...storyImpedimentData, description: e.target.value })}
                        placeholder="Detailed explanation and impact"
                        rows={4}
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label htmlFor="story-impediment-severity" className="text-sm font-semibold flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                        Severity
                      </Label>
                      <Select
                        value={storyImpedimentData.severity}
                        onValueChange={(val) => setStoryImpedimentData({ ...storyImpedimentData, severity: val })}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low - Minor inconvenience</SelectItem>
                          <SelectItem value="medium">Medium - Slowing progress</SelectItem>
                          <SelectItem value="high">High - Blocking work</SelectItem>
                          <SelectItem value="critical">Critical - Sprint at risk</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                {selectedStoryImpedimentId && selectedStoryImpedimentId !== "new" && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-900">
                      This story will be linked to the selected impediment.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white"
            >
              {isEditMode ? 'Update Story' : 'Create Story'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}


