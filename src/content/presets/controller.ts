import type {
  CharmDataPort,
  FlaskDataPort,
  GemDataPort,
  GearDataPort,
  JewelDataPort,
  StylerPort,
  TabletDataPort,
  WaystoneDataPort
} from "../ports";
import type { StatFiltersFeature } from "../stat-filters/contracts";
import type { GroupPolicyMode } from "./group-policy";
import {
  createNativeTradeForm,
  type NativeTradeFormPort
} from "./native-form";
import { type PresetMode, type PresetState } from "./state";
import { createGearSelection } from "./gear-selection";
import { createGemSelection } from "./gem-selection";
import { createJewelSelection } from "./jewel-selection";
import { createBaseMenu, type BasePresetMode } from "./base-menu";
import { getSafeItemImageUrl } from "../image-assets";
import { createPresetGroupStateManager } from "./group-state-manager";

export interface PresetsFeature {
  activateUniqueGroups(): Promise<void>;
  closeMenus(): boolean;
  deactivate(): Promise<void>;
  decorate(): void;
  selectGear(
    slotKey: string,
    baseKey: string | null,
    itemKey: string | null
  ): Promise<boolean>;
  selectGem(key: string): Promise<boolean>;
  selectJewel(baseKey: string): Promise<boolean>;
  prepareUniqueGroups(): Promise<boolean>;
  finalizeSearch(
    beforeSubmit?: () => Promise<boolean | void>
  ): Promise<boolean>;
  isUniqueActive(): boolean;
}

