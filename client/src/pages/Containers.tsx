import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Layout from "@/components/layout/Layout";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Play, 
  Square, 
  Trash2, 
  RefreshCw, 
  Search,
  MoreVertical,
  TerminalSquare,
  Loader2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { containerApi } from "@/lib/api";

interface Container {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
  ports: string;
  created: string;
}

export default function Containers() {
  const [search, setSearch] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: containers = [], isLoading, refetch } = useQuery({
    queryKey: ['containers'],
    queryFn: async () => {
      const response = await containerApi.list();
      return response.data.map((c: any) => ({
        id: c.Id || c.id,
        name: (c.Names?.[0] || c.name || '').replace(/^\//, ''),
        image: c.Image || c.image,
        state: c.State || c.state || 'unknown',
        status: c.Status || c.status || '',
        ports: c.Ports?.map((p: any) => `${p.PublicPort || ''}:${p.PrivatePort || ''}`).join(', ') || c.ports || '',
        created: c.Created ? new Date(c.Created * 1000).toLocaleString() : c.created || ''
      }));
    },
    refetchInterval: 10000,
  });

  const startMutation = useMutation({
    mutationFn: (id: string) => containerApi.start(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['containers'] });
      toast({ title: "Container Started", description: "Container started successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to start container.", variant: "destructive" });
    }
  });

  const stopMutation = useMutation({
    mutationFn: (id: string) => containerApi.stop(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['containers'] });
      toast({ title: "Container Stopped", description: "Container stopped successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to stop container.", variant: "destructive" });
    }
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => containerApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['containers'] });
      toast({ title: "Container Removed", description: "Container removed successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to remove container.", variant: "destructive" });
    }
  });

  const filteredContainers = containers.filter((c: Container) => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.image.toLowerCase().includes(search.toLowerCase()) ||
    c.id.includes(search)
  );

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Containers</h1>
            <p className="text-muted-foreground">Manage your Docker containers.</p>
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search containers..." 
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                data-testid="input-search-containers"
              />
            </div>
            <Button variant="outline" size="icon" onClick={() => refetch()} data-testid="button-refresh-containers">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="border rounded-lg bg-card">
          {isLoading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredContainers.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <p className="text-muted-foreground">No containers found.</p>
              <p className="text-sm text-muted-foreground mt-1">Install apps from the App Store to create containers.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Name</TableHead>
                  <TableHead>Image</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Ports</TableHead>
                  <TableHead className="hidden md:table-cell">Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContainers.map((container: Container) => (
                  <TableRow key={container.id} data-testid={`row-container-${container.id}`}>
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span className="font-semibold text-foreground">{container.name}</span>
                        <span className="text-xs text-muted-foreground font-mono" title={container.id}>
                          {container.id.substring(0, 12)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono font-normal text-xs">
                        {container.image}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className={`h-2.5 w-2.5 rounded-full ${
                          container.state === 'running' ? 'bg-success shadow-[0_0_8px_hsl(var(--success))]' : 'bg-destructive'
                        }`} />
                        <span className="capitalize text-sm">{container.state}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">{container.status}</div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell font-mono text-xs text-muted-foreground">
                      {container.ports || "-"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                      {container.created}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {container.state !== 'running' ? (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-success hover:text-success hover:bg-success/10"
                            onClick={() => startMutation.mutate(container.id)}
                            disabled={startMutation.isPending}
                            data-testid={`button-start-${container.id}`}
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-yellow-500 hover:text-yellow-500 hover:bg-yellow-500/10"
                            onClick={() => stopMutation.mutate(container.id)}
                            disabled={stopMutation.isPending}
                            data-testid={`button-stop-${container.id}`}
                          >
                            <Square className="h-4 w-4 fill-current" />
                          </Button>
                        )}
                        
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => toast({ title: "Opening Logs..." })}>
                              <TerminalSquare className="mr-2 h-4 w-4" /> Logs
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="text-destructive focus:text-destructive" 
                              onClick={() => removeMutation.mutate(container.id)}
                              data-testid={`button-remove-${container.id}`}
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Remove
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </Layout>
  );
}
