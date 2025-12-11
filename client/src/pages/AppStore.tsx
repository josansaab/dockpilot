import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Layout from "@/components/layout/Layout";
import { APP_CATALOG, AppStoreItem } from "@/data/mockDocker";
import { 
  Search, 
  Download,
  Settings,
  Network,
  FolderOpen,
  Terminal,
  Plus,
  Minus,
  Zap
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
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
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { appApi } from "@/lib/api";

interface CustomInstallConfig {
  ports: { container: number; host: number }[];
  volumes: { host: string; container: string }[];
  environment: Record<string, string>;
  networkMode: string;
}

const defaultPortsForApp = (appId: string): { container: number; host: number }[] => {
  const portMap: Record<string, { container: number; host: number }[]> = {
    'plex': [{ container: 32400, host: 32400 }],
    'pihole': [{ container: 80, host: 8053 }, { container: 53, host: 53 }],
    'homeassistant': [{ container: 8123, host: 8123 }],
    'nextcloud': [{ container: 80, host: 8081 }],
    'portainer': [{ container: 9000, host: 9000 }],
    'nodered': [{ container: 1880, host: 1880 }],
    'qbittorrent': [{ container: 8080, host: 8082 }],
    'jellyfin': [{ container: 8096, host: 8096 }],
    'nginx': [{ container: 80, host: 80 }],
    'postgres': [{ container: 5432, host: 5432 }],
    'mysql': [{ container: 3306, host: 3306 }],
    'redis': [{ container: 6379, host: 6379 }],
    'mongodb': [{ container: 27017, host: 27017 }],
    'grafana': [{ container: 3000, host: 3000 }],
    'prometheus': [{ container: 9090, host: 9090 }],
    'uptime-kuma': [{ container: 3001, host: 3001 }],
    'syncthing': [{ container: 8384, host: 8384 }],
    'filebrowser': [{ container: 80, host: 8085 }],
    'vaultwarden': [{ container: 80, host: 8086 }],
    'homepage': [{ container: 3000, host: 3010 }],
  };
  return portMap[appId] || [{ container: 80, host: 8080 }];
};

const defaultVolumesForApp = (appId: string): { host: string; container: string }[] => {
  const volumeMap: Record<string, { host: string; container: string }[]> = {
    'plex': [{ host: '/opt/dockpilot/data/plex/config', container: '/config' }, { host: '/opt/dockpilot/data/plex/media', container: '/media' }],
    'jellyfin': [{ host: '/opt/dockpilot/data/jellyfin/config', container: '/config' }, { host: '/opt/dockpilot/data/jellyfin/cache', container: '/cache' }],
    'nextcloud': [{ host: '/opt/dockpilot/data/nextcloud', container: '/var/www/html' }],
    'homeassistant': [{ host: '/opt/dockpilot/data/homeassistant', container: '/config' }],
    'pihole': [{ host: '/opt/dockpilot/data/pihole', container: '/etc/pihole' }],
    'qbittorrent': [{ host: '/opt/dockpilot/data/qbittorrent', container: '/config' }, { host: '/opt/dockpilot/downloads', container: '/downloads' }],
    'filebrowser': [{ host: '/opt/dockpilot/data/filebrowser', container: '/srv' }],
    'vaultwarden': [{ host: '/opt/dockpilot/data/vaultwarden', container: '/data' }],
  };
  return volumeMap[appId] || [];
};

const defaultEnvForApp = (appId: string): Record<string, string> => {
  const envMap: Record<string, Record<string, string>> = {
    'pihole': { 'TZ': 'UTC', 'WEBPASSWORD': 'admin' },
    'postgres': { 'POSTGRES_PASSWORD': 'changeme', 'POSTGRES_USER': 'admin', 'POSTGRES_DB': 'app' },
    'mysql': { 'MYSQL_ROOT_PASSWORD': 'changeme', 'MYSQL_DATABASE': 'app' },
    'redis': { 'REDIS_PASSWORD': '' },
    'mongodb': { 'MONGO_INITDB_ROOT_USERNAME': 'admin', 'MONGO_INITDB_ROOT_PASSWORD': 'changeme' },
    'grafana': { 'GF_SECURITY_ADMIN_PASSWORD': 'admin' },
  };
  return envMap[appId] || { 'TZ': 'UTC' };
};

export default function AppStore() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [installingAppId, setInstallingAppId] = useState<string | null>(null);
  const [customInstallDialogOpen, setCustomInstallDialogOpen] = useState(false);
  const [selectedApp, setSelectedApp] = useState<AppStoreItem | null>(null);
  const [customConfig, setCustomConfig] = useState<CustomInstallConfig | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const categories = ["All", ...Array.from(new Set(APP_CATALOG.map(app => app.category)))];

  const filteredApps = APP_CATALOG.filter(app => {
    const matchesSearch = app.name.toLowerCase().includes(search.toLowerCase()) || 
                          app.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = category === "All" || app.category === category;
    return matchesSearch && matchesCategory;
  });

  // Install mutation
  const installMutation = useMutation({
    mutationFn: async ({ app, config }: { app: AppStoreItem; config: CustomInstallConfig }) => {
      const payload = {
        id: app.id,
        name: app.name,
        description: app.description,
        category: app.category,
        image: app.image,
        icon: app.iconUrl,
        ports: config.ports,
        environment: config.environment,
        volumes: config.volumes,
        networkMode: config.networkMode,
        status: 'installing',
      };

      const response = await appApi.install(payload);
      return response.data;
    },
    onSuccess: (data) => {
      setInstallingAppId(null);
      setCustomInstallDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['apps'] });
      const statusMsg = data.status === 'running' 
        ? `${data.name} is now running!` 
        : `${data.name} added (Docker required to start container)`;
      toast({
        title: "Installation Complete",
        description: statusMsg,
        className: "border-green-500/50 text-green-500"
      });
    },
    onError: (error: any) => {
      setInstallingAppId(null);
      const errorMessage = error.response?.data?.error || "Failed to install the application. Please try again.";
      toast({
        title: "Installation Failed",
        description: errorMessage,
        variant: "destructive"
      });
    },
  });

  const handleQuickInstall = async (app: AppStoreItem) => {
    setInstallingAppId(app.id);
    toast({
      title: "Starting Installation",
      description: `Installing ${app.name}...`,
    });
    
    const config: CustomInstallConfig = {
      ports: defaultPortsForApp(app.id),
      volumes: defaultVolumesForApp(app.id),
      environment: defaultEnvForApp(app.id),
      networkMode: 'bridge',
    };
    
    installMutation.mutate({ app, config });
  };

  const openCustomInstall = (app: AppStoreItem) => {
    setSelectedApp(app);
    setCustomConfig({
      ports: defaultPortsForApp(app.id),
      volumes: defaultVolumesForApp(app.id),
      environment: defaultEnvForApp(app.id),
      networkMode: 'bridge',
    });
    setCustomInstallDialogOpen(true);
  };

  const handleCustomInstall = () => {
    if (!selectedApp || !customConfig) return;
    setInstallingAppId(selectedApp.id);
    installMutation.mutate({ app: selectedApp, config: customConfig });
  };

  const addPortMapping = () => {
    if (!customConfig) return;
    setCustomConfig({
      ...customConfig,
      ports: [...customConfig.ports, { container: 80, host: 8080 }]
    });
  };

  const removePortMapping = (index: number) => {
    if (!customConfig) return;
    setCustomConfig({
      ...customConfig,
      ports: customConfig.ports.filter((_, i) => i !== index)
    });
  };

  const addVolumeMapping = () => {
    if (!customConfig) return;
    setCustomConfig({
      ...customConfig,
      volumes: [...customConfig.volumes, { host: '/opt/dockpilot/data', container: '/data' }]
    });
  };

  const removeVolumeMapping = (index: number) => {
    if (!customConfig) return;
    setCustomConfig({
      ...customConfig,
      volumes: customConfig.volumes.filter((_, i) => i !== index)
    });
  };

  const addEnvVariable = () => {
    if (!customConfig) return;
    const key = `VAR_${Object.keys(customConfig.environment).length + 1}`;
    setCustomConfig({
      ...customConfig,
      environment: { ...customConfig.environment, [key]: '' }
    });
  };

  return (
    <Layout>
      <div className="space-y-8 pb-20">
        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 p-8 md:p-12 text-white shadow-lg">
          <div className="relative z-10 max-w-2xl">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">App Store</h1>
            <p className="text-lg text-white/90 mb-8">
              Discover and install open source applications for your home server with one click.
            </p>
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
              <Input 
                className="pl-10 h-12 bg-white text-black border-0 rounded-full shadow-xl placeholder:text-gray-400 focus-visible:ring-0"
                placeholder="Search for apps..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                data-testid="input-search"
              />
            </div>
          </div>
          
          <div className="absolute right-0 top-0 h-full w-1/2 opacity-10 pointer-events-none">
             <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className="h-full w-full">
                <path fill="#FFFFFF" d="M44.7,-76.4C58.9,-69.2,71.8,-59.1,81.6,-46.6C91.4,-34.1,98.1,-19.2,95.8,-5.3C93.5,8.6,82.2,21.5,70.2,31.2C58.2,40.9,45.5,47.4,33.7,54.8C21.9,62.1,11,70.3,-1.1,72.2C-13.2,74.1,-26.4,69.7,-39.2,62.7C-52,55.7,-64.4,46.1,-73.2,34.2C-82,22.3,-87.2,8.1,-84.6,-5C-82,-18.1,-71.6,-30.1,-60.6,-39.6C-49.6,-49.1,-38,-56.1,-26.3,-65.2C-14.6,-74.3,-2.8,-85.5,5.7,-95.4L14.2,-105.3L14.2,0L5.7,0C-2.8,0,-14.6,0,-26.3,0C-38,0,-49.6,0,-60.6,0C-71.6,0,-82,0,-84.6,0C-87.2,0,-82,0,-73.2,0C-64.4,0,-52,0,-39.2,0C-26.4,0,-13.2,0,-1.1,0C11,0,21.9,0,33.7,0C45.5,0,58.2,0,70.2,0C82.2,0,93.5,0,95.8,0C98.1,0,91.4,0,81.6,0C71.8,0,58.9,0,44.7,0Z" transform="translate(100 100)" />
              </svg>
          </div>
        </div>

        {/* Categories */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap",
                category === cat 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-secondary/50 text-secondary-foreground hover:bg-secondary"
              )}
              data-testid={`filter-${cat.toLowerCase()}`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* App Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredApps.map(app => (
             <div key={app.id} className="group relative bg-card hover:bg-accent/50 border border-border/50 rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl flex flex-col h-full" data-testid={`app-card-${app.id}`}>
               <div className="flex justify-between items-start mb-4">
                 <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-white/10 shadow-lg overflow-hidden p-2">
                   <img 
                     src={app.iconUrl} 
                     alt={app.name} 
                     className="w-full h-full object-contain"
                     onError={(e) => {
                       e.currentTarget.style.display = 'none';
                       e.currentTarget.nextElementSibling?.classList.remove('hidden');
                     }}
                   />
                   <span className="text-2xl font-bold hidden">{app.name.substring(0, 2)}</span>
                 </div>
                 <Badge variant="secondary" className="font-normal bg-secondary/50">
                   {app.category}
                 </Badge>
               </div>
               
               <div className="flex-1">
                 <h3 className="font-bold text-lg mb-2 group-hover:text-primary transition-colors" data-testid={`app-name-${app.id}`}>{app.name}</h3>
                 <p className="text-sm text-muted-foreground line-clamp-3">{app.description}</p>
               </div>
               
               <div className="mt-6 pt-4 border-t border-border/50 flex items-center justify-between">
                 <div className="flex items-center text-xs text-muted-foreground">
                   <Download className="w-3 h-3 mr-1" />
                   {app.downloads}
                 </div>
                 <div className="flex gap-2">
                   <Button 
                     variant="outline"
                     size="sm"
                     onClick={() => openCustomInstall(app)}
                     disabled={installingAppId === app.id}
                     className="rounded-full"
                     data-testid={`button-custom-${app.id}`}
                   >
                     <Settings className="w-3 h-3 mr-1" /> Custom
                   </Button>
                   <Button 
                     onClick={() => handleQuickInstall(app)}
                     disabled={installingAppId === app.id}
                     size="sm"
                     className="rounded-full px-4"
                     data-testid={`button-install-${app.id}`}
                   >
                     {installingAppId === app.id ? (
                       "Installing..." 
                     ) : (
                       <>
                         <Zap className="w-3 h-3 mr-1" /> Install
                       </>
                     )}
                   </Button>
                 </div>
               </div>
             </div>
          ))}
        </div>
      </div>

      {/* Custom Install Dialog */}
      <Dialog open={customInstallDialogOpen} onOpenChange={setCustomInstallDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Custom Install: {selectedApp?.name}
            </DialogTitle>
            <DialogDescription>
              Configure network, storage, and environment settings before installing.
            </DialogDescription>
          </DialogHeader>

          {customConfig && (
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
                      value={customConfig.networkMode} 
                      onValueChange={(v) => setCustomConfig({...customConfig, networkMode: v})}
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
                    <p className="text-xs text-muted-foreground">
                      Bridge: Isolated network with port mapping. Host: Use host network directly.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Port Mappings</Label>
                      <Button variant="outline" size="sm" onClick={addPortMapping} data-testid="button-add-port">
                        <Plus className="w-3 h-3 mr-1" /> Add Port
                      </Button>
                    </div>
                    
                    {customConfig.ports.map((port, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <div className="flex-1">
                          <Label className="text-xs text-muted-foreground">Host Port</Label>
                          <Input 
                            type="number"
                            value={port.host}
                            onChange={(e) => {
                              const newPorts = [...customConfig.ports];
                              newPorts[index].host = parseInt(e.target.value) || 0;
                              setCustomConfig({...customConfig, ports: newPorts});
                            }}
                            data-testid={`input-host-port-${index}`}
                          />
                        </div>
                        <span className="text-muted-foreground mt-6">→</span>
                        <div className="flex-1">
                          <Label className="text-xs text-muted-foreground">Container Port</Label>
                          <Input 
                            type="number"
                            value={port.container}
                            onChange={(e) => {
                              const newPorts = [...customConfig.ports];
                              newPorts[index].container = parseInt(e.target.value) || 0;
                              setCustomConfig({...customConfig, ports: newPorts});
                            }}
                            data-testid={`input-container-port-${index}`}
                          />
                        </div>
                        <Button variant="ghost" size="icon" className="mt-6" onClick={() => removePortMapping(index)} data-testid={`button-remove-port-${index}`}>
                          <Minus className="w-4 h-4 text-red-400" />
                        </Button>
                      </div>
                    ))}

                    {customConfig.ports.length === 0 && (
                      <p className="text-sm text-muted-foreground py-2">No port mappings configured</p>
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
                  
                  {customConfig.volumes.map((vol, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div className="flex-1">
                        <Label className="text-xs text-muted-foreground">Host Path</Label>
                        <Input 
                          value={vol.host}
                          onChange={(e) => {
                            const newVols = [...customConfig.volumes];
                            newVols[index].host = e.target.value;
                            setCustomConfig({...customConfig, volumes: newVols});
                          }}
                          placeholder="/opt/dockpilot/data/..."
                          data-testid={`input-host-volume-${index}`}
                        />
                      </div>
                      <span className="text-muted-foreground mt-6">→</span>
                      <div className="flex-1">
                        <Label className="text-xs text-muted-foreground">Container Path</Label>
                        <Input 
                          value={vol.container}
                          onChange={(e) => {
                            const newVols = [...customConfig.volumes];
                            newVols[index].container = e.target.value;
                            setCustomConfig({...customConfig, volumes: newVols});
                          }}
                          placeholder="/data"
                          data-testid={`input-container-volume-${index}`}
                        />
                      </div>
                      <Button variant="ghost" size="icon" className="mt-6" onClick={() => removeVolumeMapping(index)} data-testid={`button-remove-volume-${index}`}>
                        <Minus className="w-4 h-4 text-red-400" />
                      </Button>
                    </div>
                  ))}

                  {customConfig.volumes.length === 0 && (
                    <p className="text-sm text-muted-foreground py-2">No volume mappings configured. Data may not persist.</p>
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
                  
                  {Object.entries(customConfig.environment).map(([key, value], index) => (
                    <div key={key} className="flex items-center gap-2">
                      <Input 
                        value={key}
                        onChange={(e) => {
                          const newEnv = {...customConfig.environment};
                          delete newEnv[key];
                          newEnv[e.target.value] = value;
                          setCustomConfig({...customConfig, environment: newEnv});
                        }}
                        placeholder="Variable Name"
                        className="flex-1 font-mono text-sm"
                        data-testid={`input-env-key-${index}`}
                      />
                      <span className="text-muted-foreground">=</span>
                      <Input 
                        value={value}
                        onChange={(e) => {
                          const newEnv = {...customConfig.environment};
                          newEnv[key] = e.target.value;
                          setCustomConfig({...customConfig, environment: newEnv});
                        }}
                        placeholder="Value"
                        className="flex-1"
                        type={key.toLowerCase().includes('password') || key.toLowerCase().includes('secret') ? 'password' : 'text'}
                        data-testid={`input-env-value-${index}`}
                      />
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => {
                          const newEnv = {...customConfig.environment};
                          delete newEnv[key];
                          setCustomConfig({...customConfig, environment: newEnv});
                        }} 
                        data-testid={`button-remove-env-${index}`}
                      >
                        <Minus className="w-4 h-4 text-red-400" />
                      </Button>
                    </div>
                  ))}

                  {Object.keys(customConfig.environment).length === 0 && (
                    <p className="text-sm text-muted-foreground py-2">No environment variables configured</p>
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setCustomInstallDialogOpen(false)} data-testid="button-cancel-install">
              Cancel
            </Button>
            <Button 
              onClick={handleCustomInstall} 
              disabled={installingAppId !== null}
              className="gap-2" 
              data-testid="button-confirm-install"
            >
              <Download className="w-4 h-4" /> 
              {installingAppId ? "Installing..." : "Install App"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
