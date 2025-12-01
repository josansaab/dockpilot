import React from "react";
import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Box, 
  Layers, 
  Settings, 
  Terminal, 
  Activity 
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/" },
    { icon: Box, label: "Containers", href: "/containers" },
    { icon: Layers, label: "Images", href: "/images" },
    // { icon: Terminal, label: "Logs", href: "/logs" },
    // { icon: Settings, label: "Settings", href: "/settings" },
  ];

  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card flex flex-col">
        <div className="p-6 flex items-center gap-3 border-b border-border/50">
          <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-primary-foreground font-bold">
            DP
          </div>
          <span className="font-display font-bold text-lg tracking-tight">DockPilot</span>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <a className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-md transition-all duration-200 group",
                  isActive 
                    ? "bg-primary/10 text-primary font-medium" 
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}>
                  <item.icon className={cn("w-5 h-5", isActive ? "text-primary" : "group-hover:text-foreground")} />
                  <span>{item.label}</span>
                  {isActive && (
                    <Activity className="w-4 h-4 ml-auto animate-pulse text-primary/50" />
                  )}
                </a>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border/50 text-xs text-muted-foreground font-mono">
          <div className="flex justify-between mb-1">
            <span>Docker Engine</span>
            <span className="text-green-500">v24.0.6</span>
          </div>
          <div className="flex justify-between">
            <span>API Version</span>
            <span>1.43</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Header/Top Bar can go here if needed */}
        <div className="flex-1 overflow-y-auto scrollbar-hide p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
