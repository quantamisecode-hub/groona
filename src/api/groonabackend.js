import axios from 'axios';
import { queryClient } from '@/queryClient';

// --- CONFIGURATION ---
// Base URL is configured in .env file
// For local development: VITE_API_BASE=http://localhost:5000
// For production: VITE_API_BASE=https://aivorabackend.quantemisecode.com
const API_BASE = import.meta.env.VITE_API_BASE;

if (!API_BASE) {
  throw new Error(
    'VITE_API_BASE is not defined in .env file. ' +
    'Please create a .env file with VITE_API_BASE=http://localhost:5000 (for local) ' +
    'or VITE_API_BASE=https://aivorabackend.quantemisecode.com (for production)'
  );
}

const API_URL = `${API_BASE}/api`;
const AUTH_URL = `${API_BASE}/api/auth`;

// Export API_BASE for use in other files
export { API_BASE, API_URL };

const getToken = () => localStorage.getItem('auth_token');

// Helper to fix _id vs id issues
const fixId = (item) => {
  if (!item) return item;
  if (Array.isArray(item)) return item.map(fixId);
  if (item._id && !item.id) return { ...item, id: item._id, ...item };
  return item;
};

// --- AXIOS INSTANCE ---
const api = axios.create({
  baseURL: API_URL,
  timeout: 60000 // 60 seconds timeout for all requests (emails may take longer)
});

