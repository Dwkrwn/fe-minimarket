import type { RouteRecordRaw } from "vue-router";
import { generateCrudRoutes } from "./helpers";

/**
 * Configuration for auto-generated CRUD routes
 * Each entry will generate 3 routes: Landing, Form, and View
 *
 * Hanya modul Setup yang masih memakai generator CRUD.
 * Modul Purchasing dan Inventory memakai route eksplisit di index.ts.
 */
const crudRoutesConfig = [
  // Setup Routes
  {
    path: "/setup/user_default",
    name: "UserDefault",
    title: "UserDefault",
    basePath: "/setup/user_default",
  },
  {
    path: "/setup/m_role",
    name: "Role",
    title: "Role",
    basePath: "/setup/m_role",
  },
];

/**
 * Generate all CRUD routes from config
 */
export const crudRoutes: RouteRecordRaw[] = crudRoutesConfig.flatMap((config) =>
  generateCrudRoutes(config),
);
