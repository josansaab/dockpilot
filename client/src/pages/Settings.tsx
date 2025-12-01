import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Layout from "@/components/layout/Layout";
import { 
  User, 
  Shield, 
  Globe, 
  Palette, 
  Bell, 
  Terminal,
  Save,
  LogOut
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { settingsApi } from "@/lib/api";

export default function Settings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [serverName, setServerName] = useState("");
  const [port, setPort] = useState(8080);
  const [startOnBoot, setStartOnBoot] = useState(true);
  const [autoUpdate, setAutoUpdate] = useState(false);
  const [analytics, setAnalytics] = useState(true);

  // Fetch settings
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const response = await settingsApi.get();
      return response.data;
    },
  });

  // Update form when settings load
  useEffect(() => {
    if (settings) {
      setServerName(settings.serverName || "");
      setPort(settings.webPort || 8080);
      setStartOnBoot(!!settings.startOnBoot);
      setAutoUpdate(!!settings.autoUpdate);
      setAnalytics(!!settings.analytics);
    }
  }, [settings]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const response = await settingsApi.update({
        serverName,
        webPort: port,
        startOnBoot: startOnBoot ? 1 : 0,
        autoUpdate: autoUpdate ? 1 : 0,
        analytics: analytics ? 1 : 0,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast({
        title: "Settings Saved",
        description: "Your preferences have been updated successfully.",
        className: "border-green-500/50 text-green-500"
      });
    },
  });

  const handleSave = () => {
    saveMutation.mutate();
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-8 pb-20">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Settings</h1>
          <p className="text-muted-foreground">Manage your DockPilot configuration.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-8">
          {/* Sidebar Navigation */}
          <nav className="space-y-1">
            {[
              { icon: User, label: "General" },
              { icon: Shield, label: "Security" },
              { icon: Globe, label: "Network" },
              { icon: Palette, label: "Appearance" },
              { icon: Bell, label: "Notifications" },
              { icon: Terminal, label: "Terminal" },
            ].map((item, i) => (
              <Button 
                key={item.label} 
                variant={i === 0 ? "secondary" : "ghost"} 
                className="w-full justify-start gap-3"
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Button>
            ))}
          </nav>

          {/* Main Content */}
          <div className="space-y-6 bg-card/30 p-6 rounded-2xl border border-white/5 backdrop-blur-sm">
            
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">General Configuration</h2>
              <Separator className="bg-white/10" />
              
              <div className="grid gap-4 pt-2">
                <div className="grid gap-2">
                  <Label htmlFor="server-name">Server Name</Label>
                  <Input 
                    id="server-name" 
                    value={serverName}
                    onChange={(e) => setServerName(e.target.value)}
                    className="bg-background/50 border-white/10" 
                    data-testid="input-servername"
                  />
                  <p className="text-xs text-muted-foreground">This name will be displayed on your dashboard.</p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="port">Web Interface Port</Label>
                  <Input 
                    id="port" 
                    type="number"
                    value={port}
                    onChange={(e) => setPort(parseInt(e.target.value) || 8080)}
                    className="bg-background/50 border-white/10" 
                    data-testid="input-port"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4 pt-4">
              <h2 className="text-xl font-semibold">System</h2>
              <Separator className="bg-white/10" />
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Start on Boot</Label>
                  <p className="text-xs text-muted-foreground">Automatically start DockPilot when system boots</p>
                </div>
                <Switch 
                  checked={startOnBoot} 
                  onCheckedChange={setStartOnBoot}
                  data-testid="switch-startonboot"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Auto-Update Containers</Label>
                  <p className="text-xs text-muted-foreground">Check and update containers automatically (Watchtower)</p>
                </div>
                <Switch 
                  checked={autoUpdate} 
                  onCheckedChange={setAutoUpdate}
                  data-testid="switch-autoupdate"
                />
              </div>

               <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Analytics</Label>
                  <p className="text-xs text-muted-foreground">Share anonymous usage statistics</p>
                </div>
                <Switch 
                  checked={analytics} 
                  onCheckedChange={setAnalytics}
                  data-testid="switch-analytics"
                />
              </div>
            </div>

            <div className="pt-6 flex justify-end">
              <Button 
                onClick={handleSave} 
                className="gap-2"
                disabled={saveMutation.isPending}
                data-testid="button-save"
              >
                <Save className="w-4 h-4" /> {saveMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>

            <div className="space-y-4 pt-8">
              <h2 className="text-xl font-semibold text-red-400">Danger Zone</h2>
              <Separator className="bg-red-500/20" />
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Sign Out</Label>
                  <p className="text-xs text-muted-foreground">Log out of your DockPilot account</p>
                </div>
                <Button 
                  variant="destructive"
                  onClick={async () => {
                    try {
                      await fetch("/api/auth/logout", { 
                        method: "POST",
                        credentials: "include" 
                      });
                      queryClient.invalidateQueries({ queryKey: ["session"] });
                      window.location.reload();
                    } catch (error) {
                      toast({
                        title: "Logout Failed",
                        description: "Please try again.",
                        variant: "destructive"
                      });
                    }
                  }}
                  className="gap-2"
                  data-testid="button-logout"
                >
                  <LogOut className="w-4 h-4" /> Sign Out
                </Button>
              </div>
            </div>

          </div>
        </div>
      </div>
    </Layout>
  );
}
