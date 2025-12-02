import { execSync, spawnSync } from 'child_process';
import type { 
  DiskInfo, 
  RaidArray, 
  ZfsPool, 
  StorageTask,
  RaidLevel,
  ZfsLayout
} from '../shared/schema';

const activeTasks: Map<string, StorageTask> = new Map();
const taskListeners: Map<string, ((task: StorageTask) => void)[]> = new Map();
const MAX_TASKS = 100;

function generateTaskId(): string {
  return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function cleanupOldTasks() {
  const tasks = Array.from(activeTasks.entries());
  const completedTasks = tasks.filter(([_, t]) => t.status === 'completed' || t.status === 'failed');
  if (completedTasks.length > MAX_TASKS) {
    const toRemove = completedTasks
      .sort((a, b) => new Date(a[1].startedAt).getTime() - new Date(b[1].startedAt).getTime())
      .slice(0, completedTasks.length - MAX_TASKS);
    toRemove.forEach(([id]) => {
      activeTasks.delete(id);
      taskListeners.delete(id);
    });
  }
}

function runCommand(command: string, args: string[]): { success: boolean; stdout: string; stderr: string } {
  try {
    const result = spawnSync(command, args, { encoding: 'utf8', timeout: 60000 });
    return {
      success: result.status === 0,
      stdout: result.stdout || '',
      stderr: result.stderr || ''
    };
  } catch (e: any) {
    return { success: false, stdout: '', stderr: e.message || 'Command failed' };
  }
}

function validateName(name: string): boolean {
  return /^[a-zA-Z0-9_-]{1,32}$/.test(name);
}

function validateDevicePath(device: string): boolean {
  return /^\/dev\/(sd[a-z]+|nvme\d+n\d+(p\d+)?|vd[a-z]+)$/.test(device);
}

function updateTask(taskId: string, updates: Partial<StorageTask>) {
  const task = activeTasks.get(taskId);
  if (task) {
    Object.assign(task, updates);
    const listeners = taskListeners.get(taskId) || [];
    listeners.forEach(listener => listener(task));
  }
}

export function subscribeToTask(taskId: string, callback: (task: StorageTask) => void) {
  if (!taskListeners.has(taskId)) {
    taskListeners.set(taskId, []);
  }
  taskListeners.get(taskId)!.push(callback);
  
  const task = activeTasks.get(taskId);
  if (task) callback(task);
  
  return () => {
    const listeners = taskListeners.get(taskId) || [];
    const index = listeners.indexOf(callback);
    if (index > -1) listeners.splice(index, 1);
  };
}

export function getTask(taskId: string): StorageTask | undefined {
  return activeTasks.get(taskId);
}

export function getAllTasks(): StorageTask[] {
  return Array.from(activeTasks.values());
}

function execCommand(cmd: string): string {
  try {
    return execSync(cmd, { encoding: 'utf8', timeout: 30000 });
  } catch (e: any) {
    return e.stdout || '';
  }
}

function commandExists(cmd: string): boolean {
  try {
    execSync(`which ${cmd}`, { encoding: 'utf8' });
    return true;
  } catch {
    return false;
  }
}

export async function discoverDisks(): Promise<{
  disks: DiskInfo[];
  raidArrays: RaidArray[];
  zfsPools: ZfsPool[];
  zfsAvailable: boolean;
  mdadmAvailable: boolean;
}> {
  const disks: DiskInfo[] = [];
  const raidArrays: RaidArray[] = [];
  const zfsPools: ZfsPool[] = [];
  
  const zfsAvailable = commandExists('zpool');
  const mdadmAvailable = commandExists('mdadm');
  
  try {
    const lsblkOutput = execCommand('lsblk -J -b -o NAME,SIZE,MODEL,SERIAL,FSTYPE,MOUNTPOINT,TYPE,PKNAME 2>/dev/null');
    
    if (lsblkOutput) {
      const lsblkData = JSON.parse(lsblkOutput);
      const raidMembers = new Set<string>();
      const zfsMembers = new Set<string>();
      
      if (mdadmAvailable) {
        const mdstatOutput = execCommand('cat /proc/mdstat 2>/dev/null');
        const mdLines = mdstatOutput.split('\n');
        for (const line of mdLines) {
          const match = line.match(/^(md\d+)\s*:\s*active\s+(\w+)\s+(.+)$/);
          if (match) {
            const devices = match[3].split(' ').map(d => d.replace(/\[\d+\]/, '').replace(/\(.*\)/, ''));
            devices.forEach(d => raidMembers.add(d));
          }
        }
      }
      
      if (zfsAvailable) {
        const zpoolOutput = execCommand('zpool status 2>/dev/null');
        const deviceMatches = zpoolOutput.match(/\/dev\/\S+/g) || [];
        deviceMatches.forEach(d => zfsMembers.add(d.replace('/dev/', '')));
      }
      
      const processDisk = (device: any, parentPath: string = ''): DiskInfo => {
        const path = `/dev/${device.name}`;
        const isMounted = !!device.mountpoint;
        const isRaidMember = raidMembers.has(device.name);
        const isZfsMember = zfsMembers.has(device.name);
        const isSystemDisk = device.mountpoint === '/' || 
                            device.mountpoint === '/boot' ||
                            device.mountpoint?.startsWith('/boot') ||
                            device.fstype === 'swap';
        
        const diskInfo: DiskInfo = {
          name: device.name,
          path,
          size: formatBytes(device.size || 0),
          sizeBytes: device.size || 0,
          model: device.model || '',
          serial: device.serial || '',
          type: device.type === 'disk' ? 'disk' : 
                device.type === 'part' ? 'part' :
                device.type === 'raid' ? 'raid' : 'lvm',
          fstype: device.fstype || null,
          mountpoint: device.mountpoint || null,
          isAvailable: !isMounted && !isRaidMember && !isZfsMember && !isSystemDisk && device.type === 'disk',
          raidMember: isRaidMember ? 'mdadm' : null,
          zfsMember: isZfsMember ? 'zfs' : null,
        };
        
        if (device.children && device.children.length > 0) {
          diskInfo.children = device.children.map((child: any) => processDisk(child, path));
          const hasUsedPartitions = diskInfo.children!.some(c => 
            c.mountpoint || c.raidMember || c.zfsMember
          );
          if (hasUsedPartitions) {
            diskInfo.isAvailable = false;
          }
        }
        
        return diskInfo;
      };
      
      if (lsblkData.blockdevices) {
        for (const device of lsblkData.blockdevices) {
          if (device.type === 'disk' && !device.name.startsWith('loop') && !device.name.startsWith('ram')) {
            disks.push(processDisk(device));
          }
        }
      }
    }
  } catch (e) {
    console.error('Error discovering disks:', e);
  }
  
  if (mdadmAvailable) {
    try {
      const mdstatOutput = execCommand('cat /proc/mdstat 2>/dev/null');
      const lines = mdstatOutput.split('\n');
      let currentArray: Partial<RaidArray> | null = null;
      
      for (const line of lines) {
        const arrayMatch = line.match(/^(md\d+)\s*:\s*active\s+(\w+)\s+(.+)$/);
        if (arrayMatch) {
          if (currentArray && currentArray.name) {
            raidArrays.push(currentArray as RaidArray);
          }
          const devices = arrayMatch[3].split(' ')
            .map(d => `/dev/${d.replace(/\[\d+\]/, '').replace(/\(.*\)/, '')}`)
            .filter(d => d !== '/dev/');
          
          currentArray = {
            name: arrayMatch[1],
            path: `/dev/${arrayMatch[1]}`,
            level: arrayMatch[2],
            state: 'active',
            devices,
            size: ''
          };
        }
        
        const syncMatch = line.match(/recovery\s*=\s*([\d.]+)%/);
        if (syncMatch && currentArray) {
          currentArray.syncProgress = parseFloat(syncMatch[1]);
          currentArray.syncAction = 'recovery';
        }
        
        const resyncMatch = line.match(/resync\s*=\s*([\d.]+)%/);
        if (resyncMatch && currentArray) {
          currentArray.syncProgress = parseFloat(resyncMatch[1]);
          currentArray.syncAction = 'resync';
        }
      }
      
      if (currentArray && currentArray.name) {
        raidArrays.push(currentArray as RaidArray);
      }
      
      for (const array of raidArrays) {
        try {
          const detailOutput = execCommand(`mdadm --detail ${array.path} 2>/dev/null`);
          const sizeMatch = detailOutput.match(/Array Size\s*:\s*(\d+)/);
          if (sizeMatch) {
            array.size = formatBytes(parseInt(sizeMatch[1]) * 1024);
          }
          const stateMatch = detailOutput.match(/State\s*:\s*(\S+)/);
          if (stateMatch) {
            array.state = stateMatch[1];
          }
        } catch (e) {}
      }
    } catch (e) {
      console.error('Error getting RAID arrays:', e);
    }
  }
  
  if (zfsAvailable) {
    try {
      const zpoolListOutput = execCommand('zpool list -H -o name,size,alloc,free,health 2>/dev/null');
      const poolLines = zpoolListOutput.trim().split('\n').filter(l => l);
      
      for (const line of poolLines) {
        const [name, size, allocated, free, health] = line.split('\t');
        if (!name) continue;
        
        const statusOutput = execCommand(`zpool status ${name} 2>/dev/null`);
        const devices: string[] = [];
        let layout = 'unknown';
        
        const deviceMatches = statusOutput.match(/\/dev\/\S+/g) || [];
        devices.push(...deviceMatches);
        
        if (statusOutput.includes('mirror')) layout = 'mirror';
        else if (statusOutput.includes('raidz3')) layout = 'raidz3';
        else if (statusOutput.includes('raidz2')) layout = 'raidz2';
        else if (statusOutput.includes('raidz1') || statusOutput.includes('raidz')) layout = 'raidz1';
        else if (devices.length === 1) layout = 'single';
        
        zfsPools.push({
          name,
          state: 'online',
          size: size || '',
          allocated: allocated || '',
          free: free || '',
          health: health || 'UNKNOWN',
          devices,
          layout
        });
      }
    } catch (e) {
      console.error('Error getting ZFS pools:', e);
    }
  }
  
  return {
    disks,
    raidArrays,
    zfsPools,
    zfsAvailable,
    mdadmAvailable
  };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function validateDevices(devices: string[]): { valid: boolean; error?: string } {
  for (const device of devices) {
    if (!validateDevicePath(device)) {
      return { valid: false, error: `Invalid device path: ${device}` };
    }
  }
  
  try {
    const lsblkOutput = execCommand('lsblk -J -o NAME,MOUNTPOINT,TYPE 2>/dev/null');
    const lsblkData = JSON.parse(lsblkOutput);
    
    for (const device of devices) {
      const deviceName = device.replace('/dev/', '');
      const blockDevice = lsblkData.blockdevices?.find((d: any) => d.name === deviceName);
      
      if (!blockDevice) {
        return { valid: false, error: `Device not found: ${device}` };
      }
      
      if (blockDevice.mountpoint) {
        return { valid: false, error: `Device is mounted: ${device}` };
      }
      
      if (blockDevice.children) {
        for (const child of blockDevice.children) {
          if (child.mountpoint === '/' || child.mountpoint === '/boot') {
            return { valid: false, error: `Device contains system partition: ${device}` };
          }
        }
      }
    }
  } catch (e) {
    return { valid: false, error: 'Failed to validate devices' };
  }
  
  return { valid: true };
}

function getMinDevicesForRaid(level: RaidLevel): number {
  switch (level) {
    case 'raid0': return 2;
    case 'raid1': return 2;
    case 'raid5': return 3;
    case 'raid6': return 4;
    case 'raid10': return 4;
    default: return 2;
  }
}

function getMinDevicesForZfs(layout: ZfsLayout): number {
  switch (layout) {
    case 'single': return 1;
    case 'mirror': return 2;
    case 'raidz1': return 3;
    case 'raidz2': return 4;
    case 'raidz3': return 5;
    default: return 1;
  }
}

export async function createRaidArray(
  name: string,
  level: RaidLevel,
  devices: string[],
  filesystem: 'ext4' | 'xfs' | 'none' = 'none'
): Promise<{ success: boolean; taskId?: string; error?: string }> {
  
  if (!commandExists('mdadm')) {
    return { success: false, error: 'mdadm is not installed' };
  }
  
  if (!validateName(name)) {
    return { success: false, error: 'Invalid array name. Use only letters, numbers, underscores, and hyphens (max 32 chars)' };
  }
  
  const validation = validateDevices(devices);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }
  
  const minDevices = getMinDevicesForRaid(level);
  if (devices.length < minDevices) {
    return { success: false, error: `${level.toUpperCase()} requires at least ${minDevices} devices` };
  }
  
  if (level === 'raid10' && devices.length % 2 !== 0) {
    return { success: false, error: 'RAID10 requires an even number of devices' };
  }
  
  cleanupOldTasks();
  
  const taskId = generateTaskId();
  const task: StorageTask = {
    id: taskId,
    type: 'raid',
    action: 'create',
    status: 'running',
    progress: 0,
    message: `Creating ${level.toUpperCase()} array...`,
    startedAt: new Date()
  };
  activeTasks.set(taskId, task);
  
  const mdLevel = level.replace('raid', '');
  const mdPath = `/dev/md/${name}`;
  
  (async () => {
    try {
      updateTask(taskId, { message: 'Wiping device signatures...', progress: 10 });
      
      for (const device of devices) {
        runCommand('wipefs', ['-a', device]);
      }
      
      updateTask(taskId, { message: 'Creating RAID array...', progress: 20 });
      
      const mdadmArgs = [
        '--create', mdPath,
        `--level=${mdLevel}`,
        `--raid-devices=${devices.length}`,
        ...devices,
        '--run'
      ];
      
      const result = runCommand('mdadm', mdadmArgs);
      if (!result.success) {
        throw new Error(result.stderr || 'mdadm command failed');
      }
      
      updateTask(taskId, { message: 'Updating mdadm configuration...', progress: 60 });
      
      runCommand('sh', ['-c', 'mdadm --detail --scan >> /etc/mdadm/mdadm.conf']);
      runCommand('update-initramfs', ['-u']);
      
      if (filesystem === 'ext4' || filesystem === 'xfs') {
        updateTask(taskId, { message: `Formatting with ${filesystem}...`, progress: 80 });
        const mkfsResult = runCommand(`mkfs.${filesystem}`, [mdPath]);
        if (!mkfsResult.success) {
          throw new Error(mkfsResult.stderr || 'Formatting failed');
        }
      }
      
      updateTask(taskId, { 
        status: 'completed',
        progress: 100,
        message: `${level.toUpperCase()} array created successfully`,
        completedAt: new Date()
      });
      
    } catch (e: any) {
      updateTask(taskId, {
        status: 'failed',
        error: e.message || 'Failed to create RAID array',
        completedAt: new Date()
      });
    }
  })();
  
  return { success: true, taskId };
}

export async function createZfsPool(
  name: string,
  layout: ZfsLayout,
  devices: string[]
): Promise<{ success: boolean; taskId?: string; error?: string }> {
  
  if (!commandExists('zpool')) {
    return { success: false, error: 'ZFS is not installed. Install with: apt install zfsutils-linux' };
  }
  
  if (!validateName(name)) {
    return { success: false, error: 'Invalid pool name. Use only letters, numbers, underscores, and hyphens (max 32 chars)' };
  }
  
  const validation = validateDevices(devices);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }
  
  const minDevices = getMinDevicesForZfs(layout);
  if (devices.length < minDevices) {
    return { success: false, error: `${layout} layout requires at least ${minDevices} devices` };
  }
  
  cleanupOldTasks();
  
  const taskId = generateTaskId();
  const task: StorageTask = {
    id: taskId,
    type: 'zfs',
    action: 'create',
    status: 'running',
    progress: 0,
    message: `Creating ZFS pool with ${layout} layout...`,
    startedAt: new Date()
  };
  activeTasks.set(taskId, task);
  
  const zpoolArgs: string[] = ['create', '-f', name];
  
  switch (layout) {
    case 'single':
      zpoolArgs.push(...devices);
      break;
    case 'mirror':
      zpoolArgs.push('mirror', ...devices);
      break;
    case 'raidz1':
      zpoolArgs.push('raidz1', ...devices);
      break;
    case 'raidz2':
      zpoolArgs.push('raidz2', ...devices);
      break;
    case 'raidz3':
      zpoolArgs.push('raidz3', ...devices);
      break;
  }
  
  (async () => {
    try {
      updateTask(taskId, { message: 'Wiping device signatures...', progress: 20 });
      
      for (const device of devices) {
        runCommand('wipefs', ['-a', device]);
      }
      
      updateTask(taskId, { message: 'Creating ZFS pool...', progress: 50 });
      
      const result = runCommand('zpool', zpoolArgs);
      if (!result.success) {
        throw new Error(result.stderr || 'zpool create failed');
      }
      
      updateTask(taskId, { message: 'Enabling compression...', progress: 80 });
      runCommand('zfs', ['set', 'compression=lz4', name]);
      
      updateTask(taskId, {
        status: 'completed',
        progress: 100,
        message: `ZFS pool "${name}" created successfully`,
        completedAt: new Date()
      });
      
    } catch (e: any) {
      updateTask(taskId, {
        status: 'failed',
        error: e.message || 'Failed to create ZFS pool',
        completedAt: new Date()
      });
    }
  })();
  
  return { success: true, taskId };
}

