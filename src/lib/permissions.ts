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

export function canManageTeam(role: UserRole) {
  return role === "ceo" || role === "manager";
}

export function canCreateTask(role: UserRole) {
  return role === "ceo" || role === "manager";
}

export function canApproveTask(role: UserRole) {
  return role === "ceo" || role === "manager";
}

export function canSetManagementDecision(role: UserRole) {
  return role === "ceo";
}

export function canDeleteUpdate(role: UserRole) {
  return role === "ceo";
}

export async function getVisibleTaskFilter(user: SessionUser) {
  if (user.role === "ceo") return {};

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
  if (user.role === "ceo") return true;

  const ownerId = refId(task.ownerId);
  const departmentId = refId(task.departmentId);

  if (user.role === "employee") {
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
  if (user.role === "ceo") return true;
  if (user.role === "manager") {
    return canAccessTask(user, task, teamIds);
  }
  return task.ownerId.toString() === user.id;
}
