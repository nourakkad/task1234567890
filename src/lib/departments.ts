import { Types } from "mongoose";
import { Department } from "@/models/Department";

/** Departments this manager is responsible for (source of truth: Department.managerId). */
export async function getManagedDepartmentIds(
  managerId: string | Types.ObjectId
): Promise<string[]> {
  const rows = await Department.find({ managerId }).select("_id").lean();
  return rows.map((d) => String(d._id));
}

export async function getManagedDepartments(
  managerId: string | Types.ObjectId
): Promise<Array<{ _id: string; name: string }>> {
  const rows = await Department.find({ managerId })
    .select("_id name")
    .sort({ name: 1 })
    .lean();
  return rows.map((d) => ({ _id: String(d._id), name: d.name }));
}

/**
 * Assign selected departments to this manager.
 * Clears managerId on departments that were theirs but are no longer selected.
 */
export async function syncManagerDepartments(
  managerId: Types.ObjectId | string,
  departmentIds: string[]
): Promise<Types.ObjectId[]> {
  const mid = new Types.ObjectId(String(managerId));
  const unique = [
    ...new Set(
      departmentIds
        .map(String)
        .filter((id) => Types.ObjectId.isValid(id))
    ),
  ];
  const oids = unique.map((id) => new Types.ObjectId(id));

  if (oids.length === 0) {
    await Department.updateMany(
      { managerId: mid },
      { $set: { managerId: null } }
    );
    return [];
  }

  const found = await Department.find({ _id: { $in: oids } }).select("_id");
  if (found.length !== oids.length) {
    throw new Error("DEPARTMENT_NOT_FOUND");
  }

  await Department.updateMany(
    { managerId: mid, _id: { $nin: oids } },
    { $set: { managerId: null } }
  );
  await Department.updateMany(
    { _id: { $in: oids } },
    { $set: { managerId: mid } }
  );

  return oids;
}

export function parseDepartmentIds(body: {
  departmentIds?: unknown;
  departmentId?: unknown;
}): string[] {
  if (Array.isArray(body.departmentIds)) {
    return body.departmentIds.map(String).filter(Boolean);
  }
  if (body.departmentId) {
    return [String(body.departmentId)];
  }
  return [];
}
