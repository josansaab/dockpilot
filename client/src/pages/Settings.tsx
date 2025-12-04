import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Layout from "@/components/layout/Layout";
import { 
  User, 
  Shield, 
  Globe, 
  Palette, 
  Bell, 
  Terminal as TerminalIcon,
  Save,
  LogOut,
  Key,
  Lock,
  Wifi,
  Moon,
  Sun,
  Monitor,
  Mail,
  MessageSquare,
  RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { settingsApi } from "@/lib/api";

type SettingsTab = "general" | "security" | "network" | "appearance" | "notifications" | "terminal";

const tabs = [
  { id: "general" as const, icon: User, label: "General" },
  { id: "security" as const, icon: Shield, label: "Security" },
  { id: "network" as const, icon: Globe, label: "Network" },
  { id: "appearance" as const, icon: Palette, label: "Appearance" },
  { id: "notifications" as const, icon: Bell, label: "Notifications" },
  { id: "terminal" as const, icon: TerminalIcon, label: "Terminal" },
];

export default function Settings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  
  const [serverName, setServerName] = useState("");
  const [port, setPort] = useState(8080);
  const [startOnBoot, setStartOnBoot] = useState(true);
  const [autoUpdate, setAutoUpdate] = useState(false);
  const [analytics, setAnalytics] = useState(true);

  // Security settings
  const [sessionTimeout, setSessionTimeout] = useState(30);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [loginNotifications, setLoginNotifications] = useState(true);

  // Network settings  
  const [proxyEnabled, setProxyEnabled] = useState(false);
  const [proxyHost, setProxyHost] = useState("");
  const [proxyPort, setProxyPort] = useState(3128);
  const [sslEnabled, setSslEnabled] = useState(false);

  // Appearance settings
  const [theme, setTheme] = useState<"dark" | "light" | "system">("dark");
  const [accentColor, setAccentColor] = useState("blue");
  const [compactMode, setCompactMode] = useState(false);

  // Notification settings
  const [emailNotifications, setEmailNotifications] = useState(false);
  const [containerAlerts, setContainerAlerts] = useState(true);
  const [updateNotifications, setUpdateNotifications] = useState(true);
  const [diskSpaceWarning, setDiskSpaceWarning] = useState(true);

  // Terminal settings
  const [terminalFontSize, setTerminalFontSize] = useState(14);
  const [terminalScrollback, setTerminalScrollback] = useState(1000);
  const [terminalCursorBlink, setTerminalCursorBlink] = useState(true);

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

  const renderGeneralTab = () => (
    <>
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
    </>
  );

  const renderSecurityTab = () => (
    <>
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Authentication</h2>
        <Separator className="bg-white/10" />
        
        <div className="grid gap-4 pt-2">
          <div className="grid gap-2">
            <Label htmlFor="session-timeout">Session Timeout (minutes)</Label>
            <Input 
              id="session-timeout" 
              type="number"
              value={sessionTimeout}
              onChange={(e) => setSessionTimeout(parseInt(e.target.value) || 30)}
              className="bg-background/50 border-white/10" 
              data-testid="input-session-timeout"
            />
            <p className="text-xs text-muted-foreground">Automatically log out after inactivity</p>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-muted-foreground" />
                <Label>Two-Factor Authentication</Label>
              </div>
              <p className="text-xs text-muted-foreground">Add an extra layer of security to your account</p>
            </div>
            <Switch 
              checked={twoFactorEnabled} 
              onCheckedChange={setTwoFactorEnabled}
              data-testid="switch-2fa"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-muted-foreground" />
                <Label>Login Notifications</Label>
              </div>
              <p className="text-xs text-muted-foreground">Get notified when someone logs into your account</p>
            </div>
            <Switch 
              checked={loginNotifications} 
              onCheckedChange={setLoginNotifications}
              data-testid="switch-login-notify"
            />
          </div>
        </div>
      </div>

      <div className="space-y-4 pt-6">
        <h2 className="text-xl font-semibold">Password</h2>
        <Separator className="bg-white/10" />
        
        <div className="grid gap-4 pt-2">
          <div className="grid gap-2">
            <Label htmlFor="current-password">Current Password</Label>
            <Input 
              id="current-password" 
              type="password"
              placeholder="Enter current password"
              className="bg-background/50 border-white/10" 
              data-testid="input-current-password"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="new-password">New Password</Label>
            <Input 
              id="new-password" 
              type="password"
              placeholder="Enter new password"
              className="bg-background/50 border-white/10" 
              data-testid="input-new-password"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="confirm-password">Confirm New Password</Label>
            <Input 
              id="confirm-password" 
              type="password"
              placeholder="Confirm new password"
              className="bg-background/50 border-white/10" 
              data-testid="input-confirm-password"
            />
          </div>

          <Button className="w-fit gap-2" data-testid="button-change-password">
            <Lock className="w-4 h-4" /> Change Password
          </Button>
        </div>
      </div>

      <div className="pt-6 flex justify-end">
        <Button 
          onClick={handleSave} 
          className="gap-2"
          disabled={saveMutation.isPending}
          data-testid="button-save-security"
        >
          <Save className="w-4 h-4" /> Save Changes
        </Button>
      </div>
    </>
  );

  const renderNetworkTab = () => (
    <>
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Proxy Configuration</h2>
        <Separator className="bg-white/10" />
        
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Wifi className="w-4 h-4 text-muted-foreground" />
              <Label>Enable Proxy</Label>
            </div>
            <p className="text-xs text-muted-foreground">Route Docker traffic through a proxy server</p>
          </div>
          <Switch 
            checked={proxyEnabled} 
            onCheckedChange={setProxyEnabled}
            data-testid="switch-proxy"
          />
        </div>

        {proxyEnabled && (
          <div className="grid gap-4 pt-2 pl-6 border-l-2 border-white/10">
            <div className="grid gap-2">
              <Label htmlFor="proxy-host">Proxy Host</Label>
              <Input 
                id="proxy-host" 
                value={proxyHost}
                onChange={(e) => setProxyHost(e.target.value)}
                placeholder="proxy.example.com"
                className="bg-background/50 border-white/10" 
                data-testid="input-proxy-host"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="proxy-port">Proxy Port</Label>
              <Input 
                id="proxy-port" 
                type="number"
                value={proxyPort}
                onChange={(e) => setProxyPort(parseInt(e.target.value) || 3128)}
                className="bg-background/50 border-white/10" 
                data-testid="input-proxy-port"
              />
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4 pt-6">
        <h2 className="text-xl font-semibold">SSL/TLS</h2>
        <Separator className="bg-white/10" />
        
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-muted-foreground" />
              <Label>Enable HTTPS</Label>
            </div>
            <p className="text-xs text-muted-foreground">Secure the web interface with SSL/TLS certificates</p>
          </div>
          <Switch 
            checked={sslEnabled} 
            onCheckedChange={setSslEnabled}
            data-testid="switch-ssl"
          />
        </div>

        {sslEnabled && (
          <div className="grid gap-4 pt-2 pl-6 border-l-2 border-white/10">
            <div className="grid gap-2">
              <Label htmlFor="ssl-cert">SSL Certificate Path</Label>
              <Input 
                id="ssl-cert" 
                placeholder="/etc/ssl/certs/dockpilot.crt"
                className="bg-background/50 border-white/10" 
                data-testid="input-ssl-cert"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="ssl-key">SSL Key Path</Label>
              <Input 
                id="ssl-key" 
                placeholder="/etc/ssl/private/dockpilot.key"
                className="bg-background/50 border-white/10" 
                data-testid="input-ssl-key"
              />
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4 pt-6">
        <h2 className="text-xl font-semibold">Docker Socket</h2>
        <Separator className="bg-white/10" />
        
        <div className="grid gap-2">
          <Label htmlFor="docker-socket">Docker Socket Path</Label>
          <Input 
            id="docker-socket" 
            defaultValue="/var/run/docker.sock"
            className="bg-background/50 border-white/10" 
            data-testid="input-docker-socket"
          />
          <p className="text-xs text-muted-foreground">Path to the Docker daemon socket</p>
        </div>
      </div>

      <div className="pt-6 flex justify-end">
        <Button 
          onClick={handleSave} 
          className="gap-2"
          disabled={saveMutation.isPending}
          data-testid="button-save-network"
        >
          <Save className="w-4 h-4" /> Save Changes
        </Button>
      </div>
    </>
  );

  const renderAppearanceTab = () => (
    <>
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Theme</h2>
        <Separator className="bg-white/10" />
        
        <div className="grid gap-4 pt-2">
          <Label>Color Scheme</Label>
          <div className="grid grid-cols-3 gap-3">
            {[
              { id: "dark", icon: Moon, label: "Dark" },
              { id: "light", icon: Sun, label: "Light" },
              { id: "system", icon: Monitor, label: "System" },
            ].map((option) => (
              <button
                key={option.id}
                onClick={() => setTheme(option.id as typeof theme)}
                className={`p-4 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${
                  theme === option.id 
                    ? "border-primary bg-primary/10" 
                    : "border-white/10 hover:border-white/20"
                }`}
                data-testid={`theme-${option.id}`}
              >
                <option.icon className={`w-6 h-6 ${theme === option.id ? "text-primary" : "text-muted-foreground"}`} />
                <span className="text-sm">{option.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-4 pt-6">
        <h2 className="text-xl font-semibold">Accent Color</h2>
        <Separator className="bg-white/10" />
        
        <div className="flex gap-3 pt-2">
          {[
            { id: "blue", color: "bg-blue-500" },
            { id: "green", color: "bg-green-500" },
            { id: "purple", color: "bg-purple-500" },
            { id: "orange", color: "bg-orange-500" },
            { id: "pink", color: "bg-pink-500" },
            { id: "cyan", color: "bg-cyan-500" },
          ].map((option) => (
            <button
              key={option.id}
              onClick={() => setAccentColor(option.id)}
              className={`w-10 h-10 rounded-full ${option.color} transition-all ${
                accentColor === option.id 
                  ? "ring-2 ring-offset-2 ring-offset-background ring-white scale-110" 
                  : "hover:scale-105"
              }`}
              data-testid={`accent-${option.id}`}
            />
          ))}
        </div>
      </div>

      <div className="space-y-4 pt-6">
        <h2 className="text-xl font-semibold">Layout</h2>
        <Separator className="bg-white/10" />
        
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Compact Mode</Label>
            <p className="text-xs text-muted-foreground">Reduce padding and spacing for more content</p>
          </div>
          <Switch 
            checked={compactMode} 
            onCheckedChange={setCompactMode}
            data-testid="switch-compact"
          />
        </div>
      </div>

      <div className="pt-6 flex justify-end">
        <Button 
          onClick={handleSave} 
          className="gap-2"
          disabled={saveMutation.isPending}
          data-testid="button-save-appearance"
        >
          <Save className="w-4 h-4" /> Save Changes
        </Button>
      </div>
    </>
  );

  const renderNotificationsTab = () => (
    <>
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Email Notifications</h2>
        <Separator className="bg-white/10" />
        
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <Label>Enable Email Notifications</Label>
            </div>
            <p className="text-xs text-muted-foreground">Receive important alerts via email</p>
          </div>
          <Switch 
            checked={emailNotifications} 
            onCheckedChange={setEmailNotifications}
            data-testid="switch-email-notify"
          />
        </div>

        {emailNotifications && (
          <div className="grid gap-4 pt-2 pl-6 border-l-2 border-white/10">
            <div className="grid gap-2">
              <Label htmlFor="notify-email">Recipient Email Address</Label>
              <Input 
                id="notify-email" 
                type="email"
                placeholder="alerts@yourdomain.com"
                className="bg-background/50 border-white/10" 
                data-testid="input-notify-email"
              />
              <p className="text-xs text-muted-foreground">Where notifications will be sent</p>
            </div>

            <Separator className="bg-white/5" />

            <h3 className="text-sm font-medium text-muted-foreground">SMTP Server Configuration</h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="smtp-server">SMTP Host</Label>
                <Input 
                  id="smtp-server" 
                  placeholder="smtp.gmail.com"
                  className="bg-background/50 border-white/10" 
                  data-testid="input-smtp-server"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="smtp-port">SMTP Port</Label>
                <Select defaultValue="587">
                  <SelectTrigger className="bg-background/50 border-white/10" data-testid="select-smtp-port">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="25">25 (SMTP)</SelectItem>
                    <SelectItem value="465">465 (SMTPS/SSL)</SelectItem>
                    <SelectItem value="587">587 (STARTTLS)</SelectItem>
                    <SelectItem value="2525">2525 (Alternative)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="smtp-username">SMTP Username</Label>
              <Input 
                id="smtp-username" 
                placeholder="your-email@gmail.com"
                className="bg-background/50 border-white/10" 
                data-testid="input-smtp-username"
              />
              <p className="text-xs text-muted-foreground">Usually your email address</p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="smtp-password">SMTP Password / App Password</Label>
              <Input 
                id="smtp-password" 
                type="password"
                placeholder="••••••••••••••••"
                className="bg-background/50 border-white/10" 
                data-testid="input-smtp-password"
              />
              <p className="text-xs text-muted-foreground">For Gmail, use an App Password (not your regular password)</p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="smtp-from">From Address</Label>
              <Input 
                id="smtp-from" 
                type="email"
                placeholder="dockpilot@yourdomain.com"
                className="bg-background/50 border-white/10" 
                data-testid="input-smtp-from"
              />
              <p className="text-xs text-muted-foreground">Email address shown as sender</p>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="space-y-0.5">
                <Label>Use TLS/SSL Encryption</Label>
                <p className="text-xs text-muted-foreground">Encrypt connection to SMTP server</p>
              </div>
              <Switch 
                defaultChecked={true}
                data-testid="switch-smtp-tls"
              />
            </div>

            <div className="pt-2">
              <Button 
                variant="outline" 
                className="gap-2"
                onClick={() => {
                  toast({
                    title: "Test Email Sent",
                    description: "Check your inbox for the test notification.",
                  });
                }}
                data-testid="button-test-email"
              >
                <Mail className="w-4 h-4" /> Send Test Email
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4 pt-6">
        <h2 className="text-xl font-semibold">Alert Types</h2>
        <Separator className="bg-white/10" />
        
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-muted-foreground" />
              <Label>Container Alerts</Label>
            </div>
            <p className="text-xs text-muted-foreground">Notify when containers stop, crash, or restart</p>
          </div>
          <Switch 
            checked={containerAlerts} 
            onCheckedChange={setContainerAlerts}
            data-testid="switch-container-alerts"
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-muted-foreground" />
              <Label>Update Notifications</Label>
            </div>
            <p className="text-xs text-muted-foreground">Get notified when container updates are available</p>
          </div>
          <Switch 
            checked={updateNotifications} 
            onCheckedChange={setUpdateNotifications}
            data-testid="switch-update-notify"
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Disk Space Warning</Label>
            <p className="text-xs text-muted-foreground">Alert when disk usage exceeds 80%</p>
          </div>
          <Switch 
            checked={diskSpaceWarning} 
            onCheckedChange={setDiskSpaceWarning}
            data-testid="switch-disk-warning"
          />
        </div>
      </div>

      <div className="pt-6 flex justify-end">
        <Button 
          onClick={handleSave} 
          className="gap-2"
          disabled={saveMutation.isPending}
          data-testid="button-save-notifications"
        >
          <Save className="w-4 h-4" /> Save Changes
        </Button>
      </div>
    </>
  );

  const renderTerminalTab = () => (
    <>
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Terminal Settings</h2>
        <Separator className="bg-white/10" />
        
        <div className="grid gap-4 pt-2">
          <div className="grid gap-2">
            <Label htmlFor="font-size">Font Size</Label>
            <Select 
              value={terminalFontSize.toString()} 
              onValueChange={(v) => setTerminalFontSize(parseInt(v))}
            >
              <SelectTrigger className="bg-background/50 border-white/10" data-testid="select-font-size">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="12">12px</SelectItem>
                <SelectItem value="14">14px</SelectItem>
                <SelectItem value="16">16px</SelectItem>
                <SelectItem value="18">18px</SelectItem>
                <SelectItem value="20">20px</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="scrollback">Scrollback Lines</Label>
            <Input 
              id="scrollback" 
              type="number"
              value={terminalScrollback}
              onChange={(e) => setTerminalScrollback(parseInt(e.target.value) || 1000)}
              className="bg-background/50 border-white/10" 
              data-testid="input-scrollback"
            />
            <p className="text-xs text-muted-foreground">Number of lines to keep in terminal history</p>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Cursor Blink</Label>
              <p className="text-xs text-muted-foreground">Enable cursor blinking in terminal</p>
            </div>
            <Switch 
              checked={terminalCursorBlink} 
              onCheckedChange={setTerminalCursorBlink}
              data-testid="switch-cursor-blink"
            />
          </div>
        </div>
      </div>

      <div className="space-y-4 pt-6">
        <h2 className="text-xl font-semibold">Shell</h2>
        <Separator className="bg-white/10" />
        
        <div className="grid gap-2">
          <Label htmlFor="default-shell">Default Shell</Label>
          <Select defaultValue="bash">
            <SelectTrigger className="bg-background/50 border-white/10" data-testid="select-shell">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bash">/bin/bash</SelectItem>
              <SelectItem value="sh">/bin/sh</SelectItem>
              <SelectItem value="zsh">/bin/zsh</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Default shell for container terminals</p>
        </div>
      </div>

      <div className="space-y-4 pt-6">
        <h2 className="text-xl font-semibold">Preview</h2>
        <Separator className="bg-white/10" />
        
        <div 
          className="bg-black rounded-lg p-4 font-mono border border-white/10"
          style={{ fontSize: `${terminalFontSize}px` }}
        >
          <div className="text-green-400">root@dockpilot:~#</div>
          <div className="text-gray-300">docker ps</div>
          <div className="text-gray-500 mt-2">CONTAINER ID   IMAGE          COMMAND   CREATED   STATUS</div>
          <div className="text-gray-300">a1b2c3d4e5f6   nginx:latest   "nginx"   2h ago    Up 2h</div>
          <div className={`inline-block w-2 h-4 bg-white ${terminalCursorBlink ? 'animate-pulse' : ''}`}></div>
        </div>
      </div>

      <div className="pt-6 flex justify-end">
        <Button 
          onClick={handleSave} 
          className="gap-2"
          disabled={saveMutation.isPending}
          data-testid="button-save-terminal"
        >
          <Save className="w-4 h-4" /> Save Changes
        </Button>
      </div>
    </>
  );

  const renderContent = () => {
    switch (activeTab) {
      case "general": return renderGeneralTab();
      case "security": return renderSecurityTab();
      case "network": return renderNetworkTab();
      case "appearance": return renderAppearanceTab();
      case "notifications": return renderNotificationsTab();
      case "terminal": return renderTerminalTab();
      default: return renderGeneralTab();
    }
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
            {tabs.map((item) => (
              <Button 
                key={item.id} 
                variant={activeTab === item.id ? "secondary" : "ghost"} 
                className="w-full justify-start gap-3"
                onClick={() => setActiveTab(item.id)}
                data-testid={`tab-${item.id}`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Button>
            ))}
          </nav>

          {/* Main Content */}
          <div className="space-y-6 bg-card/30 p-6 rounded-2xl border border-white/5 backdrop-blur-sm">
            {renderContent()}
          </div>
        </div>
      </div>
    </Layout>
  );
}
