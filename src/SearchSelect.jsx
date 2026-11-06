import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./SearchSelect.css";

function searchText(value) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export default function SearchSelect({
  id, label, value, options, onChange, className = "editor-input",
  placeholder = "Choose an option", searchPlaceholder = "Search options...",
  disabled = false, groupTabs = false,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("");
  const [activeValue, setActiveValue] = useState(null);
  const [position, setPosition] = useState(null);
  const triggerRef = useRef(null);
  const popupRef = useRef(null);
  const inputRef = useRef(null);
  const tabsRef = useRef(null);
  const listId = `${id}-options`;
  const popupId = `${id}-popup`;
  const panelId = `${id}-panel`;
  const muscleTabs = useMemo(() => {
    const counts = new Map();
    for (const option of options) {
      if (option.group) counts.set(option.group, (counts.get(option.group) ?? 0) + 1);
    }
    return [{ name: "", label: "All muscles", count: options.length },
      ...[...counts].map(([name, count]) => ({ name, label: name, count }))];
  }, [options]);
  const activeGroup = groupTabs && muscleTabs.some((tab) => tab.name === selectedGroup) ? selectedGroup : "";
  const activeTabIndex = muscleTabs.findIndex((tab) => tab.name === activeGroup);
  const selected = options.find((option) => String(option.value) === String(value));
  const matches = useMemo(() => {
    const words = searchText(query).split(" ").filter(Boolean);
    return options.filter((option) => {
      const text = searchText([option.label, option.group, option.description, option.keywords].filter(Boolean).join(" "));
      return (!activeGroup || option.group === activeGroup) && words.every((word) => text.includes(word));
    });
  }, [options, query, activeGroup]);
  const enabled = matches.filter((option) => !option.disabled);
  const active = enabled.find((option) => String(option.value) === activeValue) ?? enabled[0];
  const optionId = (option) => `${id}-option-${options.indexOf(option)}`;
  const groups = new Map();
  for (const option of matches) {
    const group = option.group ?? "";
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(option);
  }

  function close(restoreFocus = false) {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus({ preventScroll: true });
  }

  function show(initialQuery = "", last = false) {
    if (disabled) return;
    setQuery(initialQuery);
    setSelectedGroup("");
    setPosition(null);
    const available = options.filter((option) => !option.disabled);
    const initial = selected && !selected.disabled ? selected : last ? available.at(-1) : available[0];
    setActiveValue(initial ? String(initial.value) : null);
    setOpen(true);
  }

  function choose(option) {
    if (!option || option.disabled) return;
    onChange(option.value);
    close(true);
  }

  function handleKeyDown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close(true);
    } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const current = enabled.indexOf(active);
      const index = event.key === "Home" ? 0 : event.key === "End" ? enabled.length - 1
        : (current + (event.key === "ArrowDown" ? 1 : -1) + enabled.length) % enabled.length;
      setActiveValue(enabled[index] ? String(enabled[index].value) : null);
    } else if (event.key === "Enter" && !event.nativeEvent.isComposing) {
      event.preventDefault();
      choose(active);
    } else if (event.key === "Tab") {
      if (groupTabs && !event.shiftKey && event.target === inputRef.current) {
        event.preventDefault();
        tabsRef.current?.querySelector('[aria-selected="true"]')?.focus();
        return;
      }
      // The popup is portalled; continue from the trigger's place in the form.
      event.preventDefault();
      const focusable = [...document.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]',
      )].filter((element) => !popupRef.current?.contains(element) && element.getClientRects().length);
      const next = focusable[focusable.indexOf(triggerRef.current) + (event.shiftKey ? -1 : 1)];
      close();
      (next ?? triggerRef.current)?.focus();
    }
  }

  function chooseMuscle(name) {
    setSelectedGroup(name);
    setActiveValue(null);
    const list = document.getElementById(listId);
    if (list) list.scrollTop = 0;
  }

  function handleTabKeyDown(event, index) {
    if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? muscleTabs.length - 1
        : (index + (event.key === "ArrowRight" ? 1 : -1) + muscleTabs.length) % muscleTabs.length;
      chooseMuscle(muscleTabs[nextIndex].name);
      const nextTab = tabsRef.current?.querySelectorAll('[role="tab"]')[nextIndex];
      nextTab?.focus({ preventScroll: true });
      nextTab?.scrollIntoView({ block: "nearest", inline: "nearest" });
    } else if (event.key === "Tab" && event.shiftKey) {
      event.preventDefault();
      inputRef.current?.focus({ preventScroll: true });
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      inputRef.current?.focus({ preventScroll: true });
    } else if (["Tab", "Escape"].includes(event.key)) {
      handleKeyDown(event);
    }
  }

  useLayoutEffect(() => {
    if (!open) return;
    function placePopup() {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const viewport = window.visualViewport;
      const leftEdge = viewport?.offsetLeft ?? 0;
      const topEdge = viewport?.offsetTop ?? 0;
      const width = viewport?.width ?? window.innerWidth;
      const height = viewport?.height ?? window.innerHeight;
      if (rect.bottom < topEdge || rect.top > topEdge + height) {
        setOpen(false);
        return;
      }
      const below = topEdge + height - rect.bottom - 20;
      const above = rect.top - topEdge - 20;
      const upwards = below < 300 && above > below;
      const popupWidth = Math.min(Math.max(rect.width, 310), width - 24);
      const next = {
        width: popupWidth,
        left: Math.max(leftEdge + 12, Math.min(rect.left, leftEdge + width - popupWidth - 12)),
        top: upwards ? rect.top - 8 : rect.bottom + 8,
        maxHeight: Math.max(80, Math.min(420, upwards ? above : below)),
        transform: upwards ? "translateY(-100%)" : "none",
      };
      setPosition((previous) => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
    }
    function onScroll(event) {
      if (!popupRef.current?.contains(event.target)) placePopup();
    }
    placePopup();
    inputRef.current?.focus({ preventScroll: true });
    const observer = new ResizeObserver(placePopup);
    observer.observe(triggerRef.current);
    window.addEventListener("resize", placePopup);
    window.addEventListener("scroll", onScroll, true);
    window.visualViewport?.addEventListener("resize", placePopup);
    window.visualViewport?.addEventListener("scroll", placePopup);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", placePopup);
      window.removeEventListener("scroll", onScroll, true);
      window.visualViewport?.removeEventListener("resize", placePopup);
      window.visualViewport?.removeEventListener("scroll", placePopup);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function dismissOutside(event) {
      if (!triggerRef.current?.contains(event.target) && !popupRef.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener("pointerdown", dismissOutside, true);
    document.addEventListener("focusin", dismissOutside);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside, true);
      document.removeEventListener("focusin", dismissOutside);
    };
  }, [open]);

  useEffect(() => {
    if (open && active) document.getElementById(optionId(active))?.scrollIntoView({ block: "nearest" });
  }, [open, active, id, options]);

  return (
    <>
      <button
        ref={triggerRef} id={id} type="button" disabled={disabled}
        className={`search-select-trigger ${className}${open ? " is-open" : ""}`}
        aria-label={`${label}: ${selected?.label ?? placeholder}`}
        aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? popupId : undefined}
        onClick={() => open ? close() : show()}
        onKeyDown={(event) => {
          if (["ArrowDown", "ArrowUp"].includes(event.key)) {
            event.preventDefault();
            show("", event.key === "ArrowUp");
          } else if (event.key.length === 1 && event.key !== " " && !event.ctrlKey && !event.metaKey && !event.altKey) {
            event.preventDefault();
            show(event.key);
          }
        }}
      >
        <span className={`search-select-value${selected ? "" : " is-placeholder"}`}>{selected?.label ?? placeholder}</span>
        <svg className="search-select-chevron" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && !disabled && createPortal(
        <div ref={popupRef} id={popupId} role="dialog" aria-label={`${label} options`}
          className="search-select-popup" style={position ?? { visibility: "hidden" }}>
          <div className="search-select-search">
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <circle cx="8.5" cy="8.5" r="5" stroke="currentColor" strokeWidth="1.5" />
              <path d="m12.5 12.5 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input ref={inputRef} type="text" role="combobox" aria-label={`Search ${label.toLowerCase()}`}
              aria-autocomplete="list" aria-expanded="true" aria-controls={listId}
              aria-activedescendant={active ? optionId(active) : undefined}
              value={query} placeholder={activeGroup ? `Search ${activeGroup.toLowerCase()} exercises...` : searchPlaceholder} autoComplete="off" spellCheck="false"
              onChange={(event) => { setQuery(event.target.value); setActiveValue(null); }}
              onKeyDown={handleKeyDown} />
            {query && <button type="button" className="search-select-clear" aria-label="Clear search"
              onClick={() => { setQuery(""); setActiveValue(null); inputRef.current?.focus(); }}>
              <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
            </button>}
          </div>
          {groupTabs && <div ref={tabsRef} role="tablist" aria-label="Muscle groups" className="search-select-tabs">
            {muscleTabs.map((tab, index) => <button key={tab.name} id={`${id}-muscle-${index}`}
              type="button" role="tab" aria-selected={activeGroup === tab.name} aria-controls={panelId}
              tabIndex={activeGroup === tab.name ? 0 : -1}
              className={`search-select-tab${activeGroup === tab.name ? " is-selected" : ""}`}
              onClick={() => chooseMuscle(tab.name)} onKeyDown={(event) => handleTabKeyDown(event, index)}>
              {tab.label}<span>{tab.count}</span>
            </button>)}
          </div>}
          <div className="search-select-panel" id={panelId} role={groupTabs ? "tabpanel" : undefined}
            aria-labelledby={groupTabs ? `${id}-muscle-${activeTabIndex}` : undefined}>
          <div id={listId} role="listbox" aria-label={label} className="search-select-list">
            {[...groups].map(([group, items], groupIndex) => (
              <div key={group} role={group ? "group" : "presentation"}
                aria-labelledby={group ? `${id}-group-${groupIndex}` : undefined}>
                {group && <div id={`${id}-group-${groupIndex}`} className="search-select-group">{group}</div>}
                {items.map((option) => {
                  const isSelected = String(option.value) === String(value);
                  return <button key={option.value} id={optionId(option)} type="button" role="option"
                    tabIndex={-1} disabled={option.disabled} aria-selected={isSelected}
                    className={`search-select-option${active === option ? " is-active" : ""}${isSelected ? " is-selected" : ""}`}
                    onMouseDown={(event) => event.preventDefault()}
                    onPointerMove={(event) => { if (event.pointerType === "mouse" && !option.disabled) setActiveValue(String(option.value)); }}
                    onClick={() => choose(option)}>
                    <span className="search-select-option-copy"><span>{option.label}</span>
                      {option.description && <small>{option.description}</small>}
                    </span>
                    {isSelected && <span className="search-select-check"><svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path d="m3.5 8 3 3 6-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg></span>}
                  </button>;
                })}
              </div>
            ))}
            {!matches.length && <div className="search-select-empty">
              {activeGroup ? `No matches in ${activeGroup.toLowerCase()}.` : "No matches found."}
              <small>{activeGroup ? "Try a different search or choose All muscles." : "Try a different search."}</small>
            </div>}
          </div>
          </div>
          <div className="search-select-footer"><span role="status" aria-live="polite">{matches.length} {groupTabs ? matches.length === 1 ? "exercise" : "exercises" : matches.length === 1 ? "option" : "options"}{activeGroup ? ` · ${activeGroup}` : ""}</span><span>Close <kbd>Esc</kbd></span></div>
        </div>, document.body,
      )}
    </>
  );
}
