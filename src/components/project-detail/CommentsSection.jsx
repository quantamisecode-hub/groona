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
    <Card className="bg-white/60 backdrop-blur-xl border-slate-200/60">
      <CardHeader>
        <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Comments ({comments.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="relative">
            {/* Overlay div showing formatted text with bold mentions */}
            <div
              className="absolute inset-0 pointer-events-none whitespace-pre-wrap break-words p-3 pr-10 text-sm leading-6 z-10 overflow-hidden font-sans border border-transparent"
              aria-hidden="true"
            >
              {newComment ? (
                <span className="text-slate-700">
                  {formatCommentContent(newComment)}
                </span>
              ) : (
                <span className="text-slate-400">Add a comment... (Type @ to mention team members)</span>
              )}
            </div>
            {/* Actual textarea for input - transparent text to show overlay */}
            <Textarea
              ref={textareaRef}
              value={newComment}
              onChange={handleCommentChange}
              placeholder=""
              rows={3}
              className="min-h-[80px] bg-white border-slate-200 p-3 pr-10 text-sm leading-6 relative z-0 resize-y"
              disabled={createCommentMutation.isPending}
              style={{
                color: 'transparent',
                caretColor: '#0f172a',
              }}
            />
            {showMentions && filteredUsers.length > 0 && (
              <Card className="absolute bottom-full left-0 mb-1 w-64 z-50 shadow-xl border-slate-200">
                <CardContent className="p-1">
                  {filteredUsers.map(user => (
                    <button
                      key={user.id}
                      onClick={() => insertMention(user)}
                      className="w-full flex items-center gap-2 p-2 hover:bg-slate-100 rounded text-left text-sm"
                    >
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-xs bg-blue-100 text-blue-700">
                          {getInitials(user.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <span>{user.full_name}</span>
                    </button>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
          {/* Attachment rendering and Upload button logic remains same */}
          {/* ... */}
          <div className="flex justify-end items-center">
            <Button
              onClick={handleSubmit}
              disabled={(!newComment.trim()) || createCommentMutation.isPending || !currentUser}
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white"
            >
              <Send className="h-4 w-4 mr-2" />
              {createCommentMutation.isPending ? "Posting..." : "Post Comment"}
            </Button>
          </div>
        </div>

        <ScrollArea className="h-[400px] pr-4">
          {comments.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <MessageSquare className="h-12 w-12 mx-auto mb-3 text-slate-300" />
              <p>No comments yet. Be the first to comment!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {comments.map((comment) => (
                <div
                  key={comment.id}
                  id={`comment-${comment.id}`} // Added ID for accessibility
                  ref={el => commentRefs.current[comment.id] = el} // STORE REF
                  className="p-4 rounded-lg border border-slate-200 bg-white shadow-sm transition-all duration-500" // Added transition
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10 flex-shrink-0 border border-slate-200">
                      <AvatarImage
                        src={users.find(u => u.email === comment.author_email)?.profile_image_url}
                        alt={comment.author_name}
                      />
                      <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-medium">
                        {getInitials(comment.author_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <p className="font-semibold text-slate-900">{comment.author_name}</p>
                          <p className="text-xs text-slate-500">
                            {formatDistanceToNow(new Date(comment.created_date || Date.now()), { addSuffix: true })}
                          </p>
                        </div>
                        {currentUser?.email === comment.author_email && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteCommentMutation.mutate(comment.id)}
                            className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">
                        {formatCommentContent(comment.content)}
                      </p>

                      {comment.attachments && comment.attachments.length > 0 && (
                        <div className="mt-2 grid gap-2">
                          {comment.attachments.map((file, i) => (
                            <div key={i} className="flex items-center gap-3 p-2 rounded border border-slate-200 bg-slate-50 text-sm hover:bg-slate-100 transition-colors w-fit max-w-full">
                              <File className="h-4 w-4 text-blue-500 flex-shrink-0" />
                              <a
                                href={file.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="truncate hover:underline text-blue-700 font-medium"
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
      </CardContent>
    </Card>
  );
}