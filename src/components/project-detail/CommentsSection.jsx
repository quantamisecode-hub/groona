import React, { useState, useRef, useEffect } from "react"; // Added useEffect
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Send, MessageSquare, Trash2, Paperclip, File, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { groonabackend } from "@/api/groonabackend";
import { toast } from "sonner";
import { notificationService } from "../shared/notificationService";

export default function CommentsSection({
  comments = [],
  users = [],
  loading,
  onAddComment,
  onDeleteComment,
  currentUser,
  entityType = 'task',
  entityId,
  entityName = '',
  highlightCommentId = null,
  mentionableUsers = [] // <--- NEW PROP
}) {
  const [newComment, setNewComment] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [cursorPosition, setCursorPosition] = useState(0);
  const textareaRef = useRef(null);
  const commentRefs = useRef({}); // Ref to store comment elements
  const queryClient = useQueryClient();

  // === NEW: SCROLL TO COMMENT LOGIC ===
  useEffect(() => {
    if (highlightCommentId && comments.length > 0) {
      const element = commentRefs.current[highlightCommentId];
      if (element) {
        // Scroll with a slight delay to ensure rendering
        setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.classList.add('bg-yellow-200', 'ring-2', 'ring-yellow-500'); // Stronger Highlight

          // Remove highlight after 3 seconds
          setTimeout(() => {
            element.classList.remove('bg-yellow-200', 'ring-2', 'ring-yellow-500');
          }, 3000);
        }, 300);
      }
    }
  }, [highlightCommentId, comments]);
  // ====================================

  const createCommentMutation = useMutation({
    mutationFn: async (payload) => {
      if (!payload.tenant_id) throw new Error("Missing Tenant ID");
      if (!payload.entity_id) throw new Error("Missing Entity ID");
      return await groonabackend.entities.Comment.create(payload);
    },
    onSuccess: async (data, variables) => {
      queryClient.invalidateQueries(['comments', entityId]);
      queryClient.invalidateQueries([entityType, entityId]);

      // ALWAYS trigger notification service - it handles logic for mentions vs assignees
      await notificationService.notifyComment({
        comment: {
          id: data.id, // Pass ID for deep linking
          author_name: currentUser.full_name,
          author_email: currentUser.email,
          content: variables.content
        },
        mentions: variables.mentions || [], // Pass mentions if any
        entityType,
        entityId,
        entityName,
        tenantId: currentUser.tenant_id || currentUser.active_tenant_id,
        commentContent: variables.content
      });

      if (onAddComment) onAddComment(data);
      toast.success("Comment posted successfully");
      setNewComment("");
      setAttachments([]);
    },
    onError: (error) => {
      console.error('[CommentsSection] Create failed:', error);
      toast.error(`Failed to post comment: ${error.message}`);
    }
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId) => groonabackend.entities.Comment.delete(commentId),
    onSuccess: () => {
      queryClient.invalidateQueries(['comments', entityId]);
      toast.success("Comment deleted");
    },
    onError: () => toast.error("Failed to delete comment")
  });

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setIsUploading(true);
    toast.info(`Uploading ${files.length} file${files.length > 1 ? 's' : ''}...`);
    try {
      for (const file of files) {
        const result = await groonabackend.integrations.Core.UploadFile({ file: file });
        setAttachments(prev => [...prev, { name: file.name, url: result.file_url, type: file.type }]);
      }
      toast.success("Files attached");
    } catch (error) {
      console.error("[CommentsSection] Upload error:", error);
      toast.error("Failed to upload files");
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  const removeAttachment = (index) => setAttachments(prev => prev.filter((_, i) => i !== index));

  const handleCommentChange = (e) => {
    const text = e.target.value;
    const curPos = e.target.selectionStart;
    setNewComment(text);
    setCursorPosition(curPos);
    const textBeforeCursor = text.slice(0, curPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    if (lastAtIndex !== -1) {
      const searchText = textBeforeCursor.slice(lastAtIndex + 1);
      if (searchText.length < 20 && !searchText.includes('\n')) {
        setMentionQuery(searchText);
        setShowMentions(true);
        return;
      }
    }
    setShowMentions(false);
  };

  const insertMention = (user) => {
    const textBeforeCursor = newComment.slice(0, cursorPosition);
    const textAfterCursor = newComment.slice(cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    const newText = textBeforeCursor.slice(0, lastAtIndex) + `@${user.full_name} ` + textAfterCursor;
    setNewComment(newText);
    setShowMentions(false);
    const newCursorPos = lastAtIndex + user.full_name.length + 2;
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  const usersToFilter = mentionableUsers && mentionableUsers.length > 0 ? mentionableUsers : users;
  const filteredUsers = usersToFilter.filter(u => u.full_name?.toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 5);

  const handleSubmit = () => {
    if ((!newComment.trim() && attachments.length === 0) || !currentUser) return;
    const mentions = [];
    if (users.length > 0) {
      users.forEach(u => {
        if (newComment.includes(`@${u.full_name}`)) {
          mentions.push(u.email);
        }
      });
    }
    const payload = {
      tenant_id: currentUser.tenant_id || currentUser.active_tenant_id,
      content: newComment,
      attachments: attachments,
      entity_type: entityType,
      entity_id: entityId,
      author_email: currentUser.email,
      author_name: currentUser.full_name,
      mentions: mentions,
      created_date: new Date().toISOString()
    };
    createCommentMutation.mutate(payload);
  };

  const getInitials = (name) => {
    if (!name) return "?";
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Function to format comment content with @ mentions highlighted in bold
  const formatCommentContent = (content) => {
    if (!content || typeof content !== 'string') return content;

    // Helper to escape regex special characters
    const escapeRegExp = (string) => {
      return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    };

    // 1. Build a pattern from known users (longest first to match "John Doe" before "John")
    const sortedUserNames = users
      .map(u => u.full_name)
      .filter(name => name && typeof name === 'string')
      .sort((a, b) => b.length - a.length);

    let parts = [];

    if (sortedUserNames.length > 0) {
      const namesPattern = sortedUserNames.map(escapeRegExp).join('|');
      // Match @ followed by one of the known names
      // We look for boundaries to avoid matching "John" inside "Johnny" if "Johnny" isn't in list but "John" is
      // But simpler: just match the name.
      const userMentionRegex = new RegExp(`@(${namesPattern})`, 'g');

      let lastIndex = 0;
      let match;

      while ((match = userMentionRegex.exec(content)) !== null) {
        if (match.index > lastIndex) {
          parts.push({ text: content.slice(lastIndex, match.index), isMention: false });
        }
        parts.push({ text: match[0], isMention: true });
        lastIndex = match.index + match[0].length;
      }

      if (lastIndex < content.length) {
        parts.push({ text: content.slice(lastIndex), isMention: false });
      }
    } else {
      // Fallback if no users loaded or empty list
      parts.push({ text: content, isMention: false });
    }

    // 2. Secondary Pass: If we have parts that are NOT mentions, we could try the generic regex 
    // for users not in the list (e.g. deleted users)
    // But for now, let's keep it simple. If the user isn't in the list, it won't be bolded.
    // This prevents false positives like "Meet me @2pm".

    // However, to mimic previous behavior for unknowns, we could add a fallback. 
    // Let's stick to the user list as it's cleaner and requested behavior ("mentioned user name").

    return parts.map((part, idx) => {
      if (part.isMention) {
        // Use color instead of bold to ensure width matches the textarea (preventing cursor drift)
        return <span key={idx} className="text-blue-600">{part.text}</span>;
      }
      return <React.Fragment key={idx}>{part.text}</React.Fragment>;
    });
  };

  if (loading) {
    return (
      <Card className="bg-white/60 backdrop-blur-xl border-slate-200/60">
        <CardHeader><CardTitle>Comments</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="bg-transparent">
      <div className="pt-2 pb-6">
        <h3 className="text-[17px] font-bold text-slate-900 flex items-center gap-2 mb-4">
          Comments <span className="text-slate-400 font-normal">({comments.length})</span>
        </h3>

        <div className="space-y-4">
          <div className="relative">
            {/* Overlay div showing formatted text with bold mentions */}
            <div
              className="absolute inset-0 pointer-events-none whitespace-pre-wrap break-words p-4 pr-36 text-[15px] leading-relaxed z-10 overflow-hidden font-sans border border-transparent"
              aria-hidden="true"
            >
              {newComment ? (
                <span className="text-slate-800">
                  {formatCommentContent(newComment)}
                </span>
              ) : (
                <span className="text-slate-400">Add a comment...</span>
              )}
            </div>
            {/* Actual textarea for input - transparent text to show overlay */}
            <Textarea
              ref={textareaRef}
              value={newComment}
              onChange={handleCommentChange}
              placeholder=""
              rows={3}
              className="min-h-[120px] bg-slate-50/50 border border-slate-200/60 rounded-[16px] p-4 pr-36 text-[15px] leading-relaxed relative z-0 resize-none outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/10 focus-visible:border-indigo-400 transition-all shadow-sm"
              disabled={createCommentMutation.isPending}
              style={{
                color: 'transparent',
                caretColor: '#0f172a',
              }}
            />

            {showMentions && filteredUsers.length > 0 && (
              <div className="absolute top-full left-0 mt-2 w-64 z-50 bg-white/80 backdrop-blur-xl shadow-lg border border-slate-200/60 rounded-xl overflow-hidden">
                <div className="p-1">
                  {filteredUsers.map(user => (
                    <button
                      key={user.id}
                      onClick={() => insertMention(user)}
                      className="w-full flex items-center gap-3 p-2.5 hover:bg-slate-100/50 rounded-lg text-left text-sm transition-colors"
                    >
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className="text-[11px] bg-slate-100 text-slate-700 font-medium">
                          {getInitials(user.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-slate-700">{user.full_name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Button
              onClick={handleSubmit}
              disabled={(!newComment.trim()) || createCommentMutation.isPending || !currentUser}
              size="sm"
              className="absolute bottom-3 right-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-full px-5 py-2 h-auto shadow-sm font-medium transition-all z-20"
            >
              {createCommentMutation.isPending ? "Posting..." : "Post"}
            </Button>
          </div>
        </div>

        <ScrollArea className="h-[400px] mt-8 pr-4">
          {comments.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <MessageSquare className="h-10 w-10 mx-auto mb-4 text-slate-200 stroke-[1.5]" />
              <p className="text-[15px]">No comments yet.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {comments.map((comment) => (
                <div
                  key={comment.id}
                  id={`comment-${comment.id}`}
                  ref={el => commentRefs.current[comment.id] = el}
                  className="group transition-all duration-500"
                >
                  <div className="flex items-start gap-4">
                    <Avatar className="h-10 w-10 flex-shrink-0">
                      <AvatarImage
                        src={users.find(u => u.email === comment.author_email)?.profile_image_url}
                        alt={comment.author_name}
                      />
                      <AvatarFallback className="bg-slate-100 text-slate-600 font-semibold text-[13px]">
                        {getInitials(comment.author_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="flex items-baseline justify-between gap-3 mb-1.5">
                        <div className="flex items-baseline gap-2">
                          <p className="font-semibold text-slate-900 text-[15px]">{comment.author_name}</p>
                          <p className="text-[13px] text-slate-400 font-medium">
                            {formatDistanceToNow(new Date(comment.created_date || Date.now()), { addSuffix: true })}
                          </p>
                        </div>
                        {currentUser?.email === comment.author_email && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteCommentMutation.mutate(comment.id)}
                            className="h-7 w-7 text-slate-300 hover:text-red-500 hover:bg-red-50/50 rounded-full opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                      <p className="text-[15px] text-slate-700 leading-relaxed whitespace-pre-wrap">
                        {formatCommentContent(comment.content)}
                      </p>

                      {comment.attachments && comment.attachments.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {comment.attachments.map((file, i) => (
                            <div key={i} className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-100/60 text-sm hover:bg-slate-100 transition-colors w-fit max-w-full">
                              <div className="h-7 w-7 rounded-lg bg-white flex items-center justify-center shadow-sm border border-slate-100">
                                <File className="h-3.5 w-3.5 text-indigo-500 flex-shrink-0" />
                              </div>
                              <a
                                href={file.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="truncate hover:underline text-slate-700 font-medium pr-2 text-[13px]"
                              >
                                {file.name}
                              </a>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}