import { Types } from "mongoose";
import { Notification, type NotificationType } from "@/models/Notification";
import type { UserRole } from "@/constants/lookups";

export function taskHrefForRole(
  role: UserRole | string | undefined,
  taskId: string
): string {
  switch (role) {
    case "employee":
      return `/my-tasks/${taskId}`;
    case "manager":
      return `/manager-tasks/${taskId}`;
    case "ceo":
      return `/ceo-tasks/${taskId}`;
    case "hr":
      return `/hr/tasks/${taskId}`;
    case "general_manager":
      return `/track/${taskId}`;
    default:
      return `/tasks/${taskId}`;
  }
}

/** Prefer track for assigners reviewing their assigned tasks. */
export function assignerTaskHref(
  role: UserRole | string | undefined,
  taskId: string
): string {
  switch (role) {
    case "manager":
      return `/team-tasks/${taskId}`;
    case "ceo":
    case "general_manager":
      return `/track/${taskId}`;
    default:
      return taskHrefForRole(role, taskId);
  }
}

type CreateArgs = {
  userId: string | Types.ObjectId;
  type: NotificationType;
  title: string;
  body?: string;
  taskId?: string | Types.ObjectId | null;
  actorId?: string | Types.ObjectId | null;
  href?: string;
};

export async function createNotification(args: CreateArgs) {
  const userId = String(args.userId);
  const actorId = args.actorId ? String(args.actorId) : null;
  if (actorId && actorId === userId) return null;

  return Notification.create({
    userId,
    type: args.type,
    title: args.title.slice(0, 200),
    body: (args.body || "").slice(0, 500),
    taskId: args.taskId || null,
    actorId: actorId || null,
    href: args.href || "",
    readAt: null,
  });
}

export async function notifyTaskAssigned(opts: {
  ownerId: string | Types.ObjectId;
  ownerRole?: string;
  assignedById: string | Types.ObjectId;
  assignerName: string;
  taskId: string | Types.ObjectId;
  taskNo: string;
  taskName: string;
}) {
  const taskId = String(opts.taskId);
  return createNotification({
    userId: opts.ownerId,
    actorId: opts.assignedById,
    type: "task_assigned",
    taskId,
    title: `مهمة جديدة: ${opts.taskNo}`,
    body: `${opts.assignerName} أسند إليك «${opts.taskName}»`,
    href: taskHrefForRole(opts.ownerRole, taskId),
  });
}

export async function notifyTaskUpdate(opts: {
  assignedById: string | Types.ObjectId | null | undefined;
  assignerRole?: string;
  actorId: string | Types.ObjectId;
  actorName: string;
  taskId: string | Types.ObjectId;
  taskNo: string;
  taskName: string;
  snippet?: string;
}) {
  if (!opts.assignedById) return null;
  const taskId = String(opts.taskId);
  return createNotification({
    userId: opts.assignedById,
    actorId: opts.actorId,
    type: "task_update",
    taskId,
    title: `تحديث على ${opts.taskNo}`,
    body: `${opts.actorName}: ${(opts.snippet || opts.taskName).slice(0, 120)}`,
    href: assignerTaskHref(opts.assignerRole, taskId),
  });
}

export async function notifyAwaitingDecision(opts: {
  assignedById: string | Types.ObjectId | null | undefined;
  assignerRole?: string;
  actorId: string | Types.ObjectId;
  actorName: string;
  taskId: string | Types.ObjectId;
  taskNo: string;
  taskName: string;
}) {
  if (!opts.assignedById) return null;
  const taskId = String(opts.taskId);
  return createNotification({
    userId: opts.assignedById,
    actorId: opts.actorId,
    type: "awaiting_decision",
    taskId,
    title: `بانتظار قرارك: ${opts.taskNo}`,
    body: `${opts.actorName} يطلب قرارًا بشأن «${opts.taskName}»`,
    href: assignerTaskHref(opts.assignerRole, taskId),
  });
}

export async function notifyDecisionMade(opts: {
  ownerId: string | Types.ObjectId;
  ownerRole?: string;
  actorId: string | Types.ObjectId;
  actorName: string;
  taskId: string | Types.ObjectId;
  taskNo: string;
  taskName: string;
  decisionLabel: string;
}) {
  const taskId = String(opts.taskId);
  return createNotification({
    userId: opts.ownerId,
    actorId: opts.actorId,
    type: "decision_made",
    taskId,
    title: `قرار على ${opts.taskNo}`,
    body: `${opts.actorName}: ${opts.decisionLabel} — «${opts.taskName}»`,
    href: taskHrefForRole(opts.ownerRole, taskId),
  });
}
