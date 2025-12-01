import React, { useState } from "react";
import Layout from "@/components/layout/Layout";
import { MOCK_CONTAINERS } from "@/data/mockDocker";
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
  TerminalSquare
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Containers() {
  const [containers, setContainers] = useState(MOCK_CONTAINERS);
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  const filteredContainers = containers.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.image.toLowerCase().includes(search.toLowerCase()) ||
    c.id.includes(search)
  );

  const handleAction = (id: string, action: string) => {
    toast({
      title: `Container ${action}`,
      description: `Successfully sent ${action} signal to container ${id.substring(0, 12)}`,
    });
    
    // Mock state update
    if (action === 'start') {
       setContainers(prev => prev.map(c => c.id === id ? { ...c, state: 'running', status: 'Up Less than a second' } : c));
    } else if (action === 'stop') {
       setContainers(prev => prev.map(c => c.id === id ? { ...c, state: 'stopped', status: 'Exited (0) just now' } : c));
    } else if (action === 'remove') {
       setContainers(prev => prev.filter(c => c.id !== id));
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Containers</h1>
            <p className="text-muted-foreground">Manage your local Docker containers.</p>
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search containers..." 
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button variant="outline" size="icon">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button>
              <Play className="mr-2 h-4 w-4" /> Run New
            </Button>
          </div>
        </div>

        <div className="border rounded-lg bg-card">
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
              {filteredContainers.map((container) => (
                <TableRow key={container.id}>
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
                          onClick={() => handleAction(container.id, 'start')}
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-yellow-500 hover:text-yellow-500 hover:bg-yellow-500/10"
                          onClick={() => handleAction(container.id, 'stop')}
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
                          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleAction(container.id, 'remove')}>
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
        </div>
      </div>
    </Layout>
  );
}
