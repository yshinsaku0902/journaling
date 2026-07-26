// Microsoft Graph で当日の Outlook 予定を取得する。
import type { OutlookEventInput } from "./types";

interface GraphEvent {
  id: string;
  subject?: string;
  isAllDay?: boolean;
  start?: { dateTime?: string; timeZone?: string };
  end?: { dateTime?: string; timeZone?: string };
}

// Prefer で Tokyo に固定して返される naive な "yyyy-MM-ddTHH:mm:ss" から分に変換
function timeToMinutes(dt: string | undefined, viewDate: string): number | null {
  if (!dt) return null;
  const [datePart, timePart] = dt.split("T");
  if (!timePart) return null;
  const [hh, mm] = timePart.split(":").map(Number);
  if (Number.isNaN(hh)) return null;
  let minutes = hh * 60 + (mm || 0);
  if (datePart < viewDate) minutes = 0; // 前日から続く予定
  else if (datePart > viewDate) minutes = 24 * 60; // 翌日まで続く予定
  return minutes;
}

export async function fetchOutlookEvents(
  accessToken: string,
  date: string,
): Promise<OutlookEventInput[]> {
  const start = `${date}T00:00:00`;
  const end = `${date}T23:59:59`;
  const params = new URLSearchParams({
    startDateTime: start,
    endDateTime: end,
    $select: "id,subject,start,end,isAllDay",
    $orderby: "start/dateTime",
    $top: "50",
  });
  const url = `https://graph.microsoft.com/v1.0/me/calendarView?${params.toString()}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Prefer: 'outlook.timezone="Tokyo Standard Time"',
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Graph API error ${res.status}: ${body}`);
  }

  const data = (await res.json()) as { value?: GraphEvent[] };
  const events: OutlookEventInput[] = [];
  for (const ev of data.value ?? []) {
    if (ev.isAllDay) continue; // 終日予定は時間軸に載せない
    const startMin = timeToMinutes(ev.start?.dateTime, date);
    if (startMin === null) continue;
    const endMin = timeToMinutes(ev.end?.dateTime, date);
    events.push({
      outlookEventId: ev.id,
      title: ev.subject?.trim() || "(件名なし)",
      startMinutes: startMin,
      endMinutes: endMin,
    });
  }
  return events;
}

// デモモード用のサンプル予定（写真の手帳に近い一日）
export function mockOutlookEvents(date: string): OutlookEventInput[] {
  const id = (n: string) => `demo-${date}-${n}`;
  const h = (hour: number, min = 0) => hour * 60 + min;
  return [
    { outlookEventId: id("1"), title: "朝ラン 8km", startMinutes: h(7), endMinutes: h(8) },
    { outlookEventId: id("2"), title: "経営会議", startMinutes: h(9), endMinutes: h(10) },
    { outlookEventId: id("3"), title: "キックオフ打合せ", startMinutes: h(12), endMinutes: h(13) },
    { outlookEventId: id("4"), title: "インフラ レッスン", startMinutes: h(15), endMinutes: h(16) },
    { outlookEventId: id("5"), title: "AIアプリ開発 MTG", startMinutes: h(16), endMinutes: h(17) },
    { outlookEventId: id("6"), title: "生保 面談", startMinutes: h(18), endMinutes: h(18, 30) },
  ];
}
