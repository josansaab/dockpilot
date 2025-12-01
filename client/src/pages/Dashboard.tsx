import React, { useState, useEffect } from "react";
import Layout from "@/components/layout/Layout";
import { MOCK_CONTAINERS } from "@/data/mockDocker";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  MoreHorizontal, 
  Power, 
  ExternalLink, 
  Settings, 
  Trash2,
  HardDrive 
} from "lucide-react";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

export default function Dashboard() {
  const [containers, setContainers] = useState(MOCK_CONTAINERS);
  const [currentTime, setCurrentTime] = useState(new Date());
  const { toast } = useToast();

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const toggleState = (id: string, currentState: string) => {
    const newState = currentState === 'running' ? 'stopped' : 'running';
    setContainers(prev => prev.map(c => c.id === id ? { ...c, state: newState } : c));
    
    toast({
      title: newState === 'running' ? "Service Started" : "Service Stopped",
      description: `${newState === 'running' ? 'Started' : 'Stopped'} container successfully.`,
      className: newState === 'running' ? "border-green-500/50 text-green-500" : "border-yellow-500/50 text-yellow-500"
    });
  };

  return (
    <Layout>
      {/* Greeting & Time */}
      <div className="flex flex-col items-center justify-center py-12 md:py-16 text-center space-y-4">
        <h1 className="text-6xl md:text-7xl font-light tracking-tighter text-foreground/80">
          {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </h1>
        <p className="text-xl text-muted-foreground font-light">
          {currentTime.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* App Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        {containers.map((app) => (
          <div 
            key={app.id} 
            className="group relative bg-card/40 backdrop-blur-md border border-white/5 hover:bg-card/60 rounded-3xl p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl flex flex-col items-center text-center gap-4"
          >
            {/* Status Indicator Dot */}
            <div className={cn(
              "absolute top-4 right-4 w-3 h-3 rounded-full transition-colors",
              app.state === 'running' ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-red-500"
            )} />

            {/* App Icon */}
            <div className={cn(
              "w-20 h-20 rounded-2xl flex items-center justify-center text-white shadow-lg text-3xl font-bold mb-2 transition-transform group-hover:scale-105",
              app.icon || "bg-slate-700"
            )}>
              {app.name.substring(0, 2)}
            </div>

            {/* App Info */}
            <div className="w-full">
              <h3 className="font-medium text-lg truncate w-full">{app.name}</h3>
              <p className="text-xs text-muted-foreground">{app.category || "System"}</p>
            </div>

            {/* Hover Overlay Actions */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center gap-3 p-4">
              {app.state === 'running' && (
                <Button 
                  className="w-full rounded-full bg-white text-black hover:bg-white/90"
                  onClick={() => window.open(app.url || '#', '_blank')}
                >
                  <ExternalLink className="w-4 h-4 mr-2" /> Open
                </Button>
              )}
              
              <div className="flex gap-2 w-full">
                 <Button 
                   variant="secondary" 
                   size="icon" 
                   className="flex-1 rounded-full bg-white/20 hover:bg-white/30 text-white border-none"
                   onClick={() => toggleState(app.id, app.state)}
                 >
                   <Power className={cn("w-4 h-4", app.state === 'running' ? "text-red-400" : "text-green-400")} />
                 </Button>
                 
                 <DropdownMenu>
                   <DropdownMenuTrigger asChild>
                     <Button variant="secondary" size="icon" className="flex-1 rounded-full bg-white/20 hover:bg-white/30 text-white border-none">
                       <MoreHorizontal className="w-4 h-4" />
                     </Button>
                   </DropdownMenuTrigger>
                   <DropdownMenuContent align="end" className="w-48 rounded-xl">
                     <DropdownMenuItem>
                       <Settings className="w-4 h-4 mr-2" /> Settings
                     </DropdownMenuItem>
                     <DropdownMenuSeparator />
                     <DropdownMenuItem className="text-red-500 focus:text-red-500">
                       <Trash2 className="w-4 h-4 mr-2" /> Uninstall
                     </DropdownMenuItem>
                   </DropdownMenuContent>
                 </DropdownMenu>
              </div>
            </div>
          </div>
        ))}

        {/* Add App Button */}
        <a href="/store" className="group flex flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed border-white/10 p-6 transition-all hover:border-white/20 hover:bg-white/5">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/5 text-white/50 transition-colors group-hover:bg-white/10 group-hover:text-white">
            <span className="text-4xl font-light">+</span>
          </div>
          <span className="font-medium text-muted-foreground group-hover:text-foreground">Add App</span>
        </a>
      </div>
      
      {/* System Widgets Bottom */}
      <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
         <div className="bg-card/30 rounded-2xl p-6 border border-white/5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">
               <HardDrive className="w-6 h-6" />
            </div>
            <div>
               <h4 className="text-sm font-medium text-muted-foreground">Storage</h4>
               <div className="text-xl font-bold">245 GB <span className="text-sm text-muted-foreground font-normal">/ 512 GB</span></div>
               <div className="w-32 h-1.5 bg-white/10 rounded-full mt-2 overflow-hidden">
                  <div className="h-full bg-blue-500 w-[45%]"></div>
               </div>
            </div>
         </div>
      </div>
    </Layout>
  );
}
