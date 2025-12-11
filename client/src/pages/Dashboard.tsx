import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Layout from "@/components/layout/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { 
  MoreHorizontal, 
  Power, 
  ExternalLink, 
  Settings, 
  Trash2,
  HardDrive,
  Save,
  X,
  FolderOpen,
  Network,
  Terminal,
  Plus,
  Minus
} from "lucide-react";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { appApi, containerApi } from "@/lib/api";

interface AppSettings {
  id: string;
  name: string;
  containerId: string | null;
  ports: { container: number; host: number }[];
  environment: Record<string, string>;
  volumes: { host: string; container: string }[];
  autoRestart: boolean;
  networkMode: string;
}

export default function Dashboard() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [selectedApp, setSelectedApp] = useState<any | null>(null);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch installed apps
  const { data: apps = [] } = useQuery({
    queryKey: ['apps'],
    queryFn: async () => {
      const response = await appApi.list();
      return Array.isArray(response.data) ? response.data : [];
    },
  });

  // Update app status mutation
  const updateAppMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await appApi.update(id, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apps'] });
    },
  });

  // Uninstall app mutation
  const uninstallMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await appApi.uninstall(id);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apps'] });
      toast({
        title: "App Uninstalled",
        description: "The application has been removed successfully.",
        className: "border-green-500/50 text-green-500"
      });
    },
  });

  const toggleState = async (id: string, containerId: string | null, currentStatus: string) => {
    if (!containerId) return;

    try {
      if (currentStatus === 'running') {
        await containerApi.stop(containerId);
        await updateAppMutation.mutateAsync({ id, data: { status: 'stopped' } });
        toast({
          title: "Service Stopped",
          description: "Container stopped successfully.",
          className: "border-yellow-500/50 text-yellow-500"
        });
      } else {
        await containerApi.start(containerId);
        await updateAppMutation.mutateAsync({ id, data: { status: 'running' } });
        toast({
          title: "Service Started",
          description: "Container started successfully.",
          className: "border-green-500/50 text-green-500"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to toggle container state.",
        variant: "destructive"
      });
    }
  };

  const openAppSettings = (app: any) => {
    setSelectedApp(app);
    setAppSettings({
      id: app.id,
      name: app.name,
      containerId: app.containerId,
      ports: app.ports || [],
      environment: app.environment || {},
      volumes: app.volumes || [],
      autoRestart: true,
      networkMode: 'bridge',
    });
    setSettingsDialogOpen(true);
  };

  const saveAppSettings = async () => {
    if (!appSettings) return;

    try {
      await updateAppMutation.mutateAsync({ 
        id: appSettings.id, 
        data: {
          ports: appSettings.ports,
          environment: appSettings.environment,
          volumes: appSettings.volumes,
        }
      });
      setSettingsDialogOpen(false);
      toast({
        title: "Settings Saved",
        description: "App configuration has been updated.",
        className: "border-green-500/50 text-green-500"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save settings.",
        variant: "destructive"
      });
    }
  };

  const addPortMapping = () => {
    if (!appSettings) return;
    setAppSettings({
      ...appSettings,
      ports: [...appSettings.ports, { container: 80, host: 8080 }]
    });
  };

  const removePortMapping = (index: number) => {
    if (!appSettings) return;
    setAppSettings({
      ...appSettings,
      ports: appSettings.ports.filter((_, i) => i !== index)
    });
  };

  const addVolumeMapping = () => {
    if (!appSettings) return;
    setAppSettings({
      ...appSettings,
      volumes: [...appSettings.volumes, { host: '/opt/dockpilot/data', container: '/data' }]
    });
  };

  const removeVolumeMapping = (index: number) => {
    if (!appSettings) return;
    setAppSettings({
      ...appSettings,
      volumes: appSettings.volumes.filter((_, i) => i !== index)
    });
  };

  const addEnvVariable = () => {
    if (!appSettings) return;
    const key = `VAR_${Object.keys(appSettings.environment).length + 1}`;
    setAppSettings({
      ...appSettings,
      environment: { ...appSettings.environment, [key]: '' }
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
        {apps.map((app: any) => (
          <div 
            key={app.id} 
            className="group relative bg-card/40 backdrop-blur-md border border-white/5 hover:bg-card/60 rounded-3xl p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl flex flex-col items-center text-center gap-4"
            data-testid={`app-tile-${app.id}`}
          >
            {/* Status Indicator Dot */}
            <div className={cn(
              "absolute top-4 right-4 w-3 h-3 rounded-full transition-colors",
              app.status === 'running' ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-red-500"
            )} data-testid={`app-status-${app.id}`} />

            {/* App Icon */}
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center bg-white/10 shadow-lg mb-2 transition-transform group-hover:scale-105 overflow-hidden p-3">
              {app.iconColor?.startsWith('http') ? (
                <img 
                  src={app.iconColor} 
                  alt={app.name} 
                  className="w-full h-full object-contain"
                />
              ) : (
                <span className="text-3xl font-bold text-white">{app.name.substring(0, 2)}</span>
              )}
            </div>

            {/* App Info */}
            <div className="w-full">
              <h3 className="font-medium text-lg truncate w-full" data-testid={`app-name-${app.id}`}>{app.name}</h3>
              <p className="text-xs text-muted-foreground">{app.category || "System"}</p>
            </div>

            {/* Hover Overlay Actions */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center gap-3 p-4">
              {app.status === 'running' && app.ports && app.ports.length > 0 && (
                <Button 
                  className="w-full rounded-full bg-white text-black hover:bg-white/90"
                  onClick={() => window.open(`http://localhost:${app.ports[0].host}`, '_blank')}
                  data-testid={`button-open-${app.id}`}
                >
                  <ExternalLink className="w-4 h-4 mr-2" /> Open
                </Button>
              )}
              
              <div className="flex gap-2 w-full">
                 <Button 
                   variant="secondary" 
                   size="icon" 
                   className="flex-1 rounded-full bg-white/20 hover:bg-white/30 text-white border-none"
                   onClick={() => toggleState(app.id, app.containerId, app.status)}
                   data-testid={`button-power-${app.id}`}
                 >
                   <Power className={cn("w-4 h-4", app.status === 'running' ? "text-red-400" : "text-green-400")} />
                 </Button>
                 
                 <DropdownMenu>
                   <DropdownMenuTrigger asChild>
                     <Button variant="secondary" size="icon" className="flex-1 rounded-full bg-white/20 hover:bg-white/30 text-white border-none" data-testid={`button-menu-${app.id}`}>
                       <MoreHorizontal className="w-4 h-4" />
                     </Button>
                   </DropdownMenuTrigger>
                   <DropdownMenuContent align="end" className="w-48 rounded-xl">
                     <DropdownMenuItem onClick={() => openAppSettings(app)} data-testid={`button-settings-${app.id}`}>
                       <Settings className="w-4 h-4 mr-2" /> Settings
                     </DropdownMenuItem>
                     <DropdownMenuSeparator />
                     <DropdownMenuItem 
                       className="text-red-500 focus:text-red-500"
                       onClick={() => uninstallMutation.mutate(app.id)}
                       data-testid={`button-uninstall-${app.id}`}
                     >
                       <Trash2 className="w-4 h-4 mr-2" /> Uninstall
                     </DropdownMenuItem>
                   </DropdownMenuContent>
                 </DropdownMenu>
              </div>
            </div>
          </div>
        ))}

        {/* Add App Button */}
        <a href="/store" className="group flex flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed border-white/10 p-6 transition-all hover:border-white/20 hover:bg-white/5" data-testid="button-add-app">
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
               <h4 className="text-sm font-medium text-muted-foreground">Installed Apps</h4>
               <div className="text-xl font-bold">{apps.length} <span className="text-sm text-muted-foreground font-normal">apps</span></div>
            </div>
         </div>
      </div>

      {/* App Settings Dialog */}
      <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              {selectedApp?.name} Settings
            </DialogTitle>
            <DialogDescription>
              Configure container settings, ports, volumes, and environment variables.
            </DialogDescription>
          </DialogHeader>

          {appSettings && (
            <div className="space-y-6 py-4">
              {/* Network Settings */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Network className="w-4 h-4 text-muted-foreground" />
                  <h3 className="font-semibold">Network</h3>
                </div>
                <Separator />

                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label>Network Mode</Label>
                    <Select 
                      value={appSettings.networkMode} 
                      onValueChange={(v) => setAppSettings({...appSettings, networkMode: v})}
                    >
                      <SelectTrigger data-testid="select-network-mode">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bridge">Bridge (Default)</SelectItem>
                        <SelectItem value="host">Host</SelectItem>
                        <SelectItem value="none">None</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Port Mappings</Label>
                      <Button variant="outline" size="sm" onClick={addPortMapping} data-testid="button-add-port">
                        <Plus className="w-3 h-3 mr-1" /> Add Port
                      </Button>
                    </div>
                    
                    {appSettings.ports.map((port, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Input 
                          type="number"
                          value={port.host}
                          onChange={(e) => {
                            const newPorts = [...appSettings.ports];
                            newPorts[index].host = parseInt(e.target.value) || 0;
                            setAppSettings({...appSettings, ports: newPorts});
                          }}
                          placeholder="Host Port"
                          className="flex-1"
                          data-testid={`input-host-port-${index}`}
                        />
                        <span className="text-muted-foreground">:</span>
                        <Input 
                          type="number"
                          value={port.container}
                          onChange={(e) => {
                            const newPorts = [...appSettings.ports];
                            newPorts[index].container = parseInt(e.target.value) || 0;
                            setAppSettings({...appSettings, ports: newPorts});
                          }}
                          placeholder="Container Port"
                          className="flex-1"
                          data-testid={`input-container-port-${index}`}
                        />
                        <Button variant="ghost" size="icon" onClick={() => removePortMapping(index)} data-testid={`button-remove-port-${index}`}>
                          <Minus className="w-4 h-4 text-red-400" />
                        </Button>
                      </div>
                    ))}

                    {appSettings.ports.length === 0 && (
                      <p className="text-sm text-muted-foreground">No port mappings configured</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Storage Settings */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-muted-foreground" />
                  <h3 className="font-semibold">Storage</h3>
                </div>
                <Separator />

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Volume Mappings</Label>
                    <Button variant="outline" size="sm" onClick={addVolumeMapping} data-testid="button-add-volume">
                      <Plus className="w-3 h-3 mr-1" /> Add Volume
                    </Button>
                  </div>
                  
                  {appSettings.volumes.map((vol, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input 
                        value={vol.host}
                        onChange={(e) => {
                          const newVols = [...appSettings.volumes];
                          newVols[index].host = e.target.value;
                          setAppSettings({...appSettings, volumes: newVols});
                        }}
                        placeholder="Host Path"
                        className="flex-1"
                        data-testid={`input-host-volume-${index}`}
                      />
                      <span className="text-muted-foreground">:</span>
                      <Input 
                        value={vol.container}
                        onChange={(e) => {
                          const newVols = [...appSettings.volumes];
                          newVols[index].container = e.target.value;
                          setAppSettings({...appSettings, volumes: newVols});
                        }}
                        placeholder="Container Path"
                        className="flex-1"
                        data-testid={`input-container-volume-${index}`}
                      />
                      <Button variant="ghost" size="icon" onClick={() => removeVolumeMapping(index)} data-testid={`button-remove-volume-${index}`}>
                        <Minus className="w-4 h-4 text-red-400" />
                      </Button>
                    </div>
                  ))}

                  {appSettings.volumes.length === 0 && (
                    <p className="text-sm text-muted-foreground">No volume mappings configured</p>
                  )}
                </div>
              </div>

              {/* Environment Variables */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-muted-foreground" />
                  <h3 className="font-semibold">Environment Variables</h3>
                </div>
                <Separator />

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Variables</Label>
                    <Button variant="outline" size="sm" onClick={addEnvVariable} data-testid="button-add-env">
                      <Plus className="w-3 h-3 mr-1" /> Add Variable
                    </Button>
                  </div>
                  
                  {Object.entries(appSettings.environment).map(([key, value], index) => (
                    <div key={key} className="flex items-center gap-2">
                      <Input 
                        value={key}
                        onChange={(e) => {
                          const newEnv = {...appSettings.environment};
                          delete newEnv[key];
                          newEnv[e.target.value] = value;
                          setAppSettings({...appSettings, environment: newEnv});
                        }}
                        placeholder="Variable Name"
                        className="flex-1"
                        data-testid={`input-env-key-${index}`}
                      />
                      <span className="text-muted-foreground">=</span>
                      <Input 
                        value={value}
                        onChange={(e) => {
                          const newEnv = {...appSettings.environment};
                          newEnv[key] = e.target.value;
                          setAppSettings({...appSettings, environment: newEnv});
                        }}
                        placeholder="Value"
                        className="flex-1"
                        data-testid={`input-env-value-${index}`}
                      />
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => {
                          const newEnv = {...appSettings.environment};
                          delete newEnv[key];
                          setAppSettings({...appSettings, environment: newEnv});
                        }} 
                        data-testid={`button-remove-env-${index}`}
                      >
                        <Minus className="w-4 h-4 text-red-400" />
                      </Button>
                    </div>
                  ))}

                  {Object.keys(appSettings.environment).length === 0 && (
                    <p className="text-sm text-muted-foreground">No environment variables configured</p>
                  )}
                </div>
              </div>

              {/* Restart Policy */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Auto-Restart</Label>
                    <p className="text-xs text-muted-foreground">Automatically restart container if it stops</p>
                  </div>
                  <Switch 
                    checked={appSettings.autoRestart} 
                    onCheckedChange={(v) => setAppSettings({...appSettings, autoRestart: v})}
                    data-testid="switch-auto-restart"
                  />
                </div>
              </div>

              {/* Terminal Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-muted-foreground" />
                  <h3 className="font-semibold">Container Terminal</h3>
                </div>
                <Separator />

                {selectedApp?.status === 'running' && selectedApp?.containerId ? (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Run commands inside the container for troubleshooting, configuration, or maintenance.
                    </p>

                    <div className="grid grid-cols-2 gap-2">
                      <Button 
                        variant="outline" 
                        className="justify-start gap-2"
                        onClick={() => {
                          const cmd = `docker exec -it ${selectedApp.containerId} /bin/bash`;
                          navigator.clipboard.writeText(cmd);
                          toast({
                            title: "Command Copied",
                            description: "Paste in your terminal to open a shell",
                          });
                        }}
                        data-testid="button-copy-bash"
                      >
                        <Terminal className="w-4 h-4" /> Copy Bash Command
                      </Button>
                      <Button 
                        variant="outline"
                        className="justify-start gap-2"
                        onClick={() => {
                          const cmd = `docker exec -it ${selectedApp.containerId} /bin/sh`;
                          navigator.clipboard.writeText(cmd);
                          toast({
                            title: "Command Copied",
                            description: "Paste in your terminal to open a shell",
                          });
                        }}
                        data-testid="button-copy-sh"
                      >
                        <Terminal className="w-4 h-4" /> Copy Shell Command
                      </Button>
                    </div>

                    <div className="bg-black rounded-lg p-4 font-mono text-sm border border-white/10">
                      <p className="text-green-400 mb-2"># Quick commands for {selectedApp.name}:</p>
                      <p className="text-gray-400">docker exec -it {selectedApp.containerId?.substring(0, 12)} /bin/bash</p>
                      <p className="text-gray-400">docker logs {selectedApp.containerId?.substring(0, 12)} --tail 100</p>
                      <p className="text-gray-400">docker inspect {selectedApp.containerId?.substring(0, 12)}</p>
                    </div>

                    <div className="grid gap-2">
                      <Label>Run Command</Label>
                      <div className="flex gap-2">
                        <Input 
                          id="terminal-command"
                          placeholder="Enter command (e.g., ls -la, cat /etc/passwd)"
                          className="flex-1 font-mono bg-background/50 border-white/10"
                          data-testid="input-terminal-command"
                          onKeyDown={async (e) => {
                            if (e.key === 'Enter') {
                              const input = e.currentTarget;
                              const command = input.value;
                              if (!command) return;
                              
                              try {
                                const response = await fetch(`/api/containers/${selectedApp.containerId}/exec`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  credentials: 'include',
                                  body: JSON.stringify({ command }),
                                });
                                const result = await response.json();
                                
                                const outputEl = document.getElementById('terminal-output');
                                if (outputEl) {
                                  outputEl.textContent = result.output || result.error || 'Command executed';
                                }
                                input.value = '';
                              } catch (error) {
                                toast({
                                  title: "Command Failed",
                                  description: "Could not execute command",
                                  variant: "destructive"
                                });
                              }
                            }
                          }}
                        />
                        <Button 
                          variant="secondary"
                          onClick={async () => {
                            const input = document.getElementById('terminal-command') as HTMLInputElement;
                            const command = input?.value;
                            if (!command) return;
                            
                            try {
                              const response = await fetch(`/api/containers/${selectedApp.containerId}/exec`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                credentials: 'include',
                                body: JSON.stringify({ command }),
                              });
                              const result = await response.json();
                              
                              const outputEl = document.getElementById('terminal-output');
                              if (outputEl) {
                                outputEl.textContent = result.output || result.error || 'Command executed';
                              }
                              input.value = '';
                            } catch (error) {
                              toast({
                                title: "Command Failed",
                                description: "Could not execute command",
                                variant: "destructive"
                              });
                            }
                          }}
                          data-testid="button-run-command"
                        >
                          Run
                        </Button>
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <Label>Output</Label>
                      <pre 
                        id="terminal-output"
                        className="bg-black rounded-lg p-4 font-mono text-sm text-gray-300 border border-white/10 min-h-[100px] max-h-[200px] overflow-auto whitespace-pre-wrap"
                      >
                        # Output will appear here...
                      </pre>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Terminal className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Container must be running to use terminal</p>
                    <p className="text-sm">Start the container first, then you can execute commands.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSettingsDialogOpen(false)} data-testid="button-cancel-settings">
              Cancel
            </Button>
            <Button onClick={saveAppSettings} className="gap-2" data-testid="button-save-settings">
              <Save className="w-4 h-4" /> Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
