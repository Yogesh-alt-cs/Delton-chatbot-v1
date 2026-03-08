import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { SplashScreen } from "@/components/SplashScreen";
import { AnimatePresence } from "framer-motion";

import Welcome from "@/pages/Welcome";
import Auth from "@/pages/Auth";

const Chat = lazy(() => import("@/pages/Chat"));
const History = lazy(() => import("@/pages/History"));
const Settings = lazy(() => import("@/pages/Settings"));
const Profile = lazy(() => import("@/pages/Profile"));
const ProfileEdit = lazy(() => import("@/pages/ProfileEdit"));
const ForgotPassword = lazy(() => import("@/pages/ForgotPassword"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));
import NotFound from "@/pages/NotFound";

const LazyFallback = () => null;

const queryClient = new QueryClient();

function AppRoutes() {
  const { loading } = useAuth();

  return (
    <>
      <AnimatePresence>{loading && <SplashScreen />}</AnimatePresence>
      {!loading && (
        <Suspense fallback={<LazyFallback />}>
          <Routes>
                {/* Public routes */}
                <Route path="/" element={<Welcome />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />

                {/* Protected routes */}
                <Route path="/chat" element={<AuthGuard><Chat /></AuthGuard>} />
                <Route path="/chat/:conversationId" element={<AuthGuard><Chat /></AuthGuard>} />
                <Route path="/history" element={<AuthGuard><History /></AuthGuard>} />
                <Route path="/settings" element={<AuthGuard><Settings /></AuthGuard>} />
                <Route path="/profile" element={<AuthGuard><Profile /></AuthGuard>} />
                <Route path="/profile/edit" element={<AuthGuard><ProfileEdit /></AuthGuard>} />

                {/* 404 */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
