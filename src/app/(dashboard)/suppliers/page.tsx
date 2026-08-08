"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { apiGet } from "@/lib/client";

interface SupplierRow {
  _id: string;
  name: string;
  product?: string;
  currency?: string;
  sampleStatus?: string;
  rating?: number;
  decision?: string;
  reason?: string;
  taskId?: { _id: string; taskNo: string; name: string };
}

export default function SuppliersPage() {
  const [rows, setRows] = useState<SupplierRow[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    apiGet<SupplierRow[]>("/api/suppliers")
      .then(setRows)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div>
      <PageHeader
        title="الموردون"
        subtitle="مقارنة الموردين المرتبطين بالمهام ضمن نطاقك"
      />
      {error ? <p className="text-[var(--danger)]">{error}</p> : null}
      <div className="card table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>المهمة</th>
              <th>المورد</th>
              <th>المنتج</th>
              <th>العملة</th>
              <th>حالة العينة</th>
              <th>التقييم</th>
              <th>القرار</th>
              <th>السبب</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s._id}>
                <td>
                  {s.taskId ? (
                    <Link
                      href={`/tasks/${s.taskId._id}`}
                      className="font-semibold text-[var(--brand)]"
                    >
                      {s.taskId.taskNo}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
                <td>{s.name}</td>
                <td className="whitespace-normal!">{s.product || "—"}</td>
                <td>{s.currency || "—"}</td>
                <td>{s.sampleStatus || "—"}</td>
                <td>{s.rating ?? "—"}</td>
                <td>{s.decision || "—"}</td>
                <td className="whitespace-normal!">{s.reason || "—"}</td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-[var(--muted)]">
                  لا يوجد موردون
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
