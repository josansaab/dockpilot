import Docker from 'dockerode';

// Initialize Docker client
// In Replit environment, we can't access Docker socket
// This will be used when deployed to actual Ubuntu/Debian servers
export const docker = new Docker({ socketPath: '/var/run/docker.sock' });

export interface ContainerInfo {
  id: string;
  name: string;
  image: string;
  state: 'running' | 'stopped' | 'exited' | 'paused' | 'restarting';
  status: string;
  ports: string;
  created: string;
}

export interface ImageInfo {
  id: string;
  repository: string;
  tag: string;
  size: string;
  created: string;
}

// Check if Docker is available
export async function isDockerAvailable(): Promise<boolean> {
  try {
    await docker.ping();
    return true;
  } catch (error) {
    console.log('Docker not available:', error instanceof Error ? error.message : 'Unknown error');
    return false;
  }
}

// List all containers
export async function listContainers(all = true): Promise<ContainerInfo[]> {
  try {
    const containers = await docker.listContainers({ all });
    
    return containers.map(container => {
      const ports = container.Ports.map(p => 
        p.PublicPort ? `${p.IP || '0.0.0.0'}:${p.PublicPort}->${p.PrivatePort}/${p.Type}` : `${p.PrivatePort}/${p.Type}`
      ).join(', ');

      return {
        id: container.Id.substring(0, 12),
        name: container.Names[0]?.replace('/', '') || 'unknown',
        image: container.Image,
        state: container.State as any,
        status: container.Status,
        ports,
        created: new Date(container.Created * 1000).toISOString(),
      };
    });
  } catch (error) {
    console.error('Error listing containers:', error);
    return [];
  }
}

// List all images
export async function listImages(): Promise<ImageInfo[]> {
  try {
    const images = await docker.listImages();
    
    return images.map(image => {
      const repoTags = image.RepoTags || ['<none>:<none>'];
      const [repository, tag] = repoTags[0].split(':');
      
      return {
        id: image.Id,
        repository: repository || '<none>',
        tag: tag || '<none>',
        size: formatBytes(image.Size),
        created: new Date(image.Created * 1000).toLocaleString(),
      };
    });
  } catch (error) {
    console.error('Error listing images:', error);
    return [];
  }
}

// Pull an image
export async function pullImage(imageName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    docker.pull(imageName, (err: any, stream: any) => {
      if (err) {
        reject(err);
        return;
      }

      docker.modem.followProgress(stream, (err: any, output: any) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
}

// Create and start a container
export async function createAndStartContainer(
  imageName: string,
  containerName: string,
  ports: { container: number; host: number }[] = [],
  environment: Record<string, string> = {},
  volumes: { host: string; container: string }[] = []
): Promise<string> {
  const portBindings: any = {};
  const exposedPorts: any = {};

  ports.forEach(({ container, host }) => {
    exposedPorts[`${container}/tcp`] = {};
    portBindings[`${container}/tcp`] = [{ HostPort: host.toString() }];
  });

  const binds = volumes.map(v => `${v.host}:${v.container}`);

  const container = await docker.createContainer({
    Image: imageName,
    name: containerName,
    Env: Object.entries(environment).map(([key, val]) => `${key}=${val}`),
    ExposedPorts: exposedPorts,
    HostConfig: {
      PortBindings: portBindings,
      Binds: binds,
      RestartPolicy: { Name: 'unless-stopped' },
    },
  });

  await container.start();
  return container.id;
}

// Start a container
export async function startContainer(containerId: string): Promise<void> {
  const container = docker.getContainer(containerId);
  await container.start();
}

// Stop a container
export async function stopContainer(containerId: string): Promise<void> {
  const container = docker.getContainer(containerId);
  await container.stop();
}

// Remove a container
export async function removeContainer(containerId: string, force = false): Promise<void> {
  const container = docker.getContainer(containerId);
  await container.remove({ force });
}

// Remove container by name
export async function removeContainerByName(containerName: string): Promise<void> {
  const containers = await docker.listContainers({ all: true });
  const target = containers.find(c => 
    c.Names.some(n => n === `/${containerName}` || n === containerName)
  );
  
  if (target) {
    const container = docker.getContainer(target.Id);
    try {
      await container.stop().catch(() => {}); // Stop if running
    } catch (e) {}
    await container.remove({ force: true });
  }
}

// Remove an image
export async function removeImage(imageId: string, force = false): Promise<void> {
  const image = docker.getImage(imageId);
  await image.remove({ force });
}

// Get container logs
export async function getContainerLogs(containerId: string, tail = 100): Promise<string> {
  const container = docker.getContainer(containerId);
  const logs = await container.logs({
    stdout: true,
    stderr: true,
    tail,
    timestamps: true,
  });
  return logs.toString('utf-8');
}

// Execute command in container
export async function execInContainer(containerId: string, command: string): Promise<string> {
  const container = docker.getContainer(containerId);
  
  // Parse command into array - split by spaces but respect quotes
  const cmdParts = command.match(/(?:[^\s"]+|"[^"]*")+/g) || [command];
  const cleanedParts = cmdParts.map(p => p.replace(/^"|"$/g, ''));
  
  const exec = await container.exec({
    Cmd: cleanedParts,
    AttachStdout: true,
    AttachStderr: true,
  });
  
  const stream = await exec.start({ hijack: true, stdin: false });
  
  return new Promise((resolve, reject) => {
    let output = '';
    
    stream.on('data', (chunk: Buffer) => {
      // Docker multiplexes stdout/stderr with an 8-byte header
      // We need to skip the header bytes for each frame
      let offset = 0;
      while (offset < chunk.length) {
        if (offset + 8 <= chunk.length) {
          const size = chunk.readUInt32BE(offset + 4);
          if (offset + 8 + size <= chunk.length) {
            output += chunk.slice(offset + 8, offset + 8 + size).toString('utf-8');
            offset += 8 + size;
          } else {
            // Incomplete frame, just append remaining
            output += chunk.slice(offset + 8).toString('utf-8');
            break;
          }
        } else {
          // Not enough bytes for header, just append
          output += chunk.slice(offset).toString('utf-8');
          break;
        }
      }
    });
    
    stream.on('end', () => {
      resolve(output.trim());
    });
    
    stream.on('error', (err: Error) => {
      reject(err);
    });
    
    // Timeout after 30 seconds
    setTimeout(() => {
      stream.destroy();
      resolve(output.trim() || 'Command timed out after 30 seconds');
    }, 30000);
  });
}

// Helper function
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i)) + ' ' + sizes[i];
}
