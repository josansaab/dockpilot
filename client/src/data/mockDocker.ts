
export interface DockerContainer {
  id: string;
  name: string;
  image: string;
  state: 'running' | 'stopped' | 'exited';
  status: string;
  ports: string;
  created: string;
  cpu: number; // percentage
  memory: number; // MB
}

export interface DockerImage {
  id: string;
  repository: string;
  tag: string;
  size: string;
  created: string;
}

export const MOCK_CONTAINERS: DockerContainer[] = [
  {
    id: "c1a2b3d4e5f6",
    name: "web-server-nginx",
    image: "nginx:latest",
    state: "running",
    status: "Up 2 hours",
    ports: "0.0.0.0:80->80/tcp",
    created: "2023-10-25 10:00:00",
    cpu: 1.2,
    memory: 128
  },
  {
    id: "a1b2c3d4e5f6",
    name: "db-postgres-primary",
    image: "postgres:16",
    state: "running",
    status: "Up 5 days",
    ports: "5432/tcp",
    created: "2023-10-20 08:30:00",
    cpu: 4.5,
    memory: 512
  },
  {
    id: "f6e5d4c3b2a1",
    name: "cache-redis",
    image: "redis:alpine",
    state: "stopped",
    status: "Exited (0) 10 minutes ago",
    ports: "",
    created: "2023-10-24 15:45:00",
    cpu: 0,
    memory: 0
  },
  {
    id: "1234567890ab",
    name: "api-backend-node",
    image: "my-api:v2",
    state: "running",
    status: "Up 30 minutes",
    ports: "0.0.0.0:3000->3000/tcp",
    created: "2023-10-25 11:30:00",
    cpu: 12.8,
    memory: 256
  },
  {
    id: "deadbeef0000",
    name: "worker-queue",
    image: "python:3.9-slim",
    state: "exited",
    status: "Exited (137) 1 hour ago",
    ports: "",
    created: "2023-10-24 09:00:00",
    cpu: 0,
    memory: 0
  }
];

export const MOCK_IMAGES: DockerImage[] = [
  {
    id: "sha256:9876543210",
    repository: "nginx",
    tag: "latest",
    size: "187MB",
    created: "2 weeks ago"
  },
  {
    id: "sha256:1234567890",
    repository: "postgres",
    tag: "16",
    size: "450MB",
    created: "1 month ago"
  },
  {
    id: "sha256:abcdef1234",
    repository: "node",
    tag: "20-alpine",
    size: "120MB",
    created: "3 days ago"
  },
  {
    id: "sha256:4321098765",
    repository: "redis",
    tag: "alpine",
    size: "40MB",
    created: "1 week ago"
  },
  {
    id: "sha256:0000000000",
    repository: "ubuntu",
    tag: "22.04",
    size: "78MB",
    created: "2 months ago"
  }
];
