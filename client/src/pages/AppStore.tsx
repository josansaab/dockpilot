import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Layout from "@/components/layout/Layout";
import { APP_CATALOG, AppStoreItem } from "@/data/mockDocker";
import { 
  Search, 
  Download
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { appApi } from "@/lib/api";

export default function AppStore() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [installingAppId, setInstallingAppId] = useState<string | null>(null);
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
    mutationFn: async (app: AppStoreItem) => {
      // Get default ports based on app
      const defaultPorts: { container: number; host: number }[] = [];
      if (app.id === 'plex') defaultPorts.push({ container: 32400, host: 32400 });
      if (app.id === 'pihole') defaultPorts.push({ container: 80, host: 8053 });
      if (app.id === 'homeassistant') defaultPorts.push({ container: 8123, host: 8123 });
      if (app.id === 'nextcloud') defaultPorts.push({ container: 80, host: 8081 });
      if (app.id === 'portainer') defaultPorts.push({ container: 9000, host: 9000 });
      if (app.id === 'nodered') defaultPorts.push({ container: 1880, host: 1880 });
      if (app.id === 'qbittorrent') defaultPorts.push({ container: 8080, host: 8082 });
      
      const payload = {
        id: app.id,
        name: app.name,
        description: app.description,
        category: app.category,
        image: app.image,
        icon: app.iconUrl,
        ports: defaultPorts,
        environment: {},
        volumes: [],
        status: 'installing',
      };

      const response = await appApi.install(payload);
      return response.data;
    },
    onSuccess: (data) => {
      setInstallingAppId(null);
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

  const handleInstall = async (app: AppStoreItem) => {
    setInstallingAppId(app.id);
    toast({
      title: "Starting Installation",
      description: `Installing ${app.name}...`,
    });
    installMutation.mutate(app);
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
                 <Button 
                   onClick={() => handleInstall(app)}
                   disabled={installingAppId === app.id}
                   size="sm"
                   className={cn(
                     "rounded-full px-6 transition-all duration-300",
                     installingAppId === app.id ? "w-full" : ""
                   )}
                   data-testid={`button-install-${app.id}`}
                 >
                   {installingAppId === app.id ? (
                     "Installing..." 
                   ) : (
                     "Install"
                   )}
                 </Button>
               </div>
             </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
