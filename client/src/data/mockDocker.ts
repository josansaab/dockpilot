
export interface DockerContainer {
  id: string;
  name: string;
  image: string;
  state: 'running' | 'stopped' | 'exited';
  status: string;
  ports: string;
  created: string;
  cpu: number;
  memory: number;
  iconUrl?: string; 
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
  iconUrl: string;
  downloads: string;
}

export const APP_CATALOG: AppStoreItem[] = [
  {
    id: "plex",
    name: "Plex Media Server",
    description: "Organizes all your personal media so you can enjoy it no matter where you are.",
    category: "Media",
    image: "plexinc/pms-docker:latest",
    iconUrl: "https://www.plex.tv/wp-content/uploads/2018/01/pmp-icon-1.png",
    downloads: "10M+"
  },
  {
    id: "jellyfin",
    name: "Jellyfin",
    description: "The Free Software Media System. No strings attached.",
    category: "Media",
    image: "jellyfin/jellyfin:latest",
    iconUrl: "https://raw.githubusercontent.com/jellyfin/jellyfin-ux/master/branding/SVG/icon-transparent.svg",
    downloads: "5M+"
  },
  {
    id: "pihole",
    name: "Pi-hole",
    description: "Network-wide Ad Blocking. A black hole for Internet advertisements.",
    category: "Network",
    image: "pihole/pihole:latest",
    iconUrl: "https://wp-cdn.pi-hole.net/wp-content/uploads/2016/12/Vortex-R.png",
    downloads: "20M+"
  },
  {
    id: "homeassistant",
    name: "Home Assistant",
    description: "Open source home automation that puts local control and privacy first.",
    category: "Automation",
    image: "homeassistant/home-assistant:stable",
    iconUrl: "https://upload.wikimedia.org/wikipedia/commons/6/6e/Home_Assistant_Logo.svg",
    downloads: "8M+"
  },
  {
    id: "nextcloud",
    name: "Nextcloud",
    description: "The self-hosted productivity platform that keeps you in control.",
    category: "Productivity",
    image: "nextcloud:latest",
    iconUrl: "https://upload.wikimedia.org/wikipedia/commons/6/60/Nextcloud_Logo.svg",
    downloads: "15M+"
  },
  {
    id: "portainer",
    name: "Portainer",
    description: "Making Docker and Kubernetes management easy.",
    category: "System",
    image: "portainer/portainer-ce:latest",
    iconUrl: "https://www.portainer.io/hubfs/portainer-logo-black.svg",
    downloads: "50M+"
  },
  {
    id: "nodered",
    name: "Node-RED",
    description: "Low-code programming for event-driven applications.",
    category: "Development",
    image: "nodered/node-red:latest",
    iconUrl: "https://nodered.org/about/resources/media/node-red-icon.svg",
    downloads: "4M+"
  },
  {
    id: "qbittorrent",
    name: "qBittorrent",
    description: "Free and reliable P2P BitTorrent client.",
    category: "Downloaders",
    image: "linuxserver/qbittorrent:latest",
    iconUrl: "https://upload.wikimedia.org/wikipedia/commons/6/66/New_qBittorrent_Logo.svg",
    downloads: "12M+"
  },
  {
    id: "grafana",
    name: "Grafana",
    description: "The open observability platform for metrics, logs, and traces.",
    category: "Monitoring",
    image: "grafana/grafana:latest",
    iconUrl: "https://raw.githubusercontent.com/grafana/grafana/main/public/img/grafana_icon.svg",
    downloads: "25M+"
  },
  {
    id: "nginx",
    name: "Nginx Proxy Manager",
    description: "Expose your services easily and securely with SSL.",
    category: "Network",
    image: "jc21/nginx-proxy-manager:latest",
    iconUrl: "https://raw.githubusercontent.com/NginxProxyManager/nginx-proxy-manager/develop/frontend/app-images/logo-256.png",
    downloads: "30M+"
  },
  {
    id: "vaultwarden",
    name: "Vaultwarden",
    description: "Lightweight Bitwarden server API implementation.",
    category: "Security",
    image: "vaultwarden/server:latest",
    iconUrl: "https://raw.githubusercontent.com/dani-garcia/vaultwarden/main/resources/vaultwarden-icon.svg",
    downloads: "8M+"
  },
  {
    id: "syncthing",
    name: "Syncthing",
    description: "Continuous file synchronization program.",
    category: "Productivity",
    image: "syncthing/syncthing:latest",
    iconUrl: "https://syncthing.net/img/logo-horizontal.svg",
    downloads: "10M+"
  }
];

export const MOCK_CONTAINERS: DockerContainer[] = [];

export const MOCK_IMAGES: DockerImage[] = [];
