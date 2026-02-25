import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './queryClient';
import { TooltipProvider } from "@/components/ui/tooltip";
// FIX: Use only one Toaster (Sonner) and configure it globally
import { Toaster } from "@/components/ui/sonner";
import { UserProvider } from "@/components/shared/UserContext";
import Pages from "@/pages/Index.jsx";
import TenantGuard from "@/components/shared/TenantGuard";

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter>
          <UserProvider>
            <TenantGuard>
              <Pages />
            </TenantGuard>
            {/* FIX: Position top-right to match your preference, remove duplicate bottom-right */}
            <Toaster position="top-right" richColors closeButton />
          </UserProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
