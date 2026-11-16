/** A job role as far as the department-fit rule is concerned (null = company-wide). */
export interface DepartmentBoundRole {
  departmentId: string | null;
}

/**
 * A job role fits a target department when it is company-wide or bound to exactly that department.
 * A `null` target (company-wide template, or a user without team) therefore accepts company-wide
 * roles only.
 */
export function roleFitsDepartment(
  role: DepartmentBoundRole,
  departmentId: string | null,
): boolean {
  return role.departmentId === null || role.departmentId === departmentId;
}

/** Roles selectable for the target department, in their given order. */
export function filterRolesForDepartment<T extends DepartmentBoundRole>(
  roles: readonly T[],
  departmentId: string | null,
): T[] {
  return roles.filter((role) => roleFitsDepartment(role, departmentId));
}

/** Keeps the current role id when it still fits, otherwise clears it (form behaviour). */
export function keepFittingRoleId(
  roles: readonly (DepartmentBoundRole & { id: string })[],
  roleId: string | null,
  departmentId: string | null,
): string | null {
  if (roleId === null) return null;
  const role = roles.find((entry) => entry.id === roleId);
  return role && roleFitsDepartment(role, departmentId) ? roleId : null;
}
