import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Layout from "@/components/layout/Layout";
import { 
  Folder, 
  FileText, 
  Image as ImageIcon, 
  Music, 
  Video, 
  MoreVertical, 
  Search, 
  Download, 
  Upload,
  Home,
  ChevronRight,
  ArrowLeft,
  Loader2,
  RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import axios from "axios";

interface FileItem {
  id: string;
  name: string;
  path: string;
  type: 'folder' | 'file' | 'image' | 'video' | 'audio';
  size: string;
  modified: string;
}

interface FilesResponse {
  currentPath: string;
  parentPath: string;
  files: FileItem[];
}

export default function FileManager() {
  const [currentPath, setCurrentPath] = useState<string>('');
  const [search, setSearch] = useState("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['files', currentPath],
    queryFn: async () => {
      const params = currentPath ? { path: currentPath } : {};
      const response = await axios.get<FilesResponse>('/api/files', { 
        params,
        withCredentials: true 
      });
      return response.data;
    },
  });

  const files = data?.files || [];
  const parentPath = data?.parentPath || '';
  const displayPath = data?.currentPath || '';

  const pathParts = displayPath ? displayPath.split('/').filter(Boolean) : [];

  const filteredFiles = files.filter((file: FileItem) => 
    file.name.toLowerCase().includes(search.toLowerCase())
  );

  const getIcon = (type: string) => {
    switch (type) {
      case 'folder': return <Folder className="w-5 h-5 text-blue-400 fill-blue-400/20" />;
      case 'image': return <ImageIcon className="w-5 h-5 text-purple-400" />;
      case 'video': return <Video className="w-5 h-5 text-red-400" />;
      case 'audio': return <Music className="w-5 h-5 text-yellow-400" />;
      default: return <FileText className="w-5 h-5 text-gray-400" />;
    }
  };

  const navigateToFolder = (path: string) => {
    setCurrentPath(path);
  };

  const navigateUp = () => {
    if (parentPath) {
      setCurrentPath(parentPath);
    }
  };

  const navigateToPathPart = (index: number) => {
    const newPath = '/' + pathParts.slice(0, index + 1).join('/');
    setCurrentPath(newPath);
  };

  return (
    <Layout>
      <div className="space-y-6 h-[calc(100vh-140px)] flex flex-col">
        {/* Header Actions */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card/30 p-4 rounded-2xl border border-white/5 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-sm text-muted-foreground overflow-hidden">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8" 
              onClick={() => setCurrentPath('')}
              data-testid="button-home"
            >
              <Home className="w-4 h-4" />
            </Button>
            
            {parentPath && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8" 
                onClick={navigateUp}
                data-testid="button-back"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
            )}
            
            {pathParts.map((part, index) => (
              <React.Fragment key={index}>
                {index > 0 && <ChevronRight className="w-4 h-4 text-muted-foreground/50" />}
                <span 
                  className={cn(
                    "whitespace-nowrap cursor-pointer hover:text-foreground",
                    index === pathParts.length - 1 ? "text-foreground font-medium" : ""
                  )}
                  onClick={() => navigateToPathPart(index)}
                >
                  {part}
                </span>
              </React.Fragment>
            ))}
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search files..." 
                className="pl-9 h-9 bg-background/50 border-white/10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                data-testid="input-search-files"
              />
            </div>
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => refetch()}
              data-testid="button-refresh-files"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* File List */}
        <div className="flex-1 bg-card/30 rounded-2xl border border-white/5 backdrop-blur-sm overflow-hidden">
          <div className="overflow-auto h-full">
            {isLoading ? (
              <div className="flex items-center justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredFiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center">
                <p className="text-muted-foreground">No files found.</p>
                <p className="text-sm text-muted-foreground mt-1">This directory is empty or you don't have access.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-white/5">
                    <TableHead className="w-[50%]">Name</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Modified</TableHead>
                    <TableHead className="text-right"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFiles.map((file: FileItem) => (
                    <TableRow 
                      key={file.id} 
                      className="group hover:bg-white/5 border-white/5 cursor-pointer transition-colors"
                      onClick={() => file.type === 'folder' && navigateToFolder(file.path)}
                      data-testid={`row-file-${file.id}`}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {getIcon(file.type)}
                          <span className="font-medium">{file.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{file.size}</TableCell>
                      <TableCell className="text-muted-foreground">{file.modified}</TableCell>
                      <TableCell className="text-right">
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex justify-end gap-1">
                          {file.type !== 'folder' && (
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Download className="w-4 h-4" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
