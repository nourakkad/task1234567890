import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { jsonError, jsonOk, handleApiError } from "@/lib/api";
import {
  canAccessTask,
  canApproveTask,
  getTeamMemberIds,
} from "@/lib/permissions";
import {
  parsePerformanceScore,
  ratingRequiredOnEnd,
} from "@/lib/performance";
import { requireSessionUser } from "@/lib/session";
import { addTimelineEntry } from "@/lib/timeline";
import { notifyDecisionMade } from "@/lib/notifications";
import { Task } from "@/models/Task";
import { User } from "@/models/User";

type Params = { params: Promise<{ id: string }> };
type Decision = "approved" | "rejected" | "ended" | "note";

export async function POST(request: Request, { params }: Params) {
  try {
    const user = await requireSessionUser();
    if (!canApproveTask(user.role)) {
      return jsonError("ليس لديك صلاحية الاعتماد", 403);
    }

    await connectDB();
    const { id } = await params;
    if (!Types.ObjectId.isValid(id)) return jsonError("معرّف غير صالح", 400);

    const task = await Task.findById(id);
    if (!task) return jsonError("المهمة غير موجودة", 404);

    const teamIds =
      user.role === "manager" ? await getTeamMemberIds(user.id) : [];
    if (!canAccessTask(user, task, teamIds)) {
      return jsonError("غير مصرح", 403);
    }

    if (task.status === "مكتملة" || task.status === "ملغاة") {
      return jsonError("المهمة مغلقة ولا يمكن تعديل قرارها", 400);
    }

    const body = await request.json();
    const decision = body.decision as Decision;
    const note = typeof body.notes === "string" ? body.notes.trim() : "";

    if (!["approved", "rejected", "ended", "note"].includes(decision)) {
      return jsonError("قرار غير صالح");
    }

    if (note) {
      if (user.role === "general_manager" || user.role === "ceo") {
        task.managementDecision = note;
        task.nextAction = note;
      } else if (user.role === "manager") {
        task.nextAction = note;
      }
    }

    if (decision === "note") {
      if (!note) return jsonError("أدخل القرار أو الأمر أولاً");
      if (user.role === "general_manager") {
        await addTimelineEntry({
          taskId: task._id.toString(),
          createdBy: user.id,
          text: note,
          entryType: "gm_order",
          result: "أمر / قرار من المدير العام",
        });
      } else if (user.role === "ceo") {
        await addTimelineEntry({
          taskId: task._id.toString(),
          createdBy: user.id,
          text: note,
          entryType: "ceo_order",
          result: "أمر / قرار من المدير التنفيذي",
        });
      } else if (user.role === "manager") {
        await addTimelineEntry({
          taskId: task._id.toString(),
          createdBy: user.id,
          text: note,
          entryType: "manager_order",
          result: "أمر / قرار من المدير",
        });
      }
      task.lastUpdate = new Date();
      await task.save();
      const populated = await Task.findById(task._id)
        .populate("ownerId", "name email role")
        .populate("departmentId", "name")
        .populate("assignedById", "name");
      return jsonOk(populated);
    }

    let decisionLabel = "";

    if (decision === "approved") {
      task.managerApproval = "approved";
      if (task.status === "بانتظار قرار الإدارة") {
        task.status = "قيد التنفيذ";
      }
      decisionLabel = "قبول المهمة";
    }

    if (decision === "rejected") {
      task.managerApproval = "rejected";
      task.status = "ملغاة";
      task.closureDate = new Date();
      decisionLabel = "رفض المهمة";
    }

    if (decision === "ended") {
      if (
        user.role !== "general_manager" &&
        user.role !== "ceo" &&
        user.role !== "manager"
      ) {
        return jsonError("غير مصرح بإنهاء المهمة", 403);
      }

      const owner = await User.findById(task.ownerId).select("role managerId");
      const ownerRole = owner?.role;

      if (ratingRequiredOnEnd(user, ownerRole)) {
        if (user.role === "manager") {
          const ownerId = task.ownerId.toString();
          if (!teamIds.includes(ownerId)) {
            return jsonError("لا يمكن تقييم موظف خارج فريقك", 403);
          }
        }
        if (task.performanceScore != null) {
          return jsonError("تم تقييم هذه المهمة مسبقًا", 400);
        }
        const score = parsePerformanceScore(body.performanceScore);
        if (score == null) {
          return jsonError("يجب اختيار تقييم من 1 إلى 10 عند إنهاء المهمة", 400);
        }
        task.performanceScore = score;
        task.performanceRatedById = new Types.ObjectId(user.id);
        task.performanceRatedAt = new Date();
      }

      task.managerApproval = "approved";
      task.status = "مكتملة";
      task.progress = 1;
      task.closureDate = new Date();
      decisionLabel =
        task.performanceScore != null
          ? `إنهاء المهمة — تقييم ${task.performanceScore}/10`
          : "إنهاء المهمة";
    }

    if (user.role === "general_manager") {
      await addTimelineEntry({
        taskId: task._id.toString(),
        createdBy: user.id,
        text: note || decisionLabel,
        entryType: "gm_decision",
        result: decisionLabel,
      });
    } else if (user.role === "ceo") {
      await addTimelineEntry({
        taskId: task._id.toString(),
        createdBy: user.id,
        text: note || decisionLabel,
        entryType: "ceo_decision",
        result: decisionLabel,
      });
    } else if (user.role === "manager") {
      await addTimelineEntry({
        taskId: task._id.toString(),
        createdBy: user.id,
        text: note || decisionLabel,
        entryType: "manager_decision",
        result: decisionLabel,
      });
    }

    task.lastUpdate = new Date();
    await task.save();

    try {
      const owner = await User.findById(task.ownerId).select("role");
      await notifyDecisionMade({
        ownerId: task.ownerId,
        ownerRole: owner?.role,
        actorId: user.id,
        actorName: user.name,
        taskId: task._id,
        taskNo: task.taskNo,
        taskName: task.name,
        decisionLabel,
      });
    } catch {
      // ignore
    }

    const populated = await Task.findById(task._id)
      .populate("ownerId", "name email role")
      .populate("departmentId", "name")
      .populate("assignedById", "name");

    return jsonOk(populated);
  } catch (error) {
    return handleApiError(error);
  }
}
