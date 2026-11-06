import { useMemo, useRef, useState } from "react";
import AppDialog from "./AppDialog.jsx";
import "./RoutineTransfer.css";

const routineFileFormat = "setlist-routines";
const routineFileVersion = 1;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validateRoutine(plan) {
  if (!isRecord(plan) || typeof plan.id !== "string" || !uuidPattern.test(plan.id) ||
      typeof plan.name !== "string" || !plan.name.trim() || plan.name.length > 100 ||
      typeof (plan.description ?? "") !== "string" || (plan.description ?? "").length > 2000 ||
      !Array.isArray(plan.categories) || plan.categories.length > 7) {
    return "A routine has invalid name or structure.";
  }

  const dayIds = new Set();
  const exerciseIds = new Set();
  const weekdays = new Set();
  for (const day of plan.categories) {
    if (!isRecord(day) || typeof day.id !== "string" || !uuidPattern.test(day.id) ||
        dayIds.has(day.id) || !Number.isInteger(day.weekday) || day.weekday < 0 || day.weekday > 6 ||
        weekdays.has(day.weekday) || typeof day.name !== "string" || !day.name.trim() || day.name.length > 80 ||
        typeof (day.short ?? day.name) !== "string" || (day.short ?? day.name).length > 80 ||
        typeof (day.focus ?? "") !== "string" || (day.focus ?? "").length > 120 ||
        typeof (day.label ?? day.name) !== "string" || (day.label ?? day.name).length > 120 ||
        !Array.isArray(day.exercises) || day.exercises.length > 100) {
      return "A routine contains an invalid or duplicate training day.";
    }
    dayIds.add(day.id);
    weekdays.add(day.weekday);
    for (const exercise of day.exercises) {
      if (!isRecord(exercise) || typeof exercise.id !== "string" || !uuidPattern.test(exercise.id) ||
          exerciseIds.has(exercise.id) || typeof exercise.catalogExerciseId !== "string" ||
          !uuidPattern.test(exercise.catalogExerciseId) || typeof exercise.equipmentId !== "string" ||
          !uuidPattern.test(exercise.equipmentId) || typeof exercise.name !== "string" || !exercise.name.trim() ||
          exercise.name.length > 120 || typeof (exercise.equipment ?? "") !== "string" ||
          (exercise.equipment ?? "").length > 100 ||
          !Number.isInteger(Number(exercise.sets)) || Number(exercise.sets) < 1 || Number(exercise.sets) > 20 ||
          typeof (exercise.reps ?? "") !== "string" || (exercise.reps ?? "").length > 32 ||
          typeof (exercise.note ?? "") !== "string" || (exercise.note ?? "").length > 500) {
        return "A routine contains an invalid exercise or target.";
      }
      exerciseIds.add(exercise.id);
    }
  }
  return "";
}

function readRoutineFile(parsed) {
  if (!isRecord(parsed) || parsed.format !== routineFileFormat || parsed.version !== routineFileVersion ||
      !Array.isArray(parsed.plans) || !parsed.plans.length || parsed.plans.length > 50) {
    throw new Error("Choose a Setlist routine export file.");
  }
  const planIds = new Set();
  for (const plan of parsed.plans) {
    const issue = validateRoutine(plan);
    if (issue) throw new Error(issue);
    if (planIds.has(plan.id)) throw new Error("The file contains duplicate routines.");
    planIds.add(plan.id);
  }
  return parsed.plans;
}

function resolveRoutineCatalog(plan, catalogExercises) {
  const unavailable = [];
  const categories = plan.categories.map((day) => ({
    ...day,
    exercises: day.exercises.map((exercise) => {
      const exactExercise = catalogExercises.find((item) => item.id === exercise.catalogExerciseId);
      const candidates = exactExercise
        ? [exactExercise]
        : catalogExercises.filter((item) => item.name.trim().toLowerCase() === exercise.name.trim().toLowerCase());
      let match;
      for (const candidate of candidates) {
        const equipment = candidate.equipment.find((item) => item.id === exercise.equipmentId) ??
          candidate.equipment.find((item) => item.name.trim().toLowerCase() ===
            (exercise.equipment ?? "").trim().toLowerCase());
        if (equipment) {
          match = { candidate, equipment };
          break;
        }
      }
      if (!match) {
        unavailable.push(exercise.name + (exercise.equipment ? " (" + exercise.equipment + ")" : ""));
        return exercise;
      }
      return {
        ...exercise,
        catalogExerciseId: match.candidate.id,
        name: match.candidate.name,
        equipmentId: match.equipment.id,
        equipment: match.equipment.name,
      };
    }),
  }));
  return { ...plan, categories, unavailable };
}

