import React, { useState } from "react";
import Layout from "@/components/layout/Layout";
import { APP_CATALOG, AppStoreItem } from "@/data/mockDocker";
import { 
  Search, 
  Download, 
  Check, 
  Star, 
  Filter
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function AppStore() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [installing, setInstalling] = useState<string | null>(null);
  const { toast } = useToast();

  const categories = ["All", ...Array.from(new Set(APP_CATALOG.map(app => app.category)))];

  const filteredApps = APP_CATALOG.filter(app => {
    const matchesSearch = app.name.toLowerCase().includes(search.toLowerCase()) || 
                          app.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = category === "All" || app.category === category;
    return matchesSearch && matchesCategory;
  });

  const handleInstall = async (app: AppStoreItem) => {
    setInstalling(app.id);
    toast({
      title: "Starting Installation",
      description: `Pulling ${app.image}...`,
    });

    // Mock install delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    setInstalling(null);
    toast({
      title: "Installation Complete",
      description: `${app.name} has been added to your dashboard.`,
      className: "bg-green-500 text-white border-none"
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
              />
            </div>
          </div>
          
          {/* Decor */}
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
            >
              {cat}
            </button>
          ))}
        </div>

        {/* App Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredApps.map(app => (
             <div key={app.id} className="group relative bg-card hover:bg-accent/50 border border-border/50 rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl flex flex-col h-full">
               <div className="flex justify-between items-start mb-4">
                 <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-lg", app.iconColor)}>
                   <span className="text-2xl font-bold">{app.name.substring(0, 2)}</span>
                 </div>
                 <Badge variant="secondary" className="font-normal bg-secondary/50">
                   {app.category}
                 </Badge>
               </div>
               
               <div className="flex-1">
                 <h3 className="font-bold text-lg mb-2 group-hover:text-primary transition-colors">{app.name}</h3>
                 <p className="text-sm text-muted-foreground line-clamp-3">{app.description}</p>
               </div>
               
               <div className="mt-6 pt-4 border-t border-border/50 flex items-center justify-between">
                 <div className="flex items-center text-xs text-muted-foreground">
                   <Download className="w-3 h-3 mr-1" />
                   {app.downloads}
                 </div>
                 <Button 
                   onClick={() => handleInstall(app)}
                   disabled={installing === app.id}
                   size="sm"
                   className={cn(
                     "rounded-full px-6 transition-all duration-300",
                     installing === app.id ? "w-full" : ""
                   )}
                 >
                   {installing === app.id ? (
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
