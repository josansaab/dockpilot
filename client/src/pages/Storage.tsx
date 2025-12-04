import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import axios from "axios";
import { 
  HardDrive, 
  Database, 
  Plus, 
  RefreshCw, 
  Loader2, 
  AlertCircle,
  CheckCircle,
  Server,
  Layers
} from "lucide-react";
import type { 
  DiskInfo, 
  RaidArray, 
  ZfsPool, 
  RaidLevel, 
  ZfsLayout,
  StorageTask 
} from "@shared/schema";

interface StorageDiscovery {
  disks: DiskInfo[];
  raidArrays: RaidArray[];
  zfsPools: ZfsPool[];
  zfsAvailable: boolean;
  mdadmAvailable: boolean;
}

export default function Storage() {
  const [isRaidDialogOpen, setIsRaidDialogOpen] = useState(false);
  const [isZfsDialogOpen, setIsZfsDialogOpen] = useState(false);
  const [selectedDisks, setSelectedDisks] = useState<string[]>([]);
  const [raidName, setRaidName] = useState("");
  const [raidLevel, setRaidLevel] = useState<RaidLevel>("raid1");
  const [raidFilesystem, setRaidFilesystem] = useState<"ext4" | "xfs" | "none">("ext4");
  const [zfsName, setZfsName] = useState("");
  const [zfsLayout, setZfsLayout] = useState<ZfsLayout>("mirror");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: discovery, isLoading, refetch } = useQuery<StorageDiscovery>({
    queryKey: ['storage-discovery'],
    queryFn: async () => {
      const response = await axios.get('/api/storage/discovery', { withCredentials: true });
      return response.data;
    },
    refetchInterval: 10000,
  });

  const { data: tasks = [] } = useQuery<StorageTask[]>({
    queryKey: ['storage-tasks'],
    queryFn: async () => {
      const response = await axios.get('/api/storage/tasks', { withCredentials: true });
      return response.data;
    },
    refetchInterval: 2000,
  });

  const createRaidMutation = useMutation({
    mutationFn: async (data: { name: string; level: RaidLevel; devices: string[]; filesystem: string }) => {
      const response = await axios.post('/api/storage/raid/create', data, { withCredentials: true });
      return response.data;
    },
    onSuccess: () => {
      toast({ title: "RAID Creation Started", description: "The RAID array is being created." });
      setIsRaidDialogOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['storage-discovery'] });
      queryClient.invalidateQueries({ queryKey: ['storage-tasks'] });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.response?.data?.error || "Failed to create RAID array", 
        variant: "destructive" 
      });
    }
  });

  const createZfsMutation = useMutation({
    mutationFn: async (data: { name: string; layout: ZfsLayout; devices: string[] }) => {
      const response = await axios.post('/api/storage/zfs/create', data, { withCredentials: true });
      return response.data;
    },
    onSuccess: () => {
      toast({ title: "ZFS Pool Creation Started", description: "The ZFS pool is being created." });
      setIsZfsDialogOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['storage-discovery'] });
      queryClient.invalidateQueries({ queryKey: ['storage-tasks'] });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.response?.data?.error || "Failed to create ZFS pool", 
        variant: "destructive" 
      });
    }
  });

  const resetForm = () => {
    setSelectedDisks([]);
    setRaidName("");
    setRaidLevel("raid1");
    setRaidFilesystem("ext4");
    setZfsName("");
    setZfsLayout("mirror");
  };

  const toggleDiskSelection = (diskPath: string) => {
    setSelectedDisks(prev => 
      prev.includes(diskPath) 
        ? prev.filter(d => d !== diskPath)
        : [...prev, diskPath]
    );
  };

  const getMinDisksForRaid = (level: RaidLevel): number => {
    switch (level) {
      case 'raid0': return 2;
      case 'raid1': return 2;
      case 'raid5': return 3;
      case 'raid6': return 4;
      case 'raid10': return 4;
      default: return 2;
    }
  };

  const getMinDisksForZfs = (layout: ZfsLayout): number => {
    switch (layout) {
      case 'single': return 1;
      case 'mirror': return 2;
      case 'raidz1': return 3;
      case 'raidz2': return 4;
      case 'raidz3': return 5;
      default: return 1;
    }
  };

  const availableDisks = discovery?.disks.filter(d => d.isAvailable) || [];
  const activeTasks = tasks.filter(t => t.status === 'running' || t.status === 'pending');

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Storage Manager</h1>
            <p className="text-muted-foreground">Manage disks, RAID arrays, and ZFS pools.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => refetch()}
              data-testid="button-refresh-storage"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button 
              onClick={() => {
                if (!discovery?.mdadmAvailable) {
                  toast({ 
                    title: "mdadm Not Installed", 
                    description: "Install mdadm with: apt install mdadm", 
                    variant: "destructive" 
                  });
                  return;
                }
                if (availableDisks.length < 2) {
                  toast({ 
                    title: "Not Enough Disks", 
                    description: "RAID requires at least 2 available disks", 
                    variant: "destructive" 
                  });
                  return;
                }
                setIsRaidDialogOpen(true);
              }}
              data-testid="button-create-raid"
            >
              <Plus className="mr-2 h-4 w-4" /> Create RAID
            </Button>
            <Button 
              onClick={() => {
                if (!discovery?.zfsAvailable) {
                  toast({ 
                    title: "ZFS Not Installed", 
                    description: "Install ZFS with: apt install zfsutils-linux", 
                    variant: "destructive" 
                  });
                  return;
                }
                if (availableDisks.length < 1) {
                  toast({ 
                    title: "No Available Disks", 
                    description: "No unformatted disks found for ZFS pool", 
                    variant: "destructive" 
                  });
                  return;
                }
                setIsZfsDialogOpen(true);
              }}
              data-testid="button-create-zfs"
            >
              <Plus className="mr-2 h-4 w-4" /> Create ZFS Pool
            </Button>
          </div>
        </div>

        {activeTasks.length > 0 && (
          <Card className="border-blue-500/50 bg-blue-500/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                Active Tasks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {activeTasks.map(task => (
                  <div key={task.id} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>{task.message}</span>
                      <span>{task.progress}%</span>
                    </div>
                    <Progress value={task.progress} className="h-2" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HardDrive className="h-5 w-5" />
                  Available Disks
                </CardTitle>
                <CardDescription>
                  Physical drives available for RAID or ZFS configuration
                  {!discovery?.mdadmAvailable && (
                    <Badge variant="outline" className="ml-2 text-yellow-500 border-yellow-500">mdadm not installed</Badge>
                  )}
                  {!discovery?.zfsAvailable && (
                    <Badge variant="outline" className="ml-2 text-yellow-500 border-yellow-500">ZFS not installed</Badge>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {availableDisks.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <HardDrive className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No available disks found.</p>
                    <p className="text-sm mt-1">All disks are either mounted, in use by RAID/ZFS, or contain system partitions.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[200px]">Device</TableHead>
                        <TableHead>Size</TableHead>
                        <TableHead>Model</TableHead>
                        <TableHead>Serial</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {availableDisks.map(disk => (
                        <TableRow key={disk.path} data-testid={`row-disk-${disk.name}`}>
                          <TableCell className="font-mono">{disk.path}</TableCell>
                          <TableCell>{disk.size}</TableCell>
                          <TableCell className="text-muted-foreground">{disk.model || '-'}</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {disk.serial ? disk.serial.substring(0, 12) : '-'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="bg-green-500/20 text-green-500">
                              Available
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {discovery?.disks.filter(d => !d.isAvailable).length ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Server className="h-5 w-5" />
                    In-Use Disks
                  </CardTitle>
                  <CardDescription>
                    Disks that are mounted, part of RAID/ZFS, or contain system partitions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[200px]">Device</TableHead>
                        <TableHead>Size</TableHead>
                        <TableHead>Filesystem</TableHead>
                        <TableHead>Mount Point</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {discovery.disks.filter(d => !d.isAvailable).map(disk => (
                        <TableRow key={disk.path} data-testid={`row-disk-inuse-${disk.name}`}>
                          <TableCell className="font-mono">{disk.path}</TableCell>
                          <TableCell>{disk.size}</TableCell>
                          <TableCell className="font-mono text-xs">{disk.fstype || '-'}</TableCell>
                          <TableCell className="text-muted-foreground">{disk.mountpoint || '-'}</TableCell>
                          <TableCell>
                            {disk.raidMember && <Badge variant="outline">RAID Member</Badge>}
                            {disk.zfsMember && <Badge variant="outline">ZFS Member</Badge>}
                            {disk.mountpoint && !disk.raidMember && !disk.zfsMember && (
                              <Badge variant="secondary">Mounted</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ) : null}

            {discovery?.raidArrays && discovery.raidArrays.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Layers className="h-5 w-5" />
                    RAID Arrays
                  </CardTitle>
                  <CardDescription>Existing mdadm RAID arrays</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Level</TableHead>
                        <TableHead>Size</TableHead>
                        <TableHead>Devices</TableHead>
                        <TableHead>State</TableHead>
                        <TableHead>Progress</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {discovery.raidArrays.map(array => (
                        <TableRow key={array.path} data-testid={`row-raid-${array.name}`}>
                          <TableCell className="font-mono">{array.path}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{array.level.toUpperCase()}</Badge>
                          </TableCell>
                          <TableCell>{array.size}</TableCell>
                          <TableCell className="font-mono text-xs">
                            {array.devices.length} disks
                          </TableCell>
                          <TableCell>
                            {array.state === 'active' || array.state === 'clean' ? (
                              <Badge className="bg-green-500/20 text-green-500">
                                <CheckCircle className="h-3 w-3 mr-1" /> Healthy
                              </Badge>
                            ) : (
                              <Badge variant="destructive">
                                <AlertCircle className="h-3 w-3 mr-1" /> {array.state}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {array.syncProgress !== undefined ? (
                              <div className="flex items-center gap-2">
                                <Progress value={array.syncProgress} className="w-20 h-2" />
                                <span className="text-xs">{array.syncProgress.toFixed(1)}%</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {discovery?.zfsPools && discovery.zfsPools.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    ZFS Pools
                  </CardTitle>
                  <CardDescription>Existing ZFS storage pools</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Layout</TableHead>
                        <TableHead>Size</TableHead>
                        <TableHead>Used</TableHead>
                        <TableHead>Free</TableHead>
                        <TableHead>Health</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {discovery.zfsPools.map(pool => (
                        <TableRow key={pool.name} data-testid={`row-zfs-${pool.name}`}>
                          <TableCell className="font-medium">{pool.name}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{pool.layout.toUpperCase()}</Badge>
                          </TableCell>
                          <TableCell>{pool.size}</TableCell>
                          <TableCell>{pool.allocated}</TableCell>
                          <TableCell>{pool.free}</TableCell>
                          <TableCell>
                            {pool.health === 'ONLINE' ? (
                              <Badge className="bg-green-500/20 text-green-500">
                                <CheckCircle className="h-3 w-3 mr-1" /> Online
                              </Badge>
                            ) : (
                              <Badge variant="destructive">
                                <AlertCircle className="h-3 w-3 mr-1" /> {pool.health}
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        <Dialog open={isRaidDialogOpen} onOpenChange={setIsRaidDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create RAID Array</DialogTitle>
              <DialogDescription>
                Select drives and configure your RAID array. All data on selected drives will be erased.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="raid-name">Array Name</Label>
                <Input
                  id="raid-name"
                  placeholder="e.g., data-array"
                  value={raidName}
                  onChange={(e) => setRaidName(e.target.value)}
                  data-testid="input-raid-name"
                />
              </div>
              <div className="grid gap-2">
                <Label>RAID Level</Label>
                <Select value={raidLevel} onValueChange={(v) => setRaidLevel(v as RaidLevel)}>
                  <SelectTrigger data-testid="select-raid-level">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="raid0">RAID 0 (Stripe) - 2+ disks</SelectItem>
                    <SelectItem value="raid1">RAID 1 (Mirror) - 2 disks</SelectItem>
                    <SelectItem value="raid5">RAID 5 (Parity) - 3+ disks</SelectItem>
                    <SelectItem value="raid6">RAID 6 (Double Parity) - 4+ disks</SelectItem>
                    <SelectItem value="raid10">RAID 10 (Mirror+Stripe) - 4+ disks</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Filesystem</Label>
                <Select value={raidFilesystem} onValueChange={(v) => setRaidFilesystem(v as any)}>
                  <SelectTrigger data-testid="select-raid-filesystem">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ext4">ext4</SelectItem>
                    <SelectItem value="xfs">XFS</SelectItem>
                    <SelectItem value="none">None (raw)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Select Disks ({selectedDisks.length} selected, min {getMinDisksForRaid(raidLevel)} required)</Label>
                <div className="border rounded-lg max-h-48 overflow-y-auto">
                  {availableDisks.map(disk => (
                    <div 
                      key={disk.path}
                      className="flex items-center gap-3 p-3 hover:bg-muted/50 border-b last:border-0"
                    >
                      <Checkbox
                        checked={selectedDisks.includes(disk.path)}
                        onCheckedChange={() => toggleDiskSelection(disk.path)}
                        data-testid={`checkbox-disk-${disk.name}`}
                      />
                      <div className="flex-1">
                        <div className="font-mono text-sm">{disk.path}</div>
                        <div className="text-xs text-muted-foreground">
                          {disk.size} {disk.model && `- ${disk.model}`}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsRaidDialogOpen(false)}>Cancel</Button>
              <Button 
                onClick={() => createRaidMutation.mutate({
                  name: raidName,
                  level: raidLevel,
                  devices: selectedDisks,
                  filesystem: raidFilesystem
                })}
                disabled={
                  !raidName || 
                  selectedDisks.length < getMinDisksForRaid(raidLevel) ||
                  createRaidMutation.isPending
                }
                data-testid="button-confirm-raid"
              >
                {createRaidMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Array
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isZfsDialogOpen} onOpenChange={setIsZfsDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create ZFS Pool</DialogTitle>
              <DialogDescription>
                Select drives and configure your ZFS pool. All data on selected drives will be erased.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="zfs-name">Pool Name</Label>
                <Input
                  id="zfs-name"
                  placeholder="e.g., tank"
                  value={zfsName}
                  onChange={(e) => setZfsName(e.target.value)}
                  data-testid="input-zfs-name"
                />
              </div>
              <div className="grid gap-2">
                <Label>Pool Layout</Label>
                <Select value={zfsLayout} onValueChange={(v) => setZfsLayout(v as ZfsLayout)}>
                  <SelectTrigger data-testid="select-zfs-layout">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">Single (No Redundancy) - 1+ disk</SelectItem>
                    <SelectItem value="mirror">Mirror - 2+ disks</SelectItem>
                    <SelectItem value="raidz1">RAIDZ1 (Single Parity) - 3+ disks</SelectItem>
                    <SelectItem value="raidz2">RAIDZ2 (Double Parity) - 4+ disks</SelectItem>
                    <SelectItem value="raidz3">RAIDZ3 (Triple Parity) - 5+ disks</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Select Disks ({selectedDisks.length} selected, min {getMinDisksForZfs(zfsLayout)} required)</Label>
                <div className="border rounded-lg max-h-48 overflow-y-auto">
                  {availableDisks.map(disk => (
                    <div 
                      key={disk.path}
                      className="flex items-center gap-3 p-3 hover:bg-muted/50 border-b last:border-0"
                    >
                      <Checkbox
                        checked={selectedDisks.includes(disk.path)}
                        onCheckedChange={() => toggleDiskSelection(disk.path)}
                        data-testid={`checkbox-zfs-disk-${disk.name}`}
                      />
                      <div className="flex-1">
                        <div className="font-mono text-sm">{disk.path}</div>
                        <div className="text-xs text-muted-foreground">
                          {disk.size} {disk.model && `- ${disk.model}`}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsZfsDialogOpen(false)}>Cancel</Button>
              <Button 
                onClick={() => createZfsMutation.mutate({
                  name: zfsName,
                  layout: zfsLayout,
                  devices: selectedDisks
                })}
                disabled={
                  !zfsName || 
                  selectedDisks.length < getMinDisksForZfs(zfsLayout) ||
                  createZfsMutation.isPending
                }
                data-testid="button-confirm-zfs"
              >
                {createZfsMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Pool
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