function countExercises(plan) {
  return plan.categories.reduce((count, day) => count + day.exercises.length, 0);
}

function exportPlanShape(plan) {
  return {
    id: plan.id,
    name: plan.name,
    description: plan.description ?? "",
    categories: plan.categories.map((day) => ({
      id: day.id,
      weekday: day.weekday,
      name: day.name,
      short: day.short ?? day.name,
      focus: day.focus ?? "",
      label: day.label ?? day.name,
      exercises: day.exercises.map((exercise) => ({
        id: exercise.id,
        catalogExerciseId: exercise.catalogExerciseId,
        name: exercise.name,
        equipmentId: exercise.equipmentId,
        equipment: exercise.equipment,
        sets: String(exercise.sets),
        reps: exercise.reps ?? "",
        note: exercise.note ?? "",
      })),
    })),
  };
}

function checkboxListSelection(current, id) {
  const next = new Set(current);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

export default function RoutineTransfer({ plans, activePlanId, catalog, onImport, onClose }) {
  const fileRef = useRef(null);
  const [exportIds, setExportIds] = useState(() => new Set(activePlanId ? [activePlanId] : []));
  const [importPlans, setImportPlans] = useState([]);
  const [importIds, setImportIds] = useState(new Set());
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const selectedExports = plans.filter((plan) => exportIds.has(plan.id));
  const resolvedImports = useMemo(
    () => importPlans.map((plan) => resolveRoutineCatalog(plan, catalog.exercises)),
    [importPlans, catalog.exercises],
  );
  const selectedImports = resolvedImports.filter((plan) => importIds.has(plan.id));
  const unavailable = selectedImports.flatMap((plan) =>
    plan.unavailable.map((exercise) => plan.name + ": " + exercise),
  );
  const exceedsPlanLimit = plans.length + selectedImports.length > 50;

  function downloadSelected() {
    setError("");
    setNotice("");
    if (!selectedExports.length) return;
    const payload = {
      format: routineFileFormat,
      version: routineFileVersion,
      exportedAt: new Date().toISOString(),
      plans: selectedExports.map(exportPlanShape),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const slug = selectedExports.length === 1
      ? selectedExports[0].name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48)
      : "";
    link.href = url;
    link.download = slug
      ? "setlist-" + slug + ".json"
      : "setlist-routines-" + new Date().toISOString().slice(0, 10) + ".json";
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice(selectedExports.length + (selectedExports.length === 1 ? " routine exported." : " routines exported."));
  }

  async function readFile(file) {
    setError("");
    setNotice("");
    setImportPlans([]);
    setImportIds(new Set());
    setFileName("");
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      setError("The file is too large. Setlist routine files must be under 4 MB.");
      return;
    }
    try {
      const parsed = JSON.parse(await file.text());
      const routines = readRoutineFile(parsed);
      setImportPlans(routines);
      setImportIds(new Set(routines.map((plan) => plan.id)));
      setFileName(file.name);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not read this routine file.");
    }
  }

  async function importSelected() {
    setError("");
    setNotice("");
    if (!selectedImports.length) {
      setError("Choose at least one routine to import.");
      return;
    }
    if (unavailable.length) {
      setError("Some exercises or equipment are unavailable in this account: " +
        unavailable.slice(0, 4).join(", ") + (unavailable.length > 4 ? ", and more." : "."));
      return;
    }
    if (exceedsPlanLimit) {
      setError("Setlist supports up to 50 active routines. Select fewer routines or archive one first.");
      return;
    }
    setBusy(true);
    try {
      await onImport(selectedImports.map(({ unavailable: _unavailable, ...plan }) => plan));
      setBusy(false);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not import these routines.");
      setBusy(false);
    }
  }

  return (
    <AppDialog
      title="Import and export routines"
      description="Export one routine or a selection as a JSON file, or import selected routines from a Setlist export. Imports are added as copies; workout history is not included."
      onClose={onClose}
      busy={busy}
      wide
      actions={<button className="text-button" type="button" disabled={busy} onClick={onClose}>Close</button>}
    >
      <div className="routine-transfer">
        <section className="routine-transfer-section" aria-labelledby="routine-export-title">
          <div className="routine-transfer-heading">
            <div>
              <h3 id="routine-export-title">Export routines</h3>
              <p>Select one routine or several.</p>
            </div>
            <div className="routine-transfer-selection">
              <button type="button" onClick={() => setExportIds(new Set(plans.map((plan) => plan.id)))}>Select all</button>
              <button type="button" onClick={() => setExportIds(new Set())}>Clear</button>
            </div>
          </div>
          {plans.length ? (
            <div className="routine-transfer-list">
              {plans.map((plan) => (
                <label className="routine-transfer-row" key={plan.id}>
                  <input
                    type="checkbox"
                    checked={exportIds.has(plan.id)}
                    onChange={() => setExportIds((current) => checkboxListSelection(current, plan.id))}
                  />
                  <span className="routine-transfer-copy">
                    <strong>{plan.name}</strong>
                    <span>{plan.categories.length} days · {countExercises(plan)} exercises</span>
                  </span>
                </label>
              ))}
            </div>
          ) : <p className="routine-transfer-empty">No saved routines to export yet.</p>}
          <button className="app-dialog-primary routine-transfer-action" type="button"
            disabled={!selectedExports.length} onClick={downloadSelected}>
            Export selected ({selectedExports.length})
          </button>
        </section>

        <section className="routine-transfer-section" aria-labelledby="routine-import-title">
          <div className="routine-transfer-heading">
            <div>
              <h3 id="routine-import-title">Import routines</h3>
              <p>Choose a JSON file exported from Setlist.</p>
            </div>
          </div>
          <input ref={fileRef} className="routine-transfer-file-input" type="file" accept=".json,application/json"
            onChange={(event) => { void readFile(event.target.files?.[0]); event.target.value = ""; }} />
          <button className="text-button routine-transfer-file-button" type="button" disabled={busy}
            onClick={() => fileRef.current?.click()}>
            Choose routine file
          </button>
          {fileName && <p className="routine-transfer-file-name">Selected: {fileName}</p>}
          {importPlans.length > 0 && (
            <>
              <div className="routine-transfer-heading routine-transfer-import-heading">
                <strong>{importPlans.length} routine{importPlans.length === 1 ? "" : "s"} found</strong>
                <div className="routine-transfer-selection">
                  <button type="button" onClick={() => setImportIds(new Set(importPlans.map((plan) => plan.id)))}>Select all</button>
                  <button type="button" onClick={() => setImportIds(new Set())}>Clear</button>
                </div>
              </div>
              <div className="routine-transfer-list">
                {resolvedImports.map((plan) => (
                  <label className="routine-transfer-row" key={plan.id}>
                    <input
                      type="checkbox"
                      checked={importIds.has(plan.id)}
                      onChange={() => setImportIds((current) => checkboxListSelection(current, plan.id))}
                    />
                    <span className="routine-transfer-copy">
                      <strong>{plan.name}</strong>
                      <span>{plan.categories.length} days · {countExercises(plan)} exercises</span>
                    </span>
                  </label>
                ))}
              </div>
              <p className="routine-transfer-hint">
                Existing routines stay untouched. Imported copies get new IDs.
                {plans.length + selectedImports.length > 50
                  ? " Archive a routine or select fewer; the active limit is 50."
                  : ""}
              </p>
              <button className="app-dialog-primary routine-transfer-action" type="button" disabled={busy || !selectedImports.length}
                onClick={() => void importSelected()}>
                {busy ? "Importing..." : "Import selected (" + selectedImports.length + ")"}
              </button>
            </>
          )}
          {error && <p className="app-dialog-error" role="alert">{error}</p>}
          {notice && <p className="routine-transfer-notice" role="status">{notice}</p>}
        </section>
      </div>
    </AppDialog>
  );
}
