import { useState } from "react";
import "./GettingStarted.css";

const trainingDays = [
  { value: 1, short: "Mon", name: "Monday" },
  { value: 2, short: "Tue", name: "Tuesday" },
  { value: 3, short: "Wed", name: "Wednesday" },
  { value: 4, short: "Thu", name: "Thursday" },
  { value: 5, short: "Fri", name: "Friday" },
  { value: 6, short: "Sat", name: "Saturday" },
  { value: 0, short: "Sun", name: "Sunday" },
];

export default function GettingStarted({ onCreate }) {
  const [name, setName] = useState("My training plan");
  const [days, setDays] = useState([]);

  function toggleDay(weekday) {
    setDays((current) => current.includes(weekday)
      ? current.filter((day) => day !== weekday) : [...current, weekday]);
  }

  return (
    <section className="getting-started" aria-labelledby="getting-started-title">
      <div className="getting-started-copy">
        <div className="getting-started-mark" aria-hidden="true">
          <svg viewBox="0 0 28 28" fill="none">
            <path d="M6 19V13m8 6V8m8 11V4M4 24h20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
        <p className="eyebrow">WELCOME TO SETLIST</p>
        <h1 id="getting-started-title">Let&apos;s get <span>started.</span></h1>
        <p className="getting-started-description">
          Your routine starts here. Give your plan a name and choose the days that fit your week.
        </p>
        <ol className="getting-started-steps">
          <li><span aria-hidden="true">01</span><div><strong>Make it yours</strong><p>Name your plan and pick your training days.</p></div></li>
          <li><span aria-hidden="true">02</span><div><strong>Build your workouts</strong><p>Find exercises and choose your equipment.</p></div></li>
          <li><span aria-hidden="true">03</span><div><strong>Show up. Check it off.</strong><p>Follow your plan and track each session.</p></div></li>
        </ol>
      </div>

      <form className="getting-started-form" onSubmit={(event) => {
        event.preventDefault();
        if (!name.trim() || !days.length) return;
        onCreate(name.trim(), trainingDays.filter((day) => days.includes(day.value)).map((day) => day.value));
      }}>
        <p className="eyebrow">YOUR FIRST PLAN</p>
        <h2>A week that works for you.</h2>
        <label className="getting-started-label" htmlFor="first-plan-name">Plan name</label>
        <input id="first-plan-name" className="editor-input getting-started-name" value={name}
          maxLength={100} required placeholder="e.g. Three-day split" autoComplete="off"
          onChange={(event) => setName(event.target.value)} />

        <fieldset className="getting-started-days" aria-describedby="training-days-hint">
          <legend>When do you want to train?</legend>
          <p id="training-days-hint">Pick your days. You can change them anytime.</p>
          <div className="getting-started-week">
            {trainingDays.map((day) => {
              const selected = days.includes(day.value);
              return <button key={day.value} className={`getting-started-day${selected ? " is-selected" : ""}`}
                type="button" aria-label={day.name} aria-pressed={selected} onClick={() => toggleDay(day.value)}>
                <span>{day.short}</span>
                <span className="getting-started-day-check" aria-hidden="true">
                  {selected && <svg viewBox="0 0 16 16" fill="none"><path d="m3.5 8 3 3 6-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                </span>
              </button>;
            })}
          </div>
          <p className="getting-started-summary" role="status" aria-live="polite">
            {days.length ? `${days.length} training ${days.length === 1 ? "day" : "days"} · ${7 - days.length} rest ${days.length === 6 ? "day" : "days"}`
              : "Choose at least one day to get started."}
          </p>
        </fieldset>

        <button className="getting-started-submit" type="submit" disabled={!name.trim() || !days.length}>
          Create my plan <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4 10h12m-5-5 5 5-5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <p className="getting-started-note">Next up: add exercises to your training days.</p>
      </form>
    </section>
  );
}
