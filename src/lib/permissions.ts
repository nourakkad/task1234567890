import { Types } from "mongoose";
import type { UserRole } from "@/constants/lookups";
import {
  getManagedDepartmentIds,
} from "@/lib/departments";
import { User } from "@/models/User";
import type { ITask } from "@/models/Task";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  /** Primary / legacy single department */
  departmentId?: string | null;
  /** Departments this manager is responsible for */
  departmentIds?: string[];
  managerId?: string | null;
}

/** General Manager or CEO — org-wide leadership */
export function isLeadership(role: UserRole) {
  return role === "general_manager" || role === "ceo";
}

/** HR owns creating/editing managers, employees, and departments */
export function canManageDirectory(role: UserRole) {
  return role === "hr";
}

/** CEO owns creating/editing/deleting HR accounts */
export function canManageHrAccounts(role: UserRole) {
  return role === "ceo";
}

/** @deprecated use canManageDirectory — kept for older call sites */
export function canManageTeam(role: UserRole) {
  return canManageDirectory(role);
}

export function canViewOrgDirectory(role: UserRole) {
  return role === "hr" || role === "ceo" || role === "manager";
}

export function canCreateTask(role: UserRole) {
  return (
    role === "general_manager" || role === "ceo" || role === "manager"
  );
}

export function canApproveTask(role: UserRole) {
  return (
    role === "general_manager" || role === "ceo" || role === "manager"
  );
}

export function canSetManagementDecision(role: UserRole) {
  return role === "general_manager" || role === "ceo";
}

export function canDeleteUpdate(role: UserRole) {
  return role === "general_manager" || role === "ceo";
}

export function canDeleteTask(role: UserRole) {
  return (
    role === "ceo" || role === "general_manager" || role === "manager"
  );
}

/** Leadership: any task. Manager: only tasks they assigned or owned by their team. */
export function canDeleteThisTask(
  user: SessionUser,
  task: ITask | { ownerId?: unknown; assignedById?: unknown; departmentId?: unknown },
  teamIds: string[],
  managedDeptIds?: string[]
) {
  if (user.role === "ceo" || user.role === "general_manager") return true;
  if (user.role !== "manager") return false;
  if (!canAccessTask(user, task, teamIds, managedDeptIds)) return false;

  const assignedBy = refId(
    (task as { assignedById?: unknown }).assignedById
  );
  if (assignedBy === user.id) return true;

  const ownerId = refId(task.ownerId);
  return Boolean(ownerId && teamIds.includes(ownerId));
}

export function canTrackEmployees(role: UserRole) {
  return role === "general_manager" || role === "ceo";
}

export function canTrackManagers(role: UserRole) {
  return role === "general_manager" || role === "ceo";
}

/** Resolve all department ids a manager may act in. */
export async function resolveManagerDepartmentIds(
  user: SessionUser
): Promise<string[]> {
  if (user.role !== "manager") {
    return user.departmentId ? [user.departmentId] : [];
  }
  if (user.departmentIds && user.departmentIds.length > 0) {
    return user.departmentIds;
  }
  const fromDb = await getManagedDepartmentIds(user.id);
  if (fromDb.length > 0) return fromDb;
  return user.departmentId ? [user.departmentId] : [];
}

export async function getVisibleTaskFilter(user: SessionUser) {
  // GM and CEO see everything
  if (user.role === "general_manager" || user.role === "ceo") return {};

  // HR only sees tasks assigned to them
  if (user.role === "hr") {
    return { ownerId: new Types.ObjectId(user.id) };
  }

  if (user.role === "manager") {
    const employees = await User.find({
      managerId: user.id,
      role: "employee",
    }).select("_id");
    const ownerIds = [
      new Types.ObjectId(user.id),
      ...employees.map((e) => e._id),
    ];
    // Own tasks + team tasks + tasks this manager assigned (even if employee left team)
    return {
      $or: [
        { ownerId: { $in: ownerIds } },
        { assignedById: new Types.ObjectId(user.id) },
      ],
    };
  }

  return { ownerId: new Types.ObjectId(user.id) };
}

function refId(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (value instanceof Types.ObjectId) return value.toString();
  if (typeof value === "object" && "_id" in (value as object)) {
    return refId((value as { _id: unknown })._id);
  }
  return String(value);
}

export function canAccessTask(
  user: SessionUser,
  task: ITask | { ownerId?: unknown; departmentId?: unknown; assignedById?: unknown },
  teamIds: string[],
  _managedDeptIds?: string[]
) {
  if (user.role === "general_manager" || user.role === "ceo") return true;

  const ownerId = refId(task.ownerId);

  if (user.role === "employee" || user.role === "hr") {
    return ownerId === user.id;
  }

  // manager: own tasks, team-member tasks, or tasks they assigned
  if (ownerId && ownerId === user.id) return true;
  if (ownerId && teamIds.includes(ownerId)) return true;
  return refId(task.assignedById) === user.id;
}

export async function getTeamMemberIds(managerId: string): Promise<string[]> {
  const employees = await User.find({
    managerId,
    role: "employee",
  }).select("_id");
  return employees.map((e) => e._id.toString());
}

export function canEditTask(
  user: SessionUser,
  task: ITask,
  teamIds: string[],
  managedDeptIds?: string[]
) {
  if (user.role === "general_manager" || user.role === "ceo") return true;
  if (user.role === "manager") {
    return canAccessTask(user, task, teamIds, managedDeptIds);
  }
  if (user.role === "hr") {
    return refId(task.ownerId) === user.id;
  }
  return task.ownerId.toString() === user.id;
}