export async function getRaidSyncProgress(): Promise<{ array: string; progress: number; action: string }[]> {
  const results: { array: string; progress: number; action: string }[] = [];
  
  try {
    const mdstatOutput = execCommand('cat /proc/mdstat 2>/dev/null');
    const lines = mdstatOutput.split('\n');
    let currentArray = '';
    
    for (const line of lines) {
      const arrayMatch = line.match(/^(md\d+)/);
      if (arrayMatch) {
        currentArray = arrayMatch[1];
      }
      
      const progressMatch = line.match(/(recovery|resync|reshape)\s*=\s*([\d.]+)%/);
      if (progressMatch && currentArray) {
        results.push({
          array: currentArray,
          progress: parseFloat(progressMatch[2]),
          action: progressMatch[1]
        });
      }
    }
  } catch (e) {}
  
  return results;
}

export async function getZfsScrubProgress(): Promise<{ pool: string; progress: number; action: string }[]> {
  const results: { pool: string; progress: number; action: string }[] = [];
  
  if (!commandExists('zpool')) return results;
  
  try {
    const zpoolListOutput = execCommand('zpool list -H -o name 2>/dev/null');
    const pools = zpoolListOutput.trim().split('\n').filter(p => p);
    
    for (const pool of pools) {
      const statusOutput = execCommand(`zpool status ${pool} 2>/dev/null`);
      
      const scrubMatch = statusOutput.match(/scan:\s+scrub\s+in\s+progress.*?([\d.]+)%\s+done/);
      if (scrubMatch) {
        results.push({
          pool,
          progress: parseFloat(scrubMatch[1]),
          action: 'scrub'
        });
      }
      
      const resilverMatch = statusOutput.match(/scan:\s+resilver\s+in\s+progress.*?([\d.]+)%\s+done/);
      if (resilverMatch) {
        results.push({
          pool,
          progress: parseFloat(resilverMatch[1]),
          action: 'resilver'
        });
      }
    }
  } catch (e) {}
  
  return results;
}
