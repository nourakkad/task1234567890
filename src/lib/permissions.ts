import { Types } from "mongoose";
import type { UserRole } from "@/constants/lookups";
import { User } from "@/models/User";
import type { ITask } from "@/models/Task";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  departmentId?: string | null;
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
  return role === "ceo";
}

export function canTrackEmployees(role: UserRole) {
  return role === "general_manager" || role === "ceo";
}

export function canTrackManagers(role: UserRole) {
  return role === "general_manager" || role === "ceo";
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
    const filter: Record<string, unknown> = {
      $or: [{ ownerId: { $in: ownerIds } }],
    };
    if (user.departmentId) {
      filter.$or = [
        { ownerId: { $in: ownerIds } },
        { departmentId: new Types.ObjectId(user.departmentId) },
      ];
    }
    return filter;
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
  task: ITask | { ownerId?: unknown; departmentId?: unknown },
  teamIds: string[]
) {
  if (user.role === "general_manager" || user.role === "ceo") return true;

  const ownerId = refId(task.ownerId);
  const departmentId = refId(task.departmentId);

  if (user.role === "employee" || user.role === "hr") {
    return ownerId === user.id;
  }

  // manager: own tasks, department tasks, or team-member tasks
  if (ownerId && ownerId === user.id) return true;
  if (
    user.departmentId &&
    departmentId &&
    departmentId === user.departmentId
  ) {
    return true;
  }
  return Boolean(ownerId && teamIds.includes(ownerId));
}

export async function getTeamMemberIds(managerId: string): Promise<string[]> {
  const employees = await User.find({
    managerId,
    role: "employee",
  }).select("_id");
  return employees.map((e) => e._id.toString());
}

export function canEditTask(user: SessionUser, task: ITask, teamIds: string[]) {
  if (user.role === "general_manager" || user.role === "ceo") return true;
  if (user.role === "manager") {
    return canAccessTask(user, task, teamIds);
  }
  if (user.role === "hr") {
    return refId(task.ownerId) === user.id;
  }
  return task.ownerId.toString() === user.id;
}