export function createPresetsFeature({
  charmData,
  flaskData,
  gemData,
  gearData,
  jewelData,
  presetState,
  stats,
  styler,
  tabletData,
  waystoneData,
  nativeForm: injectedNativeForm
}: {
  charmData: CharmDataPort;
  flaskData: FlaskDataPort;
  gemData: GemDataPort;
  gearData: GearDataPort;
  jewelData: JewelDataPort;
  presetState: PresetState;
  stats: StatFiltersFeature;
  styler: StylerPort;
  tabletData: TabletDataPort;
  waystoneData: WaystoneDataPort;
  nativeForm?: NativeTradeFormPort;
}): PresetsFeature {
  const nativeForm =
    injectedNativeForm ??
    createNativeTradeForm({
      normalize: stats.normalizeText,
      waitForElement: stats.waitForElement
    });
  let waystoneTierSelectionInProgress = false;
  let charmBaseSelectionInProgress = false;
  let flaskBaseSelectionInProgress = false;
  let tabletBaseSelectionInProgress = false;
  let uniqueGroupPolicyActive = false;
  let preparedGroupMode: GroupPolicyMode | null = null;

  function getActiveGroupPolicyMode(): GroupPolicyMode | null {
    return presetState.activePreset || (uniqueGroupPolicyActive ? "uniques" : null);
  }
  function isPoe2PresetPage(): boolean {
    return (
      styler.getTradeGameKey(location.pathname) === "poe2" ||
      document.body.dataset.fixtureGame === "poe2"
    );
  }

  function getPresetGroupTitle(group: Element): string {
    const title =
      group.querySelector(
        ":scope > .filter-group-header .filter-title, " +
          ":scope > .filter-group-header .filter-title-clickable"
      )?.textContent ||
      (group as HTMLElement).dataset.fixtureFilterGroup ||
      "";

    return stats.normalizeText(title);
  }

  function getWaystoneGroupKey(group: Element): string {
    const statGroupType = group.querySelector(
      'input[placeholder="+ Add Stat Filter"]'
    )
      ? stats.getStatGroupType(group)
      : null;

    if (statGroupType === "not") {
      return "not";
    }

    return getPresetGroupTitle(group);
  }

  const groupStateManager = createPresetGroupStateManager({
    getGearSlotKey: () => presetState.selectedGearSlotKey,
    getGroupKey: getWaystoneGroupKey
  });

  async function applyWaystoneGroupState(
    { restorePrevious = true }: { restorePrevious?: boolean } = {}
  ): Promise<void> {
    const activeMode = getActiveGroupPolicyMode();
    if (activeMode) await groupStateManager.apply(activeMode);
    else groupStateManager.restore(restorePrevious);
  }

  function setWaystoneTierMenuOpen(
    button: Element,
    shouldOpen: boolean
  ): void {
    const menu = button
      ?.closest(".poe-trade-styler-preset-navigation-item")
      ?.querySelector<HTMLElement>(".poe-trade-styler-waystone-tier-menu");

    if (!menu) {
      return;
    }

    menu.hidden = !shouldOpen;
    button.setAttribute("aria-expanded", String(shouldOpen));
  }

  function closeWaystoneTierMenus(): boolean {
    let closed = false;

    document
      .querySelectorAll<HTMLElement>('[data-poe-trade-styler-preset="waystones"]')
      .forEach((button) => {
        const menu = button
          .closest(".poe-trade-styler-preset-navigation-item")
          ?.querySelector<HTMLElement>(".poe-trade-styler-waystone-tier-menu");

        if (menu && !menu.hidden) {
          closed = true;
        }

        setWaystoneTierMenuOpen(button, false);
      });

    return closed;
  }

  function syncWaystoneTierMenu(): void {
    document
      .querySelectorAll<HTMLElement>(".poe-trade-styler-waystone-tier-option")
      .forEach((option) => {
        const selected =
          Number(option.dataset.poeTradeStylerWaystoneTier) ===
          presetState.selectedWaystoneTier;
        option.classList.toggle("is-selected", selected);
        option.setAttribute("aria-checked", String(selected));
      });
  }

  function setBaseMenuOpen(
    button: Element,
    preset: BasePresetMode,
    shouldOpen: boolean
  ): void {
    const singular = preset.replace(/s$/, "");
    const menu = button
      ?.closest(".poe-trade-styler-preset-navigation-item")
      ?.querySelector<HTMLElement>(`.poe-trade-styler-${singular}-base-menu`);

    if (!menu) {
      return;
    }

    menu.hidden = !shouldOpen;
    button.setAttribute("aria-expanded", String(shouldOpen));
  }
  function closeBaseMenus(preset: BasePresetMode): boolean {
    let closed = false;
    const singular = preset.replace(/s$/, "");

    document
      .querySelectorAll<HTMLElement>(`[data-poe-trade-styler-preset="${preset}"]`)
      .forEach((button) => {
        const menu = button
          .closest(".poe-trade-styler-preset-navigation-item")
          ?.querySelector<HTMLElement>(`.poe-trade-styler-${singular}-base-menu`);

        if (menu && !menu.hidden) {
          closed = true;
        }

        setBaseMenuOpen(button, preset, false);
      });

    return closed;
  }
  function syncBaseMenu(preset: BasePresetMode, selectedKey: string | null): void {
    document
      .querySelectorAll<HTMLElement>(
        `.poe-trade-styler-base-option[data-poe-trade-styler-base-preset="${preset}"]`
      )
      .forEach((option) => {
        const selected = option.dataset.poeTradeStylerBaseKey === selectedKey;
        option.classList.toggle("is-selected", selected);
        option.setAttribute("aria-checked", String(selected));
      });
  }
  function syncPresetControls(): void {
    const titles: Record<PresetMode, string> = {
      charms: "Choose a Charm base preset",
      flasks: "Choose a Flask base preset",
      gems: "Open Skill Gem Presets",
      gear: "Open Gear Presets",
      jewels: "Choose a Jewel base preset",
      tablets: "Choose a Tablet base preset",
      waystones: "Choose a Waystone tier preset"
    };
    (Object.keys(titles) as PresetMode[]).forEach((preset) => {
      document.querySelectorAll<HTMLElement>(
        `[data-poe-trade-styler-preset="${preset}"]`
      ).forEach((button) => {
        const active = presetState.activePreset === preset;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", String(active));
        button.title = active
          ? `Disable the ${preset} preset and keep the selected form values`
          : titles[preset];
      });
    });

    syncWaystoneTierMenu();
    syncBaseMenu("charms", presetState.selectedCharmBaseKey);
    syncBaseMenu("flasks", presetState.selectedFlaskBaseKey);
    syncBaseMenu("tablets", presetState.selectedTabletBaseKey);
  }

  async function setActivePreset(
    nextPreset: PresetMode | null,
    { preserveForm: _preserveForm = false }: { preserveForm?: boolean } = {}
  ): Promise<boolean> {
    if (
      nextPreset === presetState.activePreset &&
      !uniqueGroupPolicyActive &&
      !preparedGroupMode
    ) {
      return true;
    }

    if (nextPreset) {
      if (
        preparedGroupMode !== nextPreset &&
        !(await preparePresetActivation(nextPreset))
      ) return false;
      uniqueGroupPolicyActive = false;
      preparedGroupMode = null;
      presetState.activePreset = nextPreset;
      document.documentElement.classList.remove(
        "poe-trade-styler-charm-preset",
        "poe-trade-styler-flask-preset",
        "poe-trade-styler-gem-preset",
        "poe-trade-styler-gear-preset",
        "poe-trade-styler-jewel-preset",
        "poe-trade-styler-tablet-preset",
        "poe-trade-styler-waystone-preset"
      );
      document.documentElement.classList.add(
        `poe-trade-styler-${nextPreset.replace(/s$/, "")}-preset`
      );
      await applyWaystoneGroupState();

      stats.filterForPreset();
      stats.decorateOptions();
      syncPresetControls();

      return true;
    }

    presetState.activePreset = null;
    uniqueGroupPolicyActive = false;
    preparedGroupMode = null;
    document.documentElement.classList.remove(
      "poe-trade-styler-charm-preset",
      "poe-trade-styler-flask-preset",
      "poe-trade-styler-gem-preset",
      "poe-trade-styler-gear-preset",
      "poe-trade-styler-jewel-preset",
      "poe-trade-styler-tablet-preset",
      "poe-trade-styler-waystone-preset"
    );
    // Group enablement/collapse is preset UI state and should always be
    // restored when the preset is disabled. preserveForm only means that the
    // native tier/category values remain populated.
    await applyWaystoneGroupState();
    stats.filterForPreset();
    stats.decorateOptions();
    syncPresetControls();
    return true;
  }

  async function preparePresetActivation(mode: GroupPolicyMode): Promise<boolean> {
    await setActivePreset(null, { preserveForm: false });
    if (!(await nativeForm.resetSearch())) return false;
    await groupStateManager.collapseEnabledGroups();
    preparedGroupMode = mode;
    return true;
  }

  async function finalizeSearch(
    beforeSubmit?: () => Promise<boolean | void>
  ): Promise<boolean> {
    // Native category/item updates may replace filter-group DOM once. Reapply
    // through current native controls before submitting; this is bounded and
    // has no polling or recurring timer.
    await applyWaystoneGroupState();
    stats.filterForPreset();
    stats.decorateOptions();
    if (beforeSubmit && (await beforeSubmit()) === false) return false;
    return nativeForm.submitSearch();
  }

  async function selectWaystoneTier(tier: number): Promise<void> {
    const definition = waystoneData.WAYSTONE_TIERS.find(
      (entry) => entry.tier === tier
    );

    if (!definition || waystoneTierSelectionInProgress) return;

    waystoneTierSelectionInProgress = true;

    try {
      presetState.selectedWaystoneTier = tier;
      closeWaystoneTierMenus();
      syncPresetControls();

      if (!(await preparePresetActivation("waystones"))) return;
      if (!(await setActivePreset("waystones"))) return;
      if (!(await nativeForm.setFilterValue("Item Category", "Waystone"))) return;
      if (!(await nativeForm.setSearchItem(definition.searchText))) return;
      await finalizeSearch();
    } finally {
      waystoneTierSelectionInProgress = false;
    }
  }

  function createWaystoneTierMenu(): HTMLDivElement {
    const menu = document.createElement("div");
    menu.className = "poe-trade-styler-waystone-tier-menu";
    menu.hidden = true;
    menu.setAttribute("role", "radiogroup");
    menu.setAttribute("aria-label", "Waystone tier");

    waystoneData.WAYSTONE_TIERS.forEach((definition) => {
      const option = document.createElement("button");
      option.className =
        "poe-trade-styler-waystone-tier-option " +
        `is-${definition.color}`;
      option.type = "button";
      option.dataset.poeTradeStylerWaystoneTier = String(definition.tier);
      option.textContent = definition.roman;
      option.title = definition.searchText;
      option.setAttribute("role", "radio");
      option.setAttribute("aria-label", definition.searchText);
      option.setAttribute("aria-checked", "false");
      option.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        selectWaystoneTier(definition.tier);
      });
      menu.append(option);
    });

    return menu;
  }

  function createWaystonePresetButton() {
    const button = document.createElement("button");
    button.className =
      "poe-trade-styler-preset poe-trade-styler-waystone-preset-button";
    button.type = "button";
    button.dataset.poeTradeStylerPreset = "waystones";
    button.setAttribute("aria-pressed", "false");
    button.setAttribute("aria-label", "Waystones preset");
    button.setAttribute("aria-haspopup", "true");
    button.setAttribute("aria-expanded", "false");
    button.title = "Choose a Waystone tier preset";

    const icon = document.createElement("img");
    icon.className = "poe-trade-styler-waystone-preset-icon";
    icon.src = getSafeItemImageUrl(waystoneData.WAYSTONE_TIER_15_ICON);
    icon.alt = "";
    icon.setAttribute("aria-hidden", "true");

    button.append(icon);
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (presetState.activePreset === "waystones") {
        closeWaystoneTierMenus();
        setActivePreset(null, { preserveForm: true });
        return;
      }

      const menu = button
        .closest(".poe-trade-styler-preset-navigation-item")
        ?.querySelector<HTMLElement>(".poe-trade-styler-waystone-tier-menu");
      setWaystoneTierMenuOpen(button, Boolean(menu?.hidden));
    });
    return button;
  }

  async function selectTabletBase(baseKey: string): Promise<void> {
    const definition = tabletData.getTabletBase(baseKey);

    if (!definition || tabletBaseSelectionInProgress) {
      return;
    }

    tabletBaseSelectionInProgress = true;

    try {
      presetState.selectedTabletBaseKey = definition.key;
      stats.setTabletBase(definition.key);
      closeWaystoneTierMenus();
      closeBaseMenus("tablets");
      syncPresetControls();

      if (!(await preparePresetActivation("tablets"))) return;
      if (!(await setActivePreset("tablets"))) return;
      if (!(await nativeForm.setFilterValue("Item Category", "Tablet"))) return;
      if (!(await nativeForm.setSearchItem(definition.searchText))) return;
      await finalizeSearch();
    } finally {
      tabletBaseSelectionInProgress = false;
    }
  }

  async function selectCharmBase(baseKey: string): Promise<void> {
    const definition = charmData.getCharmBase(baseKey);
    if (!definition || charmBaseSelectionInProgress) return;

    charmBaseSelectionInProgress = true;
    try {
      presetState.selectedCharmBaseKey = definition.key;
      stats.setCharmBase(definition.key);
      closeWaystoneTierMenus();
      closeBaseMenus("tablets");
      closeBaseMenus("charms");
      syncPresetControls();

      if (!(await preparePresetActivation("charms"))) return;
      if (!(await setActivePreset("charms"))) return;
      if (!(await nativeForm.setFilterValue("Item Category", "Charm"))) return;
      if (!(await nativeForm.setSearchItem(definition.searchText))) return;
      await finalizeSearch();
    } finally {
      charmBaseSelectionInProgress = false;
    }
  }
  async function selectFlaskBase(baseKey: string): Promise<void> {
    const definition = flaskData.getFlaskBase(baseKey);
    if (!definition || flaskBaseSelectionInProgress) return;
    flaskBaseSelectionInProgress = true;
    try {
      presetState.selectedFlaskBaseKey = definition.key;
      stats.setFlaskBase(definition.key);
      closeWaystoneTierMenus();
      (["tablets", "charms", "flasks"] as BasePresetMode[]).forEach(closeBaseMenus);
      syncPresetControls();
      if (!(await preparePresetActivation("flasks"))) return;
      if (!(await setActivePreset("flasks"))) return;
      const category = definition.kind === "life" ? "Life Flask" : "Mana Flask";
      if (!(await nativeForm.setFilterValue("Item Category", category))) return;
      if (!(await nativeForm.setSearchItem(definition.searchText))) return;
      await finalizeSearch();
    } finally {
      flaskBaseSelectionInProgress = false;
    }
  }

  const selectGem = createGemSelection({
    activate: async () => { await setActivePreset("gems"); },
    closeMenus: () => {
      closeWaystoneTierMenus();
      (["tablets", "charms", "flasks"] as BasePresetMode[]).forEach(closeBaseMenus);
    },
    finalizeSearch,
    gemData,
    nativeForm,
    prepare: () => preparePresetActivation("gems"),
    presetState
  });

  const selectGear = createGearSelection({
    activate: async () => {
      await setActivePreset("gear");
      syncPresetControls();
    },
    closeMenus: () => {
      closeWaystoneTierMenus();
      (["tablets", "charms", "flasks"] as BasePresetMode[]).forEach(closeBaseMenus);
    },
    finalizeSearch,
    gearData,
    nativeForm,
    prepare: () => preparePresetActivation("gear"),
    presetState,
    stats
  });
  const selectJewel = createJewelSelection({
    activate: async () => {
      await setActivePreset("jewels");
      syncPresetControls();
    },
    closeMenus: () => {
      closeWaystoneTierMenus();
      (["tablets", "charms", "flasks"] as BasePresetMode[]).forEach(closeBaseMenus);
    },
    finalizeSearch,
    jewelData,
    nativeForm,
    prepare: () => preparePresetActivation("jewels"),
    presetState,
    stats
  });
  function createBasePresetButton(
    preset: BasePresetMode,
    label: string,
    iconSource: string
  ): HTMLButtonElement {
    const singular = preset.replace(/s$/, "");
    const button = document.createElement("button");
    button.className =
      `poe-trade-styler-preset poe-trade-styler-${singular}-preset-button`;
    button.type = "button";
    button.dataset.poeTradeStylerPreset = preset;
    button.setAttribute("aria-pressed", "false");
    button.setAttribute("aria-label", `${label} preset`);
    button.setAttribute("aria-haspopup", "true");
    button.setAttribute("aria-expanded", "false");
    button.title = `Choose a ${label} base preset`;

    const icon = document.createElement("img");
    icon.className = `poe-trade-styler-${singular}-preset-icon`;
    icon.src = getSafeItemImageUrl(iconSource);
    icon.referrerPolicy = "no-referrer";
    icon.alt = "";
    icon.setAttribute("aria-hidden", "true");

    button.append(icon);
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (presetState.activePreset === preset) {
        closeBaseMenus(preset);
        setActivePreset(null, { preserveForm: true });
        return;
      }

      closeWaystoneTierMenus();
      (["tablets", "charms", "flasks"] as BasePresetMode[])
        .filter((candidate) => candidate !== preset)
        .forEach(closeBaseMenus);
      const menu = button
        .closest(".poe-trade-styler-preset-navigation-item")
        ?.querySelector<HTMLElement>(`.poe-trade-styler-${singular}-base-menu`);
      setBaseMenuOpen(button, preset, Boolean(menu?.hidden));
    });
    return button;
  }
  const createTabletBaseMenu = () => createBaseMenu("tablets", tabletData.TABLET_BASES, selectTabletBase);
  const createCharmBaseMenu = () =>
    createBaseMenu("charms", charmData.CHARM_BASES, selectCharmBase);
  const createFlaskBaseMenu = () => createBaseMenu(
    "flasks", flaskData.FLASK_BASES, selectFlaskBase
  );
  const createTabletPresetButton = () =>
    createBasePresetButton("tablets", "Tablet", tabletData.TABLET_GENERAL_ICON);
  const createCharmPresetButton = () =>
    createBasePresetButton("charms", "Charm", charmData.CHARM_GENERAL_ICON);
  const createFlaskPresetButton = () => createBasePresetButton(
    "flasks", "Flask", flaskData.FLASK_GENERAL_ICON
  );

  function removeWaystonePresetButton(button: Element): void {
    const navigationItem = button.closest(
      ".poe-trade-styler-preset-navigation-item"
    );

    (navigationItem || button).remove();
  }

  function getBulkItemExchangeButton() {
    const exchangeLink = document.querySelector(
      'a[href*="/trade2/exchange/"], [role="button"][href*="/trade2/exchange/"]'
    );

    if (exchangeLink) {
      return exchangeLink;
    }

    // The trade mode navigation is rendered outside #trade on the live PoE 2
    // page. Keep a text fallback for fixture/markup changes where the route is
    // attached by the application rather than exposed as an href.
    const controls = [
      ...document.querySelectorAll(
        'a, button, [role="button"], .btn, .button'
      )
    ];

    return (
      controls.find((control) =>
        /\/trade2\/exchange(?:\/|$)/.test(
          control.getAttribute("href") || ""
        )
      ) ||
      controls.find(
        (control) =>
          stats.normalizeText(control.textContent || "") ===
          "bulk item exchange"
      ) ||
      null
    );
  }

  function mountBasePresetAfter(
    previousButton: Element,
    preset: BasePresetMode,
    useListItem: boolean,
    createButton: () => HTMLButtonElement,
    createMenu: () => HTMLDivElement
  ): Element {
    const singular = preset.replace(/s$/, "");
    let button = document.querySelector(
      `[data-poe-trade-styler-preset="${preset}"]`
    );
    if (!button) button = createButton();

    let navigationItem = button.closest(
      ".poe-trade-styler-preset-navigation-item"
    );
    if (!navigationItem) {
      navigationItem = document.createElement(useListItem ? "li" : "span");
      navigationItem.className = "poe-trade-styler-preset-navigation-item";
      navigationItem.append(button, createMenu());
    } else if (
      !navigationItem.querySelector(`.poe-trade-styler-${singular}-base-menu`)
    ) {
      navigationItem.append(createMenu());
    }

    const previousItem = previousButton.closest(
      ".poe-trade-styler-preset-navigation-item"
    );
    if (previousItem?.nextElementSibling !== navigationItem) {
      previousItem?.insertAdjacentElement("afterend", navigationItem);
    }
    return button;
  }

  function decoratePresets() {
    const bulkItemExchangeButton = getBulkItemExchangeButton();

    if (!bulkItemExchangeButton) {
      return;
    }

    if (!isPoe2PresetPage()) {
      document
        .querySelectorAll(
          '[data-poe-trade-styler-preset="waystones"], ' +
            '[data-poe-trade-styler-preset="tablets"], ' +
            '[data-poe-trade-styler-preset="charms"], ' +
            '[data-poe-trade-styler-preset="flasks"]'
        )
        .forEach(removeWaystonePresetButton);

      if (presetState.activePreset) {
        setActivePreset(null);
      }

      return;
    }

    document
      .querySelectorAll(".poe-trade-styler-presets")
      .forEach((presets) => presets.remove());

    let waystoneButton = document.querySelector(
      '[data-poe-trade-styler-preset="waystones"]'
    );

    if (!waystoneButton) {
      waystoneButton = createWaystonePresetButton();
    }

    const bulkNavigationItem = bulkItemExchangeButton.closest("li");

    if (bulkNavigationItem) {
      let presetNavigationItem = waystoneButton.closest(
        ".poe-trade-styler-preset-navigation-item"
      );

      if (!presetNavigationItem) {
        presetNavigationItem = document.createElement("li");
        presetNavigationItem.className =
          "poe-trade-styler-preset-navigation-item";
        presetNavigationItem.append(
          waystoneButton,
          createWaystoneTierMenu()
        );
      } else if (
        !presetNavigationItem.querySelector(
          ".poe-trade-styler-waystone-tier-menu"
        )
      ) {
        presetNavigationItem.append(createWaystoneTierMenu());
      }

      if (
        bulkNavigationItem.nextElementSibling !== presetNavigationItem
      ) {
        bulkNavigationItem.insertAdjacentElement(
          "afterend",
          presetNavigationItem
        );
      }
    } else {
      let presetNavigationItem = waystoneButton.closest(
        ".poe-trade-styler-preset-navigation-item"
      );

      if (!presetNavigationItem) {
        presetNavigationItem = document.createElement("span");
        presetNavigationItem.className =
          "poe-trade-styler-preset-navigation-item";
        presetNavigationItem.append(
          waystoneButton,
          createWaystoneTierMenu()
        );
      } else if (
        !presetNavigationItem.querySelector(
          ".poe-trade-styler-waystone-tier-menu"
        )
      ) {
        presetNavigationItem.append(createWaystoneTierMenu());
      }

      if (
        bulkItemExchangeButton.nextElementSibling !== presetNavigationItem
      ) {
        bulkItemExchangeButton.insertAdjacentElement(
          "afterend",
          presetNavigationItem
        );
      }
    }

    const tabletButton = mountBasePresetAfter(
      waystoneButton,
      "tablets",
      Boolean(bulkNavigationItem),
      createTabletPresetButton,
      createTabletBaseMenu
    );
    const charmButton = mountBasePresetAfter(
      tabletButton,
      "charms",
      Boolean(bulkNavigationItem),
      createCharmPresetButton,
      createCharmBaseMenu
    );
    mountBasePresetAfter(charmButton, "flasks", Boolean(bulkNavigationItem),
      createFlaskPresetButton, createFlaskBaseMenu);

    stats.filterForPreset();
    syncPresetControls();
  }

  return {
    async activateUniqueGroups() {
      if (
        preparedGroupMode !== "uniques" &&
        !(await preparePresetActivation("uniques"))
      ) return;
      preparedGroupMode = null;
      uniqueGroupPolicyActive = true;
      await applyWaystoneGroupState();
      stats.filterForPreset();
      stats.decorateOptions();
    },
    closeMenus() {
      const closedWaystones = closeWaystoneTierMenus();
      const closedTablets = closeBaseMenus("tablets");
      const closedCharms = closeBaseMenus("charms");
      const closedFlasks = closeBaseMenus("flasks");
      return closedWaystones || closedTablets || closedCharms || closedFlasks;
    },
    async deactivate() {
      closeWaystoneTierMenus();
      closeBaseMenus("tablets");
      closeBaseMenus("charms");
      closeBaseMenus("flasks");
      await setActivePreset(null);
    },
    decorate: decoratePresets,
    finalizeSearch,
    isUniqueActive: () => uniqueGroupPolicyActive,
    prepareUniqueGroups: () => preparePresetActivation("uniques"),
    selectGear,
    selectGem,
    selectJewel
  };
}
