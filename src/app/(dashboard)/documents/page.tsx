"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { apiGet } from "@/lib/client";
import { formatDate } from "@/lib/format";

interface DocRow {
  _id: string;
  recordNo: string;
  recordType: string;
  name: string;
  supplier?: string;
  status?: string;
  reviewResult?: string;
  requestDate?: string;
  actualDate?: string;
  fileLink?: string;
  taskId?: { _id: string; taskNo: string; name: string };
}

export default function DocumentsPage() {
  const [rows, setRows] = useState<DocRow[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    apiGet<DocRow[]>("/api/documents")
      .then(setRows)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div>
      <PageHeader
        title="العينات والمستندات"
        subtitle="تتبع طلب واستلام ومراجعة العينات والمستندات"
      />
      {error ? <p className="text-[var(--danger)]">{error}</p> : null}
      <div className="card table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>رقم السجل</th>
              <th>المهمة</th>
              <th>النوع</th>
              <th>الاسم</th>
              <th>المورد</th>
              <th>الحالة</th>
              <th>تاريخ الطلب</th>
              <th>الاستلام الفعلي</th>
              <th>الرابط</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d._id}>
                <td>{d.recordNo}</td>
                <td>
                  {d.taskId ? (
                    <Link
                      href={`/tasks/${d.taskId._id}`}
                      className="font-semibold text-[var(--brand)]"
                    >
                      {d.taskId.taskNo}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
                <td>{d.recordType}</td>
                <td className="whitespace-normal!">{d.name}</td>
                <td>{d.supplier || "—"}</td>
                <td>{d.status || "—"}</td>
                <td>{formatDate(d.requestDate)}</td>
                <td>{formatDate(d.actualDate)}</td>
                <td>
                  {d.fileLink ? (
                    <a
                      href={d.fileLink}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[var(--brand)]"
                    >
                      فتح
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-[var(--muted)]">
                  لا توجد سجلات
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
