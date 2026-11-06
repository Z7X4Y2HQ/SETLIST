import { useEffect, useState } from "react";
import { apiRequest } from "./api.js";
import AppDialog from "./AppDialog.jsx";

export default function ArchivedPlans({ token, onClose, onRestore, activePlanCount }) {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [restoreError, setRestoreError] = useState("");
  const [restoringId, setRestoringId] = useState(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError("");
    apiRequest("/setlist/plans?includeArchived=true", token, { signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) setPlans(result.plans.filter((plan) => plan.isArchived)); })
      .catch((error) => { if (!controller.signal.aborted) setLoadError(error.message ?? "Could not load archived plans."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token, attempt]);

  async function restore(plan) {
    setRestoringId(plan.id);
    setRestoreError("");
    try {
      await onRestore(plan);
    } catch (error) {
      setRestoreError(error.message ?? "Could not restore this plan.");
      setRestoringId(null);
    }
  }

  return <AppDialog title="Archived plans" wide onClose={onClose} busy={Boolean(restoringId)}
    description="Your past plans live here. Restore a plan to bring it back to your planner, with its workout history."
    actions={<button type="button" className="text-button" onClick={onClose} disabled={Boolean(restoringId)}>Back to planner</button>}>
    {loading ? <p className="app-dialog-empty" role="status">Loading your archived plans...</p>
      : loadError ? <div className="app-dialog-empty"><p className="app-dialog-error" role="alert">{loadError}</p>
        <button className="text-button" type="button" onClick={() => setAttempt((current) => current + 1)}>Try again</button></div>
      : !plans.length ? <div className="app-dialog-empty"><strong>No archived plans yet.</strong><p>Plans you archive will appear here. You can restore them whenever you need them.</p></div>
      : <ul className="archived-plans-list">{plans.map((plan) => {
        const count = plan.categories.reduce((total, day) => total + day.exercises.length, 0);
        return <li key={plan.id}>
          <div><strong>{plan.name}</strong><span>{plan.categories.length} training {plan.categories.length === 1 ? "day" : "days"} · {count} {count === 1 ? "exercise" : "exercises"}</span></div>
          <button type="button" className="text-button" disabled={Boolean(restoringId) || activePlanCount >= 50}
            aria-label={`Restore ${plan.name}`} onClick={() => void restore(plan)}>
            {restoringId === plan.id ? "Restoring..." : "Restore"}
          </button>
        </li>;
      })}</ul>}
    {activePlanCount >= 50 && <p className="app-dialog-error" role="status">Archive an active plan before restoring another. You can have up to 50 active plans.</p>}
    {restoreError && <p className="app-dialog-error" role="alert">{restoreError}</p>}
  </AppDialog>;
}
