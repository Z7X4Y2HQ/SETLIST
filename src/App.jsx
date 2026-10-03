import { useEffect, useState } from "react";

const STORAGE_KEY = "setlist-completed-v1";
const THEME_STORAGE_KEY = "setlist-theme-v1";

const days = [
  {
    name: "Monday",
    short: "Mon",
    focus: "Chest",
    label: "Push day",
    exercises: [
      { name: "Chest press machine", sets: "3–4 sets", reps: "8–12 reps", note: "Main chest movement" },
      { name: "Incline chest press machine", sets: "3 sets", reps: "8–12 reps", note: "Upper chest" },
      { name: "Pec deck / machine fly", sets: "3 sets", reps: "10–15 reps", note: "Chest isolation" },
      { name: "Cable crossover / cable fly", sets: "3 sets", reps: "10–15 reps", note: "Chest isolation, different angle" },
    ],
  },
  {
    name: "Tuesday",
    short: "Tue",
    focus: "Back",
    label: "Pull day",
    exercises: [
      { name: "Lat pulldown machine", sets: "3–4 sets", reps: "8–12 reps", note: "Lats and upper back" },
      { name: "Seated cable row", sets: "3–4 sets", reps: "8–12 reps", note: "Middle back" },
      { name: "Chest-supported row machine", sets: "3 sets", reps: "8–12 reps", note: "Upper and mid back" },
      { name: "Assisted pull-up machine", sets: "3 sets", reps: "6–12 reps", note: "Lats and upper back" },
      { name: "Reverse pec deck", sets: "3 sets", reps: "10–15 reps", note: "Rear delts and upper back" },
    ],
  },
  {
    name: "Wednesday",
    short: "Wed",
    focus: "Shoulders",
    label: "Shoulder day",
    exercises: [
      { name: "Shoulder press machine", sets: "3–4 sets", reps: "10–15 reps", note: "Front and side delts" },
      { name: "Dumbbell lateral raises", sets: "3–4 sets", reps: "10–15 reps", note: "Side delts" },
      { name: "Reverse pec deck", sets: "3 sets", reps: "10–15 reps", note: "Rear delts" },
      { name: "Cable / dumbbell front raise", sets: "2–3 sets", reps: "10–15 reps", note: "Optional front-delt work" },
    ],
  },
  {
    name: "Thursday",
    short: "Thu",
    focus: "Arms",
    label: "Arms day",
    exercises: [
      { name: "Bicep curl machine", sets: "3 sets", reps: "8–12 reps", note: "Biceps" },
      { name: "Cable bicep curl", sets: "3 sets", reps: "10–12 reps", note: "Biceps" },
      { name: "Tricep pushdown", sets: "3 sets", reps: "8–12 reps", note: "Triceps" },
      { name: "Overhead cable tricep extension", sets: "3 sets", reps: "10–12 reps", note: "Triceps" },
      { name: "Dumbbell hammer curls", sets: "2–3 sets", reps: "10–12 reps", note: "Optional finisher" },
    ],
  },
  {
    name: "Friday",
    short: "Fri",
    focus: "Core",
    label: "Abs day",
    exercises: [
      { name: "Ab crunch machine", sets: "3 sets", reps: "10–15 reps", note: "Controlled reps" },
      { name: "Cable crunch", sets: "3 sets", reps: "10–15 reps", note: "Controlled reps" },
      { name: "Hanging knee raises", sets: "3 sets", reps: "8–15 reps", note: "Keep the movement controlled" },
    ],
  },
  {
    name: "Saturday",
    short: "Sat",
    focus: "Legs",
    label: "Leg day",
    exercises: [
      { name: "Leg press machine", sets: "3–4 sets", reps: "8–12 reps", note: "Compound movement" },
      { name: "Hack squat machine", sets: "3 sets", reps: "8–12 reps", note: "Compound movement" },
      { name: "Leg extension machine", sets: "3 sets", reps: "10–15 reps", note: "Quads" },
      { name: "Seated / lying leg curl", sets: "3 sets", reps: "10–15 reps", note: "Hamstrings" },
      { name: "Calf raise machine", sets: "4 sets", reps: "12–20 reps", note: "Calves" },
    ],
  },
];

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getWeekStart(today) {
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const offset = (monday.getDay() + 6) % 7;
  monday.setDate(monday.getDate() - offset + (today.getDay() === 0 ? 7 : 0));
  return monday;
}

function readSavedProgress() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch (error) {
    console.error("Could not read saved workout progress.", error);
    return {};
  }
}

