import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "./api.js";

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return [hours, minutes, remainder].map((part) => String(part).padStart(2, "0")).join(":");
}

export default function WorkoutCalendar({ token }) {
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(dateKey(new Date()));
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
  const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const from = dateKey(monthStart);
  const to = dateKey(monthEnd);
  const gridDays = useMemo(() => {
    const first = new Date(monthStart);
    first.setDate(first.getDate() - ((first.getDay() + 6) % 7));
    const last = new Date(monthEnd);
    last.setDate(last.getDate() + (7 - ((last.getDay() + 6) % 7) - 1));
    const dates = [];
    for (const date = new Date(first); date <= last; date.setDate(date.getDate() + 1)) dates.push(new Date(date));
    return dates;
  }, [month.getFullYear(), month.getMonth()]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    apiRequest(`/setlist/calendar?from=${from}&to=${to}`, token)
      .then((result) => { if (!cancelled) setSessions(result.sessions); })
      .catch((reason) => {
        if (!cancelled) setError(reason.status === 404
          ? "Calendar history needs the updated backend deployed."
          : reason instanceof Error ? reason.message : "Could not load workout history.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token, from, to]);

  const sessionsByDate = useMemo(() => sessions.reduce((grouped, session) => {
    (grouped[session.performed_on] ??= []).push(session);
    return grouped;
  }, {}), [sessions]);
  const selectedSessions = sessionsByDate[selectedDate] ?? [];
  const selectedDaySeconds = selectedSessions.reduce((total, session) => total + Number(session.duration_seconds || 0), 0);
  const monthLabel = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(month);

  function moveMonth(offset) {
    const nextMonth = new Date(month.getFullYear(), month.getMonth() + offset, 1);
    const selectedDay = Number(selectedDate.slice(-2));
    const nextSelected = new Date(nextMonth.getFullYear(), nextMonth.getMonth(),
      Math.min(selectedDay, new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate()));
    setMonth(nextMonth);
    setSelectedDate(dateKey(nextSelected));
  }

  return (
    <section className="calendar-page">
      <header className="page-intro">
        <p className="eyebrow">YOUR TRAINING HISTORY</p>
        <h1>Calendar<span>.</span></h1>
        <p className="intro-subtitle">Every logged workout, sets completed, and time spent training.</p>
      </header>

      <div className="calendar-panel">
        <div className="calendar-heading">
          <button className="calendar-month-button" type="button" aria-label="Previous month"
            onClick={() => moveMonth(-1)}>‹</button>
          <h2>{monthLabel}</h2>
          <button className="calendar-month-button" type="button" aria-label="Next month"
            onClick={() => moveMonth(1)}>›</button>
        </div>
        <div className="calendar-grid" role="grid" aria-label={monthLabel}>
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label) => (
            <span className="calendar-weekday" key={label}>{label}</span>
          ))}
          {gridDays.map((date) => {
            const key = dateKey(date);
            const daySessions = sessionsByDate[key] ?? [];
            const inMonth = date.getMonth() === month.getMonth();
            return (
              <button key={key} type="button" role="gridcell"
                className={`calendar-day${inMonth ? "" : " outside-month"}${selectedDate === key ? " selected" : ""}${daySessions.length ? " has-session" : ""}`}
                aria-label={`${new Intl.DateTimeFormat("en", { dateStyle: "full" }).format(date)}${daySessions.length ? `, ${daySessions.length} workout${daySessions.length === 1 ? "" : "s"}` : ""}`}
                aria-pressed={selectedDate === key} onClick={() => {
                  setSelectedDate(key);
                  if (!inMonth) setMonth(new Date(date.getFullYear(), date.getMonth(), 1));
                }}>
                <span>{date.getDate()}</span>
                {daySessions.length > 0 && <i aria-hidden="true" />}
              </button>
            );
          })}
        </div>
        {loading && <p className="calendar-feedback" role="status">Loading workout history…</p>}
        {error && <p className="calendar-feedback error" role="alert">{error}</p>}
      </div>

      <section className="calendar-day-detail" aria-live="polite">
        <div className="section-heading">
          <div>
            <p className="eyebrow">DAY LOG</p>
            <h2>{new Intl.DateTimeFormat("en", { dateStyle: "full" }).format(new Date(`${selectedDate}T12:00:00`))}</h2>
          </div>
          <span className="calendar-session-count">DAY TOTAL {formatDuration(selectedDaySeconds)} · {selectedSessions.length} WORKOUT{selectedSessions.length === 1 ? "" : "S"}</span>
        </div>
        {!loading && selectedSessions.length === 0 ? (
          <div className="calendar-empty">No workout logged for this day.</div>
        ) : (
          <div className="calendar-session-list">
            {selectedSessions.map((session) => (
              <article className="calendar-session-card" key={session.id}>
                <div>
                  <p className="eyebrow">{session.plan_name}</p>
                  <h3>{session.day_name || "Workout session"}</h3>
                </div>
                <dl>
                  <div><dt>Time</dt><dd>{formatDuration(session.duration_seconds)}{session.timer_running ? " · running" : ""}</dd></div>
                  <div><dt>Sets</dt><dd>{session.set_count}</dd></div>
                  <div><dt>Exercises</dt><dd>{session.exercise_count}</dd></div>
                </dl>
                {session.exercises?.length > 0 && (
                  <ul className="calendar-exercise-list">
                    {session.exercises.map((exercise, index) => (
                      <li key={`${exercise.name}-${index}`}>
                        <span>{exercise.name}{exercise.equipment ? ` · ${exercise.equipment}` : ""}</span>
                        <strong>{exercise.setCount ? `${exercise.setCount} set${exercise.setCount === 1 ? "" : "s"}` : exercise.completed ? "Done" : "0 sets"}</strong>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
