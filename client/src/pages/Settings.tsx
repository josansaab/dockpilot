import React from "react";
import Layout from "@/components/layout/Layout";
import { 
  User, 
  Shield, 
  Globe, 
  Palette, 
  Bell, 
  HardDrive, 
  Terminal,
  Save
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";

export default function Settings() {
  const { toast } = useToast();

  const handleSave = () => {
    toast({
      title: "Settings Saved",
      description: "Your preferences have been updated successfully.",
      className: "border-green-500/50 text-green-500"
    });
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
                  <Input id="server-name" defaultValue="DockPilot-Home" className="bg-background/50 border-white/10" />
                  <p className="text-xs text-muted-foreground">This name will be displayed on your dashboard.</p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="port">Web Interface Port</Label>
                  <Input id="port" defaultValue="8080" className="bg-background/50 border-white/10" />
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
                <Switch checked={true} />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Auto-Update Containers</Label>
                  <p className="text-xs text-muted-foreground">Check and update containers automatically (Watchtower)</p>
                </div>
                <Switch />
              </div>

               <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Analytics</Label>
                  <p className="text-xs text-muted-foreground">Share anonymous usage statistics</p>
                </div>
                <Switch checked={true} />
              </div>
            </div>

            <div className="pt-6 flex justify-end">
              <Button onClick={handleSave} className="gap-2">
                <Save className="w-4 h-4" /> Save Changes
              </Button>
            </div>

          </div>
        </div>
      </div>
    </Layout>
  );
}
