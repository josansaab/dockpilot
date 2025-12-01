import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import AppStore from "@/pages/AppStore";
import Images from "@/pages/Images";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/store" component={AppStore} />
      <Route path="/files" component={Images} /> {/* Reusing Images page as Files placeholder for now */}
      <Route path="/settings" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
