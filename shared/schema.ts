import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, jsonb, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Installed Apps tracking
export const installedApps = pgTable("installed_apps", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category"),
  image: text("image").notNull(),
  iconColor: text("icon_color"),
  containerId: text("container_id"),
  status: text("status").notNull().default("stopped"),
  ports: jsonb("ports").$type<{ container: number; host: number }[]>(),
  environment: jsonb("environment").$type<Record<string, string>>(),
  volumes: jsonb("volumes").$type<{ host: string; container: string }[]>(),
  installedAt: timestamp("installed_at").notNull().defaultNow(),
});

// System Settings
export const settings = pgTable("settings", {
  id: text("id").primaryKey(),
  serverName: text("server_name").notNull().default("DockPilot-Home"),
  webPort: integer("web_port").notNull().default(8080),
  startOnBoot: integer("start_on_boot").notNull().default(1),
  autoUpdate: integer("auto_update").notNull().default(0),
  analytics: integer("analytics").notNull().default(1),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Schemas
export const insertInstalledAppSchema = createInsertSchema(installedApps).omit({
  installedAt: true,
});

export const insertSettingsSchema = createInsertSchema(settings).omit({
  updatedAt: true,
});

// Types
export type InstalledApp = typeof installedApps.$inferSelect;
export type InsertInstalledApp = z.infer<typeof insertInstalledAppSchema>;
export type Settings = typeof settings.$inferSelect;
export type InsertSettings = z.infer<typeof insertSettingsSchema>;
