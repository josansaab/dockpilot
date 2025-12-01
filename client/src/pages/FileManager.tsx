import React, { useState } from "react";
import Layout from "@/components/layout/Layout";
import { 
  Folder, 
  File, 
  FileText, 
  Image as ImageIcon, 
  Music, 
  Video, 
  MoreVertical, 
  Search, 
  Download, 
  Upload,
  Home,
  ChevronRight
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

interface FileItem {
  id: string;
  name: string;
  type: 'folder' | 'file' | 'image' | 'video' | 'audio';
  size: string;
  modified: string;
}

const MOCK_FILES: FileItem[] = [
  { id: '1', name: 'Downloads', type: 'folder', size: '-', modified: 'Today, 10:23 AM' },
  { id: '2', name: 'Documents', type: 'folder', size: '-', modified: 'Yesterday, 2:15 PM' },
  { id: '3', name: 'Media', type: 'folder', size: '-', modified: 'Oct 24, 2023' },
  { id: '4', name: 'docker-compose.yml', type: 'file', size: '2 KB', modified: 'Oct 20, 2023' },
  { id: '5', name: 'config.json', type: 'file', size: '1 KB', modified: 'Oct 20, 2023' },
  { id: '6', name: 'screenshot.png', type: 'image', size: '2.4 MB', modified: 'Just now' },
  { id: '7', name: 'backup.tar.gz', type: 'file', size: '1.2 GB', modified: '2 days ago' },
];

export default function FileManager() {
  const [currentPath, setCurrentPath] = useState(['Home']);
  const [search, setSearch] = useState("");

  const getIcon = (type: string) => {
    switch (type) {
      case 'folder': return <Folder className="w-5 h-5 text-blue-400 fill-blue-400/20" />;
      case 'image': return <ImageIcon className="w-5 h-5 text-purple-400" />;
      case 'video': return <Video className="w-5 h-5 text-red-400" />;
      case 'audio': return <Music className="w-5 h-5 text-yellow-400" />;
      default: return <FileText className="w-5 h-5 text-gray-400" />;
    }
  };

  return (
    <Layout>
      <div className="space-y-6 h-[calc(100vh-140px)] flex flex-col">
        {/* Header Actions */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card/30 p-4 rounded-2xl border border-white/5 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-sm text-muted-foreground overflow-hidden">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentPath(['Home'])}>
              <Home className="w-4 h-4" />
            </Button>
            {currentPath.map((path, index) => (
              <React.Fragment key={index}>
                {index > 0 && <ChevronRight className="w-4 h-4 text-muted-foreground/50" />}
                <span className={cn(
                  "whitespace-nowrap",
                  index === currentPath.length - 1 ? "text-foreground font-medium" : "hover:text-foreground cursor-pointer"
                )}>
                  {path}
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
              />
            </div>
            <Button size="sm" className="gap-2">
              <Upload className="w-4 h-4" /> Upload
            </Button>
          </div>
        </div>

        {/* File List */}
        <div className="flex-1 bg-card/30 rounded-2xl border border-white/5 backdrop-blur-sm overflow-hidden">
          <div className="overflow-auto h-full">
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
                {MOCK_FILES.map((file) => (
                  <TableRow key={file.id} className="group hover:bg-white/5 border-white/5 cursor-pointer transition-colors">
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
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </Layout>
  );
}