function readSavedTheme() {
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch (error) {
    console.error("Could not read saved theme preference.", error);
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function App() {
  const today = new Date();
  const todayIndex = today.getDay() === 0 ? -1 : today.getDay() - 1;
  const weekStart = getWeekStart(today);
  const [selectedIndex, setSelectedIndex] = useState(todayIndex);
  const [completedByDate, setCompletedByDate] = useState(readSavedProgress);
  const [theme, setTheme] = useState(readSavedTheme);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(completedByDate));
    } catch (error) {
      console.error("Could not save workout progress.", error);
    }
  }, [completedByDate]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (error) {
      console.error("Could not save theme preference.", error);
    }
  }, [theme]);

  const selectedDate =
    selectedIndex >= 0
      ? new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + selectedIndex)
      : today;
  const activeDay = selectedIndex >= 0 ? days[selectedIndex] : null;
  const selectedDateKey = dateKey(selectedDate);
  const completed = completedByDate[selectedDateKey] || [];
  const total = activeDay?.exercises.length ?? 0;
  const doneCount = activeDay
    ? activeDay.exercises.filter((exercise) => completed.includes(exercise.name)).length
    : 0;
  const progress = total ? Math.round((doneCount / total) * 100) : 0;
  const isTodaySelected = selectedIndex === todayIndex;

  function toggleExercise(name) {
    setCompletedByDate((current) => {
      const selected = current[selectedDateKey] || [];
      const next = selected.includes(name)
        ? selected.filter((exerciseName) => exerciseName !== name)
        : [...selected, name];
      return { ...current, [selectedDateKey]: next };
    });
  }

  function formatDate(date) {
    return new Intl.DateTimeFormat("en", { month: "long", day: "numeric" }).format(date);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="Setlist home">
          <span className="brand-mark">S</span>
          <span>SETLIST</span>
        </a>
        <div className="topbar-actions">
          <span className="topbar-caption">YOUR TRAINING WEEK</span>
          <button
            className="theme-toggle"
            type="button"
            onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? (
              <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <circle cx="10" cy="10" r="3.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M10 2v2m0 12v2M18 10h-2M4 10H2m13.66-5.66-1.42 1.42M5.76 14.24l-1.42 1.42m11.32 0-1.42-1.42M5.76 5.76 4.34 4.34" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M16.7 12.35A7.1 7.1 0 0 1 7.65 3.3a7.1 7.1 0 1 0 9.05 9.05Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        </div>
      </header>

      <section className="intro">
        <div>
          <p className="eyebrow">{isTodaySelected ? "TODAY'S SESSION" : "YOUR WEEKLY PLAN"}</p>
          <h1>
            {activeDay ? (
              <>
                {activeDay.focus} <span>day.</span>
              </>
            ) : (
              <>
                Take a <span>rest.</span>
              </>
            )}
          </h1>
          <p className="intro-subtitle">
            {activeDay
              ? `${activeDay.label} · ${formatDate(selectedDate)}`
              : `Sunday, ${formatDate(today)} · Your next session starts Monday.`}
          </p>
        </div>
        {activeDay && (
          <div
            className="progress-ring"
            style={{ "--progress": `${progress * 3.6}deg` }}
            role="img"
            aria-label={`${doneCount} of ${total} exercises complete`}
          >
            <div className="progress-ring-inner">
              <strong>{progress}%</strong>
              <span>COMPLETE</span>
            </div>
          </div>
        )}
      </section>

      <section className="week-section" aria-label="Choose a workout day">
        <div className="section-heading">
          <div>
            <p className="eyebrow">YOUR SPLIT</p>
            <h2>This week</h2>
          </div>
          <span className="week-range">
            {formatDate(weekStart)} –{" "}
            {formatDate(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 5))}
          </span>
        </div>
        <div className="week-strip">
          {days.map((day, index) => {
            const date = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + index);
            const dayComplete = (completedByDate[dateKey(date)] || []).length === day.exercises.length;
            const isToday = index === todayIndex;
            return (
              <button
                className={`day-button${selectedIndex === index ? " selected" : ""}${isToday ? " today" : ""}`}
                key={day.short}
                onClick={() => setSelectedIndex(index)}
                aria-pressed={selectedIndex === index}
                aria-label={`${day.name}, ${day.focus}${isToday ? ", today" : ""}`}
              >
                <span className="day-label">{day.short}</span>
                <span className="day-date">{date.getDate()}</span>
                <span className="day-focus">{day.focus}</span>
                <span className={`day-status${dayComplete ? " complete" : ""}`} aria-hidden="true" />
              </button>
            );
          })}
        </div>
      </section>

      {activeDay ? (
        <section className="workout-section">
          <div className="section-heading workout-heading">
            <div>
              <p className="eyebrow">THE WORKOUT</p>
              <h2>Your checklist</h2>
            </div>
            <span className="count-label">
              {doneCount} <span>/ {total} DONE</span>
            </span>
          </div>

          <div className="exercise-list">
            {activeDay.exercises.map((exercise, index) => {
              const isComplete = completed.includes(exercise.name);
              return (
                <button
                  key={exercise.name}
                  className={`exercise-card${isComplete ? " is-complete" : ""}`}
                  onClick={() => toggleExercise(exercise.name)}
                  aria-pressed={isComplete}
                >
                  <span className={`check-box${isComplete ? " checked" : ""}`} aria-hidden="true">
                    {isComplete && (
                      <svg viewBox="0 0 16 16" fill="none">
                        <path d="m3.5 8 3 3 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                  <span className="exercise-number">{String(index + 1).padStart(2, "0")}</span>
                  <span className="exercise-copy">
                    <span className="exercise-name">{exercise.name}</span>
                    <span className="exercise-note">{exercise.note}</span>
                  </span>
                  <span className="exercise-target">
                    <strong>{exercise.sets}</strong>
                    <span>{exercise.reps}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <aside className="training-note">
            <span className="note-rule" />
            <p>
              Rest <strong>1–2 minutes</strong> between sets. Choose a weight that makes the last
              few reps challenging while keeping your form controlled.
            </p>
          </aside>
        </section>
      ) : (
        <section className="rest-card">
          <div className="rest-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <p className="eyebrow">REST & RECOVER</p>
          <h2>Rest day.</h2>
          <p>There’s no workout on the plan today. Take a breather and come back ready for chest day.</p>
          <button className="next-session" onClick={() => setSelectedIndex(0)}>
            Preview Monday’s workout <span aria-hidden="true">→</span>
          </button>
        </section>
      )}

      <footer className="footer">
        <span>SHOW UP. CHECK IT OFF.</span>
        <span>SETLIST / 01</span>
      </footer>
    </main>
  );
}

export default App;
