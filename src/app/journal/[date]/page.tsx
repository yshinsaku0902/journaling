import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getEntry } from "@/lib/store";
import { SignInPrompt } from "@/components/SignInPrompt";
import { DayEditor } from "@/components/DayEditor";
import { DEMO_MODE } from "@/lib/env";
import {
  isValidDateStr,
  todayJst,
  addDays,
  jpDateParts,
  dayOfYear,
} from "@/lib/date";

export const dynamic = "force-dynamic";

export default async function JournalPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  const today = todayJst();

  if (date === "today" || !isValidDateStr(date)) {
    redirect(`/journal/${today}`);
  }

  const user = await getCurrentUser();
  if (!user) return <SignInPrompt />;

  const entry = await getEntry(user.id, date);

  return (
    <DayEditor
      date={date}
      initialEntry={entry}
      prevDate={addDays(date, -1)}
      nextDate={addDays(date, 1)}
      isToday={date === today}
      dayNumber={dayOfYear(date)}
      parts={jpDateParts(date)}
      demoMode={DEMO_MODE}
    />
  );
}
