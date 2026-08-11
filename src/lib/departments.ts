import { Types } from "mongoose";
import { CEO_DEPARTMENT_NAME } from "@/constants/lookups";
import { Department } from "@/models/Department";

/** Departments this manager is responsible for (source of truth: Department.managerId). */
export async function getManagedDepartmentIds(
  managerId: string | Types.ObjectId
): Promise<string[]> {
  const rows = await Department.find({
    managerId,
    underCeo: { $ne: true },
  })
    .select("_id")
    .lean();
  return rows.map((d) => String(d._id));
}

export async function getManagedDepartments(
  managerId: string | Types.ObjectId
): Promise<Array<{ _id: string; name: string }>> {
  const rows = await Department.find({
    managerId,
    underCeo: { $ne: true },
  })
    .select("_id name")
    .sort({ name: 1 })
    .lean();
  return rows.map((d) => ({ _id: String(d._id), name: d.name }));
}

/** Departments marked under CEO control (includes the system CEO dept). */
export async function getCeoControlledDepartments(): Promise<
  Array<{ _id: string; name: string }>
> {
  await ensureCeoDepartment();
  const rows = await Department.find({ underCeo: true })
    .select("_id name")
    .sort({ name: 1 })
    .lean();
  return rows.map((d) => ({ _id: String(d._id), name: d.name }));
}

export async function getCeoControlledDepartmentIds(): Promise<string[]> {
  const rows = await getCeoControlledDepartments();
  return rows.map((d) => d._id);
}

export async function isCeoControlledDepartmentId(
  departmentId: string | Types.ObjectId | null | undefined
): Promise<boolean> {
  if (!departmentId || !Types.ObjectId.isValid(String(departmentId))) {
    return false;
  }
  const dept = await Department.findById(departmentId)
    .select("underCeo name")
    .lean();
  if (!dept) return false;
  return Boolean(dept.underCeo) || dept.name === CEO_DEPARTMENT_NAME;
}

/** Find or create the system department for external-contract employees. */
export async function ensureCeoDepartment(): Promise<{
  _id: Types.ObjectId;
  name: string;
}> {
  let dept = await Department.findOne({ name: CEO_DEPARTMENT_NAME });
  if (!dept) {
    dept = await Department.create({
      name: CEO_DEPARTMENT_NAME,
      managerId: null,
      underCeo: true,
    });
  } else if (!dept.underCeo || dept.managerId) {
    dept.underCeo = true;
    dept.managerId = null;
    await dept.save();
  }
  return { _id: dept._id, name: dept.name };
}

/**
 * Assign selected departments to this manager.
 * Clears managerId on departments that were theirs but are no longer selected.
 * CEO-controlled departments cannot be assigned to managers.
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
      { managerId: mid, underCeo: { $ne: true } },
      { $set: { managerId: null } }
    );
    return [];
  }

  const found = await Department.find({ _id: { $in: oids } }).select(
    "_id underCeo"
  );
  if (found.length !== oids.length) {
    throw new Error("DEPARTMENT_NOT_FOUND");
  }
  if (found.some((d) => d.underCeo)) {
    throw new Error("CEO_CONTROLLED_DEPARTMENT");
  }

  await Department.updateMany(
    { managerId: mid, _id: { $nin: oids }, underCeo: { $ne: true } },
    { $set: { managerId: null } }
  );
  await Department.updateMany(
    { _id: { $in: oids } },
    { $set: { managerId: mid, underCeo: false } }
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
