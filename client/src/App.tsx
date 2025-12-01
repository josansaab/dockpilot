import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import AppStore from "@/pages/AppStore";
import FileManager from "@/pages/FileManager";
import Settings from "@/pages/Settings";
import Login from "@/pages/Login";
import Setup from "@/pages/Setup";
import { Loader2 } from "lucide-react";

interface SessionData {
  authenticated: boolean;
  setupRequired: boolean;
  user?: { id: string; username: string };
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/store" component={AppStore} />
      <Route path="/files" component={FileManager} />
      <Route path="/settings" component={Settings} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthGate() {
  const { data: session, isLoading, refetch } = useQuery<SessionData>({
    queryKey: ["session"],
    queryFn: async () => {
      const response = await fetch("/api/auth/session", {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to check session");
      }
      return response.json();
    },
    retry: false,
    staleTime: 30000,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (session?.setupRequired) {
    return <Setup onSuccess={() => refetch()} />;
  }

  if (!session?.authenticated) {
    return <Login onSuccess={() => refetch()} />;
  }

  return <Router />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <AuthGate />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
