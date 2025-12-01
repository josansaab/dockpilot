import React, { useState } from "react";
import Layout from "@/components/layout/Layout";
import { MOCK_IMAGES } from "@/data/mockDocker";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Download, 
  Trash2, 
  Play, 
  Search,
  HardDrive
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
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

export default function Images() {
  const [images, setImages] = useState(MOCK_IMAGES);
  const [search, setSearch] = useState("");
  const [pullImageName, setPullImageName] = useState("");
  const [isPulling, setIsPulling] = useState(false);
  const { toast } = useToast();

  const filteredImages = images.filter(img => 
    img.repository.toLowerCase().includes(search.toLowerCase()) || 
    img.tag.toLowerCase().includes(search.toLowerCase())
  );

  const handlePull = async () => {
    if (!pullImageName) return;
    
    setIsPulling(true);
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const [repo, tag] = pullImageName.split(":");
    
    const newImage = {
      id: `sha256:${Math.random().toString(16).substring(2, 12)}`,
      repository: repo,
      tag: tag || "latest",
      size: "150MB",
      created: "Just now"
    };
    
    setImages([newImage, ...images]);
    setIsPulling(false);
    setPullImageName("");
    
    toast({
      title: "Image Pulled",
      description: `Successfully pulled ${pullImageName}`,
    });
  };

  const handleDelete = (id: string) => {
    setImages(prev => prev.filter(img => img.id !== id));
    toast({
      title: "Image Deleted",
      description: "Docker image has been removed from local storage.",
      variant: "destructive"
    });
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Images</h1>
            <p className="text-muted-foreground">Local Docker image library.</p>
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search images..." 
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            
            <Dialog>
              <DialogTrigger asChild>
                <Button>
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
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handlePull} disabled={isPulling}>
                    {isPulling ? "Pulling..." : "Pull Image"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="border rounded-lg bg-card">
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
              {filteredImages.map((image) => (
                <TableRow key={image.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <HardDrive className="h-4 w-4 text-muted-foreground" />
                      {image.repository}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="bg-secondary px-2 py-1 rounded text-xs font-mono">
                      {image.tag}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {image.id.substring(0, 19)}...
                  </TableCell>
                  <TableCell className="text-sm">{image.size}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{image.created}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
                        onClick={() => toast({ title: "Run Container", description: `Starting container from ${image.repository}:${image.tag}` })}
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(image.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
