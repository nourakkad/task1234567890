"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { apiGet, apiSend } from "@/lib/client";

interface Department {
  _id: string;
  name: string;
  managerId?: { _id: string; name: string; email: string } | null;
}

export default function SettingsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    const data = await apiGet<Department[]>("/api/departments");
    setDepartments(data);
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  async function rename(id: string, name: string) {
    setError("");
    setMessage("");
    try {
      await apiSend("/api/departments", "PATCH", { id, name });
      await load();
      setMessage("تم تحديث القسم");
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل التحديث");
    }
  }

  return (
    <div>
      <PageHeader
        title="الأقسام"
        subtitle="الأقسام الخمسة تحت المدير التنفيذي"
      />
      {error ? <p className="mb-3 text-[var(--danger)]">{error}</p> : null}
      {message ? <p className="mb-3 text-[var(--ok)]">{message}</p> : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {departments.map((d) => (
          <div key={d._id} className="card p-4">
            <div className="field">
              <label>اسم القسم</label>
              <input
                defaultValue={d.name}
                onBlur={(e) => {
                  if (e.target.value !== d.name) {
                    rename(d._id, e.target.value);
                  }
                }}
              />
            </div>
            <div className="mt-3 text-sm text-[var(--muted)]">
              المدير: {d.managerId?.name || "غير معيّن"}
              {d.managerId?.email ? (
                <div className="text-xs">{d.managerId.email}</div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
