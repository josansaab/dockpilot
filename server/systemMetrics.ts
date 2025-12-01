import si from 'systeminformation';

export interface SystemStats {
  cpu: number;
  memory: number;
  memTotal: number;
  memUsed: number;
  disk: number;
  diskTotal: string;
  diskUsed: string;
  uptime: string;
  network: { iface: string; rx: number; tx: number }[];
  dockerReady: boolean;
  dockerStatus: string;
}

export interface StorageInfo {
  disks: {
    device: string;
    fstype: string;
    size: string;
    used: string;
    avail: string;
    percent: string;
    mount: string;
  }[];
  blockDevices: {
    name: string;
    size: string;
    type: string;
    model: string;
  }[];
  zfs: {
    name: string;
    size: string;
    used: string;
    capacity: string;
    health: string;
  }[];
  volumes: { name: string; driver: string }[];
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
  if (bytes < 1099511627776) return (bytes / 1073741824).toFixed(1) + ' GB';
  return (bytes / 1099511627776).toFixed(1) + ' TB';
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h ${mins}m`;
}

export async function getSystemStats(): Promise<SystemStats> {
  try {
    const [cpuLoad, mem, fsSize, time, networkStats, dockerInfo] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.fsSize(),
      si.time(),
      si.networkStats(),
      si.dockerInfo().catch(() => null)
    ]);

    const cpu = Math.round(cpuLoad.currentLoad);
    const memTotal = Math.round(mem.total / 1024 / 1024);
    const memUsed = Math.round(mem.used / 1024 / 1024);
    const memory = Math.round((mem.used / mem.total) * 100);

    const rootFs = fsSize.find(fs => fs.mount === '/') || fsSize[0];
    const disk = rootFs ? Math.round(rootFs.use) : 0;
    const diskTotal = rootFs ? formatBytes(rootFs.size) : '0 GB';
    const diskUsed = rootFs ? formatBytes(rootFs.used) : '0 GB';

    const uptime = formatUptime(time.uptime);

    const network = networkStats
      .filter(n => n.iface !== 'lo' && (n.rx_bytes > 0 || n.tx_bytes > 0))
      .slice(0, 5)
      .map(n => ({
        iface: n.iface,
        rx: n.rx_bytes,
        tx: n.tx_bytes
      }));

    const dockerReady = dockerInfo !== null && dockerInfo.containers > -1;
    const dockerStatus = dockerReady ? 'Running' : 'Not Available';

    return {
      cpu: Math.max(0, Math.min(100, cpu)),
      memory: Math.max(0, Math.min(100, memory)),
      memTotal,
      memUsed,
      disk: Math.max(0, Math.min(100, disk)),
      diskTotal,
      diskUsed,
      uptime,
      network,
      dockerReady,
      dockerStatus
    };
  } catch (error) {
    console.error('Error getting system stats:', error);
    return {
      cpu: 0,
      memory: 0,
      memTotal: 0,
      memUsed: 0,
      disk: 0,
      diskTotal: '0 GB',
      diskUsed: '0 GB',
      uptime: '--',
      network: [],
      dockerReady: false,
      dockerStatus: 'Error'
    };
  }
}

export async function getStorageInfo(): Promise<StorageInfo> {
  try {
    const [fsSize, blockDevices, dockerVolumes] = await Promise.all([
      si.fsSize(),
      si.blockDevices(),
      si.dockerVolumes().catch(() => [])
    ]);

    const disks = fsSize
      .filter(fs => fs.mount.startsWith('/') && !fs.mount.includes('/snap') && !fs.mount.includes('/boot'))
      .slice(0, 10)
      .map(fs => ({
        device: fs.fs,
        fstype: fs.type,
        size: formatBytes(fs.size),
        used: formatBytes(fs.used),
        avail: formatBytes(fs.available),
        percent: fs.use.toFixed(0) + '%',
        mount: fs.mount
      }));

    const physicalDisks = blockDevices
      .filter(bd => bd.type === 'disk')
      .slice(0, 10)
      .map(bd => ({
        name: bd.name,
        size: formatBytes(bd.size),
        type: bd.type,
        model: bd.model || 'Unknown'
      }));

    const volumes = Array.isArray(dockerVolumes) 
      ? dockerVolumes.slice(0, 20).map((v: any) => ({
          name: v.name || 'unknown',
          driver: v.driver || 'local'
        }))
      : [];

    return {
      disks,
      blockDevices: physicalDisks,
      zfs: [],
      volumes
    };
  } catch (error) {
    console.error('Error getting storage info:', error);
    return {
      disks: [],
      blockDevices: [],
      zfs: [],
      volumes: []
    };
  }
}

export async function getDockerContainers() {
  try {
    const containers = await si.dockerContainers();
    return containers.map(c => ({
      id: c.id,
      name: c.name,
      image: c.image,
      state: c.state,
      started: c.started,
      ports: c.ports
    }));
  } catch (error) {
    return [];
  }
}

export async function getDockerImages() {
  try {
    const images = await si.dockerImages();
    return images.map(i => ({
      id: i.id,
      repository: i.repoTags?.[0]?.split(':')[0] || 'none',
      tag: i.repoTags?.[0]?.split(':')[1] || 'none',
      size: formatBytes(i.size),
      created: i.created
    }));
  } catch (error) {
    return [];
  }
}
