import {
  QUICK_EMPTY_MODIFIER_FILTERS,
  type QuickEmptyModifierFilterDefinition
} from "./quick-filter-definitions";

interface QuickStatDetails {
  id: string;
  label: string;
  type: string;
}

export interface QuickEmptyModifierActions {
  activateModifierStatFilter(
    group: Element,
    details: QuickStatDetails
  ): Promise<boolean>;
  createStatGroup(type: string): Promise<Element | null>;
  findStatGroupByType(type: string): Element | null;
  waitForElement<T>(
    findElement: () => T | null,
    attempts?: number
  ): Promise<T | null>;
}

export interface QuickEmptyModifierFeature {
  createControl(): HTMLElement;
  syncControl(control: HTMLElement): void;
}

export function createQuickEmptyModifierFeature({
  actions,
  closePopovers,
  normalizeText,
  requestSync
}: {
  actions?: QuickEmptyModifierActions;
  closePopovers(exceptControl?: Element | null): boolean;
  normalizeText(value: unknown): string;
  requestSync(): void;
}): QuickEmptyModifierFeature {
  function getGroupToggle(group: Element | null): HTMLElement | null {
    return group?.querySelector<HTMLElement>(
      ":scope > .filter-group-header .toggle-btn"
    ) ?? null;
  }

  function isGroupEnabled(group: Element | null): boolean {
    const toggle = getGroupToggle(group);
    return Boolean(group && (!toggle || !toggle.classList.contains("off")));
  }

  function findStatRow(
    group: Element | null,
    definition: QuickEmptyModifierFilterDefinition
  ): HTMLElement | null {
    if (!group) return null;
    const target = normalizeText(definition.label);
    const rows = group.querySelectorAll<HTMLElement>(
      ".filter.full-span, .fixture-selected-stat, " +
        ".filter-group-body > .filter:not(.filter-select-mutate)"
    );

    return [...rows].find((row) => {
      const label =
        row.querySelector(".filter-title")?.textContent || row.textContent;
      return normalizeText(label) === target;
    }) ?? null;
  }

  function isStatRowEnabled(row: Element | null): boolean {
    return Boolean(
      row &&
        !row
          .querySelector<HTMLElement>(":scope .toggle-btn")
          ?.classList.contains("off")
    );
  }

  function readValue(
    group: Element | null,
    definition: QuickEmptyModifierFilterDefinition
  ): string {
    if (!isGroupEnabled(group)) return "";
    const row = findStatRow(group, definition);
    if (!isStatRowEnabled(row)) return "";
    const value =
      row?.querySelector<HTMLInputElement>('input[placeholder="min"]')?.value
        .trim() || "";
    return definition.values.includes(value) ? value : "";
  }

  async function ensureAndGroup(): Promise<Element | null> {
    if (!actions) return null;
    let group = actions.findStatGroupByType("and");
    if (!group) group = await actions.createStatGroup("and");
    if (!group) return null;

    const toggle = getGroupToggle(group);
    if (toggle?.classList.contains("off")) {
      toggle.click();
      group =
        (await actions.waitForElement(() => {
          const candidate = actions.findStatGroupByType("and");
          return isGroupEnabled(candidate) ? candidate : null;
        }, 20)) || group;
    }
    if (!isGroupEnabled(group)) return null;

    if (!group.classList.contains("expanded")) {
      group
        .querySelector<HTMLElement>(
          ":scope > .filter-group-header .filter-title-clickable, " +
            ":scope > .filter-group-header .filter-title"
        )
        ?.click();
      group =
        (await actions.waitForElement(() => {
          const candidate = actions.findStatGroupByType("and");
          return candidate?.classList.contains("expanded") ? candidate : null;
        }, 20)) || group;
    }

    return group;
  }

  function setRowEnabled(row: Element, enabled: boolean): void {
    const toggle = row.querySelector<HTMLElement>(":scope .toggle-btn");
    if (toggle && toggle.classList.contains("off") === enabled) toggle.click();
  }

  async function applyValue(
    definition: QuickEmptyModifierFilterDefinition,
    value: string
  ): Promise<boolean> {
    if (!actions) return false;
    let group = actions.findStatGroupByType("and");
    let row = findStatRow(group, definition);

    if (!value) {
      if (!row) return true;
      setRowEnabled(row, false);
      return true;
    }

    group = await ensureAndGroup();
    if (!group) return false;
    row = findStatRow(group, definition);
    if (!row) {
      const activated = await actions.activateModifierStatFilter(group, {
        id: definition.statId,
        label: definition.label,
        type: "pseudo"
      });
      if (!activated) return false;
      row = await actions.waitForElement(
        () => findStatRow(actions.findStatGroupByType("and"), definition),
        20
      );
    }
    if (!row) return false;

    setRowEnabled(row, true);
    const input = row.querySelector<HTMLInputElement>('input[placeholder="min"]');
    if (!input) return false;
    input.focus();
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.blur();
    return true;
  }

  function setControlState(control: HTMLElement): void {
    const group = actions?.findStatGroupByType("and") || null;
    const values = QUICK_EMPTY_MODIFIER_FILTERS.map((definition) =>
      readValue(group, definition)
    );
    const trigger = control.querySelector<HTMLElement>(
      ".poe-trade-styler-quick-empty-trigger"
    );
    const activeCount = values.filter(Boolean).length;
    control.dataset.value = values.join(",");
    control.classList.toggle("is-enabled", activeCount > 0);
    trigger?.classList.toggle("is-empty", activeCount === 0);
    trigger?.classList.toggle("is-enabled", activeCount > 0);

    QUICK_EMPTY_MODIFIER_FILTERS.forEach((definition, index) => {
      control
        .querySelectorAll<HTMLElement>(
          `[data-empty-modifier-filter="${definition.key}"] ` +
            ".poe-trade-styler-quick-empty-option"
        )
        .forEach((option) => {
          const selected = option.dataset.value === values[index];
          option.classList.toggle("is-selected", selected);
          option.setAttribute("aria-pressed", String(selected));
        });
    });

    const summary = QUICK_EMPTY_MODIFIER_FILTERS.map((definition, index) =>
      values[index] ? `${definition.shortLabel} ${values[index]}` : ""
    ).filter(Boolean).join(", ");
    if (trigger) {
      trigger.title = summary
        ? `Empty modifier filters: ${summary}. Click to disable all.`
        : "Empty modifier filters: disabled. Hover to choose.";
      trigger.setAttribute(
        "aria-label",
        summary
          ? `Empty modifier filters: ${summary}`
          : "Empty modifier filters: disabled"
      );
    }
  }

  function createControl(): HTMLElement {
    const control = document.createElement("div");
    control.className = "poe-trade-styler-quick-empty-filter";
    control.dataset.quickFilter = "empty-modifiers";
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className =
      "poe-trade-styler-quick-filter poe-trade-styler-quick-empty-trigger is-empty";
    trigger.setAttribute("aria-haspopup", "dialog");
    trigger.setAttribute("aria-expanded", "false");
    const label = document.createElement("span");
    label.className = "poe-trade-styler-quick-empty-icon";
    label.textContent = "Mods";
    label.setAttribute("aria-hidden", "true");
    trigger.append(label);

    const popover = document.createElement("div");
    popover.className = "poe-trade-styler-quick-empty-popover";
    popover.hidden = true;
    popover.setAttribute("role", "dialog");
    popover.setAttribute("aria-label", "Empty modifier filters");
    const close = (): void => {
      popover.hidden = true;
      control.classList.remove("is-open");
      trigger.setAttribute("aria-expanded", "false");
    };
    const open = (): void => {
      closePopovers(control);
      popover.hidden = false;
      control.classList.add("is-open");
      trigger.setAttribute("aria-expanded", "true");
    };

    QUICK_EMPTY_MODIFIER_FILTERS.forEach((definition) => {
      const row = document.createElement("div");
      row.className = "poe-trade-styler-quick-empty-row";
      row.dataset.emptyModifierFilter = definition.key;
      const label = document.createElement("strong");
      label.className = "poe-trade-styler-quick-empty-label";
      label.textContent = definition.shortLabel;
      const options = document.createElement("div");
      options.className = "poe-trade-styler-quick-empty-options";
      definition.values.forEach((value) => {
        const option = document.createElement("button");
        option.type = "button";
        option.className = "poe-trade-styler-quick-empty-option";
        option.dataset.value = value;
        option.textContent = value;
        option.setAttribute("aria-pressed", "false");
        option.title = `${definition.shortLabel}: ${value}`;
        option.addEventListener("click", async (event) => {
          event.preventDefault();
          event.stopPropagation();
          const nextValue = option.classList.contains("is-selected") ? "" : value;
          if (await applyValue(definition, nextValue)) {
            setControlState(control);
            requestSync();
            setTimeout(requestSync, 80);
          }
        });
        options.append(option);
      });
      row.append(label, options);
      popover.append(row);
    });

    control.addEventListener("pointerenter", open);
    control.addEventListener("pointerleave", close);
    control.addEventListener("focusin", open);
    control.addEventListener("focusout", (event) => {
      if (!control.contains(event.relatedTarget as Node | null)) close();
    });
    trigger.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!control.classList.contains("is-enabled")) {
        close();
        return;
      }
      await Promise.all(
        QUICK_EMPTY_MODIFIER_FILTERS.map((definition) =>
          applyValue(definition, "")
        )
      );
      setControlState(control);
      requestSync();
      setTimeout(requestSync, 80);
      close();
    });
    trigger.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowDown") return;
      event.preventDefault();
      open();
      popover.querySelector<HTMLElement>("button")?.focus({ preventScroll: true });
    });
    control.append(trigger, popover);
    setControlState(control);
    return control;
  }

  return { createControl, syncControl: setControlState };
}
