export type AppRole = "admin" | "super_admin" | "manager" | "convoyeur" | "client" | "sous_traitant";

type RoleRecord = {
  role: string | null;
  actif?: boolean | null;
};

const ROLE_PRIORITY: Record<AppRole, number> = {
  super_admin: 600,
  admin: 500,
  manager: 400,
  convoyeur: 300,
  sous_traitant: 200,
  client: 100,
};

export function isAppRole(role: string | null | undefined): role is AppRole {
  return role === "super_admin" || role === "admin" || role === "manager" || role === "convoyeur" || role === "sous_traitant" || role === "client";
}

export function getHighestPriorityRole(roles: RoleRecord[]): AppRole | null {
  return roles
    .filter((entry): entry is { role: AppRole; actif?: boolean | null } => isAppRole(entry.role))
    .sort((a, b) => ROLE_PRIORITY[b.role] - ROLE_PRIORITY[a.role])[0]?.role ?? null;
}

export function getHighestActiveRole(roles: RoleRecord[]): AppRole | null {
  return getHighestPriorityRole(roles.filter((entry) => entry.actif !== false));
}

export function hasRole(roles: RoleRecord[], targetRole: AppRole, actif?: boolean): boolean {
  return roles.some((entry) => entry.role === targetRole && (actif === undefined ? true : (entry.actif !== false) === actif));
}

export function isAdminRole(role: string | null | undefined): boolean {
  return role === "admin" || role === "super_admin";
}