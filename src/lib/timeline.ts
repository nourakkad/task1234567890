import { nextUpdateNo } from "@/lib/counters";
import {
  DailyUpdate,
  type TimelineEntryType,
} from "@/models/DailyUpdate";

export type { TimelineEntryType };

export async function addTimelineEntry(input: {
  taskId: string;
  createdBy: string;
  text: string;
  entryType: TimelineEntryType;
  result?: string;
}) {
  const updateNo = await nextUpdateNo();
  return DailyUpdate.create({
    updateNo,
    taskId: input.taskId,
    date: new Date(),
    workPerformed: input.text,
    result: input.result || "",
    entryType: input.entryType,
    createdBy: input.createdBy,
    hours: 0,
  });
}
