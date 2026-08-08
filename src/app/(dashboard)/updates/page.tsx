"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { apiGet } from "@/lib/client";
import { formatDate } from "@/lib/format";

interface UpdateRow {
  _id: string;
  updateNo: string;
  date: string;
  workPerformed: string;
  supplier?: string;
  result?: string;
  issue?: string;
  nextAction?: string;
  hours?: number;
  managerNotes?: string;
  taskId?: { _id: string; taskNo: string; name: string };
  createdBy?: { name: string };
}

export default function UpdatesPage() {
  const [updates, setUpdates] = useState<UpdateRow[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    apiGet<UpdateRow[]>("/api/updates")
      .then(setUpdates)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div>
      <PageHeader
        title="التحديث اليومي"
        subtitle="سجل العمل اليومي على المهام النشطة — بدون حذف للتحديثات السابقة"
      />
      {error ? <p className="text-[var(--danger)]">{error}</p> : null}
      <div className="card table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>رقم التحديث</th>
              <th>المهمة</th>
              <th>التاريخ</th>
              <th>العمل المنفذ</th>
              <th>المورد</th>
              <th>النتيجة</th>
              <th>ساعات</th>
              <th>بواسطة</th>
            </tr>
          </thead>
          <tbody>
            {updates.map((u) => (
              <tr key={u._id}>
                <td>{u.updateNo}</td>
                <td>
                  {u.taskId ? (
                    <Link
                      href={`/tasks/${u.taskId._id}`}
                      className="font-semibold text-[var(--brand)]"
                    >
                      {u.taskId.taskNo}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
                <td>{formatDate(u.date)}</td>
                <td className="whitespace-normal!">{u.workPerformed}</td>
                <td>{u.supplier || "—"}</td>
                <td className="whitespace-normal!">{u.result || "—"}</td>
                <td>{u.hours ?? 0}</td>
                <td>{u.createdBy?.name || "—"}</td>
              </tr>
            ))}
            {updates.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-[var(--muted)]">
                  لا توجد تحديثات
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
