
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
  // Added for CasaOS style
  icon?: string; 
  category?: string;
  url?: string;
}

export interface DockerImage {
  id: string;
  repository: string;
  tag: string;
  size: string;
  created: string;
}

export interface AppStoreItem {
  id: string;
  name: string;
  description: string;
  category: string;
  image: string;
  iconColor: string;
  downloads: string;
}

export const APP_CATALOG: AppStoreItem[] = [
  {
    id: "plex",
    name: "Plex Media Server",
    description: "Organizes all your personal media so you can enjoy it no matter where you are.",
    category: "Media",
    image: "plexinc/pms-docker:latest",
    iconColor: "bg-orange-500",
    downloads: "10M+"
  },
  {
    id: "jellyfin",
    name: "Jellyfin",
    description: "The Free Software Media System. No strings attached.",
    category: "Media",
    image: "jellyfin/jellyfin:latest",
    iconColor: "bg-purple-600",
    downloads: "5M+"
  },
  {
    id: "pihole",
    name: "Pi-hole",
    description: "Network-wide Ad Blocking. A black hole for Internet advertisements.",
    category: "Network",
    image: "pihole/pihole:latest",
    iconColor: "bg-red-600",
    downloads: "20M+"
  },
  {
    id: "homeassistant",
    name: "Home Assistant",
    description: "Open source home automation that puts local control and privacy first.",
    category: "Automation",
    image: "homeassistant/home-assistant:stable",
    iconColor: "bg-blue-500",
    downloads: "8M+"
  },
  {
    id: "nextcloud",
    name: "Nextcloud",
    description: "The self-hosted productivity platform that keeps you in control.",
    category: "Productivity",
    image: "nextcloud:latest",
    iconColor: "bg-blue-600",
    downloads: "15M+"
  },
  {
    id: "portainer",
    name: "Portainer",
    description: "Making Docker and Kubernetes management easy.",
    category: "System",
    image: "portainer/portainer-ce:latest",
    iconColor: "bg-sky-500",
    downloads: "50M+"
  },
  {
    id: "nodered",
    name: "Node-RED",
    description: "Low-code programming for event-driven applications.",
    category: "Development",
    image: "nodered/node-red:latest",
    iconColor: "bg-red-700",
    downloads: "4M+"
  },
  {
    id: "qbittorrent",
    name: "qBittorrent",
    description: "Free and reliable P2P BitTorrent client.",
    category: "Downloaders",
    image: "linuxserver/qbittorrent:latest",
    iconColor: "bg-blue-400",
    downloads: "12M+"
  }
];

export const MOCK_CONTAINERS: DockerContainer[] = [
  {
    id: "c1a2b3d4e5f6",
    name: "Plex",
    image: "plexinc/pms-docker:latest",
    state: "running",
    status: "Up 2 hours",
    ports: "32400:32400",
    created: "2023-10-25 10:00:00",
    cpu: 1.2,
    memory: 128,
    icon: "bg-orange-500",
    category: "Media",
    url: "http://localhost:32400"
  },
  {
    id: "a1b2c3d4e5f6",
    name: "Pi-hole",
    image: "pihole/pihole:latest",
    state: "running",
    status: "Up 5 days",
    ports: "80:80",
    created: "2023-10-20 08:30:00",
    cpu: 4.5,
    memory: 512,
    icon: "bg-red-600",
    category: "Network",
    url: "http://localhost/admin"
  },
  {
    id: "1234567890ab",
    name: "Home Assistant",
    image: "homeassistant/home-assistant:stable",
    state: "running",
    status: "Up 30 minutes",
    ports: "8123:8123",
    created: "2023-10-25 11:30:00",
    cpu: 12.8,
    memory: 256,
    icon: "bg-blue-500",
    category: "Automation",
    url: "http://localhost:8123"
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
  // ... others
];
