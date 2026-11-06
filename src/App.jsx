import { useEffect, useMemo, useRef, useState } from "react";
import { apiRequest } from "./api.js";
import SearchSelect from "./SearchSelect.jsx";
import GettingStarted from "./GettingStarted.jsx";
import AppDialog from "./AppDialog.jsx";
import ArchivedPlans from "./ArchivedPlans.jsx";
import RoutineTransfer from "./RoutineTransfer.jsx";
import SettingsPage from "./SettingsPage.jsx";
import WorkoutCalendar from "./WorkoutCalendar.jsx";
import { createSaveQueue } from "./save-queue.js";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const PLANS_STORAGE_KEY = "setlist-plans-v1";
const PLAN_SELECTION_KEY = "setlist-selected-plan-v1";
const PROGRESS_STORAGE_KEY = "setlist-completed-v1";
const THEME_STORAGE_KEY = "setlist-theme-v1";
const AUTH_TOKEN_STORAGE_KEY = "setlist-session-v1";
const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const starterCategories = [
  {
    id: "monday",
    weekday: 1,
    name: "Monday",
    short: "Mon",
    focus: "Chest",
    label: "Push day",
    exercises: [
      ["Chest press machine", "3–4 sets", "8–12 reps", "Main chest movement"],
      ["Incline chest press machine", "3 sets", "8–12 reps", "Upper chest"],
      ["Pec deck / machine fly", "3 sets", "10–15 reps", "Chest isolation"],
      ["Cable crossover / cable fly", "3 sets", "10–15 reps", "Chest isolation, different angle"],
    ],
  },
  {
    id: "tuesday",
    weekday: 2,
    name: "Tuesday",
    short: "Tue",
    focus: "Back",
    label: "Pull day",
    exercises: [
      ["Lat pulldown machine", "3–4 sets", "8–12 reps", "Lats and upper back"],
      ["Seated cable row", "3–4 sets", "8–12 reps", "Middle back"],
      ["Chest-supported row machine", "3 sets", "8–12 reps", "Upper and mid back"],
      ["Assisted pull-up machine", "3 sets", "6–12 reps", "Lats and upper back"],
      ["Reverse pec deck", "3 sets", "10–15 reps", "Rear delts and upper back"],
    ],
  },
  {
    id: "wednesday",
    weekday: 3,
    name: "Wednesday",
    short: "Wed",
    focus: "Shoulders",
    label: "Shoulder day",
    exercises: [
      ["Shoulder press machine", "3–4 sets", "10–15 reps", "Front and side delts"],
      ["Dumbbell lateral raises", "3–4 sets", "10–15 reps", "Side delts"],
      ["Reverse pec deck", "3 sets", "10–15 reps", "Rear delts"],
      ["Cable / dumbbell front raise", "2–3 sets", "10–15 reps", "Optional front-delt work"],
    ],
  },
  {
    id: "thursday",
    weekday: 4,
    name: "Thursday",
    short: "Thu",
    focus: "Arms",
    label: "Arms day",
    exercises: [
      ["Bicep curl machine", "3 sets", "8–12 reps", "Biceps"],
      ["Cable bicep curl", "3 sets", "10–12 reps", "Biceps"],
      ["Tricep pushdown", "3 sets", "8–12 reps", "Triceps"],
      ["Overhead cable tricep extension", "3 sets", "10–12 reps", "Triceps"],
      ["Dumbbell hammer curls", "2–3 sets", "10–12 reps", "Optional finisher"],
    ],
  },
  {
    id: "friday",
    weekday: 5,
    name: "Friday",
    short: "Fri",
    focus: "Core",
    label: "Abs day",
    exercises: [
      ["Ab crunch machine", "3 sets", "10–15 reps", "Controlled reps"],
      ["Cable crunch", "3 sets", "10–15 reps", "Controlled reps"],
      ["Hanging knee raises", "3 sets", "8–15 reps", "Keep the movement controlled"],
    ],
  },
  {
    id: "saturday",
    weekday: 6,
    name: "Saturday",
    short: "Sat",
    focus: "Legs",
    label: "Leg day",
    exercises: [
      ["Leg press machine", "3–4 sets", "8–12 reps", "Compound movement"],
      ["Hack squat machine", "3 sets", "8–12 reps", "Compound movement"],
      ["Leg extension machine", "3 sets", "10–15 reps", "Quads"],
      ["Seated / lying leg curl", "3 sets", "10–15 reps", "Hamstrings"],
      ["Calf raise machine", "4 sets", "12–20 reps", "Calves"],
    ],
  },
].map((category) => ({
  ...category,
  exercises: category.exercises.map(([name, sets, reps, note], index) => ({
    id: `${category.id}-exercise-${index + 1}`,
    name,
    sets,
    reps,
    note,
  })),
}));

const starterPlan = {
  id: "starter-plan",
  name: "Weekly Gym Plan",
  categories: starterCategories,
};

function createId() {
  return globalThis.crypto.randomUUID();
}

function createCategory(index, weekday = (index + 1) % 7) {
  return {
    id: createId(),
    name: `Day ${index + 1}`,
    weekday,
    short: `Day ${index + 1}`,
    focus: "",
    label: "",
    exercises: [],
  };
}

function createPlan(name = "My plan") {
  return { id: createId(), name, categories: [createCategory(0)] };
}

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getWeekStart(today) {
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const offset = (monday.getDay() + 6) % 7;
  monday.setDate(monday.getDate() - offset);
  return monday;
}

function isPlan(value) {
  return (
    value &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    Array.isArray(value.categories) &&
    value.categories.every(
      (category) =>
        category &&
        typeof category.id === "string" &&
        typeof category.name === "string" &&
        Array.isArray(category.exercises) &&
        category.exercises.every(
          (exercise) =>
            exercise &&
            typeof exercise.id === "string" &&
            typeof exercise.name === "string",
        ),
    )
  );
}

function normalizePlan(plan) {
  return {
    ...plan,
    categories: plan.categories.map((category, index) => ({
      ...category,
      weekday:
        Number.isInteger(category.weekday) && category.weekday >= 0 && category.weekday <= 6
          ? category.weekday
          : (index + 1) % 7,
      short: category.short ?? `Day ${index + 1}`,
      focus: category.focus ?? "",
      label: category.label ?? "",
      exercises: category.exercises.map((exercise) => ({
        ...exercise,
        id: exercise.id || createId(),
        sets: exercise.sets ?? "",
        reps: exercise.reps ?? "",
        note: exercise.note ?? "",
      })),
    })),
  };
}

function readSavedPlans() {
  const saved = window.localStorage.getItem(PLANS_STORAGE_KEY);
  if (!saved) return [starterPlan];
  const parsed = JSON.parse(saved);
  if (Array.isArray(parsed) && parsed.length > 0 && parsed.every(isPlan)) {
    return parsed.map(normalizePlan);
  }
  throw new Error("Saved plans have an invalid format. Existing plans were not migrated.");
}

function readSavedPlanSelection() {
  try {
    return window.localStorage.getItem(PLAN_SELECTION_KEY);
  } catch (error) {
    console.error("Could not read selected plan.", error);
    return null;
  }
}

