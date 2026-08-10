import { Types } from "mongoose";
import type { SessionUser } from "@/lib/permissions";

export function currentMonthRange(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { start, end };
}

export function parsePerformanceScore(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 10) return null;
  return n;
}

/** CEO rates manager tasks; manager rates employee tasks — only on end. */
export function ratingRequiredOnEnd(
  reviewer: SessionUser,
  ownerRole: string | undefined
) {
  if (reviewer.role === "ceo" && ownerRole === "manager") return true;
  if (reviewer.role === "manager" && ownerRole === "employee") return true;
  return false;
}

export type TeamPerformanceRow = {
  userId: string;
  name: string;
  avgScore: number | null;
  reviewCount: number;
};

export type MonthPerformanceRow = {
  monthKey: string;
  avgScore: number;
  reviewCount: number;
};

export async function buildTeamPerformance(
  people: Array<{ _id: Types.ObjectId; name: string }>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TaskModel: { aggregate: (pipeline: any[]) => Promise<any[]> },
  monthStart: Date,
  monthEnd: Date
): Promise<TeamPerformanceRow[]> {
  if (people.length === 0) return [];

  const ids = people.map((p) => p._id);
  const rows = await TaskModel.aggregate([
    {
      $match: {
        ownerId: { $in: ids },
        performanceScore: { $gte: 1, $lte: 10 },
        performanceRatedAt: { $gte: monthStart, $lt: monthEnd },
      },
    },
    {
      $group: {
        _id: "$ownerId",
        avgScore: { $avg: "$performanceScore" },
        reviewCount: { $sum: 1 },
      },
    },
  ]);

  const byOwner = new Map(
    rows.map((r) => [
      String(r._id),
      {
        avgScore: r.avgScore as number,
        reviewCount: r.reviewCount as number,
      },
    ])
  );

  return people.map((p) => {
    const stats = byOwner.get(String(p._id));
    return {
      userId: String(p._id),
      name: p.name,
      avgScore: stats ? stats.avgScore : null,
      reviewCount: stats?.reviewCount ?? 0,
    };
  });
}

/** All months that have ratings for one person, newest first. */
export async function buildUserMonthHistory(
  ownerId: Types.ObjectId | string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TaskModel: { aggregate: (pipeline: any[]) => Promise<any[]> }
): Promise<MonthPerformanceRow[]> {
  const rows = await TaskModel.aggregate([
    {
      $match: {
        ownerId: new Types.ObjectId(String(ownerId)),
        performanceScore: { $gte: 1, $lte: 10 },
        performanceRatedAt: { $ne: null },
      },
    },
    {
      $group: {
        _id: {
          year: { $year: "$performanceRatedAt" },
          month: { $month: "$performanceRatedAt" },
        },
        avgScore: { $avg: "$performanceScore" },
        reviewCount: { $sum: 1 },
      },
    },
    { $sort: { "_id.year": -1, "_id.month": -1 } },
  ]);

  return rows.map((r) => {
    const year = r._id.year as number;
    const month = r._id.month as number;
    return {
      monthKey: `${year}-${String(month).padStart(2, "0")}`,
      avgScore: r.avgScore as number,
      reviewCount: r.reviewCount as number,
    };
  });
}
