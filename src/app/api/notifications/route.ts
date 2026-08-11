import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { jsonError, jsonOk, handleApiError } from "@/lib/api";
import { requireSessionUser } from "@/lib/session";
import { Notification } from "@/models/Notification";

export async function GET(request: Request) {
  try {
    const user = await requireSessionUser();
    await connectDB();

    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get("unread") === "1";
    const countOnly = searchParams.get("count") === "1";

    const filter: Record<string, unknown> = {
      userId: new Types.ObjectId(user.id),
    };
    if (unreadOnly || countOnly) {
      filter.readAt = null;
    }

    if (countOnly) {
      const unreadCount = await Notification.countDocuments(filter);
      return jsonOk({ unreadCount });
    }

    const items = await Notification.find(filter)
      .populate("actorId", "name role")
      .populate("taskId", "taskNo name status")
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const unreadCount = await Notification.countDocuments({
      userId: new Types.ObjectId(user.id),
      readAt: null,
    });

    return jsonOk({ items, unreadCount });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireSessionUser();
    await connectDB();
    const body = await request.json().catch(() => ({}));

    const userOid = new Types.ObjectId(user.id);

    if (body.all === true) {
      await Notification.updateMany(
        { userId: userOid, readAt: null },
        { $set: { readAt: new Date() } }
      );
      return jsonOk({ ok: true, unreadCount: 0 });
    }

    const id = body.id ? String(body.id) : "";
    if (!id || !Types.ObjectId.isValid(id)) {
      return jsonError("معرّف الإشعار غير صالح");
    }

    const note = await Notification.findOne({
      _id: id,
      userId: userOid,
    });
    if (!note) return jsonError("الإشعار غير موجود", 404);

    if (!note.readAt) {
      note.readAt = new Date();
      await note.save();
    }

    const unreadCount = await Notification.countDocuments({
      userId: userOid,
      readAt: null,
    });

    return jsonOk({ ok: true, unreadCount, item: note });
  } catch (error) {
    return handleApiError(error);
  }
}
