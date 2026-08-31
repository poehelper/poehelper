import { DEFAULT_SETTINGS, type StylerSettings } from "./model";

export type { StylerSettings } from "./model";

export interface SettingsFeature {
  readonly state: StylerSettings;
  close(): void;
  destroy(): void;
  handleEscape(): boolean;
  isOpen(): boolean;
  mount(): void;
  open(): void;
  persist(): void;
  start(): void;
}

export interface SettingsDependencies {
  onApply(settings: StylerSettings): void;
  document?: Document;
  storage?: chrome.storage.StorageArea;
}

const SETTINGS_STORAGE_KEY = "poe-trade-helper-settings";

export function createSettingsFeature(
  dependencies: SettingsDependencies
): SettingsFeature {
  const doc = dependencies.document ?? document;
  const storage = dependencies.storage ?? chrome.storage.local;
  const state: StylerSettings = {
    ...DEFAULT_SETTINGS,
    gemItemFavorites: [],
    statFilterFavorites: [],
    uniqueItemFavorites: []
  };
  let mounted = false;

  const launcher = doc.createElement("button");
  launcher.id = "poe-trade-styler-open";
  launcher.type = "button";
  launcher.textContent = "Trade Helper";
  launcher.setAttribute("aria-haspopup", "dialog");
  launcher.setAttribute("aria-controls", "poe-trade-styler-modal");
  launcher.setAttribute("aria-expanded", "false");

  const modal = doc.createElement("div");
  modal.id = "poe-trade-styler-modal";
  modal.hidden = true;
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", "poe-trade-styler-title");

  const dialog = doc.createElement("section");
  dialog.className = "poe-trade-styler-dialog";
  dialog.tabIndex = -1;

  const header = doc.createElement("header");
  const title = doc.createElement("h2");
  title.id = "poe-trade-styler-title";
  title.textContent = "POE Trade Helper";
  const closeButton = doc.createElement("button");
  closeButton.className = "poe-trade-styler-close";
  closeButton.type = "button";
  closeButton.textContent = "×";
  closeButton.setAttribute("aria-label", "Close settings");
  header.append(title, closeButton);

  const optionsContainer = doc.createElement("div");
  optionsContainer.className = "poe-trade-styler-options";
  const options = {
    twoColumnLayout: createOption(
      "poe-trade-styler-two-column",
      "Filter and results in 2 columns",
      "Keep filters on the left and show results on the right."
    ),
    fullWidthScreen: createOption(
      "poe-trade-styler-full-width",
      "Full width screen",
      "Allow the trade layout to expand up to 1920px."
    ),
    disableBackground: createOption(
      "poe-trade-styler-disable-background",
      "Disable background",
      "Hide the trade page background image."
    ),
    rightSpaceForBetterTrading: createOption(
      "poe-trade-styler-right-space",
      "Add right space for Better Trading extension",
      "Reserve a 400px-wide area on the right side of the page."
    ),
    stickySearchPanel: createOption(
      "poe-trade-styler-sticky-search",
      "Sticky search panel",
      "Keep filters visible and pin search controls to the screen bottom."
    ),
    hideIrrelevantAffixes: createOption(
      "poe-trade-styler-hide-irrelevant-affixes",
      "Hide non-relevant prefixes and suffixes (experimental)",
      "Show only relevant stats; when off, keep native stat filters unchanged."
    )
  } satisfies Record<
    Exclude<
      keyof StylerSettings,
      "gemItemFavorites" | "statFilterFavorites" | "uniqueItemFavorites"
    >,
    SettingsOption
  >;

  optionsContainer.append(
    options.twoColumnLayout.label,
    options.fullWidthScreen.label,
    options.disableBackground.label,
    options.rightSpaceForBetterTrading.label,
    options.stickySearchPanel.label,
    options.hideIrrelevantAffixes.label
  );
  dialog.append(header, optionsContainer);
  modal.append(dialog);

  function createOption(
    id: string,
    labelText: string,
    description: string
  ): SettingsOption {
    const label = doc.createElement("label");
    label.className = "poe-trade-styler-option";
    const checkbox = doc.createElement("input");
    checkbox.id = id;
    checkbox.type = "checkbox";
    const copy = doc.createElement("span");
    const optionTitle = doc.createElement("strong");
    optionTitle.textContent = labelText;
    const optionDescription = doc.createElement("small");
    optionDescription.textContent = description;
    copy.append(optionTitle, optionDescription);
    label.append(checkbox, copy);
    return { checkbox, label };
  }

  function apply(): void {
    for (const [key, option] of Object.entries(options) as [
      keyof typeof options,
      SettingsOption
    ][]) {
      option.checkbox.checked = state[key];
    }

    dependencies.onApply(state);
  }

  function persist(): void {
    try {
      void storage.set({
        [SETTINGS_STORAGE_KEY]: {
          ...state,
          gemItemFavorites: [...state.gemItemFavorites],
          statFilterFavorites: [...state.statFilterFavorites],
          uniqueItemFavorites: [...state.uniqueItemFavorites]
        }
      });
    } catch {
      // An unpacked extension reload can invalidate an existing content script.
    }
  }

  function loadStoredSettings(value: unknown): void {
    if (!value || typeof value !== "object") return;

    const stored = value as Partial<StylerSettings>;
    for (const key of [
      "disableBackground",
      "fullWidthScreen",
      "hideIrrelevantAffixes",
      "rightSpaceForBetterTrading",
      "stickySearchPanel",
      "twoColumnLayout"
    ] as const) {
      if (typeof stored[key] === "boolean") {
        state[key] = stored[key];
      }
    }

    if (Array.isArray(stored.statFilterFavorites)) {
      state.statFilterFavorites = stored.statFilterFavorites.filter(
        (favorite): favorite is string => typeof favorite === "string"
      );
    }

    if (Array.isArray(stored.gemItemFavorites)) {
      state.gemItemFavorites = stored.gemItemFavorites.filter(
        (favorite): favorite is string => typeof favorite === "string"
      );
    }

    if (Array.isArray(stored.uniqueItemFavorites)) {
      state.uniqueItemFavorites = stored.uniqueItemFavorites.filter(
        (favorite): favorite is string => typeof favorite === "string"
      );
    }
  }

  function open(): void {
    modal.hidden = false;
    launcher.setAttribute("aria-expanded", "true");
    doc.documentElement.classList.add("poe-trade-styler-modal-open");
    dialog.focus();
  }

  function close(): void {
    modal.hidden = true;
    launcher.setAttribute("aria-expanded", "false");
    doc.documentElement.classList.remove("poe-trade-styler-modal-open");
    launcher.focus();
  }

  function mount(): void {
    if (mounted) {
      return;
    }

    doc.body.append(launcher, modal);
    launcher.addEventListener("click", open);
    closeButton.addEventListener("click", close);
    modal.addEventListener("click", onModalClick);
    for (const [key, option] of Object.entries(options) as [
      keyof typeof options,
      SettingsOption
    ][]) {
      option.checkbox.addEventListener("change", () => {
        state[key] = option.checkbox.checked;
        apply();
        persist();
      });
    }
    mounted = true;
  }

  function start(): void {
    apply();
    try {
      storage.get({ [SETTINGS_STORAGE_KEY]: null }, (items) => {
        loadStoredSettings(items[SETTINGS_STORAGE_KEY]);
        apply();
      });
    } catch {
      // Keep defaults when the extension context was invalidated.
    }
  }

  function onModalClick(event: MouseEvent): void {
    if (event.target === modal) {
      close();
    }
  }

  function handleEscape(): boolean {
    if (modal.hidden) {
      return false;
    }

    close();
    return true;
  }

  function destroy(): void {
    launcher.removeEventListener("click", open);
    closeButton.removeEventListener("click", close);
    modal.removeEventListener("click", onModalClick);
    launcher.remove();
    modal.remove();
    mounted = false;
  }

  return {
    state,
    close,
    destroy,
    handleEscape,
    isOpen: () => !modal.hidden,
    mount,
    open,
    persist,
    start
  };
}

interface SettingsOption {
  checkbox: HTMLInputElement;
  label: HTMLLabelElement;
}
