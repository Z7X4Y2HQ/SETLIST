import { useEffect, useState } from "react";

export default function SettingsPage({
  currentUser,
  restDurationSeconds,
  backendAvailable = true,
  theme,
  onSaveRestDuration,
  onToggleTheme,
  onImportExport,
  onArchivedPlans,
}) {
  const [restInput, setRestInput] = useState(String(restDurationSeconds));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => setRestInput(String(restDurationSeconds)), [restDurationSeconds]);

  async function save(event) {
    event.preventDefault();
    const seconds = Number(restInput);
    if (!Number.isInteger(seconds) || seconds < 15 || seconds > 600) {
      setMessage("Choose a rest time between 15 and 600 seconds.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      await onSaveRestDuration(seconds);
      setMessage("Rest timer saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save this setting.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="settings-page">
      <header className="page-intro">
        <p className="eyebrow">YOUR TRAINING SPACE</p>
        <h1>Settings<span>.</span></h1>
        <p className="intro-subtitle">Adjust your workout defaults and manage your routines.</p>
      </header>

      <form className="settings-card" onSubmit={save}>
        <div>
          <p className="eyebrow">WORKOUTS</p>
          <h2>Rest timer</h2>
          <p className="settings-description">This countdown starts whenever you log a set.</p>
        </div>
        <label className="settings-field">
          <span>Rest between sets</span>
          <span className="settings-input-wrap">
            <input type="number" min="15" max="600" step="5" value={restInput}
              onChange={(event) => setRestInput(event.target.value)} aria-label="Rest duration in seconds"
              disabled={!backendAvailable} />
            <span>seconds</span>
          </span>
        </label>
        <button className="primary-button" type="submit" disabled={saving || !backendAvailable}>
          {saving ? "Saving…" : "Save rest time"}
        </button>
        {message && <p className="settings-message" role="status">{message}</p>}
        {!backendAvailable && <p className="settings-message" role="status">Deploy the updated backend to save workout settings.</p>}
      </form>

      <section className="settings-card">
        <div>
          <p className="eyebrow">APPEARANCE</p>
          <h2>Color theme</h2>
          <p className="settings-description">Choose how Setlist looks on this device.</p>
        </div>
        <div className="settings-choice-row">
          <button type="button" className={`secondary-button${theme === "light" ? " selected-choice" : ""}`}
            aria-pressed={theme === "light"} onClick={() => theme !== "light" && onToggleTheme()}>
            Light
          </button>
          <button type="button" className={`secondary-button${theme === "dark" ? " selected-choice" : ""}`}
            aria-pressed={theme === "dark"} onClick={() => theme !== "dark" && onToggleTheme()}>
            Dark
          </button>
        </div>
      </section>

      <section className="settings-card">
        <div>
          <p className="eyebrow">ROUTINE LIBRARY</p>
          <h2>Import, export, and archive</h2>
          <p className="settings-description">Move routines between accounts or files, or restore an archived routine.</p>
        </div>
        <div className="settings-choice-row">
          <button type="button" className="secondary-button" onClick={onImportExport}>Import / export routines</button>
          <button type="button" className="secondary-button" onClick={onArchivedPlans}>Archived routines</button>
        </div>
      </section>

      <section className="settings-card settings-account">
        <div>
          <p className="eyebrow">ACCOUNT</p>
          <h2>{currentUser?.username || "Your account"}</h2>
          <p className="settings-description">Your plans and workout history are saved to your account.</p>
        </div>
      </section>
    </section>
  );
}
