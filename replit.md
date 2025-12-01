# DockPilot - Docker Container Management GUI

## Overview

DockPilot is a full-stack web application that provides a modern graphical interface for managing Docker containers and images. The application allows users to view, start, stop, and manage Docker containers through an intuitive dashboard, install pre-configured applications from an app store, and configure system settings. Built with a React frontend and Express backend, it uses PostgreSQL for data persistence and Dockerode for Docker API integration.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Technology Stack:**
- **Framework:** React with TypeScript
- **Bundler:** Vite for fast development and optimized production builds
- **Routing:** Wouter for lightweight client-side routing
- **State Management:** TanStack Query (React Query) for server state management
- **UI Framework:** Shadcn UI components built on Radix UI primitives
- **Styling:** Tailwind CSS with custom design tokens

**Design Decisions:**
- **Component-based architecture:** Uses reusable UI components from Shadcn UI for consistent design
- **Server state caching:** React Query handles API data fetching, caching, and synchronization
- **Type safety:** Full TypeScript coverage with shared types between frontend and backend
- **Dark-first design:** Modern dark theme optimized for developer tools aesthetic
- **Responsive layout:** Mobile-friendly design with adaptive navigation

**Key Pages:**
- Dashboard: Real-time container status and quick actions
- App Store: Pre-configured application catalog for one-click installations
- File Manager: Browse server files (UI implementation)
- Settings: System configuration and preferences
- Login/Setup: Authentication and initial setup flow

### Backend Architecture

**Technology Stack:**
- **Runtime:** Node.js with Express.js framework
- **Language:** TypeScript with ESM modules
- **Docker Integration:** Dockerode library for Docker daemon communication
- **Session Management:** Cookie-based sessions with in-memory or database storage
- **Authentication:** bcryptjs for password hashing

**Design Decisions:**
- **RESTful API:** Clear endpoint structure for CRUD operations on containers, images, and apps
- **Docker abstraction layer:** `server/docker.ts` provides typed interfaces for Docker operations
- **Session-based auth:** Secure cookie-based authentication with session expiration
- **Setup workflow:** First-time setup creates initial admin user
- **Error handling:** Centralized error handling and logging middleware

**API Structure:**
- `/api/auth/*` - Authentication endpoints (login, setup, session)
- `/api/containers/*` - Container management (list, start, stop, remove, logs)
- `/api/images/*` - Image management (list, pull, remove)
- `/api/apps/*` - Installed applications CRUD
- `/api/settings/*` - System settings management
- `/api/health` - Health check endpoint

### Database Architecture

**Technology:** PostgreSQL via Neon serverless driver
**ORM:** Drizzle ORM for type-safe database operations

**Schema Design:**
- **users:** Authentication credentials (id, username, passwordHash)
- **sessions:** Active user sessions with expiration
- **installedApps:** Tracks installed Docker applications with metadata
- **settings:** System-wide configuration (server name, ports, feature flags)

**Design Rationale:**
- **Type-safe queries:** Drizzle provides full TypeScript support with compile-time validation
- **Serverless-ready:** Neon driver supports both traditional and edge deployments
- **Migration strategy:** Drizzle Kit manages schema migrations in `/migrations`
- **Shared schema:** Database schema defined in `shared/schema.ts` for frontend/backend consistency

### Build & Deployment

**Build Process:**
- **Client build:** Vite compiles React app to static assets in `dist/public`
- **Server build:** esbuild bundles server code to single CJS file in `dist/index.cjs`
- **Dependency bundling:** Critical dependencies bundled to reduce cold start time
- **Production optimization:** Tree-shaking, minification, and code splitting

**Development Workflow:**
- **Vite dev server:** Hot module replacement for client development
- **TSX runtime:** Direct TypeScript execution for server development
- **Middleware mode:** Vite serves as middleware in Express during development

## External Dependencies

### Third-Party Services

**Neon Database:**
- Serverless PostgreSQL database
- Connection string via `DATABASE_URL` environment variable
- Supports both HTTP and WebSocket connections

**Docker Daemon:**
- Requires Docker socket access at `/var/run/docker.sock`
- Not available in Replit environment (mock data used in demo)
- Full functionality available when deployed to Ubuntu/Debian servers

### Key Libraries

**Frontend:**
- `@tanstack/react-query` - Server state management and caching
- `@radix-ui/*` - Unstyled accessible UI primitives
- `wouter` - Lightweight routing
- `axios` - HTTP client for API requests
- `lucide-react` - Icon library

**Backend:**
- `dockerode` - Docker Engine API client
- `drizzle-orm` - Type-safe SQL ORM
- `@neondatabase/serverless` - Neon PostgreSQL driver
- `bcryptjs` - Password hashing
- `express` - Web framework
- `cookie-parser` - Cookie handling middleware

**Build Tools:**
- `vite` - Frontend build tool
- `esbuild` - Server bundler
- `drizzle-kit` - Database migration tool
- `tsx` - TypeScript execution engine

### Environment Configuration

**Required Variables:**
- `DATABASE_URL` - PostgreSQL connection string
- `NODE_ENV` - Runtime environment (development/production)

**Optional Variables:**
- `REPL_ID` - Replit environment detection for special plugins