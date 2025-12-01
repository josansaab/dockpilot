import React from "react";
import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MOCK_CONTAINERS, MOCK_IMAGES } from "@/data/mockDocker";
import { Activity, Box, Layers, Server, Cpu, HardDrive } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { motion } from "framer-motion";

const data = [
  { name: '10:00', cpu: 12, mem: 24 },
  { name: '10:05', cpu: 19, mem: 28 },
  { name: '10:10', cpu: 15, mem: 35 },
  { name: '10:15', cpu: 25, mem: 45 },
  { name: '10:20', cpu: 22, mem: 42 },
  { name: '10:25', cpu: 30, mem: 48 },
  { name: '10:30', cpu: 28, mem: 55 },
];

export default function Dashboard() {
  const runningContainers = MOCK_CONTAINERS.filter(c => c.state === 'running').length;
  const totalContainers = MOCK_CONTAINERS.length;
  const totalImages = MOCK_IMAGES.length;

  return (
    <Layout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Dashboard</h1>
          <p className="text-muted-foreground">System overview and resource metrics.</p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Containers</CardTitle>
              <Box className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{runningContainers} <span className="text-muted-foreground text-sm font-normal">/ {totalContainers}</span></div>
              <p className="text-xs text-muted-foreground mt-1">
                {runningContainers} running active
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Images</CardTitle>
              <Layers className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalImages}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Total local images
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">CPU Usage</CardTitle>
              <Cpu className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">18.5%</div>
              <p className="text-xs text-muted-foreground mt-1">
                Across all containers
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
              <HardDrive className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">896 MB</div>
              <p className="text-xs text-muted-foreground mt-1">
                Total allocated
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <Card className="col-span-4">
            <CardHeader>
              <CardTitle>Resource Usage History</CardTitle>
            </CardHeader>
            <CardContent className="pl-2">
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data}>
                    <defs>
                      <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(217 91% 60%)" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(217 91% 60%)" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorMem" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(142 71% 45%)" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(142 71% 45%)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" vertical={false} />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}%`} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                      itemStyle={{ color: 'hsl(var(--foreground))' }}
                    />
                    <Area type="monotone" dataKey="cpu" stroke="hsl(217 91% 60%)" fillOpacity={1} fill="url(#colorCpu)" strokeWidth={2} />
                    <Area type="monotone" dataKey="mem" stroke="hsl(142 71% 45%)" fillOpacity={1} fill="url(#colorMem)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          
          <Card className="col-span-3">
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-4 border border-border rounded-lg bg-muted/30">
                   <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                     <Box size={20} />
                   </div>
                   <div>
                     <h4 className="text-sm font-medium">Pull Image</h4>
                     <p className="text-xs text-muted-foreground">Download from Docker Hub</p>
                   </div>
                </div>
                <div className="flex items-center gap-4 p-4 border border-border rounded-lg bg-muted/30">
                   <div className="h-10 w-10 rounded-full bg-success/20 flex items-center justify-center text-success">
                     <Activity size={20} />
                   </div>
                   <div>
                     <h4 className="text-sm font-medium">Start All</h4>
                     <p className="text-xs text-muted-foreground">Resume all stopped containers</p>
                   </div>
                </div>
                <div className="flex items-center gap-4 p-4 border border-border rounded-lg bg-muted/30">
                   <div className="h-10 w-10 rounded-full bg-destructive/20 flex items-center justify-center text-destructive">
                     <Server size={20} />
                   </div>
                   <div>
                     <h4 className="text-sm font-medium">Prune System</h4>
                     <p className="text-xs text-muted-foreground">Clean up unused resources</p>
                   </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