api.interceptors.request.use(config => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// --- GENERIC ENTITY HANDLER ---
const createEntityHandler = (entityName) => ({
  list: async (sort) => {
    const res = await api.post(`/entities/${entityName}/filter`, { sort, filters: {} });
    return fixId(res.data);
  },
  filter: async (filters, sort) => {
    const res = await api.post(`/entities/${entityName}/filter`, { filters, sort });
    return fixId(res.data);
  },
  get: async (id) => {
    const res = await api.post(`/entities/${entityName}/get/${id}`);
    return fixId(res.data);
  },
  create: async (data) => {
    const res = await api.post(`/entities/${entityName}/create`, data);
    return fixId(res.data);
  },
  update: async (id, data) => {
    const res = await api.post(`/entities/${entityName}/update`, { id, data });
    return fixId(res.data);
  },
  delete: async (id) => {
    const res = await api.post(`/entities/${entityName}/delete`, { id });
    return res.data;
  }
});

// --- MAIN CLIENT OBJECT ---
export const groonabackend = {
  auth: {
    me: async () => {
      const res = await api.get(`${AUTH_URL}/me`);
      return fixId(res.data);
    },
    login: async (email, password, emailTemplate) => {
      const res = await api.post(`${AUTH_URL}/login`, { email, password, emailTemplate });
      if (res.data.token) localStorage.setItem('auth_token', res.data.token);
      return {
        ...res.data,
        user: res.data.user ? fixId(res.data.user) : null,
        token: res.data.token
      };
    },
    sendEmailVerificationOTP: async (email) => {
      const res = await api.post(`${AUTH_URL}/send-email-verification-otp`, { email });
      return res.data;
    },
    verifyEmailOTP: async (email, otp) => {
      const res = await api.post(`${AUTH_URL}/verify-email-otp`, { email, otp });
      return res.data;
    },
    register: async (userData) => {
      const res = await api.post(`${AUTH_URL}/register`, userData);
      if (res.data.token) localStorage.setItem('auth_token', res.data.token);
      return { user: fixId(res.data.user), token: res.data.token };
    },
    acceptInvite: async (data) => {
      const res = await api.post(`${AUTH_URL}/accept-invite`, data);
      if (res.data.token) localStorage.setItem('auth_token', res.data.token);
      return { user: fixId(res.data.user || res.data), token: res.data.token };
    },
    logout: async () => {
      try {
        await api.post(`${AUTH_URL}/logout`);
      } catch (e) {
        console.error("Logout failed on server:", e);
      } finally {
        // Clear all caches and storage
        if (typeof window !== 'undefined') {
          try {
            queryClient.clear();
          } catch (e) {
            console.error("Failed to clear query cache:", e);
          }
          localStorage.clear();
          window.location.href = '/SignIn';
        }
      }
    },
    updateMe: async (data) => {
      const res = await api.put(`${AUTH_URL}/updatedetails`, data);
      return fixId(res.data);
    },

    // --- REAL SECURITY ENDPOINTS ---

    // Change Password (REAL)
    changePassword: async (currentPassword, newPassword) => {
      const res = await api.post(`${AUTH_URL}/change-password`, { currentPassword, newPassword });
      return res.data;
    },

    // Session Management (REAL)
    getSessions: async () => {
      const res = await api.get(`${AUTH_URL}/sessions`);
      return fixId(res.data);
    },

    revokeSession: async (sessionId) => {
      const res = await api.delete(`${AUTH_URL}/sessions/${sessionId}`);
      return res.data;
    },

    revokeOtherSessions: async () => {
      const res = await api.delete(`${AUTH_URL}/sessions-others`);
      return res.data;
    }
  },

  functions: {
    invoke: async (functionName, payload) => {
      const res = await api.post('/functions/invoke', { functionName, payload });
      return res.data;
    }
  },

  entities: {
    Project: createEntityHandler('Project'),
    Epic: createEntityHandler('Epic'),
    Story: createEntityHandler('Story'),
    Task: createEntityHandler('Task'),
    Impediment: createEntityHandler('Impediment'),
    User: createEntityHandler('User'),
    Tenant: createEntityHandler('Tenant'),
    Workspace: createEntityHandler('Workspace'),
    Activity: createEntityHandler('Activity'),
    Notification: createEntityHandler('Notification'),
    Client: createEntityHandler('Client'),
    Timesheet: createEntityHandler('Timesheet'),
    Comment: createEntityHandler('Comment'),
    Document: createEntityHandler('Document'),
    Sprint: createEntityHandler('Sprint'),
    Retrospective: createEntityHandler('Retrospective'),
    Milestone: createEntityHandler('Milestone'),
    Ticket: createEntityHandler('Ticket'),
    ProjectFile: createEntityHandler('ProjectFile'),
    ChatMessage: createEntityHandler('ChatMessage'),
    UserPresence: createEntityHandler('UserPresence'),
    AuditLog: createEntityHandler('AuditLog'),
    UserProfile: createEntityHandler('UserProfile'),
    UserGroup: createEntityHandler('UserGroup'),
    UserGroupMembership: createEntityHandler('UserGroupMembership'),
    ProjectTemplate: createEntityHandler('ProjectTemplate'),
    RecurringTask: createEntityHandler('RecurringTask'),
    ClockEntry: createEntityHandler('ClockEntry'),
    WorkLocation: createEntityHandler('WorkLocation'),
    TicketComment: createEntityHandler('TicketComment'),
    SubscriptionPlan: createEntityHandler('SubscriptionPlan'),
    SystemNotification: createEntityHandler('SystemNotification'),
    Mention: createEntityHandler('Mention'),
    Conversation: createEntityHandler('Conversation'),
    OTPVerification: createEntityHandler('OTPVerification'),
    ProjectUserRole: createEntityHandler('ProjectUserRole'),
    ProjectClient: createEntityHandler('ProjectClient'),
    ProjectExpense: createEntityHandler('ProjectExpense'),
    Leave: createEntityHandler('Leave'),
    LeaveType: createEntityHandler('LeaveType'),
    LeaveBalance: createEntityHandler('LeaveBalance'),
    LeaveApproval: createEntityHandler('LeaveApproval'),
    UserPermission: createEntityHandler('UserPermission'),
    CompOffCredit: createEntityHandler('CompOffCredit'),
    ReportConfig: createEntityHandler('ReportConfig'),
    UserSession: createEntityHandler('UserSession'),
    Holiday: createEntityHandler('Holiday'),
    ProjectReport: createEntityHandler('ProjectReport'),
    AIInsightsReport: createEntityHandler('AIInsightsReport'),
    PeerReviewRequest: createEntityHandler('PeerReviewRequest')
  },

  ai: {
    generateSprintTasks: async (payload) => {
      const res = await api.post('/functions/invoke', { functionName: 'generateSprintTasks', payload });
      return res.data;
    }
  },

  integrations: {
    Core: {
      InvokeLLM: async ({ prompt, response_json_schema, context, file_urls }) => {
        const res = await api.post(`/integrations/llm`, { prompt, response_json_schema, context, file_urls });
        return res.data;
      },
      SendEmail: async (data) => {
        const res = await api.post('/integrations/email', data);
        return res.data;
      },
      UploadFile: async ({ file }) => {
        const formData = new FormData();
        formData.append('file', file);
        try {
          const res = await axios.post(`${API_URL}/upload`, formData, {
            headers: {
              'Content-Type': 'multipart/form-data',
              'Authorization': `Bearer ${getToken()}`
            }
          });
          return { file_url: res.data.url, filename: res.data.filename };
        } catch (e) { throw e; }
      }
    }
  },

  agents: {
    listConversations: async () => {
      try {
        const userRes = await api.get(`${AUTH_URL}/me`);
        const user = fixId(userRes.data);
        const tenantQuery = user.tenant_id ? `&tenant_id=${user.tenant_id}` : '';
        // Use new AI assistant route
        const res = await api.get(`/ai-assistant/conversations?user_id=${user.id}${tenantQuery}`);
        return fixId(res.data);
      } catch (e) {
        // Fallback to old route if new one fails
        try {
          const userRes = await api.get(`${AUTH_URL}/me`);
          const user = fixId(userRes.data);
          const tenantQuery = user.tenant_id ? `&tenant_id=${user.tenant_id}` : '';
          const res = await api.get(`/ai/conversations?user_id=${user.id}${tenantQuery}`);
          return fixId(res.data);
        } catch (e2) {
          return [];
        }
      }
    },
    createConversation: async ({ metadata }) => {
      const userRes = await api.get(`${AUTH_URL}/me`);
      const user = fixId(userRes.data);
      // Use new AI assistant route
      const res = await api.post(`/ai-assistant/conversations`, {
        user_id: user.id,
        tenant_id: user.tenant_id,
        title: metadata?.name,
        metadata
      });
      return fixId(res.data);
    },
    sendMessage: async (conversationId, messageData, model = null, signal = null) => {
      const userRes = await api.get(`${AUTH_URL}/me`);
      const user = fixId(userRes.data);
      // Use new AI assistant route with GEMINI_API_KEY_2
      // Pass abort signal if provided for request cancellation
      const config = signal ? { signal } : {};
      const res = await api.post(`/ai-assistant/chat`, {
        conversation_id: conversationId,
        content: messageData.content,
        file_urls: messageData.file_urls,
        context: messageData.context,
        // Backend will use selected model or default
        model: model || undefined,
        user_id: user.id,
        tenant_id: user.tenant_id
      }, config);
      return res.data;
    },
    getConversation: async (conversationId) => {
      try {
        // Use new AI assistant route
        const res = await api.get(`/ai-assistant/conversations/${conversationId}`);
        return fixId(res.data);
      } catch (e) {
        // Fallback: search in list
        const conversations = await groonabackend.agents.listConversations();
        return conversations.find(c => c.id === conversationId || c._id === conversationId) || null;
      }
    },

    // Get available AI models
    listModels: async () => {
      const res = await api.get('/ai-assistant/models');
      return res.data;
    },
  },
  functions: {
    invoke: async (functionName, payload) => {
      const res = await api.post('/functions/invoke', { functionName, payload });
      return res.data;
    }
  },
  email: {
    sendTemplate: async ({ to, templateType, data, subject }) => {
      const res = await api.post('/email/send-template', { to, templateType, data, subject });
      return res.data;
    }
  }
};
