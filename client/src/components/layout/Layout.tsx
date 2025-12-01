import React from "react";
import { Link, useLocation } from "wouter";
import { 
  LayoutGrid, 
  ShoppingBag, 
  FolderOpen, 
  Settings,
  Cpu,
  HardDrive,
  Wifi
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  // CasaOS style: Clean, top bar with time, simple icons
  const navItems = [
    { icon: LayoutGrid, label: "Dashboard", href: "/" },
    { icon: ShoppingBag, label: "App Store", href: "/store" },
    { icon: FolderOpen, label: "Files", href: "/files" },
    { icon: Settings, label: "Settings", href: "/settings" },
  ];

  return (
    <div className="min-h-screen w-full bg-background text-foreground flex flex-col">
      
      {/* Top Bar / Status Bar */}
      <header className="h-16 px-6 flex items-center justify-between bg-card/50 backdrop-blur-xl border-b border-border/50 sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="font-display font-bold text-xl tracking-tight bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">
            DockPilot
          </div>
          <div className="h-6 w-px bg-border/50 mx-2"></div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground hidden md:flex">
             <div className="flex items-center gap-2">
               <Cpu className="w-3 h-3" />
               <span>CPU 12%</span>
             </div>
             <div className="flex items-center gap-2">
               <HardDrive className="w-3 h-3" />
               <span>RAM 45%</span>
             </div>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <nav className="flex items-center bg-secondary/30 rounded-full p-1 backdrop-blur-md border border-white/5">
            {navItems.map((item) => {
              const isActive = location === item.href;
              return (
                <Link key={item.href} href={item.href}>
                  <span className={cn(
                    "flex items-center gap-2 px-4 py-1.5 rounded-full transition-all duration-200 text-sm font-medium cursor-pointer",
                    isActive 
                      ? "bg-background text-primary shadow-sm" 
                      : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                  )}>
                    <item.icon className="w-4 h-4" />
                    <span className="hidden md:inline">{item.label}</span>
                  </span>
                </Link>
              );
            })}
          </nav>
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 ring-2 ring-background"></div>
        </div>
      </header>

      {/* Wallpaper Background Effect */}
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-500/20 via-background to-background pointer-events-none"></div>
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-pink-500/10 via-background to-background pointer-events-none"></div>

      {/* Main Content */}
      <main className="flex-1 container mx-auto p-6 md:p-8 max-w-7xl animate-in fade-in duration-500">
        {children}
      </main>
    </div>
  );
}