function readSavedProgress() {
  const saved = window.localStorage.getItem(PROGRESS_STORAGE_KEY);
  if (!saved) return {};
  const parsed = JSON.parse(saved);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Saved workout progress has an invalid format. Existing progress was not migrated.");
  }

  const migrated = {};
  for (const [key, entries] of Object.entries(parsed)) {
    if (!Array.isArray(entries) || !entries.every((entry) => typeof entry === "string")) {
      throw new Error(`Saved workout progress for ${key} has an invalid format.`);
    }
    if (key.includes("|")) {
      migrated[key] = entries;
      continue;
    }

    const [year, month, day] = key.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(key) ||
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      throw new Error(`Saved workout progress has an invalid date: ${key}.`);
    }
    const categoryIndex = date.getDay() === 0 ? -1 : date.getDay() - 1;
    const category = starterCategories[categoryIndex];
    const allExercises = starterCategories.flatMap((item) => item.exercises);
    const completedIds = entries.map(
      (entry) =>
        category?.exercises.find((exercise) => exercise.name === entry)?.id ??
        allExercises.find((exercise) => exercise.name === entry)?.id,
    );
    if (completedIds.some((id) => !id)) {
      throw new Error(`Saved workout progress for ${key} contains exercises that could not be matched.`);
    }
    migrated[`${starterPlan.id}|${key}`] = completedIds;
  }
  return migrated;
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

function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return [hours, minutes, remainder].map((part) => String(part).padStart(2, "0")).join(":");
}

function SortableExercise({
  exercise,
  catalog,
  index,
  completed,
  setCount,
  setsDisabled,
  restTimerSecondsRemaining = 0,
  restDurationSeconds = 90,
  onStopRestTimer,
  editing,
  onSetCountChange,
  onChange,
  onRemove,
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: exercise.id, disabled: !editing });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1 : undefined,
  };
  const targetSetCount = Math.max(1, Number.parseInt(exercise.sets, 10) || 1);
  const visibleSetCount = Math.max(0, Math.min(targetSetCount, Number(setCount) || 0));
  const setProgress = (visibleSetCount / targetSetCount) * 100;

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`exercise-card${completed ? " is-complete" : ""}${editing ? " editing" : ""}${isDragging ? " dragging" : ""}`}
    >
      {editing ? (
        <button
          className="drag-handle"
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Reorder ${exercise.name || "exercise"}`}
          title="Drag to reorder"
        >
          <svg viewBox="0 0 16 20" fill="currentColor" aria-hidden="true">
            <circle cx="5" cy="4" r="1.25" />
            <circle cx="11" cy="4" r="1.25" />
            <circle cx="5" cy="10" r="1.25" />
            <circle cx="11" cy="10" r="1.25" />
            <circle cx="5" cy="16" r="1.25" />
            <circle cx="11" cy="16" r="1.25" />
          </svg>
        </button>
      ) : <span className="exercise-number">{String(index + 1).padStart(2, "0")}</span>}
      {editing ? (
        <div className="exercise-edit-fields">
          <label className="sr-only" htmlFor={`${exercise.id}-name`}>Exercise name</label>
          <SearchSelect
            id={`${exercise.id}-name`}
            label="Exercise" className="editor-input exercise-name-input" groupTabs
            value={exercise.catalogExerciseId ?? ""}
            placeholder="Choose an exercise" searchPlaceholder="Search exercises, muscles, equipment..."
            options={catalog.exercises.map((option) => ({
              value: option.id, label: option.name, group: option.primaryMuscle,
              description: option.equipment.map((item) => item.name).join(" · "),
            }))}
            onChange={(value) => {
              const nextExercise = catalog.exercises.find((item) => item.id === value);
              const defaultEquipment = nextExercise?.equipment[0];
              onChange({ catalogExerciseId: value, name: nextExercise?.name ?? "",
                equipmentId: defaultEquipment?.id ?? "", equipment: defaultEquipment?.name ?? "" });
            }}
          />
          <label className="sr-only" htmlFor={`${exercise.id}-equipment`}>Equipment</label>
          <SearchSelect
            id={`${exercise.id}-equipment`} label="Equipment"
            value={exercise.equipmentId ?? ""} disabled={!exercise.catalogExerciseId}
            placeholder="Choose equipment" searchPlaceholder="Search compatible equipment..."
            options={(catalog.exercises.find((item) => item.id === exercise.catalogExerciseId)?.equipment ?? [])
              .map((option) => ({ value: option.id, label: option.name }))}
            onChange={(value) => {
              const selectedExercise = catalog.exercises.find((item) => item.id === exercise.catalogExerciseId);
              const selectedEquipment = selectedExercise?.equipment.find((item) => item.id === value);
              onChange({ equipmentId: value, equipment: selectedEquipment?.name ?? "" });
            }}
          />
          <div className="exercise-edit-row">
            <label className="sr-only" htmlFor={`${exercise.id}-sets`}>Sets</label>
            <input
              id={`${exercise.id}-sets`}
              className="editor-input"
              type="number" min="1" max="20" step="1"
              value={exercise.sets}
              placeholder="Sets"
              onChange={(event) => onChange({ sets: event.target.value })}
            />
            <label className="sr-only" htmlFor={`${exercise.id}-reps`}>Reps</label>
            <input
              id={`${exercise.id}-reps`}
              className="editor-input"
              maxLength={32}
              value={exercise.reps}
              placeholder="Reps"
              onChange={(event) => onChange({ reps: event.target.value })}
            />
          </div>
          <label className="sr-only" htmlFor={`${exercise.id}-note`}>Exercise note</label>
          <input
            id={`${exercise.id}-note`}
            className="editor-input"
            maxLength={500}
            value={exercise.note}
            placeholder="Short note (optional)"
            onChange={(event) => onChange({ note: event.target.value })}
          />
        </div>
      ) : (
        <>
          <span className="exercise-copy">
            <span className="exercise-name">{exercise.name || "Untitled exercise"}</span>
            {exercise.equipment && <span className="exercise-note">{exercise.equipment}</span>}
            {exercise.note && <span className="exercise-note">{exercise.note}</span>}
          </span>
          <div className="exercise-set-controls" aria-label={`${exercise.name} set progress`}>
            <span className="exercise-target">
              {exercise.sets && <strong>{visibleSetCount} / {exercise.sets} sets</strong>}
              {exercise.reps && <span>{exercise.reps}</span>}
              {completed && <span className="set-complete-label">Complete</span>}
            </span>
            <button type="button" className="set-step-button" disabled={setsDisabled || visibleSetCount <= 0}
              onClick={() => onSetCountChange(Math.max(0, visibleSetCount - 1))}
              aria-label={`Remove one completed set from ${exercise.name}`}>−</button>
            <button type="button" className="set-step-button set-step-add" disabled={setsDisabled || visibleSetCount >= targetSetCount}
              onClick={() => onSetCountChange(Math.min(targetSetCount, visibleSetCount + 1))}
              aria-label={`Add one completed set to ${exercise.name}`}>+</button>
            {exercise.sets && <span className="exercise-set-progress" role="progressbar"
              aria-label={`${exercise.name}: ${visibleSetCount} of ${targetSetCount} sets`}
              aria-valuemin={0} aria-valuemax={targetSetCount} aria-valuenow={visibleSetCount}>
              <span className="exercise-set-progress-fill" style={{ width: `${setProgress}%` }} />
            </span>}
            {restTimerSecondsRemaining > 0 && (
              <div className="exercise-rest-countdown" role="timer" aria-live="polite">
                <span>Rest · {restDurationSeconds}s</span>
                <strong>{formatDuration(restTimerSecondsRemaining)}</strong>
                <button className="text-button" type="button" onClick={onStopRestTimer}>Stop</button>
              </div>
            )}
          </div>
        </>
      )}
      {editing && (
        <button
          className="icon-button remove-exercise"
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${exercise.name || "exercise"}`}
          title="Remove exercise"
        >
          <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M4 6h12M8 6V4h4v2m2 0-.6 10H6.6L6 6m2.5 3v4m3-4v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
    </article>
  );
}

