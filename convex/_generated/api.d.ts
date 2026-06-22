/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as alerts from "../alerts.js";
import type * as auth from "../auth.js";
import type * as avances from "../avances.js";
import type * as blogs from "../blogs.js";
import type * as brief from "../brief.js";
import type * as clickUp from "../clickUp.js";
import type * as clickUpSync from "../clickUpSync.js";
import type * as clickUpUser from "../clickUpUser.js";
import type * as comentarioTareas from "../comentarioTareas.js";
import type * as comentariosFases from "../comentariosFases.js";
import type * as crons from "../crons.js";
import type * as emailNotifications from "../emailNotifications.js";
import type * as empresa from "../empresa.js";
import type * as empresaSchema from "../empresaSchema.js";
import type * as hitos from "../hitos.js";
import type * as http from "../http.js";
import type * as messages from "../messages.js";
import type * as mobile from "../mobile.js";
import type * as notificaciones from "../notificaciones.js";
import type * as permissions from "../permissions.js";
import type * as plantillasFasesProyecto from "../plantillasFasesProyecto.js";
import type * as presence from "../presence.js";
import type * as profile from "../profile.js";
import type * as proyecto from "../proyecto.js";
import type * as resumenHoras from "../resumenHoras.js";
import type * as syncTaskToClickUp from "../syncTaskToClickUp.js";
import type * as tareas from "../tareas.js";
import type * as tasks from "../tasks.js";
import type * as testimonios from "../testimonios.js";
import type * as tickets from "../tickets.js";
import type * as users from "../users.js";
import type * as workTracking from "../workTracking.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  alerts: typeof alerts;
  auth: typeof auth;
  avances: typeof avances;
  blogs: typeof blogs;
  brief: typeof brief;
  clickUp: typeof clickUp;
  clickUpSync: typeof clickUpSync;
  clickUpUser: typeof clickUpUser;
  comentarioTareas: typeof comentarioTareas;
  comentariosFases: typeof comentariosFases;
  crons: typeof crons;
  emailNotifications: typeof emailNotifications;
  empresa: typeof empresa;
  empresaSchema: typeof empresaSchema;
  hitos: typeof hitos;
  http: typeof http;
  messages: typeof messages;
  mobile: typeof mobile;
  notificaciones: typeof notificaciones;
  permissions: typeof permissions;
  plantillasFasesProyecto: typeof plantillasFasesProyecto;
  presence: typeof presence;
  profile: typeof profile;
  proyecto: typeof proyecto;
  resumenHoras: typeof resumenHoras;
  syncTaskToClickUp: typeof syncTaskToClickUp;
  tareas: typeof tareas;
  tasks: typeof tasks;
  testimonios: typeof testimonios;
  tickets: typeof tickets;
  users: typeof users;
  workTracking: typeof workTracking;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  betterAuth: import("../betterAuth/_generated/component.js").ComponentApi<"betterAuth">;
};
