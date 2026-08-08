import { Counter } from "@/models/Counter";

export async function nextSequence(name: string): Promise<number> {
  const counter = await Counter.findByIdAndUpdate(
    name,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return counter.seq;
}

export async function nextTaskNo(): Promise<string> {
  const seq = await nextSequence("task");
  return `PUR-${String(seq).padStart(3, "0")}`;
}

export async function nextUpdateNo(): Promise<string> {
  const seq = await nextSequence("update");
  return `UPD-${String(seq).padStart(3, "0")}`;
}

export async function nextDocNo(prefix: "DOC" | "SMP" = "DOC"): Promise<string> {
  const seq = await nextSequence(prefix.toLowerCase());
  return `${prefix}-${String(seq).padStart(3, "0")}`;
}
