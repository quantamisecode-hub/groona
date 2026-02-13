import React, { useState, useRef, useEffect } from "react";
import { groonabackend } from "@/api/groonabackend";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Send, Reply, Smile, Sparkles, Loader2, Paperclip, X, File } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import EmojiPicker from "./EmojiPicker";

export default function CommentsTab({ taskId, users, currentUser, isNewTask }) {
  const queryClient = useQueryClient();
  const [commentText, setCommentText] = useState("");
  const [replyingTo, setReplyingTo] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [showMentions, setShowMentions] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [attachments, setAttachments] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const textareaRef = useRef(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [aiSummary, setAiSummary] = useState("");

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ['comments', taskId],
    queryFn: () => groonabackend.entities.Comment.filter({ entity_type: 'task', entity_id: taskId }),
    enabled: !!taskId && !isNewTask,
  });

  const createCommentMutation = useMutation({
    mutationFn: (data) => groonabackend.entities.Comment.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', taskId] });
      setCommentText("");
      setReplyingTo(null);
      toast.success('Comment added');
    },
  });

  const addReactionMutation = useMutation({
    mutationFn: ({ commentId, emoji }) => {
      const comment = comments.find(c => c.id === commentId);
      const reactions = comment.reactions || {};
      const userEmail = currentUser.email;
      
      if (!reactions[emoji]) {
        reactions[emoji] = [];
      }
      
      if (reactions[emoji].includes(userEmail)) {
        reactions[emoji] = reactions[emoji].filter(e => e !== userEmail);
        if (reactions[emoji].length === 0) {
          delete reactions[emoji];
        }
      } else {
        reactions[emoji].push(userEmail);
      }
      
      return groonabackend.entities.Comment.update(commentId, { reactions });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', taskId] });
    },
  });

  // Handle @mentions
  useEffect(() => {
    const text = commentText;
    const cursorPos = cursorPosition;
    const textBeforeCursor = text.slice(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex !== -1 && lastAtIndex === cursorPos - 1) {
      setShowMentions(true);
      setMentionQuery("");
    } else if (lastAtIndex !== -1) {
      const afterAt = textBeforeCursor.slice(lastAtIndex + 1);
      if (!afterAt.includes(' ')) {
        setShowMentions(true);
        setMentionQuery(afterAt);
      } else {
        setShowMentions(false);
      }
    } else {
      setShowMentions(false);
    }
  }, [commentText, cursorPosition]);

  const handleTextChange = (e) => {
    setCommentText(e.target.value);
    setCursorPosition(e.target.selectionStart);
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setIsUploading(true);
    try {
      const uploadPromises = files.map(async (file) => {
        const { file_url } = await groonabackend.integrations.Core.UploadFile({ file });
        return {
          name: file.name,
          url: file_url,
          type: file.type,
        };
      });

      const uploadedFiles = await Promise.all(uploadPromises);
      setAttachments(prev => [...prev, ...uploadedFiles]);
      toast.success("Files uploaded");
    } catch (error) {
      console.error(error);
      toast.error("Failed to upload files");
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const removeAttachment = (index) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const insertMention = (user) => {
    const cursorPos = cursorPosition;
    const textBeforeCursor = commentText.slice(0, cursorPos);
    const textAfterCursor = commentText.slice(cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    const newText = 
      textBeforeCursor.slice(0, lastAtIndex) + 
      `@${user.full_name} ` + 
      textAfterCursor;
    
    setCommentText(newText);
    setShowMentions(false);
    textareaRef.current?.focus();
  };

  const extractMentions = (text) => {
    const mentionRegex = /@(\w+\s?\w*)/g;
    const mentions = [];
    let match;
    
    while ((match = mentionRegex.exec(text)) !== null) {
      const mentionedName = match[1];
      const user = users.find(u => u.full_name.toLowerCase() === mentionedName.toLowerCase());
      if (user) {
        mentions.push(user.email);
      }
    }
    
    return mentions;
  };

  const handleSubmitComment = async () => {
    if ((!commentText.trim() && attachments.length === 0) || !currentUser) return;
    
    const mentions = extractMentions(commentText);
    
    const commentData = {
      content: commentText,
      attachments,
      entity_type: 'task',
      entity_id: taskId,
      author_email: currentUser.email,
      author_name: currentUser.full_name,
      parent_comment_id: replyingTo?.id || null,
      mentions,
    };

    await createCommentMutation.mutateAsync(commentData);
    setAttachments([]);

    // Send notifications for mentions using notificationService
    if (mentions.length > 0) {
      try {
        const tasks = await groonabackend.entities.Task.filter({ id: taskId });
        const taskName = tasks[0]?.title || 'task';
        
        // Import notificationService
        const { notificationService } = await import('../../shared/notificationService');
        
        await notificationService.notifyComment({
          comment: {
            author_name: currentUser.full_name,
            author_email: currentUser.email
          },
          mentions: mentions.filter(email => email !== currentUser.email),
          entityType: 'task',
          entityId: taskId,
          entityName: taskName,
          tenantId: currentUser.tenant_id || currentUser.active_tenant_id,
          commentContent: commentText
        });
      } catch (error) {
        console.error('Failed to send mention notifications:', error);
      }
    }

    // Notify parent comment author if replying
    if (replyingTo && replyingTo.author_email !== currentUser.email) {
      await groonabackend.entities.Notification.create({
        recipient_email: replyingTo.author_email,
        type: 'comment_added',
        title: 'New reply to your comment',
        message: `${currentUser.full_name} replied to your comment`,
        entity_type: 'task',
        entity_id: taskId,
        sender_name: currentUser.full_name,
      });
    }
  };

  const generateAISummary = async () => {
    if (comments.length === 0) {
      toast.error('No comments to summarize');
      return;
    }

    setIsGeneratingSummary(true);
    try {
      const commentTexts = comments.map(c => `${c.author_name}: ${c.content}`).join('\n');
      const prompt = `Summarize the following task comments in a concise, actionable format. Highlight key decisions, action items, and unresolved questions:\n\n${commentTexts}`;
      
      const summary = await groonabackend.integrations.Core.InvokeLLM({
        prompt,
        add_context_from_internet: false,
      });
      
      setAiSummary(summary);
      toast.success('Summary generated');
    } catch (error) {
      toast.error('Failed to generate summary');
      console.error(error);
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const filteredUsers = users.filter(u =>
    u.full_name.toLowerCase().includes(mentionQuery.toLowerCase())
  );

  // Organize comments into threads
  const topLevelComments = comments.filter(c => !c.parent_comment_id);
  const getReplies = (commentId) => comments.filter(c => c.parent_comment_id === commentId);

  const CommentItem = ({ comment, isReply = false }) => (
    <div className={`${isReply ? 'ml-12 mt-2' : 'mb-4'}`}>
      <div className="flex gap-3">
        <Avatar className="h-10 w-10 bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold">
          {comment.author_name?.charAt(0) || 'U'}
        </Avatar>
        <div className="flex-1">
          <div className="bg-slate-50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-sm">{comment.author_name}</span>
              <span className="text-xs text-slate-500">
                {format(new Date(comment.created_date), 'MMM d, HH:mm')}
              </span>
            </div>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{comment.content}</p>
            
            {comment.attachments && comment.attachments.length > 0 && (
              <div className="mt-3 grid gap-2">
                {comment.attachments.map((file, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 bg-white border rounded text-sm w-fit max-w-full">
                    <File className="h-4 w-4 text-blue-600 flex-shrink-0" />
                    <a href={file.url} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline truncate">
                      {file.name}
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Reactions */}
          <div className="flex items-center gap-2 mt-2">
            {comment.reactions && Object.entries(comment.reactions).map(([emoji, userEmails]) => (
              <button
                key={emoji}
                onClick={() => addReactionMutation.mutate({ commentId: comment.id, emoji })}
                className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
                  userEmails.includes(currentUser.email)
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-slate-100 text-slate-700'
                } hover:bg-blue-50`}
              >
                <span>{emoji}</span>
                <span>{userEmails.length}</span>
              </button>
            ))}
            <button
              onClick={() => {
                const emoji = '👍'; // Default reaction
                addReactionMutation.mutate({ commentId: comment.id, emoji });
              }}
              className="text-slate-400 hover:text-slate-600 p-1"
            >
              <Smile className="h-4 w-4" />
            </button>
            {!isReply && (
              <button
                onClick={() => setReplyingTo(comment)}
                className="text-slate-400 hover:text-slate-600 text-xs flex items-center gap-1 px-2 py-1"
              >
                <Reply className="h-3 w-3" />
                Reply
              </button>
            )}
          </div>

          {/* Nested Replies */}
          {!isReply && getReplies(comment.id).map(reply => (
            <CommentItem key={reply.id} comment={reply} isReply={true} />
          ))}
        </div>
      </div>
    </div>
  );

  if (isNewTask) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-600">Comments will be available after the task is created.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* AI Summary Section */}
      {comments.length > 0 && (
        <div className="border-b pb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-900">AI Comment Summary</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={generateAISummary}
              disabled={isGeneratingSummary}
              className="border-purple-200 text-purple-700"
            >
              {isGeneratingSummary ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-1" />
              )}
              Generate Summary
            </Button>
          </div>
          {aiSummary && (
            <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{aiSummary}</p>
            </div>
          )}
        </div>
      )}

      {/* Comment Input */}
      <div className="relative">
        {replyingTo && (
          <div className="mb-2 p-2 bg-blue-50 border border-blue-200 rounded flex items-center justify-between">
            <span className="text-sm text-blue-700">
              Replying to {replyingTo.author_name}
            </span>
            <button onClick={() => setReplyingTo(null)} className="text-blue-700 hover:text-blue-900">
              <span className="text-xs">Cancel</span>
            </button>
          </div>
        )}
        
        <div className="relative">
          <Textarea
            ref={textareaRef}
            value={commentText}
            onChange={handleTextChange}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleSubmitComment();
              }
            }}
            placeholder="Add a comment... Use @ to mention someone"
            rows={3}
            className="pr-20"
          />
          
          {/* Mention Suggestions */}
          {showMentions && (
            <div className="absolute bottom-full mb-2 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto z-10">
              {filteredUsers.length > 0 ? (
                filteredUsers.map(user => (
                  <button
                    key={user.id}
                    onClick={() => insertMention(user)}
                    className="w-full px-4 py-2 text-left hover:bg-slate-50 flex items-center gap-2"
                  >
                    <Avatar className="h-6 w-6 bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-semibold">
                      {user.full_name?.charAt(0)}
                    </Avatar>
                    <span className="text-sm">{user.full_name}</span>
                  </button>
                ))
              ) : (
                <div className="px-4 py-2 text-sm text-slate-500">No users found</div>
              )}
            </div>
          )}
          
          <div className="absolute bottom-3 right-3 flex gap-2 items-center">
            <div className="flex items-center mr-2">
              <input
                type="file"
                id="comments-tab-file"
                multiple
                className="hidden"
                onChange={handleFileUpload}
                disabled={isUploading || createCommentMutation.isPending}
              />
              <label 
                htmlFor="comments-tab-file"
                className={`p-2 rounded-full hover:bg-slate-100 cursor-pointer transition-colors ${isUploading ? 'opacity-50' : ''}`}
              >
                <Paperclip className="h-4 w-4 text-slate-500" />
              </label>
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            >
              <Smile className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              onClick={handleSubmitComment}
              disabled={(!commentText.trim() && attachments.length === 0) || createCommentMutation.isPending || isUploading || !currentUser}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {attachments.map((file, index) => (
              <div key={index} className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-full text-xs border border-slate-200">
                <Paperclip className="h-3 w-3 text-slate-500" />
                <span className="max-w-[150px] truncate">{file.name}</span>
                <button onClick={() => removeAttachment(index)} className="text-slate-400 hover:text-red-500">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        
        <p className="text-xs text-slate-500 mt-2">
          Press Cmd/Ctrl + Enter to submit
        </p>
      </div>

      {/* Comments List */}
      <div>
        <h3 className="font-semibold text-slate-900 mb-4">
          Comments ({comments.length})
        </h3>
        
        {isLoading ? (
          <div className="text-center py-8">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-slate-400" />
          </div>
        ) : topLevelComments.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            No comments yet. Be the first to comment!
          </div>
        ) : (
          <div>
            {topLevelComments.map(comment => (
              <CommentItem key={comment.id} comment={comment} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