function App() {
  const today = new Date();
  const weekStart = getWeekStart(today);
  const [plans, setPlans] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState(readSavedPlanSelection);
  const initialPlan = plans.find((plan) => plan.id === selectedPlanId) ?? plans[0];
  const [selectedIndex, setSelectedIndex] = useState(
    () => initialPlan?.categories.findIndex((category) => category.weekday === today.getDay()) ?? -1,
  );
  const [completedByDate, setCompletedByDate] = useState({});
  const [theme, setTheme] = useState(readSavedTheme);
  const [page, setPage] = useState("workout");
  const [restDurationSeconds, setRestDurationSeconds] = useState(90);
  const [workoutBackendUnavailable, setWorkoutBackendUnavailable] = useState(false);
  const [restEndsAt, setRestEndsAt] = useState(null);
  const [restExerciseId, setRestExerciseId] = useState(null);
  const [timerNow, setTimerNow] = useState(Date.now());
  const [workoutSession, setWorkoutSession] = useState(null);
  const [setCounts, setSetCounts] = useState({});
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionError, setSessionError] = useState("");
  const [timerPending, setTimerPending] = useState(false);
  const [editing, setEditing] = useState(false);
  const [authToken, setAuthToken] = useState(
    () => window.sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY),
  );
  const [currentUser, setCurrentUser] = useState(null);
  const [catalog, setCatalog] = useState({ exercises: [], equipment: [], muscleGroups: [] });
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [registerMode, setRegisterMode] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [loginPending, setLoginPending] = useState(false);
  const [dataReady, setDataReady] = useState(false);
  const [dataLoadError, setDataLoadError] = useState("");
  const [dataLoadAttempt, setDataLoadAttempt] = useState(0);
  const [saveState, setSaveState] = useState("");
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [archivePending, setArchivePending] = useState(false);
  const [archiveError, setArchiveError] = useState("");
  const [showArchivedPlans, setShowArchivedPlans] = useState(false);
  const [showRoutineTransfer, setShowRoutineTransfer] = useState(false);
  const [showRoutineMenu, setShowRoutineMenu] = useState(false);
  const routineMenuRef = useRef(null);
  const setCountsRef = useRef({});
  const setRequestQueueRef = useRef(Promise.resolve());
  const currentWorkoutKeyRef = useRef("");
  const savedPlansRef = useRef("");
  const savedProgressRef = useRef({});
  const saveQueue = useMemo(() => createSaveQueue({ onState: (state) => { if (authToken) setSaveState(state); } }), [authToken]);
  useEffect(() => () => saveQueue.cancel(), [saveQueue]);
  useEffect(() => {
    if (!showRoutineMenu) return undefined;
    const closeOnOutsideClick = (event) => {
      if (!routineMenuRef.current?.contains(event.target)) setShowRoutineMenu(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setShowRoutineMenu(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [showRoutineMenu]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 100, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const activePlan = plans.find((plan) => plan.id === selectedPlanId) ?? plans[0];
  // Recognize only the untouched plan generated by the previous first-login flow.
  const emptyStarterPlan = plans.length === 1 && activePlan?.name === "My first plan" &&
    activePlan.categories.length === 1 && activePlan.categories[0].name === "Day 1" &&
    activePlan.categories[0].short === "Day 1" && activePlan.categories[0].weekday === 1 &&
    !activePlan.categories[0].focus && !activePlan.categories[0].label &&
    !activePlan.categories[0].exercises.length &&
    !Object.entries(completedByDate).some(([key, ids]) => key.startsWith(`${activePlan.id}|`) && ids.length)
    ? activePlan : null;
  const needsOnboarding = !plans.length || Boolean(emptyStarterPlan);
  const activeCategory = selectedIndex >= 0 ? activePlan?.categories[selectedIndex] : null;
  const weekdayOffset = activeCategory ? (activeCategory.weekday + 6) % 7 : 0;
  const selectedDate = activeCategory
    ? new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + weekdayOffset)
    : today;
  const progressKey = activePlan ? `${activePlan.id}|${dateKey(selectedDate)}` : "";
  const selectedDateKey = dateKey(selectedDate);
  const isPastSelectedDate = selectedDateKey < dateKey(today);
  currentWorkoutKeyRef.current = progressKey;
  const completed = completedByDate[progressKey] || [];
  const exerciseCount = activeCategory?.exercises.length ?? 0;
  const doneCount = activeCategory
    ? activeCategory.exercises.filter((exercise) => completed.includes(exercise.id)).length
    : 0;
  const progress = exerciseCount ? Math.round((doneCount / exerciseCount) * 100) : 0;
  const restSecondsRemaining = restEndsAt ? Math.max(0, Math.ceil((restEndsAt - timerNow) / 1000)) : 0;
  const workoutSeconds = (Number(workoutSession?.duration_seconds) || 0) + (!isPastSelectedDate && workoutSession?.started_at
    ? Math.max(0, Math.floor((timerNow - new Date(workoutSession.started_at).getTime()) / 1000))
    : 0);
  const workoutTimerRunning = !isPastSelectedDate && Boolean(workoutSession?.started_at);
  const isTodaySelected = activeCategory
    ? activeCategory.weekday === today.getDay()
    : !activePlan?.categories.some((category) => category.weekday === today.getDay());

  useEffect(() => {
    if (!authToken) return;

    let cancelled = false;
    const loadData = async () => {
      try {
        const [profile, catalogData, plansResponse, progressResponse, settingsResponse] = await Promise.all([
          apiRequest("/setlist/auth/me", authToken),
          apiRequest("/setlist/catalog", authToken),
          apiRequest("/setlist/plans", authToken),
          apiRequest("/setlist/progress", authToken),
          apiRequest("/setlist/settings", authToken).catch((error) => {
            if (error.status === 404) return { restDurationSeconds: 90, backendFeatureMissing: true };
            throw error;
          }),
        ]);
        if (cancelled) return;
        setCurrentUser(profile.user);
        setCatalog(catalogData);
        setRestDurationSeconds(settingsResponse.restDurationSeconds);
        setWorkoutBackendUnavailable(Boolean(settingsResponse.backendFeatureMissing));
        let loadedPlans = plansResponse.plans;
        let loadedProgress = progressResponse.completedByDate;
        if (!loadedPlans.length && profile.user.role === "owner") {
          const hasLegacyPlans = window.localStorage.getItem(PLANS_STORAGE_KEY) !== null;
          const hasLegacyProgress = window.localStorage.getItem(PROGRESS_STORAGE_KEY) !== null;
          if (hasLegacyPlans || hasLegacyProgress) {
            const imported = await apiRequest("/setlist/import-legacy", authToken, {
              method: "POST",
              body: JSON.stringify({
                data: {
                  plans: hasLegacyPlans ? readSavedPlans() : [starterPlan],
                  completedByDate: hasLegacyProgress ? readSavedProgress() : {},
                },
              }),
            });
            if (imported.imported) {
              loadedPlans = imported.plans;
              const [refreshedCatalog, refreshedProgress] = await Promise.all([
                apiRequest("/setlist/catalog", authToken),
                apiRequest("/setlist/progress", authToken),
              ]);
              setCatalog(refreshedCatalog);
              loadedProgress = refreshedProgress.completedByDate;
            }
          }
        }
        if (cancelled) return;
        savedPlansRef.current = JSON.stringify(loadedPlans);
        savedProgressRef.current = loadedProgress;
        setPlans(loadedPlans);
        const nextPlan = loadedPlans.find((plan) => plan.id === window.localStorage.getItem(PLAN_SELECTION_KEY)) ?? loadedPlans[0];
        setSelectedIndex(nextPlan?.categories.findIndex((day) => day.weekday === today.getDay()) ?? -1);
        setCompletedByDate(loadedProgress);
        const storedSelection = window.localStorage.getItem(PLAN_SELECTION_KEY);
        setSelectedPlanId(
          loadedPlans.some((plan) => plan.id === storedSelection)
            ? storedSelection
            : loadedPlans[0]?.id ?? "",
        );
        setDataReady(true);
      } catch (error) {
        if (cancelled) return;
        if (error.status === 401) {
          window.sessionStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
          setAuthToken(null);
          setDataReady(false);
          setDataLoadError("");
          setLoginError("Your saved session belongs to a different database or has expired. Sign in again to use the local database.");
          return;
        }
        setDataLoadError(
          error instanceof Error ? error.message : "Could not load data from the server.",
        );
      }
    };
    void loadData();
    return () => {
      cancelled = true;
    };
  }, [authToken, dataLoadAttempt]);

  useEffect(() => {
    if (!authToken || !dataReady || !activePlan) return undefined;
    let cancelled = false;
    setSessionLoading(true);
    setSessionError("");
    setWorkoutSession(null);
    setCountsRef.current = {};
    setSetCounts({});
    setRestEndsAt(null);
    setRestExerciseId(null);
    apiRequest(`/setlist/workout-session?planId=${encodeURIComponent(activePlan.id)}&performedOn=${selectedDateKey}`, authToken)
      .then((result) => {
        if (cancelled) return;
        setWorkoutSession(result.session);
        setCountsRef.current = result.setCounts;
        setSetCounts(result.setCounts);
      })
      .catch((error) => {
        if (!cancelled && error.status === 404) {
          setWorkoutBackendUnavailable(true);
          setSessionError("");
        } else if (!cancelled) {
          setSessionError(error instanceof Error ? error.message : "Could not load workout progress.");
        }
      })
      .finally(() => {
        if (!cancelled) setSessionLoading(false);
      });
    return () => { cancelled = true; };
  }, [authToken, dataReady, activePlan?.id, selectedDateKey]);

  useEffect(() => {
    if (!workoutSession?.started_at && !restEndsAt) return undefined;
    const interval = window.setInterval(() => setTimerNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [workoutSession?.started_at, restEndsAt]);

  useEffect(() => {
    if (!restEndsAt) return;
    if (restEndsAt <= timerNow) {
      setRestEndsAt(null);
      setRestExerciseId(null);
    }
  }, [restEndsAt, timerNow]);

  useEffect(() => {
    if (!authToken || !dataReady || needsOnboarding) return;
    const incomplete = plans.some((plan) => !plan.name.trim() || plan.categories.some((day) =>
      !day.name.trim() || day.exercises.some((exercise) => !exercise.catalogExerciseId ||
        !exercise.equipmentId || !Number.isInteger(Number(exercise.sets)) ||
        Number(exercise.sets) < 1 || Number(exercise.sets) > 20)));
    if (incomplete) {
      saveQueue.cancelPending();
      setSaveState("Finish the plan name, exercise, equipment, and sets to save.");
      return;
    }
    const planSnapshot = JSON.stringify(plans);
    saveQueue.schedule(async () => {
      if (savedPlansRef.current !== planSnapshot) {
        await apiRequest("/setlist/plans", authToken, {
          method: "PUT", body: JSON.stringify({ plans }),
        });
        savedPlansRef.current = planSnapshot;
      }
      const allowed = new Map(plans.map((plan) => [plan.id,
        new Set(plan.categories.flatMap((day) => day.exercises.map((exercise) => exercise.id)))]));
      const changes = {};
      const keys = new Set([...Object.keys(completedByDate), ...Object.keys(savedProgressRef.current)]);
      for (const key of keys) {
        const exercises = allowed.get(key.split("|")[0]);
        if (!exercises) continue;
        const ids = (completedByDate[key] ?? []).filter((id) => exercises.has(id));
        if (JSON.stringify(ids) !== JSON.stringify(savedProgressRef.current[key] ?? [])) changes[key] = ids;
      }
      if (Object.keys(changes).length) {
        await apiRequest("/setlist/progress", authToken, {
          method: "PUT", body: JSON.stringify({ completedByDate: changes }),
        });
        savedProgressRef.current = { ...savedProgressRef.current, ...changes };
      }
    });
  }, [authToken, completedByDate, dataReady, needsOnboarding, plans, saveQueue]);

  useEffect(() => {
    if (!dataReady) return;
    if (activePlan && selectedPlanId !== activePlan.id) {
      setSelectedPlanId(activePlan.id);
    }
    try {
      if (activePlan) window.localStorage.setItem(PLAN_SELECTION_KEY, activePlan.id);
    } catch (error) {
      console.error("Could not save selected plan.", error);
    }
  }, [activePlan, dataReady, selectedPlanId]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (error) {
      console.error("Could not save theme preference.", error);
    }
  }, [theme]);

  function updatePlan(patch) {
    setPlans((current) =>
      current.map((plan) => (plan.id === activePlan.id ? { ...plan, ...patch } : plan)),
    );
  }

  function updateCategory(categoryId, patch) {
    setPlans((current) => current.map((plan) => plan.id !== activePlan.id ? plan : {
      ...plan, categories: plan.categories.map((category) =>
        category.id === categoryId ? { ...category, ...patch } : category),
    }));
  }

  function updateExercise(categoryId, exerciseId, patch) {
    setPlans((current) => current.map((plan) => plan.id !== activePlan.id ? plan : {
      ...plan, categories: plan.categories.map((day) => day.id !== categoryId ? day : {
        ...day, exercises: day.exercises.map((exercise) =>
          exercise.id === exerciseId ? { ...exercise, ...patch } : exercise),
      }),
    }));
  }

  function changeExerciseSetCount(exerciseId, nextCount) {
    if (!activePlan || !authToken) return;
    const exercise = activeCategory?.exercises.find((item) => item.id === exerciseId);
    const targetSets = Math.max(1, Number.parseInt(exercise?.sets, 10) || 1);
    const previousCount = Math.max(0, Math.min(targetSets, Number(setCountsRef.current[exerciseId] ?? 0)));
    const safeCount = Math.max(0, Math.min(targetSets, Math.trunc(Number(nextCount) || 0)));
    setCountsRef.current = { ...setCountsRef.current, [exerciseId]: safeCount };
    setSetCounts(setCountsRef.current);
    if (safeCount > previousCount && !isPastSelectedDate) {
      setRestExerciseId(exerciseId);
      setRestEndsAt(Date.now() + restDurationSeconds * 1000);
    }
    setCompletedByDate((current) => {
      const selected = current[progressKey] || [];
      const isComplete = safeCount >= targetSets;
      const next = isComplete
        ? selected.includes(exerciseId) ? selected : [...selected, exerciseId]
        : selected.filter((id) => id !== exerciseId);
      return { ...current, [progressKey]: next };
    });

    const request = setRequestQueueRef.current.catch(() => {}).then(() => apiRequest(
      "/setlist/workout-session/sets", authToken, {
        method: "PUT",
        body: JSON.stringify({ planId: activePlan.id, performedOn: selectedDateKey, exerciseId, setCount: safeCount }),
      },
    ));
    setRequestQueueRef.current = request.catch(() => {});
    const requestKey = progressKey;
    void request.then((result) => {
      if (currentWorkoutKeyRef.current !== requestKey) return;
      setWorkoutSession(result.session);
      setSessionError("");
    }).catch((error) => {
      if (currentWorkoutKeyRef.current !== requestKey) return;
      setSessionError(error instanceof Error ? error.message : "Could not save this set.");
      void apiRequest(`/setlist/workout-session?planId=${encodeURIComponent(activePlan.id)}&performedOn=${selectedDateKey}`, authToken)
        .then((result) => {
          if (currentWorkoutKeyRef.current !== requestKey) return;
          setWorkoutSession(result.session);
          setCountsRef.current = result.setCounts;
          setSetCounts(result.setCounts);
        setWorkoutBackendUnavailable(false);
          setCompletedByDate((current) => {
            const selected = current[progressKey] || [];
            const isComplete = (Number(result.setCounts[exerciseId] ?? 0) >= targetSets);
            return { ...current, [progressKey]: isComplete
              ? selected.includes(exerciseId) ? selected : [...selected, exerciseId]
              : selected.filter((id) => id !== exerciseId) };
          });
        }).catch(() => {});
    });
  }

  async function saveRestDuration(seconds) {
    const result = await apiRequest("/setlist/settings", authToken, {
      method: "PUT", body: JSON.stringify({ restDurationSeconds: seconds }),
    });
    setRestDurationSeconds(result.restDurationSeconds);
  }

  async function changeWorkoutTimer(action) {
    if (!activePlan || !authToken || isPastSelectedDate) return;
    const requestKey = progressKey;
    setTimerPending(true);
    setSessionError("");
    try {
      const result = await apiRequest("/setlist/workout-session/timer", authToken, {
        method: "PUT",
        body: JSON.stringify({ planId: activePlan.id, performedOn: selectedDateKey, action }),
      });
      if (currentWorkoutKeyRef.current !== requestKey) return;
      setWorkoutSession(result.session);
      setCountsRef.current = result.setCounts;
      setSetCounts(result.setCounts);
    } catch (error) {
      setSessionError(error instanceof Error ? error.message : "Could not update the workout timer.");
    } finally {
      setTimerPending(false);
    }
  }

  function createFirstPlan(name, selectedDays) {
    const nextPlan = {
      id: emptyStarterPlan?.id ?? createId(), name,
      categories: selectedDays.map((weekday, index) => ({
        ...createCategory(index, weekday), name: weekdays[weekday], short: weekdays[weekday].slice(0, 3),
      })),
    };
    setPlans([nextPlan]);
    setSelectedPlanId(nextPlan.id);
    setSelectedIndex(0);
    setEditing(true);
  }

  function addPlan() {
    const nextPlan = createPlan(`Plan ${plans.length + 1}`);
    setPlans((current) => [...current, nextPlan]);
    setSelectedPlanId(nextPlan.id);
    setSelectedIndex(0);
    setEditing(true);
  }

  async function importRoutines(importedPlans) {
    if (plans.length + importedPlans.length > 50) {
      throw new Error("Archive a routine or choose fewer imports. Setlist supports 50 active routines.");
    }
    await saveQueue.flush();
    if (savedPlansRef.current !== JSON.stringify(plans)) {
      throw new Error("Finish editing or save the current routine before importing.");
    }

    const copiedPlans = importedPlans.map((plan) => ({
      ...plan,
      id: createId(),
      name: plan.name.trim(),
      description: plan.description ?? "",
      categories: plan.categories.map((day) => ({
        ...day,
        id: createId(),
        exercises: day.exercises.map((exercise) => ({ ...exercise, id: createId() })),
      })),
    }));
    const result = await apiRequest("/setlist/plans", authToken, {
      method: "PUT",
      body: JSON.stringify({ plans: [...plans, ...copiedPlans] }),
    });
    savedPlansRef.current = JSON.stringify(result.plans);
    setPlans(result.plans);
    const selectedImport = copiedPlans[copiedPlans.length - 1];
    setSelectedPlanId(selectedImport.id);
    setSelectedIndex(selectedImport.categories.findIndex((day) => day.weekday === today.getDay()));
    setEditing(false);
    setSaveState(copiedPlans.length + (copiedPlans.length === 1 ? " routine imported" : " routines imported"));
  }

  function removePlan() {
    if (!activePlan) return;
    setArchiveTarget(activePlan);
    setArchiveError("");
  }

  async function archivePlan() {
    if (!archiveTarget || archivePending) return;
    setArchivePending(true);
    setArchiveError("");
    try {
      await saveQueue.flush();
      if (savedPlansRef.current !== JSON.stringify(plans)) {
        throw new Error("Finish the plan fields and save your changes before archiving.");
      }
      await apiRequest(`/setlist/plans/${archiveTarget.id}`, authToken, { method: "DELETE" });
      const remaining = plans.filter((plan) => plan.id !== archiveTarget.id);
      savedPlansRef.current = JSON.stringify(remaining);
      setPlans(remaining);
      setSelectedPlanId(remaining[0]?.id ?? null);
      setSelectedIndex(remaining[0]?.categories.findIndex((day) => day.weekday === today.getDay()) ?? -1);
      setEditing(false);
      setArchiveTarget(null);
      setSaveState("Plan archived");
    } catch (error) {
      setArchiveError(error.message ?? "Could not archive this plan.");
    } finally {
      setArchivePending(false);
    }
  }

  async function restorePlan(plan) {
    await saveQueue.flush();
    if (savedPlansRef.current !== JSON.stringify(plans)) {
      throw new Error("Finish the fields in your current plan before restoring another.");
    }
    if (plans.length >= 50) throw new Error("Archive an active plan before restoring another.");
    const result = await apiRequest("/setlist/plans", authToken, {
      method: "PUT", body: JSON.stringify({ plans: [...plans, plan] }),
    });
    savedPlansRef.current = JSON.stringify(result.plans);
    setPlans(result.plans);
    setSelectedPlanId(plan.id);
    setSelectedIndex(plan.categories.findIndex((day) => day.weekday === today.getDay()));
    setEditing(false);
    setShowArchivedPlans(false);
    setSaveState("Plan restored");
  }

  function addCategory() {
    if (activePlan.categories.length >= weekdays.length) return;
    const usedWeekdays = new Set(activePlan.categories.map((category) => category.weekday));
    const weekday = weekdays.findIndex((_, index) => !usedWeekdays.has(index));
    const category = createCategory(activePlan.categories.length, weekday);
    updatePlan({ categories: [...activePlan.categories, category] });
    setSelectedIndex(activePlan.categories.length);
  }

  function removeCategory(categoryId) {
    const category = activePlan.categories.find((item) => item.id === categoryId);
    const removedIndex = activePlan.categories.findIndex((item) => item.id === categoryId);
    if (!window.confirm(`Remove "${category.name}" and its exercises?`)) return;
    const nextCategories = activePlan.categories.filter((item) => item.id !== categoryId);
    updatePlan({ categories: nextCategories });
    clearExerciseProgress(category.exercises.map((exercise) => exercise.id));
    setSelectedIndex((current) => {
      if (!nextCategories.length) return -1;
      if (current === removedIndex) return Math.min(removedIndex, nextCategories.length - 1);
      return current > removedIndex ? current - 1 : current;
    });
  }

  function addExercise() {
    if (!activeCategory) return;
    const initialExercise = catalog.exercises[0];
    const initialEquipment = initialExercise?.equipment[0];
    const exercise = {
      id: createId(),
      catalogExerciseId: initialExercise?.id ?? "",
      name: initialExercise?.name ?? "",
      equipmentId: initialEquipment?.id ?? "",
      equipment: initialEquipment?.name ?? "",
      sets: "3",
      reps: "8-12",
      note: "",
    };
    updateCategory(activeCategory.id, { exercises: [...activeCategory.exercises, exercise] });
  }

  function removeExercise(categoryId, exerciseId) {
    const category = activePlan.categories.find((item) => item.id === categoryId);
    updateCategory(categoryId, {
      exercises: category.exercises.filter((exercise) => exercise.id !== exerciseId),
    });
    clearExerciseProgress([exerciseId]);
  }

  function clearExerciseProgress(exerciseIds) {
    const idsToRemove = new Set(exerciseIds);
    setCompletedByDate((current) => {
      const next = { ...current };
      for (const [key, ids] of Object.entries(current)) {
        if (!key.startsWith(`${activePlan.id}|`)) continue;
        const remaining = ids.filter((id) => !idsToRemove.has(id));
        if (remaining.length) next[key] = remaining;
        else delete next[key];
      }
      return next;
    });
  }

  function reorderExercises(event, category) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = category.exercises.findIndex((exercise) => exercise.id === active.id);
    const newIndex = category.exercises.findIndex((exercise) => exercise.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    updateCategory(category.id, { exercises: arrayMove(category.exercises, oldIndex, newIndex) });
  }

  function formatDate(date) {
    return new Intl.DateTimeFormat("en", { month: "long", day: "numeric" }).format(date);
  }

  async function handleLogin(event) {
    event.preventDefault();
    setLoginPending(true);
    try {
      const result = await apiRequest(
        registerMode ? "/setlist/auth/register" : "/setlist/auth/login",
        undefined,
        {
        method: "POST",
        body: JSON.stringify({ username, password }),
        },
      );
      window.sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, result.token);
      setAuthToken(result.token);
      setCurrentUser(result.user);
      setPassword("");
      setLoginError("");
      setDataLoadError("");
    } catch (error) {
      setLoginError(
        error instanceof Error ? error.message : "Could not sign in to the server.",
      );
    } finally {
      setLoginPending(false);
    }
  }

  async function signOut() {
    try { await saveQueue.flush(); } catch { return; }
    try { await setRequestQueueRef.current; } catch { /* pending set failures were already displayed */ }
    if (authToken) {
      try {
        await apiRequest("/setlist/auth/logout", authToken, { method: "POST" });
      } catch (error) {
        console.error("Could not end the server session.", error);
      }
    }
    window.sessionStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    setAuthToken(null);
    setCurrentUser(null);
    setArchiveTarget(null);
    setShowArchivedPlans(false);
    setShowRoutineTransfer(false);
    setShowRoutineMenu(false);
    setPage("workout");
    setWorkoutSession(null);
    setSetCounts({});
    setCountsRef.current = {};
    setRestEndsAt(null);
    setRestExerciseId(null);
    setPlans([]);
    setSelectedPlanId(null);
    setSelectedIndex(-1);
    setCompletedByDate({});
    setEditing(false);
    setSaveState("");
    setDataReady(false);
    setDataLoadError("");
  }

  if (!authToken) {
    return (
      <main className={`auth-screen${theme === "dark" ? " is-dark" : ""}`}>
        <form className="auth-panel" onSubmit={handleLogin}>
          <p className="eyebrow">SETLIST // YOUR TRAINING SPACE</p>
          <h1>{registerMode ? "Create your account." : "Welcome back."}</h1>
          <p className="auth-description">
            {registerMode
              ? "Create a private account for your plans and training history."
              : "Sign in to load your plans and workout history."}
          </p>
          <label>
            Username
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              autoFocus
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={registerMode ? "new-password" : "current-password"}
              minLength={registerMode ? 12 : undefined}
              required
            />
          </label>
          {registerMode && (
            <p className="auth-hint">3–32 letters, numbers, dots, underscores or hyphens. Password: 12+ characters.</p>
          )}
          {loginError && <p className="auth-error" role="alert">{loginError}</p>}
          <button className="auth-submit" type="submit" disabled={loginPending}>
            {loginPending ? "Please wait..." : registerMode ? "Create account" : "Sign in"}
          </button>
          <button
            className="text-button auth-signout"
            type="button"
            onClick={() => {
              setRegisterMode((current) => !current);
              setLoginError("");
            }}
          >
            {registerMode ? "Already have an account? Sign in" : "New to Setlist? Create an account"}
          </button>
        </form>
      </main>
    );
  }

  if (!dataReady) {
    return (
      <main className={`auth-screen${theme === "dark" ? " is-dark" : ""}`}>
        <section className="auth-panel">
          <p className="eyebrow">SETLIST // PRIVATE ACCESS</p>
          <h1>{dataLoadError ? "Server unavailable." : "Loading your data."}</h1>
          <p className="auth-description">
            {dataLoadError || "Connecting to your private workspace..."}
          </p>
          {dataLoadError && (
            <button
              className="auth-submit"
              type="button"
              onClick={() => {
                setDataLoadError("");
                setDataLoadAttempt((attempt) => attempt + 1);
              }}
            >
              Try again
            </button>
          )}
          <button className="text-button auth-signout" type="button" onClick={() => void signOut()}>
            Sign out
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="Setlist home" onClick={(event) => { event.preventDefault(); setPage("workout"); }}>
          <span className="brand-mark">S</span>
          <span>SETLIST</span>
        </a>
        <div className="topbar-actions">
          <span className="topbar-caption" role="status">{needsOnboarding ? "" : saveState}</span>
          <span className="topbar-caption">{currentUser?.username}</span>
          {saveState.startsWith("Could not save:") && <button className="text-button" type="button"
            onClick={() => void saveQueue.retry().catch(() => {})}>Retry save</button>}
          {!needsOnboarding && <nav className="topbar-nav" aria-label="Main navigation">
            <button type="button" className="page-nav-button" aria-current={page === "workout" ? "page" : undefined}
              onClick={() => setPage("workout")}>Workout</button>
            <button type="button" className="page-nav-button" aria-current={page === "calendar" ? "page" : undefined}
              onClick={() => setPage("calendar")}>Calendar</button>
            <button type="button" className="page-nav-button" aria-current={page === "settings" ? "page" : undefined}
              onClick={() => setPage("settings")}>Settings</button>
          </nav>}
          {!needsOnboarding && page === "workout" && <>
          <label className="sr-only" htmlFor="plan-picker">Choose plan</label>
          <SearchSelect
            id="plan-picker" label="Plan" className="plan-picker"
            disabled={workoutTimerRunning}
            value={activePlan?.id ?? ""} placeholder="Choose plan" searchPlaceholder="Search your plans..."
            options={plans.map((plan) => ({ value: plan.id, label: plan.name }))}
            onChange={(value) => {
              const nextPlan = plans.find((plan) => plan.id === value);
              setSelectedPlanId(value);
              setSelectedIndex(nextPlan?.categories.findIndex((category) => category.weekday === today.getDay()) ?? -1);
            }}
          />
          </>}
          <div className="routine-menu" ref={routineMenuRef}>
            <button className="theme-toggle routine-menu-toggle" type="button"
              aria-label="Routine actions" aria-haspopup="true" aria-expanded={showRoutineMenu} aria-controls="routine-menu-panel"
              title="Routine actions" onClick={() => setShowRoutineMenu((open) => !open)}>
              <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <circle cx="4" cy="10" r="1.5" />
                <circle cx="10" cy="10" r="1.5" />
                <circle cx="16" cy="10" r="1.5" />
              </svg>
            </button>
            {showRoutineMenu && (
              <div className="routine-menu-panel" id="routine-menu-panel" aria-label="Routine actions">
                {!needsOnboarding && page === "workout" && <>
                  <p className="routine-menu-label">ROUTINE</p>
                  <button type="button" className="routine-menu-item" disabled={plans.length >= 50 || workoutTimerRunning}
                    onClick={() => { setShowRoutineMenu(false); addPlan(); }}>New routine</button>
                  <button type="button" className="routine-menu-item" disabled={workoutTimerRunning}
                    onClick={() => { setShowRoutineMenu(false); setEditing((current) => !current); }}>
                    {editing ? "Finish editing" : "Edit current routine"}
                  </button>
                  <hr className="routine-menu-divider" />
                </>}
                <button type="button" className="routine-menu-item"
                  onClick={() => { setShowRoutineMenu(false); setPage("settings"); }}>
                  Settings
                </button>
                <hr className="routine-menu-divider" />
                <button type="button" className="routine-menu-item"
                  onClick={() => { setShowRoutineMenu(false); void signOut(); }}>
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {workoutBackendUnavailable && !needsOnboarding && (
        <aside className="backend-update-notice" role="status">
          Workout logging, timers, and calendar need the updated backend deployed. Routine editing will still work.
        </aside>
      )}

      {showRoutineTransfer && <RoutineTransfer plans={plans} activePlanId={activePlan?.id} catalog={catalog}
        onImport={importRoutines} onClose={() => setShowRoutineTransfer(false)} />}
      {archiveTarget && <AppDialog role="alertdialog" title={`Archive “${archiveTarget.name}”?`}
        description="This plan will move to Archived plans. Your workout history will be kept, and you can restore the plan anytime."
        busy={archivePending} onClose={() => setArchiveTarget(null)}
        actions={<>
          <button className="text-button" type="button" autoFocus disabled={archivePending} onClick={() => setArchiveTarget(null)}>Keep plan</button>
          <button className="app-dialog-primary" type="button" disabled={archivePending} onClick={() => void archivePlan()}>{archivePending ? "Archiving..." : "Archive plan"}</button>
        </>}>
        {archiveError && <p className="app-dialog-error" role="alert">{archiveError}</p>}
      </AppDialog>}
      {showArchivedPlans && <ArchivedPlans token={authToken} activePlanCount={plans.length}
        onClose={() => setShowArchivedPlans(false)} onRestore={restorePlan} />}

      {needsOnboarding ? <GettingStarted onCreate={createFirstPlan} /> : page === "settings" ? (
        <SettingsPage
          currentUser={currentUser}
          restDurationSeconds={restDurationSeconds}
          backendAvailable={!workoutBackendUnavailable}
          theme={theme}
          onSaveRestDuration={saveRestDuration}
          onToggleTheme={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
          onImportExport={() => setShowRoutineTransfer(true)}
          onArchivedPlans={() => setShowArchivedPlans(true)}
        />
      ) : page === "calendar" ? <WorkoutCalendar token={authToken} /> : <>
      {editing && (
        <section className="plan-editor" aria-label="Plan settings">
          <div className="plan-name-field">
            <label className="eyebrow" htmlFor="plan-name">PLAN NAME</label>
            <input
              id="plan-name"
              className="editor-input"
              value={activePlan.name}
              maxLength={100}
              onChange={(event) => updatePlan({ name: event.target.value })}
              onBlur={() => {
                if (!activePlan.name.trim()) updatePlan({ name: "Untitled plan" });
              }}
              placeholder="Name your plan"
            />
          </div>
          <button className="text-button danger-button" type="button" onClick={removePlan}>
            Archive plan
          </button>
        </section>
      )}

      {editing && activePlan.categories.length > 0 && activePlan.categories.every((day) => !day.exercises.length) && (
        <aside className="plan-setup-hint" role="status">
          <strong>Your plan is ready. Let&apos;s add your first exercise.</strong>
          <span>Choose a training day below, then use Add exercise to pick a movement and equipment.</span>
        </aside>
      )}

      <section className={`workout-timer-panel${isPastSelectedDate ? " is-history" : ""}`} aria-label="Workout timers">
        <div className="workout-timer-copy">
          <p className="eyebrow">SESSION TIMER</p>
          <strong>{formatDuration(workoutSeconds)}</strong>
          <p>{isPastSelectedDate ? `Past session · ${formatDate(selectedDate)}` : `${workoutTimerRunning ? "Workout in progress" : workoutSession?.finished_at ? "Workout paused" : "Start when you arrive at the gym"} · ${formatDate(selectedDate)}`}</p>
        </div>
        {!isPastSelectedDate && <div className="timer-actions">
          {workoutTimerRunning ? (
            <button className="timer-button primary" type="button" disabled={timerPending || sessionLoading || workoutBackendUnavailable}
              onClick={() => void changeWorkoutTimer("stop")}>{timerPending ? "Saving…" : "Stop & save"}</button>
          ) : (
            <button className="timer-button primary" type="button" disabled={timerPending || sessionLoading || workoutBackendUnavailable || !activePlan || editing}
              onClick={() => void changeWorkoutTimer("start")}>{workoutSession?.finished_at ? "Resume" : "Start workout"}</button>
          )}
          <button className="timer-button" type="button" disabled={timerPending || sessionLoading || workoutBackendUnavailable || !workoutSession}
            onClick={() => void changeWorkoutTimer("reset")}>Reset time</button>
        </div>}
        {sessionError && <p className="timer-error" role="alert">{sessionError}</p>}
      </section>

      <section className="intro">
        <div>
          <p className="eyebrow">
            {activeCategory
              ? isTodaySelected ? "TODAY'S SESSION" : "YOUR WEEKLY PLAN"
              : isTodaySelected ? "TODAY'S REST DAY" : "YOUR WEEKLY PLAN"}
          </p>
          <h1>
            {activeCategory ? (
              activeCategory.focus ? (
                <>{activeCategory.focus} <span>day.</span></>
              ) : (
                <>{activeCategory.name}<span>.</span></>
              )
            ) : (
              <>Take a <span>rest.</span></>
            )}
          </h1>
          <p className="intro-subtitle">
            {activeCategory
              ? `${activeCategory.label || activeCategory.name} · ${formatDate(selectedDate)}`
              : "No session selected. Add a category or choose a workout day."}
          </p>
        </div>
        {activeCategory && (
          <div
            className="progress-ring"
            style={{ "--progress": `${progress * 3.6}deg` }}
            role="img"
            aria-label={`${doneCount} of ${exerciseCount} exercises complete`}
          >
            <div className="progress-ring-inner">
              <strong>{progress}%</strong>
              <span>COMPLETE</span>
            </div>
          </div>
        )}
      </section>

      <section className="week-section" aria-label="Choose a workout category">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{editing ? "EDIT YOUR SPLIT" : "YOUR SPLIT"}</p>
            <h2>{activePlan.name}</h2>
          </div>
          {activePlan.categories.length > 0 && (
            <span className="week-range">
              {formatDate(
                new Date(
                  weekStart.getFullYear(),
                  weekStart.getMonth(),
                  weekStart.getDate() + Math.min(...activePlan.categories.map((category) => (category.weekday + 6) % 7)),
                ),
              )}{" "}
              –{" "}
              {formatDate(
                new Date(
                  weekStart.getFullYear(),
                  weekStart.getMonth(),
                  weekStart.getDate() + Math.max(...activePlan.categories.map((category) => (category.weekday + 6) % 7)),
                ),
              )}
            </span>
          )}
        </div>
        {activePlan.categories.length > 0 ? (
          <div className={`week-strip${editing ? " editing" : ""}`}>
            {activePlan.categories.map((category, index) => {
              const date = new Date(
                weekStart.getFullYear(),
                weekStart.getMonth(),
                weekStart.getDate() + (category.weekday + 6) % 7,
              );
              const categoryKey = `${activePlan.id}|${dateKey(date)}`;
              const categoryProgress = completedByDate[categoryKey] || [];
              const categoryComplete =
                category.exercises.length > 0 &&
                category.exercises.every((exercise) => categoryProgress.includes(exercise.id));
              const isToday = category.weekday === today.getDay();
              return (
                <div className="category-tab-wrap" key={category.id}>
                  {editing ? (
                    <div className={`day-button category-edit-card${selectedIndex === index ? " selected" : ""}${isToday ? " today" : ""}`}>
                      <button
                        className="category-select-button"
                        type="button"
                        disabled={workoutTimerRunning}
                        onClick={() => setSelectedIndex(index)}
                        aria-pressed={selectedIndex === index}
                        aria-label={`Select ${category.name} category`}
                      >
                        <span className="day-date">{index + 1}</span>
                      </button>
                      <label className="sr-only" htmlFor={`${category.id}-short`}>Category short name</label>
                      <input
                        id={`${category.id}-short`}
                        className="category-short-input"
                        value={category.short}
                        maxLength={80}
                        onChange={(event) => updateCategory(category.id, { short: event.target.value })}
                        aria-label={`${category.name} short name`}
                      />
                      <label className="sr-only" htmlFor={`${category.id}-focus`}>Workout focus</label>
                      <input
                        id={`${category.id}-focus`}
                        className="category-focus-input"
                        value={category.focus}
                        maxLength={120}
                        placeholder="Focus"
                        onChange={(event) => updateCategory(category.id, { focus: event.target.value })}
                        aria-label={`${category.name} focus`}
                      />
                      <span className={`day-status${categoryComplete ? " complete" : ""}`} aria-hidden="true" />
                    </div>
                  ) : (
                    <button
                      className={`day-button${selectedIndex === index ? " selected" : ""}${isToday ? " today" : ""}`}
                      type="button"
                      disabled={workoutTimerRunning}
                      onClick={() => setSelectedIndex(index)}
                      aria-pressed={selectedIndex === index}
                      aria-label={`${category.name}, ${category.focus || "workout"}${isToday ? ", today" : ""}`}
                    >
                        <span className="day-label">{category.short}</span>
                        <span className="day-date">{date.getDate()}</span>
                        <span className="day-focus">{category.focus || category.name}</span>
                        <span className={`day-status${categoryComplete ? " complete" : ""}`} aria-hidden="true" />
                    </button>
                  )}
                  {editing && (
                    <button
                      className="category-remove"
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        removeCategory(category.id);
                      }}
                      aria-label={`Remove ${category.name}`}
                      title={`Remove ${category.name}`}
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })}
            {editing && activePlan.categories.length < weekdays.length && (
              <button className="add-category-card" type="button" onClick={addCategory}>
                <span aria-hidden="true">+</span>
                Add category
              </button>
            )}
          </div>
        ) : (
          <div className="empty-categories">
            <p>This plan has no categories yet.</p>
            {editing && <button className="secondary-button" type="button" onClick={addCategory}>Add your first category</button>}
          </div>
        )}
      </section>

      {activeCategory ? (
        <section className="workout-section">
          <div className="section-heading workout-heading">
            <div>
              <p className="eyebrow">{editing ? "CUSTOMIZE CATEGORY" : "THE WORKOUT"}</p>
              {editing ? (
                <div className="category-title-fields">
                  <label className="sr-only" htmlFor={`${activeCategory.id}-name`}>Category name</label>
                  <input
                    id={`${activeCategory.id}-name`}
                    className="editor-input category-name-input"
                    value={activeCategory.name}
                    maxLength={80}
                    onChange={(event) => updateCategory(activeCategory.id, { name: event.target.value })}
                  />
                  <label className="sr-only" htmlFor={`${activeCategory.id}-label`}>Category subtitle</label>
                  <input
                    id={`${activeCategory.id}-label`}
                    className="editor-input category-label-input"
                    value={activeCategory.label}
                    maxLength={120}
                    onChange={(event) => updateCategory(activeCategory.id, { label: event.target.value })}
                    placeholder="Subtitle (optional)"
                  />
                  <label className="sr-only" htmlFor={`${activeCategory.id}-weekday`}>Scheduled weekday</label>
                  <SearchSelect
                    id={`${activeCategory.id}-weekday`} label="Scheduled weekday"
                    className="editor-input category-weekday-input"
                    value={activeCategory.weekday} searchPlaceholder="Search weekdays..."
                    options={weekdays.map((weekday, index) => ({ value: index, label: weekday,
                      disabled: activePlan.categories.some((category) => category.id !== activeCategory.id && category.weekday === index),
                    }))}
                    onChange={(value) => updateCategory(activeCategory.id, { weekday: Number(value) })}
                  />
                </div>
              ) : (
                <h2>Your checklist</h2>
              )}
            </div>
            <span className="count-label">
              {doneCount} <span>/ {exerciseCount} DONE</span>
            </span>
          </div>

          {activeCategory.exercises.length > 0 ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={(event) => reorderExercises(event, activeCategory)}
            >
              <SortableContext
                items={activeCategory.exercises.map((exercise) => exercise.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="exercise-list">
                  {activeCategory.exercises.map((exercise, index) => (
                    <SortableExercise
                      key={exercise.id}
                      exercise={exercise}
                      catalog={catalog}
                      index={index}
                      completed={completed.includes(exercise.id)}
                      setCount={Number(setCounts[exercise.id] ?? 0)}
                      setsDisabled={sessionLoading || workoutBackendUnavailable}
                      restTimerSecondsRemaining={restExerciseId === exercise.id && !isPastSelectedDate ? restSecondsRemaining : 0}
                      restDurationSeconds={restDurationSeconds}
                      onStopRestTimer={() => { setRestEndsAt(null); setRestExerciseId(null); }}
                      editing={editing}
                      onSetCountChange={(count) => changeExerciseSetCount(exercise.id, count)}
                      onChange={(patch) => updateExercise(activeCategory.id, exercise.id, patch)}
                      onRemove={() => removeExercise(activeCategory.id, exercise.id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          ) : (
            <div className="empty-exercises">
              <p>No exercises in this category yet.</p>
            </div>
          )}

          {editing && (
            <button className="add-exercise-button" type="button" onClick={addExercise} disabled={!catalog.exercises.length || activeCategory.exercises.length >= 100}>
              <span aria-hidden="true">+</span>
              Add exercise
            </button>
          )}

          {!editing && (
            <aside className="training-note">
              <span className="note-rule" />
              <p>
                Rest <strong>1–2 minutes</strong> between sets. Choose a weight that makes the last
                few reps challenging while keeping your form controlled.
              </p>
            </aside>
          )}
        </section>
      ) : (
        <section className="rest-card">
          <div className="rest-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <p className="eyebrow">{activePlan.categories.length ? "REST & RECOVER" : "GET STARTED"}</p>
          <h2>{activePlan.categories.length ? "Rest day." : "Build your plan."}</h2>
          <p>
            {activePlan.categories.length
              ? "There’s no workout selected. Choose one of your categories to see its exercises."
              : "Add a category for each workout day, then fill it with exercises, sets, reps, and notes."}
          </p>
          {editing && (
            <button className="next-session" type="button" onClick={addCategory}>
              Add a category <span aria-hidden="true">+</span>
            </button>
          )}
        </section>
      )}

      <footer className="footer">
        <span>SHOW UP. CHECK IT OFF.</span>
        <span>SETLIST / {String(activePlan.categories.length).padStart(2, "0")} CATEGORIES</span>
      </footer>
      </>}
    </main>
  );
}

export default App;
