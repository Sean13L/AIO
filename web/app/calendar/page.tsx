"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuthGate } from "@/lib/useAuthGate";
import { api } from "@/lib/api";
import type { ItemWithCourse, LectureWithCourse } from "@/lib/types";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// Our timestamps are stored/interpreted as UTC (see ingestSyllabus.ts), so
// the grid is built in UTC too — otherwise events could land a day off
// depending on the viewer's local timezone.
function ymdUTC(iso: string): string {
  return iso.slice(0, 10);
}

function hmUTC(iso: string): string {
  return iso.slice(11, 16);
}

export default function CalendarPage() {
  const { email, ready } = useAuthGate();
  const [items, setItems] = useState<ItemWithCourse[] | null>(null);
  const [lectures, setLectures] = useState<LectureWithCourse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  });

  useEffect(() => {
    if (!email) return;
    setError(null);
    Promise.all([api.listAllItems(), api.listAllLectures()])
      .then(([i, l]) => {
        setItems(i);
        setLectures(l);
      })
      .catch((err) => setError((err as Error).message));
  }, [email]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, { items: ItemWithCourse[]; lectures: LectureWithCourse[] }>();
    for (const item of items ?? []) {
      const key = ymdUTC(item.due_at);
      if (!map.has(key)) map.set(key, { items: [], lectures: [] });
      map.get(key)!.items.push(item);
    }
    for (const lecture of lectures ?? []) {
      const key = ymdUTC(lecture.scheduled_at);
      if (!map.has(key)) map.set(key, { items: [], lectures: [] });
      map.get(key)!.lectures.push(lecture);
    }
    return map;
  }, [items, lectures]);

  if (!ready) return null;
  if (!email) {
    return (
      <div className="card">
        <p>
          <Link href="/auth/signin">Sign in</Link> to see your calendar.
        </p>
      </div>
    );
  }

  const year = cursor.getUTCFullYear();
  const month = cursor.getUTCMonth();
  const firstWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const todayKey = ymdUTC(new Date().toISOString());

  function goPrev() {
    setCursor(new Date(Date.UTC(year, month - 1, 1)));
  }
  function goNext() {
    setCursor(new Date(Date.UTC(year, month + 1, 1)));
  }
  function goToday() {
    const now = new Date();
    setCursor(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)));
  }

  return (
    <div>
      <h1>Calendar</h1>
      <p className="muted">
        Every extracted date across all your courses. For an external calendar app instead, see
        the subscribe link on the <Link href="/">Courses</Link> page.
      </p>
      {error && <p className="error">{error}</p>}

      <div className="calendar-nav">
        <button className="secondary" onClick={goPrev}>
          &larr; Prev
        </button>
        <h2>
          {MONTH_LABELS[month]} {year}
        </h2>
        <button className="secondary" onClick={goNext}>
          Next &rarr;
        </button>
        <button className="secondary" onClick={goToday}>
          Today
        </button>
      </div>

      {items === null || lectures === null ? (
        <p className="muted">Loading…</p>
      ) : (
        <div className="calendar-grid-scroll">
        <div className="calendar-grid">
          {WEEKDAY_LABELS.map((w) => (
            <div key={w} className="calendar-weekday">
              {w}
            </div>
          ))}
          {cells.map((day, idx) => {
            if (day === null) {
              return <div key={idx} className="calendar-cell calendar-cell-empty" />;
            }
            const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const dayEvents = eventsByDay.get(key);
            return (
              <div key={idx} className={`calendar-cell${key === todayKey ? " calendar-today" : ""}`}>
                <div className="calendar-day-number">{day}</div>
                {dayEvents?.items.map((item) => (
                  <Link
                    key={item.id}
                    href={`/courses/${item.course_id}`}
                    className="calendar-event calendar-event-item"
                    title={item.name}
                  >
                    {item.is_datetime ? `${hmUTC(item.due_at)} ` : ""}
                    {item.course_code}: {item.name}
                  </Link>
                ))}
                {dayEvents?.lectures.map((lecture) => (
                  <Link
                    key={lecture.id}
                    href={`/courses/${lecture.course_id}/lectures/${lecture.id}`}
                    className="calendar-event calendar-event-lecture"
                    title="Lecture"
                  >
                    {hmUTC(lecture.scheduled_at)} {lecture.course_code}: Lecture
                  </Link>
                ))}
              </div>
            );
          })}
        </div>
        </div>
      )}
    </div>
  );
}
