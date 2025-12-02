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
  Trash2, 
  RefreshCw, 
  Search,
  Download,
  Loader2,
  HardDrive
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { imageApi } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface DockerImage {
  id: string;
  repository: string;
  tag: string;
  size: string;
  created: string;
}

export default function Images() {
  const [search, setSearch] = useState("");
  const [pullImageName, setPullImageName] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: images = [], isLoading, refetch } = useQuery({
    queryKey: ['images'],
    queryFn: async () => {
      const response = await imageApi.list();
      return response.data.map((img: any) => ({
        id: img.Id || img.id || '',
        repository: img.RepoTags?.[0]?.split(':')[0] || img.repository || '<none>',
        tag: img.RepoTags?.[0]?.split(':')[1] || img.tag || '<none>',
        size: img.Size ? formatSize(img.Size) : img.size || '0 MB',
        created: img.Created ? new Date(img.Created * 1000).toLocaleDateString() : img.created || ''
      }));
    },
    refetchInterval: 30000,
  });

  const pullMutation = useMutation({
    mutationFn: (imageName: string) => imageApi.pull(imageName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['images'] });
      toast({ title: "Image Pulled", description: "Image pulled successfully." });
      setIsDialogOpen(false);
      setPullImageName("");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to pull image.", variant: "destructive" });
    }
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => imageApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['images'] });
      toast({ title: "Image Removed", description: "Image removed successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to remove image.", variant: "destructive" });
    }
  });

  function formatSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
    return (bytes / 1073741824).toFixed(1) + ' GB';
  }

  const filteredImages = images.filter((img: DockerImage) => 
    img.repository.toLowerCase().includes(search.toLowerCase()) || 
    img.tag.toLowerCase().includes(search.toLowerCase()) ||
    img.id.includes(search)
  );

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Images</h1>
            <p className="text-muted-foreground">Manage your Docker images.</p>
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search images..." 
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                data-testid="input-search-images"
              />
            </div>
            <Button variant="outline" size="icon" onClick={() => refetch()} data-testid="button-refresh-images">
              <RefreshCw className="h-4 w-4" />
            </Button>
            
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-pull-image">
                  <Download className="mr-2 h-4 w-4" /> Pull Image
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Pull Docker Image</DialogTitle>
                  <DialogDescription>
                    Enter the image name (and optional tag) to pull from Docker Hub.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Image Name</Label>
                    <Input 
                      id="name" 
                      placeholder="e.g. nginx:latest" 
                      value={pullImageName}
                      onChange={(e) => setPullImageName(e.target.value)}
                      data-testid="input-pull-image-name"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                  <Button 
                    onClick={() => pullMutation.mutate(pullImageName)}
                    disabled={!pullImageName || pullMutation.isPending}
                    data-testid="button-confirm-pull"
                  >
                    {pullMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Pull Image
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="border rounded-lg bg-card">
          {isLoading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredImages.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <p className="text-muted-foreground">No images found.</p>
              <p className="text-sm text-muted-foreground mt-1">Pull an image or install apps to download images.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[300px]">Repository</TableHead>
                  <TableHead>Tag</TableHead>
                  <TableHead>Image ID</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredImages.map((image: DockerImage) => (
                  <TableRow key={image.id} data-testid={`row-image-${image.id}`}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <HardDrive className="h-4 w-4 text-muted-foreground" />
                        {image.repository}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-mono">
                        {image.tag}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {image.id.replace('sha256:', '').substring(0, 12)}...
                    </TableCell>
                    <TableCell className="text-sm">{image.size}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{image.created}</TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => removeMutation.mutate(image.id)}
                        disabled={removeMutation.isPending}
                        data-testid={`button-remove-image-${image.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
