# Groona Frontend - Developer KT Documentation

This document provides a deep-dive into the Groona frontend, explaining how the application is structured, how data flows, and how the core systems interact.

---

## 🛠 Tech Stack & Core Libraries

- **Framework**: [React](https://reactjs.org/) (v18+)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) with [Radix UI](https://www.radix-ui.com/) for headless primitives.
- **Data Fetching**: [TanStack Query](https://tanstack.com/query/latest) (formerly React Query)
- **Routing**: [React Router Dom](https://reactrouter.com/) (v7+)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Real-time**: [Socket.io Client](https://socket.io/docs/v4/client-api/)

---

## 🏗 Project Structure (src/)

```text
src/
├── api/                # API client and entity handlers (Business SDK)
├── components/         # Reusable UI components
│   ├── shared/         # Contexts, Guards, and Global components
│   └── ui/             # Atomic Shadcn/Radix components
├── hooks/              # Custom React hooks
├── lib/                # Library configurations (e.g., utils, tailwind-merge)
├── pages/              # Page components and Routing orchestration
├── services/           # External business services (AI, etc.)
├── utils/              # Helper functions and constants
├── App.jsx             # Root component (Providers & Guards)
└── main.jsx            # Application entry point
```

---

## 🚦 Orchestration: The Boot Sequence

### 1. `main.jsx`
The entry point that renders the `<App />` within a `React.StrictMode`.

### 2. `App.jsx`
Wraps the entire application in essential providers:
- **`QueryClientProvider`**: Manages server state and caching.
- **`BrowserRouter`**: Enables client-side routing.
- **`UserProvider`**: Manages global user/tenant state.
- **`TenantGuard`**: Protects routes based on tenant subscription status.
- **`TooltipProvider` & `Toaster`**: Global UI utilities.

---

## 🛣 The Routing Engine (`src/pages/Index.jsx`)

Groona uses a dynamic routing pattern rather than a static route map.

- **Normalization**: The code automatically maps URL slugs (e.g., `/reset-password`) to component names (e.g., `ResetPassword`) by removing hyphens and matching case-insensitively.
- **Layout Logic**:
    - **Standalone Pages**: Pages like `SignIn`, `Register`, and `LandingPage` render without the sidebar.
    - **Sidebar Pages**: All internal dashboard pages are wrapped in a `<Layout />` component that provides the navigation sidebar.

---

## 🔄 State Management & Data Flow

### 1. Server State (TanStack Query)
Instead of Redux, Groona relies on TanStack Query to manage data from the backend.
- Hooks like `useQuery` and `useMutation` are used throughout the app.
- Key configurations (retries, stale times) are managed in `queryClient.js`.

### 2. Global Context (`UserContext.jsx`)
The `UserContext` is the "Source of Truth" for the frontend:
- **Current User**: Fetched via `groonabackend.auth.me()`.
- **Active Tenant**: Identifies which organization data to show (especially for Super Admins).
- **Subscription**: Controls feature access based on the tenant's plan.

---

## 🔌 API Integration (`src/api/groonabackend.js`)

The `groonabackend.js` file acts as a **Frontend SDK**.

- **Axios Instance**: Configured with interceptors to automatically attach the `JWT Token` to every request.
- **Generic Entity Handlers**: Uses `createEntityHandler('EntityName')` to provide standardized `list`, `create`, `update`, and `delete` methods for all backend models.
- **AI & Integrations**: Provides specialized methods for interacting with Gemini AI, file uploads, and specific business functions.

---

## 📡 Real-time Engine

Socket.io integration allows for live updates:
- **Project Broadcasts**: When a task or project changes, an event is sent to the backend and broadcast back to all users in that tenant's "room".
- **Refetching**: Frontend components listen for these events and trigger `queryClient.invalidateQueries` to refresh data automatically without a page reload.

---

## 🎨 Styling & UI Components

- **Tailwind CSS**: Used for all styling via utility classes.
- **Component Pattern**: Follows the Shadcn UI approach where atomic components (buttons, dialogs, inputs) are kept in `src/components/ui/` and then composed into larger business components.

---

*For detailed implementation details of a specific module, refer to the code comments within the respective directory.*
