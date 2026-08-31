"use strict";
(() => {
  // src/content/layout/controller.ts
  function isDropdownRenderedAbove(inputRect, dropdownRect) {
    return dropdownRect.height > 0 && dropdownRect.bottom <= inputRect.top + 1;
  }
  function getUpwardDropdownHeightLimit(inputTop, parentTop, gap = 8) {
    if (!Number.isFinite(inputTop) || !Number.isFinite(parentTop)) return 0;
    return Math.max(0, Math.floor(inputTop - Math.max(0, parentTop) - gap));
  }
  function capDropdownHeightToContainer(height, containerHeight, reservedHeight = 200) {
    if (!Number.isFinite(height)) return 0;
    if (!Number.isFinite(containerHeight)) return Math.max(0, Math.floor(height));
    return Math.max(
      0,
      Math.floor(Math.min(height, containerHeight - reservedHeight))
    );
  }
  function createLayoutFeature({
    isStickySearchEnabled,
    isTwoColumnEnabled,
    styler,
    document: doc = document,
    window: browserWindow = window
  }) {
    let syncedFilterPane = null;
    function sync() {
      const root = doc.documentElement;
      const filterPane = doc.querySelector("#trade > .top");
      const controls = filterPane?.querySelector(".controls");
      const quickFilters = filterPane?.querySelector(
        ".poe-trade-styler-quick-filters"
      );
      if (filterPane && filterPane !== syncedFilterPane) {
        syncedFilterPane?.removeEventListener("scroll", sync);
        filterPane.addEventListener("scroll", sync, { passive: true });
        syncedFilterPane = filterPane;
      }
      if (!isTwoColumnEnabled() || !isStickySearchEnabled() || !browserWindow.matchMedia("(min-width: 1200px)").matches || !filterPane || !controls) {
        clearProperties(root);
        return;
      }
      const filterRect = filterPane.getBoundingClientRect();
      const controlsRect = controls.getBoundingClientRect();
      const quickFiltersRect = quickFilters?.getBoundingClientRect();
      const statFilterInput = filterPane.querySelector(
        'input[placeholder="+ Add Stat Filter"]'
      );
      root.style.setProperty(
        "--poe-trade-styler-controls-left",
        `${filterRect.left}px`
      );
      root.style.setProperty(
        "--poe-trade-styler-controls-width",
        `${filterRect.width}px`
      );
      root.style.setProperty(
        "--poe-trade-styler-controls-height",
        `${controlsRect.height}px`
      );
      root.style.setProperty(
        "--poe-trade-styler-quick-filters-height",
        `${quickFiltersRect?.height || 0}px`
      );
      if (statFilterInput) {
        const statFilterRect = statFilterInput.getBoundingClientRect();
        const statFilterDropdown = statFilterInput.closest(".filter-select-mutate")?.querySelector(".multiselect__content-wrapper");
        const opensAbove = statFilterDropdown && isDropdownRenderedAbove(
          statFilterRect,
          statFilterDropdown.getBoundingClientRect()
        );
        const availableHeight = opensAbove ? getUpwardDropdownHeightLimit(
          statFilterRect.top,
          filterRect.top
        ) : styler.getAvailableDropdownHeight(
          statFilterRect.bottom,
          controlsRect.top,
          quickFiltersRect?.top
        );
        const heightLimit = capDropdownHeightToContainer(
          availableHeight,
          filterRect.height
        );
        root.style.setProperty(
          "--poe-trade-styler-stat-filter-height",
          `${heightLimit}px`
        );
      }
    }
    function clearProperties(root) {
      root.style.removeProperty("--poe-trade-styler-controls-left");
      root.style.removeProperty("--poe-trade-styler-controls-width");
      root.style.removeProperty("--poe-trade-styler-controls-height");
      root.style.removeProperty("--poe-trade-styler-quick-filters-height");
      root.style.removeProperty("--poe-trade-styler-stat-filter-height");
    }
    function destroy() {
      syncedFilterPane?.removeEventListener("scroll", sync);
      syncedFilterPane = null;
      clearProperties(doc.documentElement);
    }
    return { destroy, sync };
  }

  // src/content/trade-dom.ts
  var TRADE_SELECTORS = Object.freeze({
    filterBody: "#trade .filter-body",
    searchInput: '#trade input[placeholder="Search Items..."]',
    searchResults: "#trade .results"
  });
  function getSearchInput(root = document) {
    return root.querySelector(TRADE_SELECTORS.searchInput);
  }
  function getCurrentSearchText(root = document) {
    const searchInput = getSearchInput(root);
    const selectedText = searchInput?.closest(".multiselect")?.querySelector(".multiselect__single")?.textContent?.replace(/\s+/g, " ").trim();
    return searchInput?.value.trim() || selectedText || "Advanced search";
  }
  function getRenderedSelectValue(filterBody) {
    if (!filterBody) {
      return "";
    }
    const input = filterBody.querySelector(
      ".multiselect__input"
    );
    const value = (filterBody.querySelector(".multiselect__single")?.textContent || input?.value || "").trim();
    const placeholder = (input?.placeholder || "").trim();
    return value && value !== placeholder ? value : "";
  }
  function getFilterBodyByLabel(label, normalize, root = document) {
    const targetLabel = normalize(label);
    return [...root.querySelectorAll("#trade .filter-body")].find(
      (filterBody) => normalize(
        filterBody.querySelector(":scope > .filter-title")?.textContent ?? ""
      ) === targetLabel
    ) ?? null;
  }

  // src/content/presets/native-form.ts
  function createNativeTradeForm({
    document: doc = document,
    normalize,
    waitForElement
  }) {
    function isSearchItemReset() {
      const input = getSearchInput(doc);
      const selectedItem = input?.closest(".multiselect")?.querySelector(".multiselect__single");
      return Boolean(input && !input.value.trim() && !selectedItem);
    }
    async function resetSearch() {
      const clearButton = doc.querySelector(
        "#trade .controls .clear-btn"
      );
      if (!clearButton) return false;
      clearButton.click();
      await waitForNativeUpdatesToSettle();
      await waitForNativeUpdatesToSettle();
      const cleared = await waitForElement(
        () => isSearchItemReset() ? clearButton : null,
        60
      );
      if (!cleared) return false;
      await waitForNativeUpdatesToSettle();
      await waitForNativeUpdatesToSettle();
      return isSearchItemReset();
    }
    function findSelectOption(container, label) {
      const target = normalize(label);
      return [...container.querySelectorAll(
        ".multiselect__option:not(.multiselect__option--disabled)"
      )].find((option) => normalize(option.textContent ?? "") === target) ?? null;
    }
    function waitForNativeUpdatesToSettle() {
      return new Promise((resolve) => setTimeout(resolve, 0));
    }
    async function setFilterValue(label, value) {
      const filterBody = getFilterBodyByLabel(label, normalize, doc);
      const input = filterBody?.querySelector(
        ".multiselect__input"
      );
      if (!filterBody || !input) return false;
      const currentValue = getRenderedSelectValue(filterBody) || filterBody.querySelector(".multiselect__single")?.textContent?.trim() || input.value.trim() || "Any";
      if (normalize(currentValue) === normalize(value)) return true;
      input.focus();
      input.click();
      input.value = value === "Any" ? "" : value;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      const option = findSelectOption(filterBody, value) || await waitForElement(() => findSelectOption(filterBody, value), 20);
      if (!option) return false;
      option.click();
      await waitForNativeUpdatesToSettle();
      return true;
    }
    function setFilterBounds(label, { min = null, max = null }) {
      const filterBody = getFilterBodyByLabel(label, normalize, doc);
      if (!filterBody) return false;
      const values = [
        ["min", min],
        ["max", max]
      ];
      let foundEveryRequestedInput = true;
      for (const [bound, value] of values) {
        if (value === null) continue;
        const input = filterBody.querySelector(
          `input[placeholder="${bound}"]`
        );
        if (!input) {
          foundEveryRequestedInput = false;
          continue;
        }
        const nextValue = String(value);
        if (input.value === nextValue) continue;
        input.value = nextValue;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }
      return foundEveryRequestedInput;
    }
    async function setSearchItem(label, { match = "prefix" } = {}) {
      const input = getSearchInput(doc);
      const searchControl = input?.closest(".multiselect");
      if (!input || !searchControl) return false;
      input.focus();
      input.click();
      input.value = label;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      const findOption = () => {
        const target = normalize(label);
        const options = [...searchControl.querySelectorAll(
          ".multiselect__option:not(.multiselect__option--disabled)"
        )];
        return options.find((option2) => normalize(option2.textContent ?? "") === target) ?? (match === "prefix" ? options.find(
          (option2) => normalize(option2.textContent ?? "").startsWith(`${target} `)
        ) : null) ?? null;
      };
      const option = findOption() || await waitForElement(findOption, 60);
      if (option) {
        option.click();
        await waitForNativeUpdatesToSettle();
        return true;
      }
      input.dispatchEvent(new Event("change", { bubbles: true }));
      return false;
    }
    async function clearSearchItem() {
      const input = getSearchInput(doc);
      const searchControl = input?.closest(".multiselect");
      if (!input || !searchControl) return false;
      const clearControl = searchControl.querySelector(
        ".multiselect__clear, .multiselect__tag-icon, [aria-label='Clear selection'], [title='Clear selection']"
      );
      clearControl?.click();
      input.value = "";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      await waitForNativeUpdatesToSettle();
      return input.value === "";
    }
    function submitSearch() {
      const searchButton = doc.querySelector(
        "#trade .controls .search-btn"
      );
      if (!searchButton || searchButton.disabled) return false;
      searchButton.click();
      return true;
    }
    return {
      clearSearchItem,
      resetSearch,
      setFilterBounds,
      setFilterValue,
      setSearchItem,
      submitSearch
    };
  }

  // src/content/presets/gear-selection.ts
  function createGearSelection({
    activate,
    closeMenus,
    finalizeSearch,
    gearData,
    nativeForm,
    prepare,
    presetState,
    stats
  }) {
    let selectionInProgress = false;
    return async function selectGear(slotKey, baseKey, itemKey) {
      const slot = gearData.getGearSlot(slotKey);
      const base = baseKey ? gearData.getGearBase(baseKey) : null;
      const item = itemKey ? gearData.getGearItem(itemKey) : null;
      if (!slot || selectionInProgress) return false;
      if (baseKey && (!base || !slot.baseKeys.includes(base.key))) return false;
      if (itemKey && (!item || item.tradeAvailable === false || baseKey && item.baseKey !== baseKey)) return false;
      selectionInProgress = true;
      try {
        closeMenus();
        if (!await prepare()) return false;
        presetState.selectedGearSlotKey = slot.key;
        presetState.selectedGearBaseKey = base?.key || null;
        presetState.selectedGearItemKey = item?.key || null;
        stats.setGearSelection(slot.key, base?.key || null, item?.key || null);
        await activate();
        if (!await nativeForm.setFilterValue(
          "Item Category",
          base?.category || slot.category
        )) {
          return false;
        }
        if (item) {
          if (!await nativeForm.setSearchItem(item.displayName)) return false;
        } else if (!await nativeForm.clearSearchItem()) {
          return false;
        }
        return finalizeSearch();
      } finally {
        selectionInProgress = false;
      }
    };
  }

  // src/content/presets/gem-selection.ts
  function createGemSelection({
    activate,
    closeMenus,
    finalizeSearch,
    gemData,
    nativeForm,
    prepare,
    presetState
  }) {
    let selectionInProgress = false;
    return async (key) => {
      const definition = gemData.getGem(key);
      if (!definition || selectionInProgress) return false;
      selectionInProgress = true;
      try {
        closeMenus();
        if (!await prepare()) return false;
        presetState.selectedGemKey = definition.key;
        await activate();
        if (!await nativeForm.setFilterValue("Item Category", "Any Gem")) {
          return false;
        }
        if (!await nativeForm.setSearchItem(definition.searchText, { match: "exact" })) {
          return false;
        }
        return finalizeSearch();
      } finally {
        selectionInProgress = false;
      }
    };
  }

  // src/content/presets/jewel-selection.ts
  function createJewelSelection({
    activate,
    closeMenus,
    finalizeSearch,
    jewelData,
    nativeForm,
    prepare,
    presetState,
    stats
  }) {
    let selectionInProgress = false;
    return async (baseKey) => {
      const definition = jewelData.getJewelBase(baseKey);
      if (!definition || selectionInProgress) return false;
      selectionInProgress = true;
      try {
        presetState.selectedJewelBaseKey = definition.key;
        stats.setJewelBase(definition.key);
        closeMenus();
        if (!await prepare()) return false;
        await activate();
        if (!await nativeForm.setFilterValue("Item Category", "Any Jewel")) {
          return false;
        }
        if (!await nativeForm.setSearchItem(definition.searchText, { match: "exact" })) {
          return false;
        }
        return finalizeSearch();
      } finally {
        selectionInProgress = false;
      }
    };
  }

  // src/content/image-assets.ts
  var FALLBACK_PATH = "assets/item-icons/fallback.webp";
  function extensionAssetUrl(path) {
    const extensionRuntime = globalThis.chrome?.runtime;
    const pageOrigin = globalThis.location?.origin || "https://www.pathofexile.com";
    return extensionRuntime?.getURL ? extensionRuntime.getURL(path) : new URL(`/${path}`, pageOrigin).href;
  }
  var GENERIC_ITEM_FALLBACK_ICON = extensionAssetUrl(FALLBACK_PATH);
  function getSafeItemImageUrl(source) {
    const value = String(source || "").trim();
    if (/^assets\/item-icons\/[a-f0-9-]+\.webp$/i.test(value)) {
      return extensionAssetUrl(value);
    }
    if (/^https:\/\/web\.poecdn\.com\/gen\/image\/[A-Za-z0-9_-]+\/[a-f0-9]+\/[A-Za-z0-9._-]+$/i.test(value)) {
      return value;
    }
    return GENERIC_ITEM_FALLBACK_ICON;
  }

  // src/content/presets/base-menu.ts
  function createBaseMenu(preset, definitions, selectBase, {
    selectUnique,
    uniqueDefinitions = []
  } = {}) {
    const singular = preset.replace(/s$/, "");
    const menu = document.createElement("div");
    menu.className = `poe-trade-styler-${singular}-base-menu`;
    menu.hidden = true;
    menu.setAttribute("role", "radiogroup");
    menu.setAttribute("aria-label", `${singular} base`);
    function appendHeadings(labels, fullWidth = false) {
      labels.forEach((text) => {
        const heading = document.createElement("div");
        heading.className = "poe-trade-styler-base-column-heading";
        heading.classList.toggle("is-full-width", fullWidth);
        heading.textContent = text;
        menu.append(heading);
      });
    }
    function appendPlaceholder() {
      const placeholder = document.createElement("span");
      placeholder.className = "poe-trade-styler-base-option-placeholder";
      placeholder.setAttribute("aria-hidden", "true");
      menu.append(placeholder);
    }
    function appendOption(definition, isUnique = false) {
      const baseDefinition = definition;
      const option = document.createElement("button");
      option.className = `poe-trade-styler-base-option poe-trade-styler-${singular}-base-option`;
      option.classList.toggle("is-unique", isUnique);
      option.type = "button";
      if (isUnique) {
        option.dataset.poeTradeStylerUniqueKey = definition.key;
      } else {
        option.dataset.poeTradeStylerBaseKey = definition.key;
      }
      option.dataset.poeTradeStylerBasePreset = preset;
      const detail = isUnique ? [
        definition.base,
        definition.requiredLevel ? `Requires Level ${definition.requiredLevel}` : ""
      ].filter(Boolean).join(" \xB7 ") : baseDefinition.baseStat || (definition.requiredLevel ? `Requires Level ${definition.requiredLevel}` : "");
      option.title = detail ? `${definition.displayName} \u2014 ${detail}` : definition.displayName;
      option.setAttribute(
        "aria-label",
        detail ? `${definition.displayName}. ${detail}` : definition.displayName
      );
      if (!isUnique) {
        option.setAttribute("role", "radio");
        option.setAttribute("aria-checked", "false");
      }
      const icon = document.createElement("img");
      icon.src = getSafeItemImageUrl(definition.icon);
      icon.referrerPolicy = "no-referrer";
      icon.alt = "";
      icon.setAttribute("aria-hidden", "true");
      const label = document.createElement("span");
      label.className = "poe-trade-styler-base-option-label";
      if (isUnique) {
        const name = document.createElement("span");
        name.className = "poe-trade-styler-unique-option-name";
        name.textContent = preset === "charms" ? `${definition.displayName} ${definition.base}` : definition.displayName;
        label.append(name);
      } else {
        label.textContent = definition.displayName;
      }
      if (!isUnique && baseDefinition.baseStat) {
        label.dataset.poeTradeStylerBaseStat = baseDefinition.baseStat;
      }
      option.append(icon, label);
      if ((preset === "flasks" || isUnique) && definition.requiredLevel) {
        const level = document.createElement("span");
        level.className = "poe-trade-styler-flask-base-level";
        level.textContent = String(definition.requiredLevel);
        option.append(level);
      }
      option.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (isUnique && selectUnique) {
          void selectUnique(definition.searchText);
        } else {
          void selectBase(definition.key);
        }
      });
      menu.append(option);
    }
    function appendPairedRows(left, right, isUnique = false) {
      const rowCount = Math.max(left.length, right.length);
      for (let index = 0; index < rowCount; index += 1) {
        if (left[index]) appendOption(left[index], isUnique);
        else appendPlaceholder();
        if (right[index]) appendOption(right[index], isUnique);
        else appendPlaceholder();
      }
    }
    if (preset === "flasks") {
      appendHeadings(["Life Flasks", "Mana Flasks"]);
      appendPairedRows(
        definitions.filter((definition) => definition.kind === "life"),
        definitions.filter((definition) => definition.kind === "mana")
      );
      appendPairedRows(
        uniqueDefinitions.filter((definition) => definition.kind === "life"),
        uniqueDefinitions.filter((definition) => definition.kind === "mana"),
        true
      );
    } else if (preset === "charms" && uniqueDefinitions.length > 0) {
      appendHeadings(["Charm Bases", "Unique Charms"]);
      const remainingUniques = [...uniqueDefinitions];
      const alignedUniques = definitions.map((definition) => {
        const matchIndex = remainingUniques.findIndex(
          (unique) => unique.base === (definition.searchText || definition.displayName)
        );
        return matchIndex >= 0 ? remainingUniques.splice(matchIndex, 1)[0] : null;
      });
      definitions.forEach((definition, index) => {
        appendOption(definition);
        const unique = alignedUniques[index];
        if (unique) appendOption(unique, true);
        else appendPlaceholder();
      });
      remainingUniques.forEach((unique) => {
        appendPlaceholder();
        appendOption(unique, true);
      });
    } else if (preset === "tablets" && uniqueDefinitions.length > 0) {
      appendHeadings(["Tablet Bases", "Unique Tablets"]);
      const remainingUniques = [...uniqueDefinitions];
      const matchingUniques = (definition) => {
        const baseName = definition.searchText || definition.displayName;
        return uniqueDefinitions.filter((unique) => unique.base === baseName);
      };
      const pairedDefinitions = definitions.filter(
        (definition) => matchingUniques(definition).length === 1
      );
      const unpairedDefinitions = definitions.filter(
        (definition) => matchingUniques(definition).length !== 1
      );
      pairedDefinitions.forEach((definition) => {
        const unique = matchingUniques(definition)[0];
        remainingUniques.splice(remainingUniques.indexOf(unique), 1);
        appendOption(definition);
        appendOption(unique, true);
      });
      const unpairedRowCount = Math.max(
        unpairedDefinitions.length,
        remainingUniques.length
      );
      for (let index = 0; index < unpairedRowCount; index += 1) {
        if (unpairedDefinitions[index]) appendOption(unpairedDefinitions[index]);
        else appendPlaceholder();
        if (remainingUniques[index]) appendOption(remainingUniques[index], true);
        else appendPlaceholder();
      }
    } else if (preset === "jewels" && uniqueDefinitions.length > 0) {
      appendHeadings(["Jewel Bases"], true);
      definitions.forEach((definition) => appendOption(definition));
      if (definitions.length % 2 !== 0) appendPlaceholder();
      appendHeadings(["Unique Jewels"], true);
      uniqueDefinitions.forEach((definition) => appendOption(definition, true));
      if (uniqueDefinitions.length % 2 !== 0) appendPlaceholder();
    } else {
      definitions.forEach((definition) => appendOption(definition));
    }
    return menu;
  }

  // src/content/presets/group-policy.ts
  var PRESET_ENABLED_GROUPS = Object.freeze({
    charms: /* @__PURE__ */ new Set([
      "type filters",
      "requirements",
      "requirements filters",
      "miscellaneous",
      "stat filters",
      "not",
      "trade filters"
    ]),
    flasks: /* @__PURE__ */ new Set([
      "type filters",
      "stat filters",
      "not",
      "trade filters"
    ]),
    gems: /* @__PURE__ */ new Set([
      "type filters",
      "requirements",
      "requirements filters",
      "miscellaneous",
      "trade filters"
    ]),
    gear: /* @__PURE__ */ new Set([
      "type filters",
      "equipment filters",
      "requirements",
      "requirements filters",
      "miscellaneous",
      "stat filters",
      "not",
      "trade filters"
    ]),
    jewels: /* @__PURE__ */ new Set([
      "type filters",
      "miscellaneous",
      "stat filters",
      "not",
      "trade filters"
    ]),
    tablets: /* @__PURE__ */ new Set([
      "type filters",
      "miscellaneous",
      "stat filters",
      "not",
      "trade filters"
    ]),
    waystones: /* @__PURE__ */ new Set([
      "endgame filters",
      "miscellaneous",
      "stat filters",
      "not",
      "trade filters"
    ])
  });
  var ACCESSORY_GEAR_SLOTS = /* @__PURE__ */ new Set(["amulets", "rings", "belts"]);
  var ACCESSORY_GEAR_ENABLED_GROUPS = /* @__PURE__ */ new Set([
    "type filters",
    "miscellaneous",
    "stat filters",
    "not",
    "trade filters"
  ]);
  var UNIQUE_ENABLED_GROUPS = /* @__PURE__ */ new Set([
    "type filters",
    "equipment filters",
    "miscellaneous",
    "stat filters",
    "not",
    "trade filters"
  ]);
  function getPresetGroupPolicy(preset, groupKey, { gearSlotKey = null } = {}) {
    if (preset === "uniques") {
      return { enabled: UNIQUE_ENABLED_GROUPS.has(groupKey), hidden: false };
    }
    if (preset === "jewels" && groupKey === "type filters") {
      return { enabled: true, expanded: false, hidden: false };
    }
    if (preset === "gear" && gearSlotKey && ACCESSORY_GEAR_SLOTS.has(gearSlotKey)) {
      return {
        enabled: ACCESSORY_GEAR_ENABLED_GROUPS.has(groupKey),
        hidden: false
      };
    }
    return {
      enabled: PRESET_ENABLED_GROUPS[preset].has(groupKey),
      hidden: false
    };
  }

  // src/content/presets/group-state-manager.ts
  function createPresetGroupStateManager({
    getGearSlotKey,
    getGroupKey
  }) {
    const savedStates = /* @__PURE__ */ new Map();
    function getGroups() {
      return [...document.querySelectorAll(
        "#trade .search-advanced-pane .filter-group"
      )];
    }
    function getToggle(group) {
      return group.querySelector(
        ":scope > .filter-group-header .toggle-btn"
      );
    }
    function setEnabled(group, enabled) {
      const toggle = getToggle(group);
      if (!toggle || toggle.classList.contains("off") !== enabled) return false;
      toggle.click();
      return true;
    }
    function setExpanded(group, expanded) {
      if (group.classList.contains("expanded") === expanded) return;
      group.querySelector(
        ":scope > .filter-group-header .filter-title-clickable, :scope > .filter-group-header .filter-title"
      )?.click();
    }
    function remember(group) {
      if (savedStates.has(group)) return;
      const toggle = getToggle(group);
      savedStates.set(group, {
        enabled: !toggle || !toggle.classList.contains("off"),
        expanded: group.classList.contains("expanded")
      });
    }
    async function waitForStage() {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    async function collapseEnabledGroups() {
      await waitForStage();
      for (const group of getGroups()) {
        remember(group);
        const toggle = getToggle(group);
        setExpanded(group, false);
        if (!toggle || !toggle.classList.contains("off")) setEnabled(group, false);
      }
      await waitForStage();
    }
    async function apply(mode) {
      let toggled = false;
      for (const group of getGroups()) {
        remember(group);
        const policy = getPresetGroupPolicy(mode, getGroupKey(group), {
          gearSlotKey: getGearSlotKey()
        });
        group.classList.remove("poe-trade-styler-preset-collapsed");
        group.classList.remove("poe-trade-styler-preset-hidden");
        if (!policy.enabled || policy.expanded === false) {
          setExpanded(group, false);
        }
        toggled = setEnabled(group, policy.enabled) || toggled;
      }
      if (toggled) await waitForStage();
      for (const group of getGroups()) {
        const policy = getPresetGroupPolicy(mode, getGroupKey(group), {
          gearSlotKey: getGearSlotKey()
        });
        group.classList.remove("poe-trade-styler-preset-collapsed");
        group.classList.remove("poe-trade-styler-preset-hidden");
        if (!policy.enabled || policy.expanded === false) {
          setExpanded(group, false);
        }
        setEnabled(group, policy.enabled);
        setExpanded(group, policy.enabled && policy.expanded !== false);
      }
    }
    function restore(restorePrevious = true) {
      for (const group of getGroups()) {
        group.classList.remove("poe-trade-styler-preset-collapsed");
        group.classList.remove("poe-trade-styler-preset-hidden");
        const previous = savedStates.get(group);
        if (!previous || !restorePrevious) continue;
        setEnabled(group, previous.enabled);
        setExpanded(group, previous.expanded);
      }
      savedStates.clear();
    }
    return { apply, collapseEnabledGroups, restore };
  }

  // src/content/presets/controller.ts
  function createPresetsFeature({
    charmData,
    flaskData,
    gemData,
    gearData,
    jewelData,
    presetState,
    stats,
    styler,
    tabletData,
    uniqueData,
    waystoneData,
    nativeForm: injectedNativeForm
  }) {
    const nativeForm = injectedNativeForm ?? createNativeTradeForm({
      normalize: stats.normalizeText,
      waitForElement: stats.waitForElement
    });
    let waystoneTierSelectionInProgress = false;
    let charmBaseSelectionInProgress = false;
    let flaskBaseSelectionInProgress = false;
    let tabletBaseSelectionInProgress = false;
    let uniqueItemSelectionInProgress = false;
    let uniqueGroupPolicyActive = false;
    let preparedGroupMode = null;
    function getActiveGroupPolicyMode() {
      return presetState.activePreset || (uniqueGroupPolicyActive ? "uniques" : null);
    }
    function isPoe2PresetPage() {
      return styler.getTradeGameKey(location.pathname) === "poe2" || document.body.dataset.fixtureGame === "poe2";
    }
    function getPresetGroupTitle(group) {
      const title = group.querySelector(
        ":scope > .filter-group-header .filter-title, :scope > .filter-group-header .filter-title-clickable"
      )?.textContent || group.dataset.fixtureFilterGroup || "";
      return stats.normalizeText(title);
    }
    function getWaystoneGroupKey(group) {
      const statGroupType = group.querySelector(
        'input[placeholder="+ Add Stat Filter"]'
      ) ? stats.getStatGroupType(group) : null;
      if (statGroupType === "not") {
        return "not";
      }
      return getPresetGroupTitle(group);
    }
    const groupStateManager = createPresetGroupStateManager({
      getGearSlotKey: () => presetState.selectedGearSlotKey,
      getGroupKey: getWaystoneGroupKey
    });
    async function applyWaystoneGroupState({ restorePrevious = true } = {}) {
      const activeMode = getActiveGroupPolicyMode();
      if (activeMode) await groupStateManager.apply(activeMode);
      else groupStateManager.restore(restorePrevious);
    }
    function setWaystoneTierMenuOpen(button, shouldOpen) {
      const menu = button?.closest(".poe-trade-styler-preset-navigation-item")?.querySelector(".poe-trade-styler-waystone-tier-menu");
      if (!menu) {
        return;
      }
      menu.hidden = !shouldOpen;
      button.setAttribute("aria-expanded", String(shouldOpen));
    }
    function closeWaystoneTierMenus() {
      let closed = false;
      document.querySelectorAll('[data-poe-trade-styler-preset="waystones"]').forEach((button) => {
        const menu = button.closest(".poe-trade-styler-preset-navigation-item")?.querySelector(".poe-trade-styler-waystone-tier-menu");
        if (menu && !menu.hidden) {
          closed = true;
        }
        setWaystoneTierMenuOpen(button, false);
      });
      return closed;
    }
    function syncWaystoneTierMenu() {
      document.querySelectorAll(".poe-trade-styler-waystone-tier-option").forEach((option) => {
        const selected = Number(option.dataset.poeTradeStylerWaystoneTier) === presetState.selectedWaystoneTier;
        option.classList.toggle("is-selected", selected);
        option.setAttribute("aria-checked", String(selected));
      });
    }
    function setBaseMenuOpen(button, preset, shouldOpen) {
      const singular = preset.replace(/s$/, "");
      const menu = button?.closest(".poe-trade-styler-preset-navigation-item")?.querySelector(`.poe-trade-styler-${singular}-base-menu`);
      if (!menu) {
        return;
      }
      menu.hidden = !shouldOpen;
      button.setAttribute("aria-expanded", String(shouldOpen));
    }
    function closeBaseMenus(preset) {
      let closed = false;
      const singular = preset.replace(/s$/, "");
      document.querySelectorAll(`[data-poe-trade-styler-preset="${preset}"]`).forEach((button) => {
        const menu = button.closest(".poe-trade-styler-preset-navigation-item")?.querySelector(`.poe-trade-styler-${singular}-base-menu`);
        if (menu && !menu.hidden) {
          closed = true;
        }
        setBaseMenuOpen(button, preset, false);
      });
      return closed;
    }
    function syncBaseMenu(preset, selectedKey) {
      document.querySelectorAll(
        `.poe-trade-styler-base-option[data-poe-trade-styler-base-preset="${preset}"][data-poe-trade-styler-base-key]`
      ).forEach((option) => {
        const selected = option.dataset.poeTradeStylerBaseKey === selectedKey;
        option.classList.toggle("is-selected", selected);
        option.setAttribute("aria-checked", String(selected));
      });
    }
    function syncPresetControls() {
      const titles = {
        charms: "Choose a Charm base preset",
        flasks: "Choose a Flask base preset",
        gems: "Open Skill Gem Presets",
        gear: "Open Gear Presets",
        jewels: "Choose a Jewel base preset",
        tablets: "Choose a Tablet base preset",
        waystones: "Choose a Waystone tier preset"
      };
      Object.keys(titles).forEach((preset) => {
        document.querySelectorAll(
          `[data-poe-trade-styler-preset="${preset}"]`
        ).forEach((button) => {
          const active = presetState.activePreset === preset;
          button.classList.toggle("is-active", active);
          button.setAttribute("aria-pressed", String(active));
          button.title = active ? `Disable the ${preset} preset and keep the selected form values` : titles[preset];
        });
      });
      syncWaystoneTierMenu();
      syncBaseMenu("charms", presetState.selectedCharmBaseKey);
      syncBaseMenu("flasks", presetState.selectedFlaskBaseKey);
      syncBaseMenu("tablets", presetState.selectedTabletBaseKey);
    }
    async function setActivePreset(nextPreset, { preserveForm: _preserveForm = false } = {}) {
      if (nextPreset === presetState.activePreset && !uniqueGroupPolicyActive && !preparedGroupMode) {
        return true;
      }
      if (nextPreset) {
        if (preparedGroupMode !== nextPreset && !await preparePresetActivation(nextPreset)) return false;
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
      await applyWaystoneGroupState();
      stats.filterForPreset();
      stats.decorateOptions();
      syncPresetControls();
      return true;
    }
    async function preparePresetActivation(mode) {
      await setActivePreset(null, { preserveForm: false });
      if (!await nativeForm.resetSearch()) return false;
      await groupStateManager.collapseEnabledGroups();
      preparedGroupMode = mode;
      return true;
    }
    async function finalizeSearch(beforeSubmit) {
      await applyWaystoneGroupState();
      stats.filterForPreset();
      stats.decorateOptions();
      if (beforeSubmit && await beforeSubmit() === false) return false;
      return nativeForm.submitSearch();
    }
    async function selectWaystoneTier(tier) {
      const definition = waystoneData.WAYSTONE_TIERS.find(
        (entry) => entry.tier === tier
      );
      if (!definition || waystoneTierSelectionInProgress) return;
      waystoneTierSelectionInProgress = true;
      try {
        presetState.selectedWaystoneTier = tier;
        closeWaystoneTierMenus();
        syncPresetControls();
        if (!await preparePresetActivation("waystones")) return;
        if (!await setActivePreset("waystones")) return;
        if (!await nativeForm.setFilterValue("Item Category", "Waystone")) return;
        if (!await nativeForm.setSearchItem(definition.searchText)) return;
        await finalizeSearch();
      } finally {
        waystoneTierSelectionInProgress = false;
      }
    }
    function createWaystoneTierMenu() {
      const menu = document.createElement("div");
      menu.className = "poe-trade-styler-waystone-tier-menu";
      menu.hidden = true;
      menu.setAttribute("role", "radiogroup");
      menu.setAttribute("aria-label", "Waystone tier");
      waystoneData.WAYSTONE_TIERS.forEach((definition) => {
        const option = document.createElement("button");
        option.className = `poe-trade-styler-waystone-tier-option is-${definition.color}`;
        option.type = "button";
        option.dataset.poeTradeStylerWaystoneTier = String(definition.tier);
        option.title = definition.searchText;
        option.setAttribute("role", "radio");
        option.setAttribute("aria-label", definition.searchText);
        option.setAttribute("aria-checked", "false");
        const icon = document.createElement("img");
        icon.className = "poe-trade-styler-waystone-tier-icon";
        icon.src = getSafeItemImageUrl(definition.icon);
        icon.alt = "";
        icon.setAttribute("aria-hidden", "true");
        option.append(icon);
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
      button.className = "poe-trade-styler-preset poe-trade-styler-waystone-preset-button";
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
        const menu = button.closest(".poe-trade-styler-preset-navigation-item")?.querySelector(".poe-trade-styler-waystone-tier-menu");
        setWaystoneTierMenuOpen(button, Boolean(menu?.hidden));
      });
      return button;
    }
    async function selectTabletBase(baseKey) {
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
        if (!await preparePresetActivation("tablets")) return;
        if (!await setActivePreset("tablets")) return;
        if (!await nativeForm.setFilterValue("Item Category", "Tablet")) return;
        if (!await nativeForm.setSearchItem(definition.searchText)) return;
        await finalizeSearch();
      } finally {
        tabletBaseSelectionInProgress = false;
      }
    }
    async function selectCharmBase(baseKey) {
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
        if (!await preparePresetActivation("charms")) return;
        if (!await setActivePreset("charms")) return;
        if (!await nativeForm.setFilterValue("Item Category", "Charm")) return;
        if (!await nativeForm.setSearchItem(definition.searchText)) return;
        await finalizeSearch();
      } finally {
        charmBaseSelectionInProgress = false;
      }
    }
    async function selectFlaskBase(baseKey) {
      const definition = flaskData.getFlaskBase(baseKey);
      if (!definition || flaskBaseSelectionInProgress) return;
      flaskBaseSelectionInProgress = true;
      try {
        presetState.selectedFlaskBaseKey = definition.key;
        stats.setFlaskBase(definition.key);
        closeWaystoneTierMenus();
        ["tablets", "charms", "flasks"].forEach(closeBaseMenus);
        syncPresetControls();
        if (!await preparePresetActivation("flasks")) return;
        if (!await setActivePreset("flasks")) return;
        const category = definition.kind === "life" ? "Life Flask" : "Mana Flask";
        if (!await nativeForm.setFilterValue("Item Category", category)) return;
        if (!await nativeForm.setSearchItem(definition.searchText)) return;
        await finalizeSearch();
      } finally {
        flaskBaseSelectionInProgress = false;
      }
    }
    async function selectUniqueItem(searchText) {
      if (!searchText || uniqueItemSelectionInProgress) return false;
      uniqueItemSelectionInProgress = true;
      try {
        closeWaystoneTierMenus();
        ["tablets", "charms", "flasks"].forEach(closeBaseMenus);
        if (!await preparePresetActivation("uniques")) return false;
        return searchUniqueItem(searchText);
      } finally {
        uniqueItemSelectionInProgress = false;
      }
    }
    const selectGem = createGemSelection({
      activate: async () => {
        await setActivePreset("gems");
      },
      closeMenus: () => {
        closeWaystoneTierMenus();
        ["tablets", "charms", "flasks"].forEach(closeBaseMenus);
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
        ["tablets", "charms", "flasks"].forEach(closeBaseMenus);
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
        ["tablets", "charms", "flasks"].forEach(closeBaseMenus);
      },
      finalizeSearch,
      jewelData,
      nativeForm,
      prepare: () => preparePresetActivation("jewels"),
      presetState,
      stats
    });
    function createBasePresetButton(preset, label, iconSource) {
      const singular = preset.replace(/s$/, "");
      const button = document.createElement("button");
      button.className = `poe-trade-styler-preset poe-trade-styler-${singular}-preset-button`;
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
        ["tablets", "charms", "flasks"].filter((candidate) => candidate !== preset).forEach(closeBaseMenus);
        const menu = button.closest(".poe-trade-styler-preset-navigation-item")?.querySelector(`.poe-trade-styler-${singular}-base-menu`);
        setBaseMenuOpen(button, preset, Boolean(menu?.hidden));
      });
      return button;
    }
    function getUniqueMenuDefinitions(type) {
      return (uniqueData?.getItemsByType(type) || []).map((item) => ({
        base: item.base,
        displayName: item.name,
        icon: item.officialIcon,
        key: item.key,
        kind: type === "Life Flasks" ? "life" : type === "Mana Flasks" ? "mana" : void 0,
        requiredLevel: item.level,
        searchText: `${item.name} ${item.base}`
      }));
    }
    const createTabletBaseMenu = () => createBaseMenu("tablets", tabletData.TABLET_BASES, selectTabletBase, {
      selectUnique: async (searchText) => {
        await selectUniqueItem(searchText);
      },
      uniqueDefinitions: getUniqueMenuDefinitions("Tablets")
    });
    const createCharmBaseMenu = () => createBaseMenu("charms", charmData.CHARM_BASES, selectCharmBase, {
      selectUnique: async (searchText) => {
        await selectUniqueItem(searchText);
      },
      uniqueDefinitions: getUniqueMenuDefinitions("Charms")
    });
    const createFlaskBaseMenu = () => createBaseMenu(
      "flasks",
      flaskData.FLASK_BASES,
      selectFlaskBase,
      {
        selectUnique: async (searchText) => {
          await selectUniqueItem(searchText);
        },
        uniqueDefinitions: [
          ...getUniqueMenuDefinitions("Life Flasks"),
          ...getUniqueMenuDefinitions("Mana Flasks")
        ]
      }
    );
    const createTabletPresetButton = () => createBasePresetButton("tablets", "Tablet", tabletData.TABLET_GENERAL_ICON);
    const createCharmPresetButton = () => createBasePresetButton("charms", "Charm", charmData.CHARM_GENERAL_ICON);
    const createFlaskPresetButton = () => createBasePresetButton(
      "flasks",
      "Flask",
      flaskData.FLASK_GENERAL_ICON
    );
    function removeWaystonePresetButton(button) {
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
      const controls = [
        ...document.querySelectorAll(
          'a, button, [role="button"], .btn, .button'
        )
      ];
      return controls.find(
        (control) => /\/trade2\/exchange(?:\/|$)/.test(
          control.getAttribute("href") || ""
        )
      ) || controls.find(
        (control) => stats.normalizeText(control.textContent || "") === "bulk item exchange"
      ) || null;
    }
    function mountBasePresetAfter(previousButton, preset, useListItem, createButton, createMenu) {
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
      } else if (!navigationItem.querySelector(`.poe-trade-styler-${singular}-base-menu`)) {
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
        document.querySelectorAll(
          '[data-poe-trade-styler-preset="waystones"], [data-poe-trade-styler-preset="tablets"], [data-poe-trade-styler-preset="charms"], [data-poe-trade-styler-preset="flasks"]'
        ).forEach(removeWaystonePresetButton);
        if (presetState.activePreset) {
          setActivePreset(null);
        }
        return;
      }
      document.querySelectorAll(".poe-trade-styler-presets").forEach((presets) => presets.remove());
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
          presetNavigationItem.className = "poe-trade-styler-preset-navigation-item";
          presetNavigationItem.append(
            waystoneButton,
            createWaystoneTierMenu()
          );
        } else if (!presetNavigationItem.querySelector(
          ".poe-trade-styler-waystone-tier-menu"
        )) {
          presetNavigationItem.append(createWaystoneTierMenu());
        }
        if (bulkNavigationItem.nextElementSibling !== presetNavigationItem) {
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
          presetNavigationItem.className = "poe-trade-styler-preset-navigation-item";
          presetNavigationItem.append(
            waystoneButton,
            createWaystoneTierMenu()
          );
        } else if (!presetNavigationItem.querySelector(
          ".poe-trade-styler-waystone-tier-menu"
        )) {
          presetNavigationItem.append(createWaystoneTierMenu());
        }
        if (bulkItemExchangeButton.nextElementSibling !== presetNavigationItem) {
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
      mountBasePresetAfter(
        charmButton,
        "flasks",
        Boolean(bulkNavigationItem),
        createFlaskPresetButton,
        createFlaskBaseMenu
      );
      stats.filterForPreset();
      syncPresetControls();
    }
    async function activateUniqueGroups() {
      if (preparedGroupMode !== "uniques" && !await preparePresetActivation("uniques")) return;
      preparedGroupMode = null;
      uniqueGroupPolicyActive = true;
      await applyWaystoneGroupState();
      stats.filterForPreset();
      stats.decorateOptions();
    }
    async function searchUniqueItem(name) {
      await activateUniqueGroups();
      if (!uniqueGroupPolicyActive) return false;
      if (!await nativeForm.setSearchItem(name)) return false;
      return finalizeSearch();
    }
    return {
      activateUniqueGroups,
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
      searchUniqueItem,
      selectGear,
      selectGem,
      selectJewel,
      selectUniqueItem
    };
  }

  // src/content/presets/state.ts
  function usesCompactPresetCatalog(preset) {
    return preset === "charms" || preset === "flasks" || preset === "gems" || preset === "gear" || preset === "jewels";
  }
  function createPresetState() {
    return {
      activePreset: null,
      selectedCharmBaseKey: null,
      selectedFlaskBaseKey: null,
      selectedGemKey: null,
      selectedGearBaseKey: null,
      selectedGearItemKey: null,
      selectedGearSlotKey: null,
      selectedJewelBaseKey: null,
      selectedTabletBaseKey: null,
      selectedWaystoneTier: null
    };
  }

  // src/content/quick-filter-definitions.ts
  var bundledIconData = globalThis.Poe2BundledIconData;
  var quickFilterIcon = (key) => bundledIconData?.mappings?.quickFilters?.[key] || bundledIconData?.fallbackPath || "assets/item-icons/fallback.webp";
  var QUICK_RARITY_FILTER = {
    key: "rarity",
    label: "Item Rarity",
    values: [
      "Normal",
      "Magic",
      "Rare",
      "Unique",
      "Unique (Foil)",
      "Any Non-Unique"
    ]
  };
  var QUICK_BOOLEAN_FILTERS = [
    {
      key: "corrupted",
      label: "Corrupted",
      icon: quickFilterIcon("corrupted")
    },
    {
      key: "fractured",
      label: "Fractured",
      icon: quickFilterIcon("fractured")
    },
    {
      key: "desecrated",
      label: "Desecrated",
      icon: quickFilterIcon("desecrated")
    },
    {
      key: "crafted",
      label: "Crafted",
      icon: quickFilterIcon("crafted")
    },
    {
      key: "mirrored",
      label: "Mirrored",
      icon: quickFilterIcon("mirrored")
    },
    {
      key: "sanctified",
      label: "Sanctified",
      icon: quickFilterIcon("sanctified")
    }
  ];
  var QUICK_NUMBER_FILTERS = [
    {
      key: "augmentable-sockets",
      label: "Augmentable Sockets",
      shortLabel: "Minimum augmentable sockets",
      icon: quickFilterIcon("augmentable-sockets"),
      values: ["1", "2", "3", "4", "5", "6"]
    },
    {
      key: "item-quality",
      label: "Item Quality",
      shortLabel: "Minimum item quality",
      icon: quickFilterIcon("item-quality"),
      values: Array.from({ length: 30 }, (_, index) => String(index + 1)),
      min: 0,
      max: 100
    },
    {
      key: "gem-level",
      label: "Gem Level",
      shortLabel: "Exact gem level",
      icon: quickFilterIcon("gem-level"),
      values: Array.from({ length: 21 }, (_, index) => String(index + 1)),
      columns: 2,
      exact: true,
      gemOnly: true,
      min: 1,
      max: 21
    },
    {
      key: "gem-sockets",
      label: "Gem Sockets",
      shortLabel: "Minimum gem sockets",
      icon: quickFilterIcon("gem-sockets"),
      values: ["2", "3", "4", "5"],
      gemOnly: true
    }
  ];

  // src/content/quick-rarity-filter.ts
  function createQuickRarityFilterFeature(dependencies) {
    const {
      closePopovers,
      definition,
      ensureGroupEnabled,
      getFilterBody,
      isGroupEnabled,
      normalizeText,
      requestSync,
      waitForElement
    } = dependencies;
    function getRarityTone(value) {
      if (value === "Normal") return "normal";
      if (value === "Magic") return "magic";
      if (value === "Rare") return "rare";
      if (value.startsWith("Unique")) return "unique";
      return "";
    }
    function readValue() {
      const filterBody = getFilterBody();
      if (!isGroupEnabled(filterBody)) return "";
      const input = filterBody?.querySelector(
        ".multiselect__input"
      );
      const multiselect = input?.closest(".multiselect");
      const isSearching = Boolean(
        multiselect?.classList.contains("multiselect--active")
      );
      const selectedText = filterBody?.querySelector(".multiselect__single")?.textContent?.trim();
      const renderedValue = normalizeText(
        selectedText || (!isSearching ? input?.value.trim() : "") || (!input?.value.trim() ? input?.placeholder : "") || "any"
      );
      return definition.values.find(
        (value) => normalizeText(value) === renderedValue
      ) || "";
    }
    async function applyValue(value) {
      let filterBody = value ? await ensureGroupEnabled() : getFilterBody();
      if (!filterBody) return false;
      if (readValue() === value) return true;
      const input = filterBody.querySelector(
        ".multiselect__input"
      );
      if (!input) return false;
      input.focus();
      input.click();
      input.value = value || "Any";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      const target = normalizeText(value || "Any");
      const findOption = () => {
        filterBody = getFilterBody() || filterBody;
        const currentBody = filterBody;
        if (!currentBody) return null;
        return [...currentBody.querySelectorAll(
          ".multiselect__option:not(.multiselect__option--disabled)"
        )].find(
          (option2) => normalizeText(option2.textContent || "") === target
        ) || null;
      };
      const option = findOption() || await waitForElement(findOption, 20);
      if (!option) return false;
      const isCommitted = () => readValue() === value;
      option.dispatchEvent(
        new Event("mousedown", { bubbles: true, cancelable: true })
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (!isCommitted()) {
        option.click();
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      if (!isCommitted()) {
        input.dispatchEvent(
          new KeyboardEvent("keydown", {
            bubbles: true,
            cancelable: true,
            code: "Enter",
            key: "Enter"
          })
        );
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      return Boolean(
        await waitForElement(
          () => isCommitted() ? getFilterBody() : null,
          20
        )
      );
    }
    function syncControl(control) {
      const value = readValue();
      const trigger = control.querySelector(
        ".poe-trade-styler-quick-rarity-trigger"
      );
      const reset = control.querySelector(
        ".poe-trade-styler-quick-rarity-reset"
      );
      control.dataset.value = value;
      trigger?.classList.toggle("is-empty", !value);
      trigger?.classList.toggle("is-enabled", Boolean(value));
      if (trigger) {
        const tone = getRarityTone(value);
        trigger.textContent = value || "Rarity";
        for (const rarityTone of ["normal", "magic", "rare", "unique"]) {
          trigger.classList.toggle(
            `is-rarity-${rarityTone}`,
            rarityTone === tone
          );
        }
        trigger.title = value ? `Rarity: ${value}. Click to disable.` : "Rarity: disabled. Hover to choose.";
        trigger.setAttribute(
          "aria-label",
          value ? `Rarity: ${value}. Click to disable.` : "Rarity: disabled"
        );
      }
      if (reset) reset.disabled = !value;
      control.querySelectorAll(".poe-trade-styler-quick-rarity-option").forEach((option) => {
        const selected = option.dataset.value === value;
        option.classList.toggle("is-selected", selected);
        option.setAttribute("aria-selected", String(selected));
      });
    }
    function createControl() {
      const control = document.createElement("div");
      control.className = "poe-trade-styler-quick-rarity-filter";
      control.dataset.quickFilter = definition.key;
      const trigger = document.createElement("button");
      trigger.type = "button";
      trigger.className = "poe-trade-styler-quick-filter poe-trade-styler-quick-rarity-trigger is-empty";
      trigger.textContent = "Rarity";
      trigger.setAttribute("aria-haspopup", "listbox");
      trigger.setAttribute("aria-expanded", "false");
      const popover = document.createElement("div");
      popover.className = "poe-trade-styler-quick-rarity-popover";
      popover.hidden = true;
      popover.setAttribute("role", "listbox");
      popover.setAttribute("aria-label", "Item rarity");
      const close = () => {
        popover.hidden = true;
        control.classList.remove("is-open");
        trigger.setAttribute("aria-expanded", "false");
      };
      const open = () => {
        closePopovers(control);
        popover.hidden = false;
        control.classList.add("is-open");
        trigger.setAttribute("aria-expanded", "true");
      };
      const commit = async (value) => {
        if (!await applyValue(value)) return;
        syncControl(control);
        close();
        requestSync();
        setTimeout(requestSync, 80);
      };
      definition.values.forEach((value) => {
        const option = document.createElement("button");
        option.type = "button";
        option.className = "poe-trade-styler-quick-rarity-option";
        const tone = getRarityTone(value);
        if (tone) option.classList.add(`is-rarity-${tone}`);
        option.dataset.value = value;
        option.textContent = value;
        option.setAttribute("role", "option");
        option.setAttribute("aria-selected", "false");
        option.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          void commit(value);
        });
        popover.append(option);
      });
      const reset = document.createElement("button");
      reset.type = "button";
      reset.className = "poe-trade-styler-quick-rarity-reset";
      reset.textContent = "Reset";
      reset.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        void commit("");
      });
      popover.append(reset);
      control.addEventListener("pointerenter", open);
      control.addEventListener("pointerleave", close);
      control.addEventListener("focusin", open);
      control.addEventListener("focusout", (event) => {
        if (!control.contains(event.relatedTarget)) close();
      });
      trigger.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        void commit("");
      });
      trigger.addEventListener("keydown", (event) => {
        if (event.key !== "ArrowDown") return;
        event.preventDefault();
        open();
        popover.querySelector(
          '.poe-trade-styler-quick-rarity-option[aria-selected="true"], .poe-trade-styler-quick-rarity-option'
        )?.focus({ preventScroll: true });
      });
      control.append(trigger, popover);
      syncControl(control);
      return control;
    }
    return { createControl, syncControl };
  }

  // src/content/quick-filter-value.ts
  function createQuickValueBadge(doc) {
    const badge = doc.createElement("span");
    badge.className = "poe-trade-styler-quick-filter-value";
    badge.hidden = true;
    return badge;
  }
  function syncQuickValueBadge(badge, value) {
    if (badge.textContent !== value) badge.textContent = value;
    badge.dataset.valueWidth = value.length >= 4 ? "extra-wide" : value.length >= 3 ? "wide" : "normal";
    badge.hidden = !value;
  }

  // src/content/quick-number-filter.ts
  function applyNativeQuickNumberValue(filterBody, definition, value, bound, restoreFocusTo) {
    const bounds = "exact" in definition && definition.exact ? ["min", "max"] : [bound];
    const inputs = [];
    for (const targetBound of bounds) {
      const input = filterBody?.querySelector(
        `input[placeholder="${targetBound}"]`
      );
      if (!input) return false;
      inputs.push(input);
    }
    if (!restoreFocusTo) inputs[0].focus();
    for (const input of inputs) {
      input.value = value;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
    if (!restoreFocusTo) inputs.at(-1)?.blur();
    return true;
  }
  function configureQuickNumberGrid(popover, definition) {
    const columnCount = definition.columns ?? Math.min(5, Math.max(1, Math.ceil(definition.values.length / 10)));
    popover.style.setProperty(
      "--poe-trade-styler-quick-number-columns",
      String(columnCount)
    );
    popover.style.setProperty(
      "--poe-trade-styler-quick-number-rows",
      String(Math.ceil(definition.values.length / columnCount))
    );
  }
  function hasSelectedGem(gemData, normalizeText) {
    const searchText = normalizeText(getCurrentSearchText());
    return gemData.GEM_DEFINITIONS.some(
      (gem) => normalizeText(gem.name) === searchText || normalizeText(gem.searchText) === searchText
    );
  }
  function readQuickNumberValue(filterBody, definition) {
    const minimum = filterBody?.querySelector('input[placeholder="min"]')?.value.trim() || "";
    if (!definition.exact) return minimum;
    const maximum = filterBody?.querySelector('input[placeholder="max"]')?.value.trim() || "";
    return minimum && minimum === maximum ? minimum : "";
  }
  function setQuickNumberControlVisibility(control, definition, gemSelected) {
    const hidden = Boolean(definition.gemOnly && !gemSelected);
    control.hidden = hidden;
    if (!hidden || !control.classList.contains("is-open")) return;
    control.classList.remove("is-open");
    const popover = control.querySelector(
      ".poe-trade-styler-quick-number-popover"
    );
    const trigger = control.querySelector(
      ".poe-trade-styler-quick-number-trigger"
    );
    if (popover) popover.hidden = true;
    trigger?.setAttribute("aria-expanded", "false");
  }

  // src/content/hover-number-input.ts
  function createHoverNumberInputController() {
    let hoveredInput = null;
    return {
      enable(input) {
        input.addEventListener("pointerenter", () => {
          hoveredInput = input;
        });
        input.addEventListener("pointerleave", () => {
          if (hoveredInput === input) hoveredInput = null;
        });
      },
      handleKeyDown(event) {
        const input = hoveredInput;
        const isDigit = event.key.length === 1 && event.key >= "0" && event.key <= "9";
        if (!input || !input.isConnected || input.disabled || input.readOnly || input === input.ownerDocument.activeElement || event.isComposing || event.altKey || event.ctrlKey || event.metaKey || !isDigit && event.key !== "Backspace") {
          return false;
        }
        input.value = isDigit ? `${input.value}${event.key}` : input.value.slice(0, -1);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        event.preventDefault();
        event.stopPropagation();
        return true;
      }
    };
  }

  // src/content/quick-filters.ts
  function createQuickFiltersFeature({
    gemData,
    styler,
    normalizeText,
    waitForElement
  }) {
    const normalizeStatFilterText = normalizeText;
    const QUICK_BOUND_FILTERS = styler.QUICK_BOUND_FILTERS;
    let quickFilterSyncScheduled = false;
    let quickFilterGroupToggleInProgress = false;
    const hoverNumberInput = createHoverNumberInputController();
    const pendingQuickFilterGroupEnables = /* @__PURE__ */ new Map();
    function getQuickFilterBody(label) {
      return getFilterBodyByLabel(label, normalizeStatFilterText);
    }
    function getQuickFilterGroupToggle(filterBody) {
      return getQuickFilterGroup(filterBody)?.querySelector(
        ":scope > .filter-group-header .toggle-btn"
      ) ?? null;
    }
    function getQuickFilterGroup(filterBody) {
      let group = filterBody?.closest(".filter-group") || null;
      while (group) {
        if (group.querySelector(
          ":scope > .filter-group-header .toggle-btn"
        )) {
          return group;
        }
        group = group.parentElement?.closest(".filter-group") || null;
      }
      return null;
    }
    function isQuickFilterGroupEnabled(filterBody) {
      const toggle = getQuickFilterGroupToggle(filterBody);
      return !toggle || !toggle.classList.contains("off");
    }
    function setQuickFilterGroupEnabled(filterBody, enabled) {
      const toggle = getQuickFilterGroupToggle(filterBody);
      if (toggle && toggle.classList.contains("off") === enabled) {
        quickFilterGroupToggleInProgress = true;
        try {
          toggle.click();
        } finally {
          quickFilterGroupToggleInProgress = false;
        }
      }
    }
    function setQuickFilterGroupExpanded(filterBody) {
      const group = getQuickFilterGroup(filterBody);
      if (group && !group.classList.contains("expanded")) {
        quickFilterGroupToggleInProgress = true;
        try {
          group.querySelector(
            ":scope > .filter-group-header .filter-title-clickable, :scope > .filter-group-header .filter-title"
          )?.click();
        } finally {
          quickFilterGroupToggleInProgress = false;
        }
      }
    }
    function getQuickFilterGroupKey(filterBody, fallbackLabel) {
      const group = getQuickFilterGroup(filterBody);
      const title = group?.querySelector(
        ":scope > .filter-group-header .filter-title-clickable, :scope > .filter-group-header .filter-title"
      )?.textContent;
      return normalizeStatFilterText(title || fallbackLabel);
    }
    async function ensureQuickFilterGroupEnabled(label) {
      const initialBody = getQuickFilterBody(label);
      if (!initialBody) {
        return null;
      }
      const groupKey = getQuickFilterGroupKey(initialBody, label);
      const pendingEnable = pendingQuickFilterGroupEnables.get(groupKey);
      if (pendingEnable) {
        await pendingEnable;
        const currentBody2 = getQuickFilterBody(label);
        return isQuickFilterGroupEnabled(currentBody2) ? currentBody2 : null;
      }
      const enable = (async () => {
        let currentBody2 = getQuickFilterBody(label) || initialBody;
        if (!isQuickFilterGroupEnabled(currentBody2)) {
          setQuickFilterGroupEnabled(currentBody2, true);
          currentBody2 = await waitForElement(() => {
            const candidate = getQuickFilterBody(label);
            return isQuickFilterGroupEnabled(candidate) ? candidate : null;
          }, 20) || currentBody2;
        }
        if (!isQuickFilterGroupEnabled(currentBody2)) {
          return;
        }
        setQuickFilterGroupExpanded(currentBody2);
        const group = getQuickFilterGroup(currentBody2);
        if (group && !group.classList.contains("expanded")) {
          await waitForElement(() => {
            const candidate = getQuickFilterBody(label);
            const candidateGroup = getQuickFilterGroup(candidate);
            return candidate && isQuickFilterGroupEnabled(candidate) && candidateGroup?.classList.contains("expanded") ? candidate : null;
          }, 20);
        }
      })();
      pendingQuickFilterGroupEnables.set(groupKey, enable);
      try {
        await enable;
      } finally {
        if (pendingQuickFilterGroupEnables.get(groupKey) === enable) {
          pendingQuickFilterGroupEnables.delete(groupKey);
        }
      }
      const currentBody = getQuickFilterBody(label);
      return isQuickFilterGroupEnabled(currentBody) ? currentBody : null;
    }
    function readQuickBooleanState(definition) {
      const filterBody = getQuickFilterBody(definition.label);
      if (!isQuickFilterGroupEnabled(filterBody)) {
        return "any";
      }
      const renderedValue = normalizeStatFilterText(
        getRenderedSelectValue(filterBody) || filterBody?.querySelector(".multiselect__input")?.value || filterBody?.querySelector(".multiselect__input")?.placeholder || "any"
      );
      if (renderedValue === "yes" || renderedValue === "true") {
        return "yes";
      }
      if (renderedValue === "no" || renderedValue === "false") {
        return "no";
      }
      return "any";
    }
    function setQuickBooleanControlState(control, definition, state) {
      const stateLabel = { any: "Any", yes: "Yes", no: "No" }[state];
      control.dataset.state = state;
      control.classList.toggle("is-any", state === "any");
      control.classList.toggle("is-yes", state === "yes");
      control.classList.toggle("is-no", state === "no");
      control.title = `Quick Miscellaneous filter: ${definition.label}. Current: ${stateLabel}. Click to cycle Any \u2192 Yes \u2192 No.`;
      control.setAttribute(
        "aria-label",
        `${definition.label}: ${stateLabel}. Click to change.`
      );
    }
    async function applyQuickBooleanState(definition, state) {
      let filterBody = getQuickFilterBody(definition.label);
      const targetText = { any: "Any", yes: "Yes", no: "No" }[state];
      if (state !== "any") {
        filterBody = await ensureQuickFilterGroupEnabled(definition.label);
        if (!filterBody) {
          return false;
        }
      }
      const findOption = () => {
        filterBody = getQuickFilterBody(definition.label) || filterBody;
        return [...filterBody?.querySelectorAll(
          ".multiselect__option:not(.multiselect__option--disabled)"
        ) || []].find(
          (candidate) => normalizeStatFilterText(candidate.textContent || "") === normalizeStatFilterText(targetText)
        ) ?? null;
      };
      const option = findOption() || await waitForElement(findOption, 20);
      if (!option) {
        return false;
      }
      option.click();
      if (state !== "any") {
        await waitForElement(
          () => readQuickBooleanState(definition) === state ? getQuickFilterBody(definition.label) : null,
          20
        );
      }
      return true;
    }
    function createQuickFilterIcon(definition) {
      const icon = document.createElement("img");
      icon.className = "poe-trade-styler-quick-filter-icon";
      icon.src = getSafeItemImageUrl(definition.icon);
      icon.alt = "";
      icon.setAttribute("aria-hidden", "true");
      return icon;
    }
    function createQuickBooleanControl(definition) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "poe-trade-styler-quick-filter poe-trade-styler-quick-filter-boolean";
      button.dataset.quickFilter = definition.key;
      button.append(createQuickFilterIcon(definition));
      setQuickBooleanControlState(button, definition, "any");
      button.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        const nextState = styler.getNextQuickBooleanState(button.dataset.state);
        if (await applyQuickBooleanState(definition, nextState)) {
          setQuickBooleanControlState(button, definition, nextState);
          button.blur();
          requestQuickFilterSync();
          setTimeout(requestQuickFilterSync, 80);
        }
      });
      return button;
    }
    function setQuickNumberControlValue(control, definition, value) {
      const trigger = control.querySelector(
        ".poe-trade-styler-quick-number-trigger"
      );
      const badge = control.querySelector(
        ".poe-trade-styler-quick-filter-value"
      );
      const resetButton = control.querySelector(
        ".poe-trade-styler-quick-number-reset"
      );
      const input = control.querySelector(
        ".poe-trade-styler-quick-number-input"
      );
      if (!trigger || !badge) return;
      control.dataset.value = value;
      trigger.classList.toggle("is-empty", !value);
      trigger.classList.toggle("is-enabled", Boolean(value));
      control.querySelectorAll(".poe-trade-styler-quick-number-option").forEach((option) => {
        const selected = option.dataset.value === value;
        option.classList.toggle("is-selected", selected);
        option.setAttribute("aria-selected", String(selected));
      });
      syncQuickValueBadge(badge, value);
      if (input && input !== document.activeElement && input.value !== value) {
        input.value = value;
      }
      if (resetButton) resetButton.disabled = !value;
      trigger.title = value ? `${definition.shortLabel}: ${value}. Click to disable.` : `${definition.shortLabel}: disabled. Hover to choose.`;
      trigger.setAttribute(
        "aria-label",
        value ? `${definition.shortLabel}: ${value}. Click to disable.` : `${definition.shortLabel}: disabled`
      );
    }
    async function applyQuickNumberValue(definition, value, bound = "min", restoreFocusTo = null) {
      let filterBody = getQuickFilterBody(definition.label);
      if (value) {
        filterBody = await ensureQuickFilterGroupEnabled(definition.label);
      }
      return applyNativeQuickNumberValue(
        filterBody,
        definition,
        value,
        bound,
        restoreFocusTo
      );
    }
    function createQuickNumberControl(definition) {
      const control = document.createElement("div");
      control.className = "poe-trade-styler-quick-number-filter";
      control.dataset.quickFilter = definition.key;
      const trigger = document.createElement("button");
      trigger.type = "button";
      trigger.className = "poe-trade-styler-quick-filter poe-trade-styler-quick-filter-number poe-trade-styler-quick-number-trigger is-empty";
      trigger.setAttribute("aria-haspopup", "dialog");
      trigger.setAttribute("aria-expanded", "false");
      trigger.append(createQuickFilterIcon(definition));
      trigger.append(createQuickValueBadge(document));
      const popover = document.createElement("div");
      const titleId = `poe-trade-styler-quick-number-title-${definition.key}`;
      popover.className = "poe-trade-styler-quick-number-popover";
      popover.hidden = true;
      popover.setAttribute("role", "dialog");
      popover.setAttribute("aria-labelledby", titleId);
      const title = document.createElement("strong");
      title.id = titleId;
      title.className = "poe-trade-styler-quick-number-title";
      title.textContent = definition.shortLabel;
      const close = () => {
        popover.hidden = true;
        control.classList.remove("is-open");
        trigger.setAttribute("aria-expanded", "false");
      };
      const open = () => {
        closeQuickBoundPopovers(control);
        popover.hidden = false;
        control.classList.add("is-open");
        trigger.setAttribute("aria-expanded", "true");
      };
      const commitValue = async (value, closePopover = false, restoreFocusTo = null) => {
        if (await applyQuickNumberValue(
          definition,
          value,
          "min",
          restoreFocusTo
        )) {
          if (closePopover) {
            control.querySelector(
              ".poe-trade-styler-quick-number-input"
            )?.blur();
          }
          setQuickNumberControlValue(control, definition, value);
          requestQuickFilterSync();
          setTimeout(requestQuickFilterSync, 80);
          if (closePopover) {
            trigger.focus({ preventScroll: true });
            closeQuickBoundPopovers();
          }
        }
      };
      let initialFocusTarget = null;
      if (definition.min != null && definition.max != null) {
        const input = document.createElement("input");
        const isValidInputValue = (value) => {
          if (value === "") return true;
          const number = Number(value);
          return Number.isInteger(number) && number >= definition.min && number <= definition.max;
        };
        input.className = "poe-trade-styler-quick-number-input";
        input.type = "number";
        input.inputMode = "numeric";
        input.step = "1";
        input.min = String(definition.min);
        input.max = String(definition.max);
        input.placeholder = `${definition.min}\u2013${definition.max}`;
        input.setAttribute("aria-label", definition.shortLabel);
        hoverNumberInput.enable(input);
        input.addEventListener("input", () => {
          if (isValidInputValue(input.value)) {
            void commitValue(input.value, false, input);
          }
        });
        input.addEventListener("keydown", (event) => {
          if (event.key === "Enter" && isValidInputValue(input.value)) {
            event.preventDefault();
            event.stopPropagation();
            void commitValue(input.value, true, input);
          }
        });
        initialFocusTarget = input;
        popover.append(input);
      }
      const options = document.createElement("div");
      options.className = "poe-trade-styler-quick-number-options";
      options.setAttribute("role", "listbox");
      options.setAttribute("aria-label", `${definition.shortLabel} values`);
      configureQuickNumberGrid(popover, definition);
      definition.values.forEach((value) => {
        const option = document.createElement("button");
        option.type = "button";
        option.className = "poe-trade-styler-quick-number-option";
        option.dataset.value = value;
        option.setAttribute("role", "option");
        option.setAttribute("aria-selected", "false");
        option.textContent = value;
        option.addEventListener("click", async (event) => {
          event.preventDefault();
          event.stopPropagation();
          await commitValue(value, true);
        });
        option.addEventListener("keydown", (event) => {
          const optionButtons = [
            ...options.querySelectorAll(
              ".poe-trade-styler-quick-number-option"
            )
          ];
          const currentIndex = optionButtons.indexOf(option);
          let nextIndex = currentIndex;
          if (event.key === "ArrowDown") nextIndex++;
          if (event.key === "ArrowUp") nextIndex--;
          if (event.key === "Home") nextIndex = 0;
          if (event.key === "End") nextIndex = optionButtons.length - 1;
          if (nextIndex !== currentIndex) {
            event.preventDefault();
            optionButtons[Math.max(0, Math.min(optionButtons.length - 1, nextIndex))]?.focus({ preventScroll: true });
          }
        });
        options.append(option);
      });
      initialFocusTarget ||= options.querySelector("button");
      popover.append(options);
      const resetButton = document.createElement("button");
      resetButton.type = "button";
      resetButton.className = "poe-trade-styler-quick-number-reset";
      resetButton.textContent = "Reset";
      resetButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        void commitValue("", true);
      });
      popover.prepend(title);
      popover.append(resetButton);
      control.addEventListener("pointerenter", open);
      control.addEventListener("pointerleave", close);
      control.addEventListener("focusin", open);
      control.addEventListener("focusout", (event) => {
        if (!control.contains(event.relatedTarget)) close();
      });
      trigger.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (control.dataset.value) {
          void commitValue("", true);
        } else {
          close();
        }
      });
      trigger.addEventListener("keydown", (event) => {
        if (event.key !== "ArrowDown") return;
        event.preventDefault();
        open();
        const selectedOption = options.querySelector(
          '.poe-trade-styler-quick-number-option[aria-selected="true"]'
        );
        (initialFocusTarget || selectedOption)?.focus({ preventScroll: true });
      });
      control.append(trigger, popover);
      setQuickNumberControlValue(control, definition, "");
      return control;
    }
    function setQuickBoundControlValue(control, definition, value) {
      const input = control.querySelector("input");
      const trigger = control.querySelector(
        ".poe-trade-styler-quick-bound-trigger"
      );
      const badge = control.querySelector(
        ".poe-trade-styler-quick-filter-value"
      );
      if (!input || !trigger || !badge) return;
      input.value = value;
      control.dataset.value = value;
      control.classList.toggle("is-empty", !value);
      control.classList.toggle("is-enabled", Boolean(value));
      trigger.classList.toggle("is-empty", !value);
      trigger.classList.toggle("is-enabled", Boolean(value));
      syncQuickValueBadge(badge, value);
      trigger.title = value ? `${definition.shortLabel}: ${value}. Click to disable.` : `${definition.shortLabel}: disabled. Hover to enter a value.`;
      trigger.setAttribute(
        "aria-label",
        value ? `${definition.shortLabel}: ${value}. Click to disable.` : `${definition.shortLabel}: disabled`
      );
      input.setAttribute(
        "aria-label",
        `${definition.shortLabel}: ${value || "empty"}`
      );
    }
    function closeQuickBoundPopovers(exceptControl = null) {
      let closed = false;
      document.querySelectorAll(
        ".poe-trade-styler-quick-number-filter.is-open, .poe-trade-styler-quick-bound-filter.is-open, .poe-trade-styler-quick-rarity-filter.is-open"
      ).forEach((control) => {
        if (control === exceptControl) {
          return;
        }
        control.classList.remove("is-open");
        const popover = control.querySelector(
          ".poe-trade-styler-quick-number-popover, .poe-trade-styler-quick-bound-popover, .poe-trade-styler-quick-rarity-popover"
        );
        const trigger = control.querySelector(
          ".poe-trade-styler-quick-number-trigger, .poe-trade-styler-quick-bound-trigger, .poe-trade-styler-quick-rarity-trigger"
        );
        if (popover) popover.hidden = true;
        trigger?.setAttribute("aria-expanded", "false");
        closed = true;
      });
      return closed;
    }
    function createQuickBoundControl(definition) {
      const control = document.createElement("div");
      control.className = "poe-trade-styler-quick-bound-filter is-empty";
      control.dataset.quickFilter = definition.key;
      const trigger = document.createElement("button");
      trigger.type = "button";
      trigger.className = "poe-trade-styler-quick-filter poe-trade-styler-quick-bound-trigger is-empty";
      trigger.setAttribute("aria-haspopup", "dialog");
      trigger.setAttribute("aria-expanded", "false");
      const icon = document.createElement("span");
      icon.className = `poe-trade-styler-quick-bound-icon is-${definition.tone}`;
      icon.textContent = definition.icon;
      icon.setAttribute("aria-hidden", "true");
      trigger.append(icon, createQuickValueBadge(document));
      const popover = document.createElement("div");
      const titleId = `poe-trade-styler-quick-bound-title-${definition.key}`;
      popover.className = "poe-trade-styler-quick-bound-popover";
      popover.hidden = true;
      popover.setAttribute("role", "dialog");
      popover.setAttribute("aria-labelledby", titleId);
      const title = document.createElement("strong");
      title.id = titleId;
      title.className = "poe-trade-styler-quick-bound-title";
      title.textContent = definition.shortLabel;
      const close = () => {
        popover.hidden = true;
        control.classList.remove("is-open");
        trigger.setAttribute("aria-expanded", "false");
      };
      const open = () => {
        closeQuickBoundPopovers(control);
        popover.hidden = false;
        control.classList.add("is-open");
        trigger.setAttribute("aria-expanded", "true");
        input.value = control.dataset.value || "";
      };
      const input = document.createElement("input");
      input.type = "number";
      input.inputMode = "numeric";
      input.step = "1";
      input.min = String(definition.min ?? 0);
      if (definition.max != null) {
        input.max = String(definition.max);
      }
      input.placeholder = definition.bound;
      hoverNumberInput.enable(input);
      const commitValue = async (value, closePopover = false) => {
        const normalizedValue = styler.normalizeQuickBoundValue(
          definition,
          value
        );
        input.value = normalizedValue;
        if (await applyQuickNumberValue(
          definition,
          normalizedValue,
          definition.bound,
          input
        )) {
          setQuickBoundControlValue(control, definition, normalizedValue);
          requestQuickFilterSync();
          setTimeout(requestQuickFilterSync, 80);
          if (closePopover) {
            trigger.focus({ preventScroll: true });
            closeQuickBoundPopovers();
          }
        }
      };
      input.addEventListener("input", () => {
        void commitValue(input.value);
      });
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          event.stopPropagation();
          void commitValue(input.value, true);
        }
      });
      const actions = document.createElement("div");
      actions.className = "poe-trade-styler-quick-bound-actions";
      const resetButton = document.createElement("button");
      resetButton.type = "button";
      resetButton.className = "poe-trade-styler-quick-bound-action is-reset";
      resetButton.textContent = "\xD7";
      resetButton.title = `Reset ${definition.shortLabel.toLowerCase()}`;
      resetButton.setAttribute(
        "aria-label",
        `Reset ${definition.shortLabel.toLowerCase()}`
      );
      resetButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        void commitValue("", true);
      });
      actions.append(input, resetButton);
      popover.append(title, actions);
      control.addEventListener("pointerenter", open);
      control.addEventListener("pointerleave", close);
      control.addEventListener("focusin", open);
      control.addEventListener("focusout", (event) => {
        if (!control.contains(event.relatedTarget)) close();
      });
      trigger.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (control.dataset.value) {
          void commitValue("", true);
        } else {
          close();
        }
      });
      trigger.addEventListener("keydown", (event) => {
        if (event.key !== "ArrowDown") return;
        event.preventDefault();
        open();
        input.focus({ preventScroll: true });
        input.select();
      });
      control.append(trigger, popover);
      setQuickBoundControlValue(control, definition, "");
      return control;
    }
    const rarityFilter = createQuickRarityFilterFeature({
      closePopovers: closeQuickBoundPopovers,
      definition: QUICK_RARITY_FILTER,
      ensureGroupEnabled: () => ensureQuickFilterGroupEnabled(QUICK_RARITY_FILTER.label),
      getFilterBody: () => getQuickFilterBody(QUICK_RARITY_FILTER.label),
      isGroupEnabled: isQuickFilterGroupEnabled,
      normalizeText: normalizeStatFilterText,
      requestSync: requestQuickFilterSync,
      waitForElement
    });
    function syncQuickFilters() {
      const strip = document.querySelector(
        "#trade > .top .poe-trade-styler-quick-filters"
      );
      if (!strip) {
        return;
      }
      const rarityControl = strip.querySelector(
        '[data-quick-filter="rarity"]'
      );
      if (rarityControl) rarityFilter.syncControl(rarityControl);
      QUICK_BOOLEAN_FILTERS.forEach((definition) => {
        const control = strip.querySelector(
          `[data-quick-filter="${definition.key}"]`
        );
        if (control) {
          setQuickBooleanControlState(
            control,
            definition,
            readQuickBooleanState(definition)
          );
        }
      });
      const gemSelected = hasSelectedGem(gemData, normalizeStatFilterText);
      QUICK_NUMBER_FILTERS.forEach((definition) => {
        const control = strip.querySelector(
          `[data-quick-filter="${definition.key}"]`
        );
        const filterBody = getQuickFilterBody(definition.label);
        const value = isQuickFilterGroupEnabled(filterBody) ? readQuickNumberValue(filterBody, definition) : "";
        if (control) {
          setQuickNumberControlVisibility(control, definition, gemSelected);
          setQuickNumberControlValue(control, definition, value);
        }
      });
      QUICK_BOUND_FILTERS.forEach((definition) => {
        const control = strip.querySelector(
          `[data-quick-filter="${definition.key}"]`
        );
        const filterBody = getQuickFilterBody(definition.label);
        const value = isQuickFilterGroupEnabled(filterBody) && filterBody?.querySelector(
          `input[placeholder="${definition.bound}"]`
        )?.value?.trim() || "";
        if (control && !control.classList.contains("is-open")) {
          setQuickBoundControlValue(control, definition, value);
        }
      });
    }
    function requestQuickFilterSync() {
      if (quickFilterSyncScheduled) {
        return;
      }
      quickFilterSyncScheduled = true;
      requestAnimationFrame(() => {
        quickFilterSyncScheduled = false;
        syncQuickFilters();
      });
    }
    function decorateQuickFilters() {
      const controls = document.querySelector("#trade > .top .controls");
      const controlsParent = controls?.parentElement;
      if (!controls || !controlsParent) {
        return;
      }
      const existing = controlsParent.querySelector(
        ":scope > .poe-trade-styler-quick-filters"
      );
      if (existing) {
        syncQuickFilters();
        return;
      }
      document.querySelectorAll("#trade .poe-trade-styler-quick-filters").forEach((strip2) => strip2.remove());
      const strip = document.createElement("div");
      strip.className = "poe-trade-styler-quick-filters";
      strip.setAttribute("role", "group");
      strip.setAttribute("aria-label", "Quick filters");
      QUICK_BOUND_FILTERS.forEach(
        (definition) => strip.append(createQuickBoundControl(definition))
      );
      QUICK_BOOLEAN_FILTERS.forEach(
        (definition) => strip.append(createQuickBooleanControl(definition))
      );
      QUICK_NUMBER_FILTERS.forEach(
        (definition) => strip.append(createQuickNumberControl(definition))
      );
      strip.append(rarityFilter.createControl());
      controlsParent.insertBefore(strip, controls);
      syncQuickFilters();
    }
    return {
      closeBoundPopovers: closeQuickBoundPopovers,
      decorate: decorateQuickFilters,
      handleKeyDown: hoverNumberInput.handleKeyDown,
      isGroupToggleInProgress: () => quickFilterGroupToggleInProgress,
      requestSync: requestQuickFilterSync
    };
  }

  // src/content/settings/model.ts
  var DEFAULT_SETTINGS = Object.freeze({
    disableBackground: true,
    fullWidthScreen: true,
    gemItemFavorites: [],
    hideIrrelevantAffixes: true,
    rightSpaceForBetterTrading: true,
    statFilterFavorites: [],
    stickySearchPanel: true,
    twoColumnLayout: true,
    uniqueItemFavorites: []
  });

  // src/content/settings/controller.ts
  var SETTINGS_STORAGE_KEY = "poe-trade-helper-settings";
  function createSettingsFeature(dependencies) {
    const doc = dependencies.document ?? document;
    const storage = dependencies.storage ?? chrome.storage.local;
    const state = {
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
    closeButton.textContent = "\xD7";
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
    };
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
    function createOption(id, labelText, description) {
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
    function apply() {
      for (const [key, option] of Object.entries(options)) {
        option.checkbox.checked = state[key];
      }
      dependencies.onApply(state);
    }
    function persist() {
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
      }
    }
    function loadStoredSettings(value) {
      if (!value || typeof value !== "object") return;
      const stored = value;
      for (const key of [
        "disableBackground",
        "fullWidthScreen",
        "hideIrrelevantAffixes",
        "rightSpaceForBetterTrading",
        "stickySearchPanel",
        "twoColumnLayout"
      ]) {
        if (typeof stored[key] === "boolean") {
          state[key] = stored[key];
        }
      }
      if (Array.isArray(stored.statFilterFavorites)) {
        state.statFilterFavorites = stored.statFilterFavorites.filter(
          (favorite) => typeof favorite === "string"
        );
      }
      if (Array.isArray(stored.gemItemFavorites)) {
        state.gemItemFavorites = stored.gemItemFavorites.filter(
          (favorite) => typeof favorite === "string"
        );
      }
      if (Array.isArray(stored.uniqueItemFavorites)) {
        state.uniqueItemFavorites = stored.uniqueItemFavorites.filter(
          (favorite) => typeof favorite === "string"
        );
      }
    }
    function open() {
      modal.hidden = false;
      launcher.setAttribute("aria-expanded", "true");
      doc.documentElement.classList.add("poe-trade-styler-modal-open");
      dialog.focus();
    }
    function close() {
      modal.hidden = true;
      launcher.setAttribute("aria-expanded", "false");
      doc.documentElement.classList.remove("poe-trade-styler-modal-open");
      launcher.focus();
    }
    function mount() {
      if (mounted) {
        return;
      }
      doc.body.append(launcher, modal);
      launcher.addEventListener("click", open);
      closeButton.addEventListener("click", close);
      modal.addEventListener("click", onModalClick);
      for (const [key, option] of Object.entries(options)) {
        option.checkbox.addEventListener("change", () => {
          state[key] = option.checkbox.checked;
          apply();
          persist();
        });
      }
      mounted = true;
    }
    function start() {
      apply();
      try {
        storage.get({ [SETTINGS_STORAGE_KEY]: null }, (items) => {
          loadStoredSettings(items[SETTINGS_STORAGE_KEY]);
          apply();
        });
      } catch {
      }
    }
    function onModalClick(event) {
      if (event.target === modal) {
        close();
      }
    }
    function handleEscape() {
      if (modal.hidden) {
        return false;
      }
      close();
      return true;
    }
    function destroy() {
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

  // src/content/stat-filters/catalog.ts
  function normalizeOptionText(value) {
    return value.replace(/\s+/g, " ").trim();
  }
  function isPseudoStatOption(option) {
    return String(option.type || option.id.split(".")[0] || "").trim().toLowerCase() === "pseudo";
  }
  function excludePseudoStatOptions(options) {
    return options.filter((option) => !isPseudoStatOption(option));
  }
  function comparePseudoStatOptions(left, right) {
    const sortText = (text) => text.normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
    return sortText(left.text).localeCompare(sortText(right.text), void 0, {
      numeric: true,
      sensitivity: "base"
    }) || left.text.localeCompare(right.text, void 0, { sensitivity: "base" }) || left.id.localeCompare(right.id);
  }
  function getPseudoStatOptions(catalog) {
    const options = /* @__PURE__ */ new Map();
    Object.values(catalog).forEach((entry) => {
      const id = String(entry.id || "").replace(/^stat\./, "");
      const type = String(entry.type || id.split(".")[0] || "").trim().toLowerCase();
      const text = normalizeOptionText(String(entry.text || ""));
      if (type !== "pseudo" || !text) return;
      const key = id || `${type}::${text.toLowerCase()}`;
      if (!options.has(key)) {
        options.set(key, { id, text, type: "pseudo", group: "pseudo" });
      }
    });
    return [...options.values()].sort(comparePseudoStatOptions);
  }
  function appendPseudoStatOptions(itemOptions, catalog) {
    const nonPseudoOptions = [];
    const pseudoOptions = /* @__PURE__ */ new Map();
    const addPseudoOption = (option) => {
      const text = normalizeOptionText(option.text);
      const key = option.id || `pseudo::${text.toLowerCase()}`;
      pseudoOptions.set(key, {
        ...option,
        text,
        type: "pseudo",
        group: "pseudo"
      });
    };
    itemOptions.forEach((option) => {
      if (isPseudoStatOption(option)) {
        addPseudoOption(option);
      } else {
        nonPseudoOptions.push(option);
      }
    });
    getPseudoStatOptions(catalog).forEach(addPseudoOption);
    return [
      ...nonPseudoOptions,
      ...[...pseudoOptions.values()].sort(comparePseudoStatOptions)
    ];
  }
  function createPresetStatCatalogService({
    charmData,
    fetch: fetchCatalog = fetch,
    flaskData,
    gearData,
    jewelData,
    onChange,
    styler,
    tabletData,
    waystoneData
  }) {
    const catalogRequests = /* @__PURE__ */ new Map();
    let charmOptions = [];
    let flaskOptions = [];
    let gearOptions = [];
    let jewelOptions = [];
    let waystoneOptions = excludePseudoStatOptions(
      waystoneData.getWaystoneStatOptions()
    );
    let tabletOptions = [];
    let waystoneCatalogRequested = false;
    let charmBaseKey = null;
    let charmCatalogBaseKey = null;
    let flaskBaseKey = null;
    let flaskCatalogBaseKey = null;
    let gearSelectionKey = null;
    let gearCatalogSelectionKey = null;
    let gearSlotKey = null;
    let gearBaseKey = null;
    let gearItemKey = null;
    let jewelBaseKey = null;
    let jewelCatalogBaseKey = null;
    let tabletBaseKey = null;
    let tabletCatalogBaseKey = null;
    function loadCatalog() {
      const catalogUrl = "/api/trade2/data/stats";
      if (!catalogRequests.has(catalogUrl)) {
        catalogRequests.set(
          catalogUrl,
          fetchCatalog(catalogUrl, { credentials: "same-origin" }).then((response) => {
            if (!response.ok) {
              throw new Error(`Stat catalog request failed: ${response.status}`);
            }
            return response.json();
          }).then((payload) => styler.indexTradeStats(payload)).catch(() => null)
        );
      }
      return catalogRequests.get(catalogUrl);
    }
    function setTabletBase(baseKey) {
      tabletBaseKey = baseKey;
      tabletOptions = excludePseudoStatOptions(
        tabletData.getTabletStatOptions(baseKey)
      );
      tabletCatalogBaseKey = null;
    }
    function setCharmBase(baseKey) {
      charmBaseKey = baseKey;
      charmOptions = excludePseudoStatOptions(
        charmData.getCharmStatOptions(baseKey)
      );
      charmCatalogBaseKey = null;
    }
    function setFlaskBase(baseKey) {
      flaskBaseKey = baseKey;
      flaskOptions = excludePseudoStatOptions(
        flaskData.getFlaskStatOptions(baseKey)
      );
      flaskCatalogBaseKey = null;
    }
    function setGearSelection(slotKey, baseKey, itemKey) {
      gearSlotKey = slotKey;
      gearBaseKey = baseKey;
      gearItemKey = itemKey;
      gearSelectionKey = JSON.stringify([slotKey, baseKey, itemKey]);
      gearOptions = [];
      gearCatalogSelectionKey = null;
    }
    function setJewelBase(baseKey) {
      jewelBaseKey = baseKey;
      jewelOptions = jewelData.getJewelStatOptions(baseKey);
      jewelCatalogBaseKey = null;
    }
    function requestWaystoneCatalog() {
      if (waystoneCatalogRequested) return;
      waystoneCatalogRequested = true;
      void loadCatalog().then((catalog) => {
        if (!catalog) return;
        waystoneOptions = excludePseudoStatOptions(
          waystoneData.getWaystoneStatOptions(Object.values(catalog))
        );
        onChange();
      });
    }
    function requestTabletCatalog(baseKey) {
      if (!baseKey || tabletCatalogBaseKey === baseKey) return;
      tabletCatalogBaseKey = baseKey;
      void loadCatalog().then((catalog) => {
        if (!catalog || tabletBaseKey !== baseKey) return;
        tabletOptions = excludePseudoStatOptions(
          tabletData.getTabletStatOptions(baseKey, Object.values(catalog))
        );
        onChange();
      });
    }
    function requestCharmCatalog(baseKey) {
      if (!baseKey || charmCatalogBaseKey === baseKey) return;
      charmCatalogBaseKey = baseKey;
      void loadCatalog().then((catalog) => {
        if (!catalog || charmBaseKey !== baseKey) return;
        charmOptions = excludePseudoStatOptions(
          charmData.getCharmStatOptions(baseKey, Object.values(catalog))
        );
        onChange();
      });
    }
    function requestFlaskCatalog(baseKey) {
      if (!baseKey || flaskCatalogBaseKey === baseKey) return;
      flaskCatalogBaseKey = baseKey;
      void loadCatalog().then((catalog) => {
        if (!catalog || flaskBaseKey !== baseKey) return;
        flaskOptions = excludePseudoStatOptions(
          flaskData.getFlaskStatOptions(baseKey, Object.values(catalog))
        );
        onChange();
      });
    }
    function requestGearCatalog(slotKey, baseKey, itemKey) {
      const selectionKey = JSON.stringify([slotKey, baseKey, itemKey]);
      if (!slotKey || gearCatalogSelectionKey === selectionKey) return;
      gearCatalogSelectionKey = selectionKey;
      void loadCatalog().then((catalog) => {
        if (!catalog || gearSelectionKey !== selectionKey) return;
        gearOptions = appendPseudoStatOptions(
          gearData.getGearStatOptions(
            slotKey,
            baseKey,
            itemKey,
            Object.values(catalog)
          ),
          catalog
        );
        onChange();
      });
    }
    function requestJewelCatalog(baseKey) {
      if (!baseKey || jewelCatalogBaseKey === baseKey) return;
      jewelCatalogBaseKey = baseKey;
      void loadCatalog().then((catalog) => {
        if (!catalog || jewelBaseKey !== baseKey) return;
        jewelOptions = appendPseudoStatOptions(
          jewelData.getJewelStatOptions(baseKey, Object.values(catalog)),
          catalog
        );
        onChange();
      });
    }
    async function getModifierDetails(label, statId) {
      const fallback = {
        id: statId,
        label: styler.getModifierStatTemplate(label),
        type: statId?.split(".")[0] || "explicit"
      };
      if (!statId) return fallback;
      const entry = (await loadCatalog())?.[statId];
      return entry ? { id: entry.id, label: entry.text, type: entry.type || fallback.type } : fallback;
    }
    return {
      getModifierDetails,
      getOptions: (mode) => mode === "charms" ? charmOptions : mode === "flasks" ? flaskOptions : mode === "gems" ? [] : mode === "gear" ? gearOptions : mode === "jewels" ? jewelOptions : mode === "tablets" ? tabletOptions : waystoneOptions,
      requestCharmCatalog,
      requestFlaskCatalog,
      requestGearCatalog,
      requestJewelCatalog,
      requestTabletCatalog,
      requestWaystoneCatalog,
      setCharmBase,
      setFlaskBase,
      setGearSelection,
      setJewelBase,
      setTabletBase
    };
  }

  // src/content/stat-filters/result-modifiers.ts
  function createResultModifiersFeature({
    catalog,
    document: doc = document,
    groups,
    styler
  }) {
    async function addModifier(button, label, statId, target) {
      button.disabled = true;
      button.title = button.dataset.defaultTitle ?? "";
      button.classList.remove("poe-trade-styler-mod-action-error");
      button.classList.add("poe-trade-styler-mod-action-busy");
      let group = target === "not" ? groups.findType("not") : groups.findPositive();
      if (!group) group = await groups.create(target === "not" ? "not" : "and");
      const details = await catalog.getModifierDetails(label, statId);
      const selected = group && await groups.activate(group, details);
      button.disabled = false;
      button.classList.remove("poe-trade-styler-mod-action-busy");
      if (selected) {
        button.classList.add("poe-trade-styler-mod-action-added");
        setTimeout(
          () => button.classList.remove("poe-trade-styler-mod-action-added"),
          900
        );
        return;
      }
      button.classList.add("poe-trade-styler-mod-action-error");
      button.title = `Could not find the matching stat filter for: ${label}`;
    }
    function createAction(label, statId, target) {
      const button = doc.createElement("button");
      const isNot = target === "not";
      button.className = "poe-trade-styler-mod-action";
      button.type = "button";
      button.dataset.symbol = isNot ? "\u2212" : "+";
      button.title = isNot ? "Add this modifier to a NOT stat group" : "Add this modifier to the active AND or Sum stat group";
      button.dataset.defaultTitle = button.title;
      button.setAttribute(
        "aria-label",
        `${isNot ? "Exclude" : "Include"} modifier: ${label}`
      );
      button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        void addModifier(button, label, statId, target);
      });
      return button;
    }
    function decorate() {
      doc.querySelectorAll(
        "#trade .resultset:not(.exchange) .row .explicitMod .lc.s, #trade .resultset:not(.exchange) .row .item-mod--explicit > .lc.s"
      ).forEach((modifier) => {
        if (modifier.querySelector(":scope > .poe-trade-styler-mod-controls")) {
          return;
        }
        const label = modifier.textContent.replace(/\s+/g, " ").trim();
        const statId = styler.getItemModifierStatId(modifier.dataset.field);
        if (!label) return;
        if (statId) void catalog.getModifierDetails(label, statId);
        const controls = doc.createElement("span");
        controls.className = "poe-trade-styler-mod-controls";
        controls.setAttribute("role", "group");
        controls.setAttribute("aria-label", `Actions for ${label}`);
        controls.append(
          createAction(label, statId, "positive"),
          createAction(label, statId, "not")
        );
        modifier.prepend(controls);
      });
    }
    return { decorate };
  }

  // src/content/stat-filters/visibility.ts
  function restoreNativeStatFilters(document2) {
    document2.querySelectorAll(
      ".poe-trade-styler-corruption-option, .poe-trade-styler-waystone-stat-option, .poe-trade-styler-waystone-stat-group"
    ).forEach((element) => element.remove());
    document2.querySelectorAll(
      '#trade > .top input[placeholder="+ Add Stat Filter"]'
    ).forEach((input) => {
      const statFilter = input.closest(".multiselect");
      const statList = statFilter?.querySelector(
        ".multiselect__content"
      );
      statList?.classList.remove("poe-trade-styler-stat-filter-list");
      if (statList) {
        delete statList.dataset.poeTradeStylerCorruptionSignature;
        delete statList.dataset.poeTradeStylerWaystoneSignature;
      }
      statFilter?.querySelectorAll(".multiselect__element").forEach((element) => {
        element.classList.remove(
          "poe-trade-styler-preset-stat-hidden",
          "poe-trade-styler-stat-option-favorite"
        );
        delete element.dataset.poeTradeStylerStatKey;
      });
      statFilter?.querySelectorAll(".poe-trade-styler-stat-favorite").forEach((element) => element.remove());
    });
  }
  function filterFocusedStatOptions({
    document: document2,
    hideIrrelevantAffixes,
    isFocusedFilterActive,
    normalizeText,
    preset
  }) {
    document2.querySelectorAll(
      '#trade > .top input[placeholder="+ Add Stat Filter"]'
    ).forEach((input) => {
      const statFilter = input.closest(".multiselect");
      const query = normalizeText(input.value);
      const optionSelector = hideIrrelevantAffixes && usesCompactPresetCatalog(preset) ? ".poe-trade-styler-waystone-stat-option, .poe-trade-styler-waystone-stat-group" : ".multiselect__element";
      statFilter?.querySelectorAll(optionSelector).forEach((element) => {
        if (!isFocusedFilterActive || !hideIrrelevantAffixes) {
          element.classList.remove("poe-trade-styler-preset-stat-hidden");
          return;
        }
        const isPresetOption = element.classList.contains(
          "poe-trade-styler-waystone-stat-option"
        );
        const isPresetGroup = element.classList.contains(
          "poe-trade-styler-waystone-stat-group"
        );
        const isCorruptionOption = element.classList.contains(
          "poe-trade-styler-corruption-option"
        );
        const isRelevant = (isPresetOption || isCorruptionOption) && (!query || element.dataset.poeTradeStylerWaystoneSearch?.includes(query));
        element.classList.toggle(
          "poe-trade-styler-preset-stat-hidden",
          !isRelevant && !isPresetGroup
        );
      });
      statFilter?.querySelectorAll(
        ".poe-trade-styler-waystone-stat-group"
      ).forEach((header) => {
        if (!hideIrrelevantAffixes) {
          header.classList.remove("poe-trade-styler-preset-stat-hidden");
          return;
        }
        const group = header.dataset.poeTradeStylerWaystoneGroup;
        const hasVisibleOption = [
          ...statFilter.querySelectorAll(
            ".poe-trade-styler-waystone-stat-option"
          )
        ].some(
          (option) => option.dataset.poeTradeStylerWaystoneGroup === group && !option.classList.contains("poe-trade-styler-preset-stat-hidden")
        );
        header.classList.toggle(
          "poe-trade-styler-preset-stat-hidden",
          !hasVisibleOption
        );
      });
    });
  }

  // src/content/stat-filters/controller.ts
  function createStatFiltersFeature({
    charmData,
    corruptionData,
    flaskData,
    gearData,
    isUniqueActive = () => false,
    jewelData,
    persistSettings,
    presetState,
    settings,
    styler,
    tabletData,
    waystoneData
  }) {
    const presetCatalog = createPresetStatCatalogService({
      charmData,
      flaskData,
      gearData,
      jewelData,
      onChange: scheduleDecoration,
      styler,
      tabletData,
      waystoneData
    });
    const normalizeStatFilterText = (value) => value.replace(/\s+/g, " ").trim().toLowerCase();
    function getStatFilterDetails(option) {
      const type = option.querySelector(".mutate-type")?.textContent || "";
      const labelContainer = option.querySelector("div");
      const label = labelContainer?.querySelector(":scope > span")?.textContent || labelContainer?.textContent || "";
      if (!label.trim()) {
        return null;
      }
      return {
        key: `${normalizeStatFilterText(type)}::${normalizeStatFilterText(label)}`,
        label: label.replace(/\s+/g, " ").trim(),
        type: normalizeStatFilterText(type)
      };
    }
    function canonicalStatFilterText(value) {
      return normalizeStatFilterText(value).replace(/\s*\(local\)\s*$/, "").replace(/\breduced\b/g, "increased");
    }
    function scheduleDecoration() {
      requestAnimationFrame(decorateStatFilterOptions);
    }
    function getStatGroupType(statGroup) {
      const header = statGroup.querySelector(".filter-group-header");
      const renderedType = header?.querySelector(
        ".multiselect__single, .filter-group-type, .filter-group-type-select"
      );
      const type = styler.getStatGroupTypeFromText(
        renderedType?.textContent || header?.textContent || ""
      );
      if (type) {
        return type;
      }
      return normalizeStatFilterText(header?.textContent || "") === "stat filters" ? "and" : null;
    }
    function getStatGroups() {
      return [
        ...document.querySelectorAll("#trade > .top .filter-group")
      ].filter(
        (group) => group.querySelector('input[placeholder="+ Add Stat Filter"]')
      );
    }
    function statGroupHasFilters(statGroup) {
      return Boolean(
        statGroup.querySelector(
          ".filter.full-span, .fixture-selected-stat, .filter-group-body > .filter:not(.filter-select-mutate)"
        )
      );
    }
    function findPositiveStatGroup() {
      const positiveTypes = /* @__PURE__ */ new Set(["and", "sum", "sum2"]);
      const candidates = getStatGroups().map((group, index) => ({
        group,
        index,
        type: getStatGroupType(group),
        used: statGroupHasFilters(group)
      })).filter(
        (candidate) => candidate.type !== null && positiveTypes.has(candidate.type)
      );
      candidates.sort((left, right) => {
        if (left.used !== right.used) {
          return Number(right.used) - Number(left.used);
        }
        const typeRank = { and: 1, sum: 2, sum2: 3 };
        return typeRank[right.type] - typeRank[left.type] || right.index - left.index;
      });
      return candidates[0]?.group || null;
    }
    function findStatGroupByType(type) {
      return getStatGroups().find((group) => getStatGroupType(group) === type) ?? null;
    }
    function waitForElement(findElement, attempts = 12) {
      return new Promise((resolve) => {
        let remaining = attempts;
        const check = () => {
          const element = findElement();
          if (element || remaining <= 0) {
            resolve(element || null);
            return;
          }
          remaining -= 1;
          setTimeout(check, 50);
        };
        check();
      });
    }
    async function createStatGroup(type, { requireNew = false } = {}) {
      const groupSelect = document.querySelector(
        "#trade > .top .filter-group-select"
      );
      const groupInput = groupSelect?.querySelector(
        'input[placeholder="+ Add Stat Group"]'
      );
      const optionLabel = type === "not" ? "Not" : "And";
      if (!groupSelect || !groupInput) {
        return null;
      }
      const findGroupOption = () => [...groupSelect.querySelectorAll(
        ".multiselect__option:not(.multiselect__option--disabled), li > span"
      )].find(
        (candidate) => normalizeStatFilterText(candidate.textContent || "") === normalizeStatFilterText(optionLabel)
      ) ?? null;
      groupInput.focus();
      groupInput.click();
      const option = findGroupOption() || await waitForElement(findGroupOption, 20);
      if (!option) {
        return null;
      }
      const previousGroups = new Set(getStatGroups());
      option.click();
      return waitForElement(() => {
        const matchingNewGroup = getStatGroups().find(
          (group) => !previousGroups.has(group) && getStatGroupType(group) === type
        );
        return matchingNewGroup || (requireNew ? null : findStatGroupByType(type));
      });
    }
    function findModifierStatFilterOption(statGroup, statDetails) {
      const targetLabel = styler.normalizeModifierStatText(statDetails.label);
      const candidates = [...statGroup.querySelectorAll(
        ".multiselect__element:not(.poe-trade-styler-waystone-stat-option) .multiselect__option:not(.multiselect__option--disabled)"
      )].map((option) => ({
        option,
        details: getStatFilterDetails(option),
        id: getStatOptionId(option.closest(".multiselect__element"), option)
      })).filter(
        ({ details }) => details && styler.normalizeModifierStatText(details.label) === targetLabel
      );
      const targetId = String(statDetails.id || "").replace(/^stat\./, "");
      const exactIdMatch = targetId && candidates.find(({ id }) => id === targetId);
      if (exactIdMatch) {
        return exactIdMatch.option;
      }
      const preferredTypes = [
        statDetails.type,
        "explicit",
        "pseudo",
        "implicit",
        "enchant"
      ].filter((type, index, types) => type && types.indexOf(type) === index);
      candidates.sort((left, right) => {
        const leftType = normalizeStatFilterText(
          left.option.querySelector(".mutate-type")?.textContent || ""
        );
        const rightType = normalizeStatFilterText(
          right.option.querySelector(".mutate-type")?.textContent || ""
        );
        const leftRank = preferredTypes.indexOf(leftType);
        const rightRank = preferredTypes.indexOf(rightType);
        return (leftRank < 0 ? preferredTypes.length : leftRank) - (rightRank < 0 ? preferredTypes.length : rightRank);
      });
      return candidates[0]?.option || null;
    }
    function statGroupContainsModifier(statGroup, statDetails) {
      const targetLabel = styler.normalizeModifierStatText(statDetails.label);
      return [...statGroup.querySelectorAll(".filter.full-span")].some(
        (row) => styler.normalizeModifierStatText(row.textContent || "").includes(
          targetLabel
        )
      );
    }
    async function activateModifierStatFilter(statGroup, statDetails, searchQuery = statDetails.label) {
      const input = statGroup.querySelector(
        'input[placeholder="+ Add Stat Filter"]'
      );
      if (!input) {
        return false;
      }
      input.focus();
      input.value = searchQuery;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      const option = await waitForElement(
        () => findModifierStatFilterOption(statGroup, statDetails),
        20
      );
      if (!option) {
        return false;
      }
      if (statGroupContainsModifier(statGroup, statDetails)) {
        return true;
      }
      option.click();
      const clickedFilter = await waitForElement(
        () => statGroupContainsModifier(statGroup, statDetails) ? statGroup : null,
        8
      );
      if (clickedFilter) {
        return true;
      }
      input.focus();
      input.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          code: "Enter",
          bubbles: true,
          cancelable: true
        })
      );
      return Boolean(
        await waitForElement(
          () => statGroupContainsModifier(statGroup, statDetails) ? statGroup : null,
          8
        )
      );
    }
    function selectNativeStatFilter(statFilter, label) {
      const targetLabel = canonicalStatFilterText(label);
      const candidates = [
        ...statFilter.querySelectorAll(
          ".multiselect__element:not(.poe-trade-styler-corruption-option) .multiselect__option:not(.multiselect__option--disabled)"
        )
      ].map((option) => ({ option, details: getStatFilterDetails(option) })).filter(
        ({ details }) => details && canonicalStatFilterText(details.label) === targetLabel
      );
      const preferredTypes = ["enchant", "implicit"];
      for (const preferredType of preferredTypes) {
        const candidate = candidates.find(
          ({ option }) => normalizeStatFilterText(
            option.querySelector(".mutate-type")?.textContent || ""
          ) === preferredType
        );
        if (candidate) {
          candidate.option.click();
          return true;
        }
      }
      return false;
    }
    function activateCorruptionStatFilter(statFilter, label) {
      const input = statFilter.querySelector(
        'input[placeholder="+ Add Stat Filter"]'
      );
      if (!input) {
        return;
      }
      input.focus();
      input.value = styler.getCorruptionStatSearchQuery(label);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      let attempts = 0;
      const selectWhenRendered = () => {
        if (selectNativeStatFilter(statFilter, label) || attempts >= 5) {
          return;
        }
        attempts += 1;
        setTimeout(selectWhenRendered, 40);
      };
      requestAnimationFrame(selectWhenRendered);
    }
    function createCorruptionStatOption(statFilter, label, selectedUnique) {
      const element = document.createElement("li");
      element.className = "multiselect__element poe-trade-styler-corruption-option";
      element.dataset.poeTradeStylerWaystoneSearch = normalizeStatFilterText(label);
      const option = document.createElement("span");
      option.className = "multiselect__option";
      option.tabIndex = 0;
      option.setAttribute("role", "option");
      option.title = `Corruption enchantment for ${selectedUnique}`;
      const type = document.createElement("i");
      type.className = "mutate-type mutate-type-enchant poe-trade-styler-corruption-type";
      type.textContent = "enchant";
      const labelContainer = document.createElement("div");
      const labelText = document.createElement("span");
      labelText.textContent = label;
      labelContainer.append(labelText);
      option.append(type, labelContainer);
      element.append(option);
      option.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
      option.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        activateCorruptionStatFilter(statFilter, label);
      });
      option.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          activateCorruptionStatFilter(statFilter, label);
        }
      });
      return element;
    }
    function syncCorruptionStatOptions(statFilter, statList, selectedUnique, corruptionImplicits) {
      const signature = JSON.stringify([selectedUnique, corruptionImplicits]);
      const existing = statList.querySelectorAll(
        ".poe-trade-styler-corruption-option"
      );
      if (statList.dataset.poeTradeStylerCorruptionSignature === signature && existing.length === corruptionImplicits.length) {
        return;
      }
      existing.forEach((element) => element.remove());
      statList.dataset.poeTradeStylerCorruptionSignature = signature;
      const fragment = document.createDocumentFragment();
      corruptionImplicits.forEach((label) => {
        fragment.append(
          createCorruptionStatOption(statFilter, label, selectedUnique)
        );
      });
      statList.prepend(fragment);
    }
    function getStatOptionId(element, option) {
      const carriers = [
        element,
        option,
        ...element?.querySelectorAll(
          "[data-id], [data-stat-id], [data-value]"
        ) ?? []
      ].filter((carrier) => carrier !== null);
      for (const carrier of carriers) {
        for (const attribute of ["data-id", "data-stat-id", "data-value"]) {
          const value = carrier.getAttribute(attribute) || "";
          const match = value.match(
            /(?:stat\.)?([a-z]+\.stat_\d+)/i
          );
          if (match) {
            return match[1];
          }
        }
      }
      return "";
    }
    function createWaystoneStatGroupHeader(type) {
      const element = document.createElement("li");
      element.className = "multiselect__element poe-trade-styler-waystone-stat-group";
      element.dataset.poeTradeStylerWaystoneGroup = type;
      const option = document.createElement("span");
      option.className = "multiselect__option multiselect__option--group multiselect__option--disabled";
      option.textContent = type;
      element.append(option);
      return element;
    }
    function createAffixBadge(affix, extraClass = "") {
      if (affix !== "prefix" && affix !== "suffix") {
        return null;
      }
      const badge = document.createElement("span");
      badge.className = [
        "poe-trade-styler-affix",
        `poe-trade-styler-affix-${affix}`,
        extraClass
      ].filter(Boolean).join(" ");
      badge.textContent = affix === "prefix" ? "P" : "S";
      badge.title = affix === "prefix" ? "Prefix" : "Suffix";
      badge.setAttribute("aria-label", badge.title);
      badge.dataset.poeTradeStylerAffix = affix;
      return badge;
    }
    function createWaystoneStatOption(statFilter, definition) {
      const element = document.createElement("li");
      element.className = "multiselect__element poe-trade-styler-waystone-stat-option";
      element.dataset.statId = definition.id;
      element.dataset.poeTradeStylerWaystoneGroup = definition.group || definition.type;
      element.dataset.poeTradeStylerWaystoneSearch = normalizeStatFilterText(definition.text);
      const option = document.createElement("span");
      option.className = "multiselect__option";
      option.tabIndex = 0;
      option.setAttribute("role", "option");
      const type = document.createElement("i");
      type.className = `mutate-type mutate-type-${definition.type}`;
      type.textContent = definition.type;
      const labelContainer = document.createElement("div");
      const label = document.createElement("span");
      label.textContent = definition.text;
      labelContainer.append(label);
      option.append(type, labelContainer);
      if (definition.affix === "prefix" || definition.affix === "suffix") {
        element.classList.add("poe-trade-styler-preset-affix-stat-option");
        const badge = createAffixBadge(
          definition.affix,
          "poe-trade-styler-preset-affix"
        );
        if (badge) option.append(badge);
      }
      element.append(option);
      const activate = () => {
        const statGroup = statFilter.closest(".filter-group");
        if (statGroup) {
          activateModifierStatFilter(statGroup, {
            id: definition.id,
            label: definition.text,
            type: definition.type
          });
        }
      };
      option.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
      option.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        activate();
      });
      option.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          activate();
        }
      });
      return element;
    }
    function syncWaystonePresetStatOptions(statFilter, statList) {
      const existing = statList.querySelectorAll(
        ".poe-trade-styler-waystone-stat-option, .poe-trade-styler-waystone-stat-group"
      );
      if (!presetState.activePreset) {
        existing.forEach((element) => element.remove());
        delete statList.dataset.poeTradeStylerWaystoneSignature;
        return;
      }
      if (presetState.activePreset === "waystones") {
        presetCatalog.requestWaystoneCatalog();
      } else if (presetState.activePreset === "charms" && presetState.selectedCharmBaseKey) {
        presetCatalog.requestCharmCatalog(presetState.selectedCharmBaseKey);
      } else if (presetState.activePreset === "flasks" && presetState.selectedFlaskBaseKey) {
        presetCatalog.requestFlaskCatalog(presetState.selectedFlaskBaseKey);
      } else if (presetState.activePreset === "gear" && presetState.selectedGearSlotKey) {
        presetCatalog.requestGearCatalog(
          presetState.selectedGearSlotKey,
          presetState.selectedGearBaseKey,
          presetState.selectedGearItemKey
        );
      } else if (presetState.activePreset === "jewels" && presetState.selectedJewelBaseKey) {
        presetCatalog.requestJewelCatalog(presetState.selectedJewelBaseKey);
      } else if (presetState.selectedTabletBaseKey) {
        presetCatalog.requestTabletCatalog(presetState.selectedTabletBaseKey);
      }
      const presetStatOptions = presetCatalog.getOptions(
        presetState.activePreset
      );
      const signature = JSON.stringify(
        [
          presetState.activePreset,
          presetState.selectedCharmBaseKey,
          presetState.selectedFlaskBaseKey,
          presetState.selectedGearSlotKey,
          presetState.selectedGearBaseKey,
          presetState.selectedGearItemKey,
          presetState.selectedJewelBaseKey,
          presetState.selectedTabletBaseKey,
          presetStatOptions.map(({ id, text, type, group, affix }) => [
            id,
            text,
            type,
            group,
            affix
          ])
        ]
      );
      if (statList.dataset.poeTradeStylerWaystoneSignature === signature && existing.length > 0) {
        return;
      }
      existing.forEach((element) => element.remove());
      statList.dataset.poeTradeStylerWaystoneSignature = signature;
      const fragment = document.createDocumentFragment();
      let renderedGroup = null;
      presetStatOptions.forEach((definition) => {
        const group = definition.group || definition.type;
        if (group !== renderedGroup) {
          renderedGroup = group;
          fragment.append(createWaystoneStatGroupHeader(renderedGroup));
        }
        fragment.append(createWaystoneStatOption(statFilter, definition));
      });
      statList.prepend(fragment);
    }
    function filterStatOptionsForPreset() {
      if (!settings.hideIrrelevantAffixes) {
        restoreNativeStatFilters(document);
        return;
      }
      filterFocusedStatOptions({
        document,
        hideIrrelevantAffixes: true,
        isFocusedFilterActive: Boolean(
          presetState.activePreset || isUniqueActive()
        ),
        normalizeText: normalizeStatFilterText,
        preset: presetState.activePreset
      });
    }
    function decorateStatFilterOptions() {
      const statFilters = [
        ...document.querySelectorAll(
          '#trade > .top input[placeholder="+ Add Stat Filter"]'
        )
      ].map((input) => input.closest(".multiselect")).filter((filter) => filter !== null);
      if (statFilters.length === 0) {
        return;
      }
      if (!settings.hideIrrelevantAffixes) {
        restoreNativeStatFilters(document);
        return;
      }
      const favorites = new Set(settings.statFilterFavorites);
      const selectedUnique = styler.getTradeGameKey(location.pathname) === "poe2" ? getCurrentSearchText() : "";
      const corruptionImplicits = corruptionData.getCorruptionImplicits(
        selectedUnique
      );
      const sortForPreset = Boolean(presetState.activePreset);
      statFilters.forEach((statFilter) => {
        const statList = statFilter.querySelector(
          ".multiselect__content"
        );
        const statInput = statFilter.querySelector(
          'input[placeholder="+ Add Stat Filter"]'
        );
        if (statInput && statFilter.dataset.poeTradeStylerPresetFilterBound !== "true") {
          statInput.addEventListener("input", filterStatOptionsForPreset);
          statFilter.dataset.poeTradeStylerPresetFilterBound = "true";
        }
        statList?.classList.toggle(
          "poe-trade-styler-stat-filter-list",
          sortForPreset
        );
        if (statList) {
          syncCorruptionStatOptions(
            statFilter,
            statList,
            selectedUnique,
            corruptionImplicits
          );
          syncWaystonePresetStatOptions(statFilter, statList);
        }
        const nativeOptions = usesCompactPresetCatalog(presetState.activePreset) ? [] : [
          ...statFilter.querySelectorAll(
            ".multiselect__element:not(.poe-trade-styler-corruption-option):not(.poe-trade-styler-waystone-stat-option):not(.poe-trade-styler-waystone-stat-group)"
          )
        ];
        nativeOptions.forEach((element) => {
          const option = element.querySelector(
            ".multiselect__option:not(.multiselect__option--disabled)"
          );
          const details = option && getStatFilterDetails(option);
          if (!details) {
            return;
          }
          element.dataset.poeTradeStylerStatKey = details.key;
          let favoriteButton = option.querySelector(
            ".poe-trade-styler-stat-favorite"
          );
          if (!favoriteButton) {
            favoriteButton = document.createElement("button");
            favoriteButton.className = "poe-trade-styler-stat-favorite";
            favoriteButton.type = "button";
            option.append(favoriteButton);
            favoriteButton.addEventListener("pointerdown", (event) => {
              event.preventDefault();
              event.stopPropagation();
            });
            favoriteButton.addEventListener("click", (event) => {
              event.preventDefault();
              event.stopPropagation();
              const key = element.dataset.poeTradeStylerStatKey;
              if (!key) return;
              const nextFavorites = new Set(settings.statFilterFavorites);
              if (nextFavorites.has(key)) {
                nextFavorites.delete(key);
              } else {
                nextFavorites.add(key);
              }
              settings.statFilterFavorites = [...nextFavorites];
              decorateStatFilterOptions();
              persistSettings();
            });
          }
          const isFavorite = favorites.has(details.key);
          element.classList.toggle(
            "poe-trade-styler-stat-option-favorite",
            isFavorite
          );
          const favoriteSymbol = isFavorite ? "\u2605" : "\u2606";
          if (favoriteButton.textContent !== favoriteSymbol) {
            favoriteButton.textContent = favoriteSymbol;
          }
          favoriteButton.setAttribute("aria-pressed", String(isFavorite));
          favoriteButton.setAttribute(
            "aria-label",
            `${isFavorite ? "Remove" : "Add"} ${details.label} ${isFavorite ? "from" : "to"} favorites`
          );
          favoriteButton.title = isFavorite ? "Remove from favorites" : "Add to favorites";
        });
      });
      filterStatOptionsForPreset();
    }
    const resultModifiers = createResultModifiersFeature({
      catalog: presetCatalog,
      groups: {
        activate: activateModifierStatFilter,
        create: createStatGroup,
        findPositive: findPositiveStatGroup,
        findType: findStatGroupByType
      },
      styler
    });
    return {
      activateModifierStatFilter,
      createStatGroup,
      decorateOptions: decorateStatFilterOptions,
      decorateResultModifiers: resultModifiers.decorate,
      filterForPreset: filterStatOptionsForPreset,
      findStatGroupByType,
      getStatGroupType,
      normalizeText: normalizeStatFilterText,
      setCharmBase: presetCatalog.setCharmBase,
      setFlaskBase: presetCatalog.setFlaskBase,
      setGearSelection: presetCatalog.setGearSelection,
      setJewelBase: presetCatalog.setJewelBase,
      setTabletBase: presetCatalog.setTabletBase,
      waitForElement
    };
  }

  // src/content/unique-helper/composition.ts
  var DAMAGE_TYPES = ["Physical", "Fire", "Cold", "Lightning", "Chaos"];
  var DEFENCE_NAMES = ["Armour", "Evasion Rating", "Energy Shield"];
  var ROLL_SOURCE = String.raw`(\([^)]+\)|[+\-]?\d+(?:\.\d+)?)`;
  function parseRoll(value) {
    const normalized = String(value || "").trim().replace(/^\(|\)$/g, "");
    const range = normalized.match(
      /^([+\-]?\d+(?:\.\d+)?)\s*-\s*([+\-]?\d+(?:\.\d+)?)$/
    );
    if (range) return { low: Number(range[1]), high: Number(range[2]) };
    const number = normalized.match(/^[+\-]?\d+(?:\.\d+)?/);
    return number ? { low: Number(number[0]), high: Number(number[0]) } : null;
  }
  function parseDamage(value) {
    const abstract = value.match(/^\s*(\([^)]+\))\s+to\s+(\([^)]+\))\s*$/i);
    if (abstract) {
      const minimum = parseRoll(abstract[1]);
      const maximum = parseRoll(abstract[2]);
      return minimum && maximum ? { minimum, maximum } : null;
    }
    const exact = value.match(/^\s*([\d.]+)\s*-\s*([\d.]+)\s*$/);
    return exact ? {
      minimum: { low: Number(exact[1]), high: Number(exact[1]) },
      maximum: { low: Number(exact[2]), high: Number(exact[2]) }
    } : null;
  }
  function addRoll(left, right) {
    return { low: left.low + right.low, high: left.high + right.high };
  }
  function multiplyRoll(left, percent) {
    return {
      low: left.low * (1 + percent.low / 100),
      high: left.high * (1 + percent.high / 100)
    };
  }
  function addPercent(target, amount, direction) {
    const sign = direction.toLowerCase() === "reduced" ? -1 : 1;
    target.low += sign * amount.low;
    target.high += sign * amount.high;
  }
  function cleanNumber(value, decimals = 2) {
    const factor = 10 ** decimals;
    const rounded = Math.round((value + Number.EPSILON) * factor) / factor;
    return String(rounded);
  }
  function formatRoll(roll, { decimals = 2, round = false } = {}) {
    const format = (value) => cleanNumber(round ? Math.round(value) : value, decimals);
    return roll.low === roll.high ? format(roll.low) : `${format(roll.low)}-${format(roll.high)}`;
  }
  function formatDamage(damage) {
    const minimum = formatRoll(damage.minimum, { round: true });
    const maximum = formatRoll(damage.maximum, { round: true });
    return damage.minimum.low === damage.minimum.high && damage.maximum.low === damage.maximum.high ? `${minimum}-${maximum}` : `(${minimum}) to (${maximum})`;
  }
  function splitProperties(properties) {
    return Object.fromEntries(
      properties.flatMap((property) => {
        const separator = property.indexOf(":");
        return separator === -1 ? [] : [[property.slice(0, separator).trim(), property.slice(separator + 1).trim()]];
      })
    );
  }
  function composeProperties(baseProperties, uniqueMods) {
    const rawStats = splitProperties(baseProperties);
    const damages = /* @__PURE__ */ new Map();
    const defences = /* @__PURE__ */ new Map();
    const defencePercents = new Map(
      DEFENCE_NAMES.map((name) => [name, { low: 0, high: 0 }])
    );
    const physicalPercent = { low: 0, high: 0 };
    const attackSpeedPercent = { low: 0, high: 0 };
    const criticalPercent = { low: 0, high: 0 };
    const blockPercent = { low: 0, high: 0 };
    let criticalFlat = { low: 0, high: 0 };
    let criticalOverride = null;
    let blockFlat = { low: 0, high: 0 };
    let forceZeroDefences = false;
    for (const type of DAMAGE_TYPES) {
      const damage = parseDamage(rawStats[`${type} Damage`] || "");
      if (damage) damages.set(type, damage);
    }
    for (const name of DEFENCE_NAMES) {
      const defence = parseRoll(rawStats[name] || "");
      if (defence) defences.set(name, defence);
    }
    for (const rawMod of uniqueMods) {
      const mod = rawMod.replace(/\s*,\s*/g, ", ");
      let match = mod.match(
        new RegExp(
          `^Adds\\s+${ROLL_SOURCE}\\s+to\\s+${ROLL_SOURCE}\\s+(Physical|Fire|Cold|Lightning|Chaos)\\s+Damage$`,
          "i"
        )
      );
      if (match && damages.size > 0) {
        const type = match[3][0].toUpperCase() + match[3].slice(1).toLowerCase();
        const minimum = parseRoll(match[1]);
        const maximum = parseRoll(match[2]);
        if (!minimum || !maximum) continue;
        const damage = damages.get(type) || {
          minimum: { low: 0, high: 0 },
          maximum: { low: 0, high: 0 }
        };
        damage.minimum = addRoll(damage.minimum, minimum);
        damage.maximum = addRoll(damage.maximum, maximum);
        damages.set(type, damage);
        continue;
      }
      match = mod.match(
        new RegExp(`^${ROLL_SOURCE}\\s*%\\s+(increased|reduced)\\s+Physical Damage$`, "i")
      );
      if (match && damages.has("Physical")) {
        const amount = parseRoll(match[1]);
        if (amount) addPercent(physicalPercent, amount, match[2]);
        continue;
      }
      match = mod.match(
        new RegExp(`^${ROLL_SOURCE}\\s*%\\s+(increased|reduced)\\s+Attack Speed$`, "i")
      );
      if (match && rawStats["Attacks per Second"]) {
        const amount = parseRoll(match[1]);
        if (amount) addPercent(attackSpeedPercent, amount, match[2]);
        continue;
      }
      match = mod.match(new RegExp(`^\\+${ROLL_SOURCE}\\s*%\\s+to\\s+Critical Hit Chance$`, "i"));
      if (match && rawStats["Critical Hit Chance"]) {
        const amount = parseRoll(match[1]);
        if (amount) criticalFlat = addRoll(criticalFlat, amount);
        continue;
      }
      match = mod.match(new RegExp(`^${ROLL_SOURCE}\\s*%\\s+increased\\s+Critical Hit Chance$`, "i"));
      if (match && rawStats["Critical Hit Chance"]) {
        const amount = parseRoll(match[1]);
        if (amount) addPercent(criticalPercent, amount, "increased");
        continue;
      }
      match = mod.match(
        new RegExp(`^This Weapon's Critical Hit Chance is ${ROLL_SOURCE}\\s*%$`, "i")
      );
      if (match && rawStats["Critical Hit Chance"]) {
        criticalOverride = parseRoll(match[1]);
        continue;
      }
      match = mod.match(
        new RegExp(
          `^\\+${ROLL_SOURCE}\\s+to\\s+(Armour|Evasion Rating|(?:maximum )?Energy Shield)$`,
          "i"
        )
      );
      if (match) {
        const defenceName = /^maximum Energy Shield$/i.test(match[2]) ? "Energy Shield" : match[2];
        const amount = parseRoll(match[1]);
        if (amount && defences.has(defenceName)) {
          defences.set(defenceName, addRoll(defences.get(defenceName), amount));
          continue;
        }
      }
      match = mod.match(new RegExp(`^${ROLL_SOURCE}\\s*%\\s+(increased|reduced)\\s+(.+)$`, "i"));
      if (match && !/\b(?:Global|when|while|per)\b/i.test(mod)) {
        const amount = parseRoll(match[1]);
        const affected = DEFENCE_NAMES.filter(
          (name) => match[3].includes(name === "Evasion Rating" ? "Evasion" : name)
        );
        if (amount && affected.length > 0) {
          for (const name of affected) {
            addPercent(defencePercents.get(name), amount, match[2]);
          }
          continue;
        }
      }
      match = mod.match(new RegExp(`^\\+${ROLL_SOURCE}\\s*%\\s+to\\s+Block chance$`, "i"));
      if (match && rawStats["Block chance"]) {
        const amount = parseRoll(match[1]);
        if (amount) blockFlat = addRoll(blockFlat, amount);
        continue;
      }
      match = mod.match(new RegExp(`^${ROLL_SOURCE}\\s*%\\s+increased\\s+Block chance$`, "i"));
      if (match && rawStats["Block chance"]) {
        const amount = parseRoll(match[1]);
        if (amount) addPercent(blockPercent, amount, "increased");
        continue;
      }
      if (/^(?:Your )?Armour\s*,?\s*Evasion and Energy Shield are zero$/i.test(mod)) {
        forceZeroDefences = true;
      }
    }
    if (damages.has("Physical")) {
      const physical = damages.get("Physical");
      physical.minimum = multiplyRoll(physical.minimum, physicalPercent);
      physical.maximum = multiplyRoll(physical.maximum, physicalPercent);
    }
    const properties = [];
    for (const type of DAMAGE_TYPES) {
      const damage = damages.get(type);
      if (damage) properties.push(`${type} Damage: ${formatDamage(damage)}`);
    }
    const critical = parseRoll(rawStats["Critical Hit Chance"] || "");
    if (critical) {
      const value = criticalOverride || multiplyRoll(addRoll(critical, criticalFlat), criticalPercent);
      properties.push(`Critical Hit Chance: ${formatRoll(value)}%`);
    }
    const attacks = parseRoll(rawStats["Attacks per Second"] || "");
    if (attacks) {
      properties.push(
        `Attacks per Second: ${formatRoll(multiplyRoll(attacks, attackSpeedPercent))}`
      );
    }
    if (rawStats["Reload Time"]) properties.push(`Reload Time: ${rawStats["Reload Time"]}`);
    if (rawStats["Weapon Range"]) properties.push(`Weapon Range: ${rawStats["Weapon Range"]}`);
    for (const name of DEFENCE_NAMES) {
      const defence = defences.get(name);
      if (!defence) continue;
      const value = forceZeroDefences ? { low: 0, high: 0 } : multiplyRoll(defence, defencePercents.get(name));
      properties.push(`${name}: ${formatRoll(value, { round: true })}`);
    }
    const block = parseRoll(rawStats["Block chance"] || "");
    if (block) {
      properties.push(
        `Block Chance: ${formatRoll(multiplyRoll(addRoll(block, blockFlat), blockPercent))}%`
      );
    }
    for (const [name, value] of Object.entries(rawStats)) {
      if (DAMAGE_TYPES.some((type) => name === `${type} Damage`)) continue;
      if ([
        "Critical Hit Chance",
        "Attacks per Second",
        "Reload Time",
        "Weapon Range",
        "Block chance",
        ...DEFENCE_NAMES
      ].includes(name)) {
        continue;
      }
      properties.push(`${name}: ${value}`);
    }
    return properties;
  }
  function getPropertyStyle(property) {
    if (/^Physical Damage:/i.test(property)) return 1;
    if (/^Fire Damage:/i.test(property)) return 4;
    if (/^Cold Damage:/i.test(property)) return 5;
    if (/^Lightning Damage:/i.test(property)) return 6;
    if (/^Chaos Damage:/i.test(property)) return 7;
    return property.includes(":") ? 0 : null;
  }
  function composeRequirements(requirements, uniqueMods) {
    const values = /* @__PURE__ */ new Map();
    const order = [];
    for (const part of requirements.replace(/^Requires:\s*/i, "").split(/,\s*/)) {
      const match = part.match(/^(?:Level\s+)?(-?\d+(?:\.\d+)?)\s*(Str|Dex|Int)?$/i);
      if (!match) continue;
      const key = match[2] || "Level";
      values.set(key, { low: Number(match[1]), high: Number(match[1]) });
      order.push(key);
    }
    const attributeNames = /* @__PURE__ */ new Map([
      ["Strength", "Str"],
      ["Dexterity", "Dex"],
      ["Intelligence", "Int"]
    ]);
    const allPercent = { low: 0, high: 0 };
    const attributePercents = new Map(
      [...attributeNames.values()].map((key) => [key, { low: 0, high: 0 }])
    );
    const attributeFlats = new Map(
      [...attributeNames.values()].map((key) => [key, { low: 0, high: 0 }])
    );
    let noAttributeRequirements = false;
    for (const mod of uniqueMods) {
      if (/^Has no Attribute Requirements$/i.test(mod)) {
        noAttributeRequirements = true;
        continue;
      }
      let match = mod.match(
        new RegExp(
          `^(?:Equipment and Skill Gems have\\s+)?${ROLL_SOURCE}\\s*%\\s+(increased|reduced)\\s+Attribute Requirements$`,
          "i"
        )
      );
      if (match) {
        const amount = parseRoll(match[1]);
        if (amount) addPercent(allPercent, amount, match[2]);
        continue;
      }
      match = mod.match(
        new RegExp(`^${ROLL_SOURCE}\\s*%\\s+(increased|reduced)\\s+(Strength|Dexterity|Intelligence) Requirement$`, "i")
      );
      if (match) {
        const amount = parseRoll(match[1]);
        if (amount) addPercent(attributePercents.get(attributeNames.get(match[3])), amount, match[2]);
        continue;
      }
      match = mod.match(
        /^([+\-](?:\([^)]+\)|\d+(?:\.\d+)?))\s+(Strength|Dexterity|Intelligence) Requirement$/i
      );
      if (match) {
        const amount = parseRoll(match[1]);
        const key = attributeNames.get(match[2]);
        if (amount && key) attributeFlats.set(key, addRoll(attributeFlats.get(key), amount));
      }
    }
    if (noAttributeRequirements) {
      for (const key of attributeNames.values()) values.delete(key);
    } else {
      for (const key of attributeNames.values()) {
        const flat = attributeFlats.get(key);
        if (!values.has(key) && flat.low === 0 && flat.high === 0) continue;
        const base = values.get(key) || { low: 0, high: 0 };
        const percent = addRoll(allPercent, attributePercents.get(key));
        values.set(key, addRoll(multiplyRoll(base, percent), flat));
        if (!order.includes(key)) order.push(key);
      }
    }
    const parts = order.filter((key, index) => order.indexOf(key) === index && values.has(key)).map((key) => {
      const value = formatRoll(values.get(key));
      return key === "Level" ? `Level ${value}` : `${value} ${key}`;
    });
    return `Requires: ${parts.join(", ")}`;
  }
  function composeRuneforgedView(variant, uniqueMods) {
    const properties = composeProperties(variant.properties, uniqueMods);
    return {
      properties,
      propertyStyles: properties.map(getPropertyStyle),
      requirements: composeRequirements(variant.requirements, uniqueMods)
    };
  }

  // src/content/unique-helper/catalogue.ts
  function getEntryVariant(entry) {
    return entry.variantIndex >= 0 ? entry.item.runeforging[entry.variantIndex] || null : null;
  }
  function getEntryLevel(entry) {
    const variant = getEntryVariant(entry);
    const requirementLevel = variant?.requirements.match(/\bLevel\s+(\d+)/i);
    return variant?.level ?? (requirementLevel ? Number(requirementLevel[1]) : entry.item.level);
  }
  function getDistinctVariantIndexes(item) {
    const seen = /* @__PURE__ */ new Set();
    return item.runeforging.flatMap((variant, index) => {
      const identity = JSON.stringify([
        variant.key,
        variant.label,
        variant.requirements,
        variant.properties,
        variant.implicitMods,
        variant.cost
      ]);
      if (seen.has(identity)) return [];
      seen.add(identity);
      return [index];
    });
  }
  function createEntries(item, listForgedSeparately) {
    const entries = [{ item, variantIndex: -1 }];
    if (!listForgedSeparately) return entries;
    return entries.concat(
      getDistinctVariantIndexes(item).map((variantIndex) => ({
        item,
        variantIndex
      }))
    );
  }
  function matchesFilters(entry, filters) {
    const item = entry.item;
    const variant = getEntryVariant(entry);
    const level = getEntryLevel(entry);
    if (filters.minimumRequiredLevel !== null && level < filters.minimumRequiredLevel) {
      return false;
    }
    if (filters.maximumRequiredLevel !== null && level > filters.maximumRequiredLevel) {
      return false;
    }
    if (!filters.searchQuery) return true;
    const searchableText = [
      item.name,
      item.base,
      item.type,
      item.requirements,
      ...item.baseProperties,
      ...item.baseImplicitMods,
      ...item.mods,
      ...item.flavourText,
      ...variant ? [
        variant.label,
        variant.requirements,
        ...variant.properties,
        ...variant.implicitMods,
        variant.cost
      ] : []
    ].join(" ").toLocaleLowerCase();
    return searchableText.includes(filters.searchQuery);
  }
  function filterUniqueEntries(items, listForgedSeparately, filters) {
    return items.flatMap((item) => createEntries(item, listForgedSeparately)).filter((entry) => matchesFilters(entry, filters));
  }
  function sortUniqueEntries(entries) {
    return entries.sort(
      (left, right) => getEntryLevel(left) - getEntryLevel(right) || left.item.name.localeCompare(right.item.name) || (getEntryVariant(left)?.label || left.item.base).localeCompare(
        getEntryVariant(right)?.label || right.item.base
      )
    );
  }

  // src/content/unique-helper/favorites.ts
  var UNIQUE_FAVORITES_TYPE = "__favorites__";
  function createUniqueFavorites({
    onChange,
    persistSettings,
    settings
  }) {
    function getItems(items) {
      const favoriteKeys = new Set(settings.uniqueItemFavorites);
      return items.filter((item) => favoriteKeys.has(item.key));
    }
    function createButton(doc, item) {
      const button = doc.createElement("button");
      const isFavorite = settings.uniqueItemFavorites.includes(item.key);
      button.className = "poe-trade-styler-unique-result-favorite";
      button.type = "button";
      button.classList.toggle("is-active", isFavorite);
      button.textContent = isFavorite ? "\u2605" : "\u2606";
      button.title = isFavorite ? "Remove from Favorites" : "Add to Favorites";
      button.setAttribute(
        "aria-label",
        isFavorite ? `Remove ${item.name} from Favorites` : `Add ${item.name} to Favorites`
      );
      button.setAttribute("aria-pressed", String(isFavorite));
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const favoriteKeys = new Set(settings.uniqueItemFavorites);
        if (favoriteKeys.has(item.key)) {
          favoriteKeys.delete(item.key);
        } else {
          favoriteKeys.add(item.key);
        }
        settings.uniqueItemFavorites = [...favoriteKeys];
        persistSettings();
        onChange();
      });
      return button;
    }
    return { createButton, getItems };
  }

  // src/content/unique-helper/item-text.ts
  function appendTextElement(doc, parent, tagName, className, text) {
    const element = doc.createElement(tagName);
    element.className = className;
    element.textContent = text;
    parent.append(element);
    return element;
  }
  var ITEM_NUMBER_PATTERN = /[+\-]?(?:\([+\-]?\d+(?:\.\d+)?-[+\-]?\d+(?:\.\d+)?\)|\d+(?:\.\d+)?-[+\-]?\d+(?:\.\d+)?|\d+(?:\.\d+)?)(?:%|m)?/g;
  function appendModifierText(doc, parent, value) {
    let cursor = 0;
    for (const match of value.matchAll(ITEM_NUMBER_PATTERN)) {
      const index = match.index ?? 0;
      if (index > cursor) parent.append(doc.createTextNode(value.slice(cursor, index)));
      const token = doc.createElement("span");
      token.className = "poe-trade-styler-item-token poe-trade-styler-item-token-value";
      token.textContent = match[0];
      parent.append(token);
      cursor = index + match[0].length;
    }
    if (cursor < value.length) parent.append(doc.createTextNode(value.slice(cursor)));
  }
  function appendPropertyText(doc, parent, value, style) {
    const colon = value.indexOf(":");
    if (colon === -1) {
      parent.textContent = value;
      return;
    }
    parent.append(doc.createTextNode(value.slice(0, colon + 1)));
    const propertyValue = doc.createElement("span");
    const styleClass = (/* @__PURE__ */ new Map([
      [0, "default"],
      [1, "augmented"],
      [4, "fire"],
      [5, "cold"],
      [6, "lightning"],
      [7, "chaos"]
    ])).get(style) || "default";
    propertyValue.className = `poe-trade-styler-property-value poe-trade-styler-property-value-${styleClass}`;
    propertyValue.textContent = value.slice(colon + 1);
    parent.append(propertyValue);
  }
  function appendRequirementText(doc, parent, value) {
    const colon = value.indexOf(":");
    if (colon === -1) {
      parent.textContent = value;
      return;
    }
    parent.append(doc.createTextNode(value.slice(0, colon + 1)));
    const requirementValue = doc.createElement("span");
    requirementValue.className = "poe-trade-styler-requirement-value";
    requirementValue.textContent = value.slice(colon + 1);
    parent.append(requirementValue);
  }
  function appendImplicitText(doc, parent, value) {
    const skill = value.match(/^(Grants Skill:)(.*)$/i);
    if (!skill) {
      appendModifierText(doc, parent, value);
      return;
    }
    parent.append(doc.createTextNode(skill[1]));
    const skillName = doc.createElement("span");
    skillName.className = "poe-trade-styler-skill-value";
    skillName.textContent = skill[2];
    parent.append(skillName);
  }

  // src/content/unique-helper/controller.ts
  var TYPE_ORDER = [
    "One Hand Swords",
    "Two Hand Swords",
    "One Hand Axes",
    "Two Hand Axes",
    "One Hand Maces",
    "Two Hand Maces",
    "Sceptres",
    "Spears",
    "Quarterstaves",
    "Staves",
    "Wands",
    "Bows",
    "Crossbows",
    "Claws",
    "Daggers",
    "Flails",
    "Traps",
    "Quivers",
    "Shields",
    "Bucklers",
    "Foci",
    "Helmets",
    "Body Armours",
    "Gloves",
    "Boots",
    "Amulets",
    "Rings",
    "Belts",
    "Talismans",
    "Jewels",
    "Life Flasks",
    "Mana Flasks",
    "Charms",
    "Relics",
    "Tablets",
    "Other"
  ];
  function sortTypes(types) {
    return [...types].sort((left, right) => {
      const leftIndex = TYPE_ORDER.indexOf(left);
      const rightIndex = TYPE_ORDER.indexOf(right);
      const normalizedLeft = leftIndex === -1 ? TYPE_ORDER.length : leftIndex;
      const normalizedRight = rightIndex === -1 ? TYPE_ORDER.length : rightIndex;
      return normalizedLeft - normalizedRight || left.localeCompare(right);
    });
  }
  function createUniqueHelperFeature({
    corruptionData,
    document: doc = document,
    isActive = () => false,
    onDeactivate = async () => void 0,
    onBeforeOpen = async () => true,
    onSearchItem = async () => false,
    persistSettings = () => void 0,
    settings = { uniqueItemFavorites: [] },
    styler,
    uniqueData
  }) {
    const types = sortTypes(uniqueData.UNIQUE_TYPES);
    const variantIndexes = /* @__PURE__ */ new Map();
    let selectedType = types[0] || "";
    let searchQuery = "";
    let minimumRequiredLevel = null;
    let maximumRequiredLevel = null;
    let listForgedSeparately = false;
    let tooltipSequence = 0;
    let itemSearchInProgress = false;
    let launcherToggleInProgress = false;
    let prepareSearchPromise = null;
    let launcher = null;
    let modal = null;
    let typeList = null;
    let results = null;
    const favorites = createUniqueFavorites({
      onChange: () => {
        renderTypes();
        renderResults();
      },
      persistSettings,
      settings
    });
    function isPoe2Page() {
      return styler.getTradeGameKey(location.pathname) === "poe2" || doc.body.dataset.fixtureGame === "poe2";
    }
    function getFilteredEntries(type) {
      return filterUniqueEntries(
        type === UNIQUE_FAVORITES_TYPE ? favorites.getItems(uniqueData.UNIQUE_ITEMS) : uniqueData.getItemsByType(type),
        listForgedSeparately,
        {
          maximumRequiredLevel,
          minimumRequiredLevel,
          searchQuery
        }
      );
    }
    function getVisibleTypes() {
      const visibleTypes = types.filter(
        (type) => getFilteredEntries(type).length > 0
      );
      return favorites.getItems(uniqueData.UNIQUE_ITEMS).length > 0 ? [UNIQUE_FAVORITES_TYPE, ...visibleTypes] : visibleTypes;
    }
    function ensureSelectedType() {
      const visibleTypes = getVisibleTypes();
      if (!visibleTypes.includes(selectedType)) selectedType = visibleTypes[0] || "";
    }
    function getEntries() {
      return sortUniqueEntries(getFilteredEntries(selectedType));
    }
    function getVariantIndex(item) {
      return variantIndexes.get(item.key) ?? -1;
    }
    function getVariant(item, variantIndex = getVariantIndex(item)) {
      return variantIndex >= 0 ? item.runeforging[variantIndex] || null : null;
    }
    function appendLineGroup(parent, title, lines, className, propertyStyles = []) {
      if (lines.length === 0) return;
      const group = doc.createElement("section");
      group.className = `poe-trade-styler-unique-result-section ${className}`;
      group.setAttribute("aria-label", title);
      for (const [index, text] of lines.entries()) {
        const line = doc.createElement("div");
        line.className = "poe-trade-styler-unique-result-line";
        if (className.includes("result-properties")) {
          appendPropertyText(doc, line, text, propertyStyles[index] ?? null);
        } else if (className.includes("result-requirements")) {
          appendRequirementText(doc, line, text);
        } else if (className.includes("result-implicits")) {
          appendImplicitText(doc, line, text);
        } else if (className.includes("result-mods")) {
          appendModifierText(doc, line, text);
        } else {
          line.textContent = text;
        }
        group.append(line);
      }
      parent.append(group);
    }
    function createCorruptionInfo(corruptedImplicits) {
      const corruptionInfo = doc.createElement("div");
      corruptionInfo.className = "poe-trade-styler-unique-corruption-implicit-info";
      corruptionInfo.tabIndex = 0;
      corruptionInfo.setAttribute(
        "aria-label",
        `Possible corrupted implicits for ${selectedType}`
      );
      appendTextElement(
        doc,
        corruptionInfo,
        "span",
        "poe-trade-styler-unique-corruption-implicit-label",
        "Corrupted implicits"
      );
      const corruptionTooltip = doc.createElement("div");
      corruptionTooltip.className = "poe-trade-styler-unique-corruption-implicit-tooltip";
      corruptionTooltip.id = `poe-trade-styler-unique-corruption-tooltip-${++tooltipSequence}`;
      corruptionTooltip.setAttribute("role", "tooltip");
      corruptionInfo.setAttribute("aria-describedby", corruptionTooltip.id);
      appendLineGroup(
        corruptionTooltip,
        "Possible corrupted implicits",
        corruptedImplicits,
        "poe-trade-styler-unique-result-mods poe-trade-styler-unique-corruption-implicit-list"
      );
      corruptionInfo.append(corruptionTooltip);
      return corruptionInfo;
    }
    function getTypeCorruptionImplicits() {
      const implicits = /* @__PURE__ */ new Set();
      const items = selectedType === UNIQUE_FAVORITES_TYPE ? favorites.getItems(uniqueData.UNIQUE_ITEMS) : uniqueData.getItemsByType(selectedType);
      for (const item of items) {
        for (const implicit of corruptionData.getCorruptionImplicits(
          `${item.name} ${item.base}`
        )) {
          implicits.add(implicit);
        }
      }
      return [...implicits];
    }
    function createRuneforgeButton(item, variantIndex) {
      const variant = getVariant(item, variantIndex);
      const runeforgeCost = variant?.cost || item.runeforging[0]?.cost || "";
      const button = doc.createElement("button");
      button.className = "poe-trade-styler-unique-result-runeforge";
      button.type = "button";
      button.classList.toggle("is-active", Boolean(variant));
      button.setAttribute(
        "aria-label",
        variant ? `Showing ${variant.label}; switch version` : `Show Runeforged version of ${item.name}`
      );
      if (!runeforgeCost) {
        button.title = variant ? `${variant.label} (click to switch version)` : "Show Runeforged version";
      }
      const icon = doc.createElement("img");
      icon.src = getSafeItemImageUrl(uniqueData.RUNEFORGE_ICON);
      icon.alt = "";
      icon.setAttribute("aria-hidden", "true");
      appendTextElement(
        doc,
        button,
        "span",
        "poe-trade-styler-unique-result-runeforge-label",
        variant ? variant.tier === "runemastered" ? "Runemastered" : "Runeforged" : "Runeforge"
      );
      button.prepend(icon);
      if (runeforgeCost) {
        const costTooltip = doc.createElement("span");
        costTooltip.className = "poe-trade-styler-unique-result-runeforge-cost-tooltip";
        costTooltip.id = `poe-trade-styler-unique-runeforge-cost-${++tooltipSequence}`;
        costTooltip.setAttribute("role", "tooltip");
        costTooltip.textContent = runeforgeCost;
        button.setAttribute("aria-describedby", costTooltip.id);
        button.append(costTooltip);
      }
      button.addEventListener("click", (event) => {
        event.preventDefault();
        const current = variantIndex ?? getVariantIndex(item);
        const next = current + 1 >= item.runeforging.length ? -1 : current + 1;
        if (variantIndex === void 0) variantIndexes.set(item.key, next);
        button.closest(".poe-trade-styler-unique-result")?.replaceWith(createItemResult(item, variantIndex === void 0 ? void 0 : next));
      });
      return button;
    }
    function createItemResult(item, variantIndex) {
      const variant = getVariant(item, variantIndex);
      const composedVariant = variant ? composeRuneforgedView(variant, item.mods) : null;
      const typeLine = variant?.label || item.base;
      const properties = composedVariant?.properties.length ? composedVariant.properties : item.baseProperties;
      const propertyStyles = composedVariant?.properties.length ? composedVariant.propertyStyles : item.basePropertyStyles;
      const normalItemClass = item.baseProperties.find(
        (property) => !property.includes(":")
      ) || item.type;
      const hasItemClassProperty = properties[0] && !properties[0].includes(":");
      const itemClass = hasItemClassProperty ? properties[0] : normalItemClass;
      const statProperties = hasItemClassProperty ? properties.slice(1) : properties;
      const statPropertyStyles = hasItemClassProperty ? propertyStyles.slice(1) : propertyStyles;
      const requirements = composedVariant?.requirements || item.requirements;
      const article = doc.createElement("article");
      article.className = "poe-trade-styler-unique-result";
      article.classList.toggle("is-forged", Boolean(variant));
      article.dataset.poeTradeStylerUniqueItem = item.key;
      if (variant) article.dataset.poeTradeStylerUniqueVariant = variant.key;
      article.setAttribute("aria-label", `${item.name}, ${typeLine}`);
      const heading = doc.createElement("h3");
      heading.className = "poe-trade-styler-unique-result-heading";
      const nameButton = doc.createElement("button");
      nameButton.className = "poe-trade-styler-unique-result-name-button";
      nameButton.type = "button";
      appendTextElement(
        doc,
        nameButton,
        "span",
        "poe-trade-styler-unique-result-name",
        item.name
      );
      appendTextElement(
        doc,
        nameButton,
        "span",
        "poe-trade-styler-unique-result-base",
        typeLine
      );
      const fullItemName = `${item.name} ${typeLine}`;
      nameButton.title = `Search trade for ${fullItemName}`;
      nameButton.setAttribute("aria-label", `Search trade for ${fullItemName}`);
      nameButton.addEventListener("click", async (event) => {
        event.preventDefault();
        if (itemSearchInProgress) return;
        itemSearchInProgress = true;
        try {
          const prepared = await (prepareSearchPromise ?? onBeforeOpen()).catch(() => false);
          if (!prepared) return;
          close();
          await onSearchItem(fullItemName);
        } finally {
          itemSearchInProgress = false;
        }
      });
      heading.append(nameButton, favorites.createButton(doc, item));
      article.append(heading);
      const media = doc.createElement("div");
      media.className = "poe-trade-styler-unique-result-media";
      const artworkWrap = doc.createElement("div");
      artworkWrap.className = "poe-trade-styler-unique-result-art-wrap";
      artworkWrap.setAttribute("tabindex", "0");
      artworkWrap.setAttribute("aria-label", `${item.name} item details`);
      const artworkAnchor = doc.createElement("div");
      artworkAnchor.className = "poe-trade-styler-unique-result-art-anchor";
      const artwork = doc.createElement("img");
      artwork.className = "poe-trade-styler-unique-result-art";
      artwork.src = getSafeItemImageUrl(item.officialIcon);
      artwork.referrerPolicy = "no-referrer";
      artwork.loading = "lazy";
      artwork.alt = `${item.name} artwork`;
      artworkAnchor.append(artwork);
      artworkWrap.append(artworkAnchor);
      media.append(artworkWrap);
      const stats = doc.createElement("div");
      stats.className = "poe-trade-styler-unique-result-stats";
      appendLineGroup(
        stats,
        "Base properties",
        statProperties,
        "poe-trade-styler-unique-result-properties",
        statPropertyStyles
      );
      appendLineGroup(
        stats,
        "Requirements",
        [requirements],
        "poe-trade-styler-unique-result-requirements"
      );
      const actions = doc.createElement("div");
      actions.className = "poe-trade-styler-unique-result-actions";
      if (item.runeforging.length > 0) {
        actions.append(createRuneforgeButton(item, variantIndex));
      }
      const source = doc.createElement("a");
      source.className = "poe-trade-styler-unique-result-source";
      source.href = item.sourceUrl;
      source.target = "_blank";
      source.rel = "noreferrer";
      source.textContent = "More info";
      source.title = "Open the external information page";
      actions.append(source);
      media.append(actions);
      const modifiers = doc.createElement("div");
      modifiers.className = "poe-trade-styler-unique-result-affixes";
      appendLineGroup(
        modifiers,
        variant ? "Runeforged implicit modifiers" : "Base implicit modifiers",
        variant?.implicitMods || item.baseImplicitMods,
        "poe-trade-styler-unique-result-implicits"
      );
      appendLineGroup(
        modifiers,
        "Unique modifiers",
        item.mods,
        "poe-trade-styler-unique-result-mods"
      );
      const tooltip = doc.createElement("div");
      tooltip.className = "poe-trade-styler-unique-result-tooltip";
      tooltip.id = `poe-trade-styler-unique-tooltip-${++tooltipSequence}`;
      tooltip.setAttribute("role", "tooltip");
      artworkWrap.setAttribute("aria-describedby", tooltip.id);
      appendTextElement(
        doc,
        tooltip,
        "div",
        "poe-trade-styler-unique-tooltip-item-class",
        itemClass
      );
      appendLineGroup(
        tooltip,
        "Flavour text",
        item.flavourText,
        "poe-trade-styler-unique-result-flavour"
      );
      artworkAnchor.append(tooltip);
      article.append(media, stats, modifiers);
      return article;
    }
    function renderTypes() {
      if (!typeList) return;
      typeList.replaceChildren();
      ensureSelectedType();
      for (const type of getVisibleTypes()) {
        const typeEntries = sortUniqueEntries(getFilteredEntries(type));
        const count = typeEntries.length;
        const firstItem = typeEntries[0]?.item;
        const isFavorites = type === UNIQUE_FAVORITES_TYPE;
        const label = isFavorites ? "Favorites" : type;
        const tab = doc.createElement("button");
        tab.className = "poe-trade-styler-unique-type";
        tab.type = "button";
        tab.dataset.poeTradeStylerUniqueType = label;
        tab.classList.toggle("is-active", type === selectedType);
        tab.setAttribute("role", "tab");
        tab.setAttribute("aria-selected", String(type === selectedType));
        if (isFavorites) {
          appendTextElement(
            doc,
            tab,
            "span",
            "poe-trade-styler-unique-type-favorite-icon",
            "\u2605"
          ).setAttribute("aria-hidden", "true");
        } else if (firstItem) {
          const icon = doc.createElement("img");
          icon.className = "poe-trade-styler-unique-type-icon";
          icon.src = getSafeItemImageUrl(firstItem.officialIcon);
          icon.alt = "";
          icon.loading = "lazy";
          icon.referrerPolicy = "no-referrer";
          icon.setAttribute("aria-hidden", "true");
          tab.append(icon);
        }
        appendTextElement(
          doc,
          tab,
          "span",
          "poe-trade-styler-unique-type-name",
          label
        );
        appendTextElement(
          doc,
          tab,
          "span",
          "poe-trade-styler-unique-type-count",
          String(count)
        );
        tab.addEventListener("click", () => {
          if (selectedType === type) return;
          selectedType = type;
          renderTypes();
          renderResults();
        });
        typeList.append(tab);
      }
    }
    function applyFilters() {
      ensureSelectedType();
      renderTypes();
      renderResults();
    }
    function renderResults() {
      if (!results) return;
      results.replaceChildren();
      const entries = getEntries();
      const fragment = doc.createDocumentFragment();
      const summary = doc.createElement("header");
      summary.className = "poe-trade-styler-unique-results-summary";
      const corruptedImplicits = getTypeCorruptionImplicits();
      if (corruptedImplicits.length > 0) {
        summary.append(createCorruptionInfo(corruptedImplicits));
      }
      appendTextElement(
        doc,
        summary,
        "strong",
        "poe-trade-styler-unique-results-count",
        listForgedSeparately ? `Showing ${entries.length} ${entries.length === 1 ? "item" : "items"}` : `Showing ${entries.length} ${entries.length === 1 ? "unique" : "uniques"}`
      );
      appendTextElement(
        doc,
        summary,
        "span",
        "poe-trade-styler-unique-results-order",
        "Required level: low to high"
      );
      fragment.append(summary);
      if (entries.length === 0) {
        appendTextElement(
          doc,
          fragment,
          "p",
          "poe-trade-styler-unique-empty",
          "No uniques match the current filters."
        );
      } else {
        for (const entry of entries) {
          fragment.append(
            createItemResult(
              entry.item,
              listForgedSeparately ? entry.variantIndex : void 0
            )
          );
        }
      }
      results.append(fragment);
      results.scrollTop = 0;
    }
    function parseRequiredLevel(value) {
      if (!value.trim()) return null;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    function createFilters() {
      const filters = doc.createElement("section");
      filters.className = "poe-trade-styler-unique-filters";
      filters.setAttribute("aria-label", "Unique quick filters");
      const searchField = doc.createElement("label");
      searchField.className = "poe-trade-styler-unique-filter poe-trade-styler-unique-filter-search";
      const searchInput = doc.createElement("input");
      searchInput.type = "search";
      searchInput.placeholder = "Search base or property";
      searchInput.setAttribute("aria-label", "Filter uniques");
      searchInput.addEventListener("input", () => {
        searchQuery = searchInput.value.trim().toLocaleLowerCase();
        applyFilters();
      });
      searchField.append(searchInput);
      const forgedToggle = doc.createElement("label");
      forgedToggle.className = "poe-trade-styler-unique-forged-toggle";
      const forgedCheckbox = doc.createElement("input");
      forgedCheckbox.type = "checkbox";
      forgedCheckbox.checked = false;
      forgedCheckbox.setAttribute(
        "aria-label",
        "List Runeforged uniques as separate items"
      );
      forgedCheckbox.addEventListener("change", () => {
        listForgedSeparately = forgedCheckbox.checked;
        variantIndexes.clear();
        applyFilters();
      });
      forgedToggle.append(forgedCheckbox);
      appendTextElement(
        doc,
        forgedToggle,
        "span",
        "poe-trade-styler-unique-forged-toggle-label",
        "Runeforged as items"
      );
      const levelGroup = doc.createElement("div");
      levelGroup.className = "poe-trade-styler-unique-level-filters";
      levelGroup.setAttribute("role", "group");
      levelGroup.setAttribute("aria-label", "Required level");
      appendTextElement(
        doc,
        levelGroup,
        "span",
        "poe-trade-styler-unique-filter-label",
        "Required level"
      );
      const createLevelInput = (labelText, ariaLabel, onInput) => {
        const field = doc.createElement("label");
        field.className = "poe-trade-styler-unique-level-filter";
        const input = doc.createElement("input");
        input.type = "number";
        input.min = "1";
        input.max = "100";
        input.inputMode = "numeric";
        input.placeholder = labelText;
        input.setAttribute("aria-label", ariaLabel);
        input.addEventListener("input", () => {
          onInput(parseRequiredLevel(input.value));
          applyFilters();
        });
        field.append(input);
        levelGroup.append(field);
        return input;
      };
      const minimumInput = createLevelInput(
        "Min",
        "Minimum required level",
        (value) => {
          minimumRequiredLevel = value;
        }
      );
      const maximumInput = createLevelInput(
        "Max",
        "Maximum required level",
        (value) => {
          maximumRequiredLevel = value;
        }
      );
      const reset = doc.createElement("button");
      reset.className = "poe-trade-styler-unique-filter-reset";
      reset.type = "button";
      reset.textContent = "Reset";
      reset.addEventListener("click", () => {
        searchInput.value = "";
        minimumInput.value = "";
        maximumInput.value = "";
        searchQuery = "";
        minimumRequiredLevel = null;
        maximumRequiredLevel = null;
        applyFilters();
        searchInput.focus();
      });
      filters.append(searchField, forgedToggle, levelGroup, reset);
      return filters;
    }
    function createModal() {
      const overlay = doc.createElement("div");
      overlay.id = "poe-trade-styler-unique-modal";
      overlay.hidden = true;
      overlay.setAttribute("role", "dialog");
      overlay.setAttribute("aria-modal", "true");
      overlay.setAttribute("aria-labelledby", "poe-trade-styler-unique-title");
      const dialog = doc.createElement("div");
      dialog.className = "poe-trade-styler-unique-dialog";
      const top = doc.createElement("header");
      top.className = "poe-trade-styler-unique-top";
      const title = appendTextElement(
        doc,
        top,
        "h2",
        "poe-trade-styler-unique-title",
        "Unique Helper"
      );
      title.id = "poe-trade-styler-unique-title";
      const closeButton = doc.createElement("button");
      closeButton.className = "poe-trade-styler-unique-close";
      closeButton.type = "button";
      closeButton.setAttribute("aria-label", "Close Unique Helper");
      closeButton.textContent = "\xD7";
      closeButton.addEventListener("click", close);
      top.append(closeButton);
      const content = doc.createElement("div");
      content.className = "poe-trade-styler-unique-content";
      typeList = doc.createElement("nav");
      typeList.className = "poe-trade-styler-unique-types";
      typeList.setAttribute("role", "tablist");
      typeList.setAttribute("aria-label", "Unique item types");
      typeList.setAttribute("aria-orientation", "vertical");
      results = doc.createElement("section");
      results.className = "poe-trade-styler-unique-results";
      results.setAttribute("aria-label", "Uniques sorted by required level");
      content.append(typeList, results);
      dialog.append(top, createFilters(), content);
      overlay.append(dialog);
      overlay.addEventListener("click", (event) => {
        if (event.target === overlay) close();
      });
      doc.body.append(overlay);
      renderTypes();
      renderResults();
      return overlay;
    }
    function open() {
      if (!modal) modal = createModal();
      prepareSearchPromise = onBeforeOpen().catch(() => false);
      modal.hidden = false;
      doc.documentElement.classList.add("poe-trade-styler-unique-modal-open");
      launcher?.setAttribute("aria-expanded", "true");
      modal.querySelector(".poe-trade-styler-unique-close")?.focus();
    }
    function close() {
      if (!modal || modal.hidden) return false;
      modal.hidden = true;
      doc.documentElement.classList.remove("poe-trade-styler-unique-modal-open");
      launcher?.setAttribute("aria-expanded", "false");
      launcher?.focus();
      return true;
    }
    function createLauncher() {
      const button = doc.createElement("button");
      button.className = "poe-trade-styler-preset poe-trade-styler-unique-preset-button";
      button.type = "button";
      button.dataset.poeTradeStylerPreset = "uniques";
      button.setAttribute("aria-label", "Open Unique Helper");
      button.setAttribute("aria-haspopup", "dialog");
      button.setAttribute("aria-expanded", "false");
      button.title = "Open Unique Helper";
      const icon = doc.createElement("img");
      icon.className = "poe-trade-styler-unique-preset-icon";
      icon.src = getSafeItemImageUrl(uniqueData.UNIQUE_HELPER_ICON);
      icon.alt = "";
      icon.referrerPolicy = "no-referrer";
      icon.setAttribute("aria-hidden", "true");
      button.append(icon);
      button.addEventListener("click", async () => {
        if (launcherToggleInProgress) return;
        if (!isActive()) {
          open();
          return;
        }
        launcherToggleInProgress = true;
        close();
        try {
          await onDeactivate();
        } finally {
          launcherToggleInProgress = false;
          button.classList.remove("is-active");
          button.setAttribute("aria-pressed", "false");
        }
      });
      return button;
    }
    function removeLauncher() {
      launcher?.closest(".poe-trade-styler-unique-navigation-item")?.remove();
      launcher = null;
      close();
    }
    function decorate() {
      if (!isPoe2Page()) {
        removeLauncher();
        return;
      }
      const craftingPresetButton = doc.querySelector(
        '[data-poe-trade-styler-preset="gear"]'
      ) || doc.querySelector(
        '[data-poe-trade-styler-preset="flasks"]'
      ) || doc.querySelector(
        '[data-poe-trade-styler-preset="charms"]'
      ) || doc.querySelector('[data-poe-trade-styler-preset="tablets"]');
      const craftingPresetNavigationItem = craftingPresetButton?.closest(
        ".poe-trade-styler-preset-navigation-item"
      );
      if (!craftingPresetNavigationItem) return;
      launcher = doc.querySelector(
        '[data-poe-trade-styler-preset="uniques"]'
      ) || launcher || createLauncher();
      const active = isActive();
      launcher.classList.toggle("is-active", active);
      launcher.setAttribute("aria-pressed", String(active));
      let navigationItem = launcher.closest(
        ".poe-trade-styler-unique-navigation-item"
      );
      if (!navigationItem) {
        navigationItem = doc.createElement(
          craftingPresetNavigationItem.tagName.toLowerCase() === "li" ? "li" : "span"
        );
        navigationItem.className = "poe-trade-styler-preset-navigation-item poe-trade-styler-unique-navigation-item";
        navigationItem.append(launcher);
      }
      if (craftingPresetNavigationItem.nextElementSibling !== navigationItem) {
        craftingPresetNavigationItem.insertAdjacentElement("afterend", navigationItem);
      }
      if (!modal) modal = createModal();
    }
    return {
      close,
      decorate,
      destroy() {
        removeLauncher();
        modal?.remove();
        modal = null;
        typeList = null;
        results = null;
        doc.documentElement.classList.remove("poe-trade-styler-unique-modal-open");
      }
    };
  }

  // src/content/gear-helper/controller.ts
  var PROPERTY_LABELS = Object.freeze({
    armour: "Armour",
    attack_time: "APS",
    block: "Block",
    critical_strike_chance: "Crit",
    energyshield: "Energy Shield",
    evasion: "Evasion",
    increasedmovementspeed: "Move",
    physical_damage_max: "Physical Damage",
    range: "Range",
    ward: "Ward"
  });
  function appendText(doc, parent, tag, className, text) {
    const element = doc.createElement(tag);
    element.className = className;
    element.textContent = text;
    parent.append(element);
    return element;
  }
  var ATTRIBUTE_TONES = Object.freeze({
    STR: "strength",
    INT: "intelligence",
    DEX: "dexterity"
  });
  function appendGearBaseLabel(doc, button, label) {
    const parts = label.split(/\b(STR|INT|DEX)\b/g);
    for (const part of parts) {
      const tone = ATTRIBUTE_TONES[part];
      if (!tone) {
        button.append(doc.createTextNode(part));
        continue;
      }
      appendText(
        doc,
        button,
        "span",
        `poe-trade-styler-gear-attribute-label is-${tone}`,
        part
      );
    }
  }
  function qualityValue(value) {
    return Math.floor(value * 1.2);
  }
  function formatProperties(item) {
    const properties = item.properties;
    const lines = [];
    const physicalMin = Number(properties.physical_damage_min);
    const physicalMax = Number(properties.physical_damage_max);
    if (Number.isFinite(physicalMin) && Number.isFinite(physicalMax)) {
      lines.push(
        `Physical ${qualityValue(physicalMin)}\u2013${qualityValue(physicalMax)}`
      );
    }
    for (const [key, rawValue] of Object.entries(properties)) {
      if (key === "physical_damage_min" || key === "physical_damage_max") continue;
      const value = Number(rawValue);
      if (!Number.isFinite(value) || !PROPERTY_LABELS[key]) continue;
      if (["armour", "evasion", "energyshield", "ward"].includes(key)) {
        lines.push(`${PROPERTY_LABELS[key]} ${qualityValue(value)}`);
      } else if (key === "attack_time") {
        lines.push(`APS ${(1e3 / value).toFixed(2)}`);
      } else if (key === "critical_strike_chance") {
        lines.push(`Crit ${(value / 100).toFixed(1).replace(/\.0$/, "")}%`);
      } else if (key === "block") {
        lines.push(`Block ${value}%`);
      } else if (key === "range") {
        lines.push(`Range ${(value / 10).toFixed(1).replace(/\.0$/, "")}`);
      } else if (key === "increasedmovementspeed" && value) {
        lines.push(`Move ${value > 0 ? "+" : ""}${value / 100}%`);
      }
    }
    return lines;
  }
  function formatRequirements(item) {
    const attributes = Object.entries(item.requirements).filter(([, value]) => Number(value) > 0).map(([key, value]) => `${String(key).slice(0, 3).toUpperCase()} ${value}`);
    return [`Level ${item.requiredLevel}`, ...attributes].join(" \xB7 ");
  }
  function isRuneforgedBase(item) {
    return /^(?:Runeforged|Runemastered|Runefather's)\b/i.test(item.displayName);
  }
  function createGearHelperFeature({
    document: doc = document,
    gearData,
    onDeactivate = async () => void 0,
    onSelect,
    presetState,
    styler
  }) {
    let launcher = null;
    let modal = null;
    let slotList = null;
    let baseList = null;
    let itemList = null;
    let itemSummary = null;
    let showRuneforged = false;
    let selectedSlotKey = presetState.selectedGearSlotKey || gearData.GEAR_SLOTS[0]?.key || "";
    let selectedBaseKey = presetState.selectedGearBaseKey;
    let selectionInProgress = false;
    let launcherToggleInProgress = false;
    function isPoe2Page() {
      return styler.getTradeGameKey(location.pathname) === "poe2" || doc.body.dataset.fixtureGame === "poe2";
    }
    function getSelectedSlot() {
      return gearData.getGearSlot(selectedSlotKey);
    }
    function selectSlot(slotKey) {
      const slot = gearData.getGearSlot(slotKey);
      if (!slot) return;
      selectedSlotKey = slot.key;
      selectedBaseKey = slot.baseKeys.length === 1 ? slot.baseKeys[0] : null;
      render();
    }
    function renderSlots() {
      if (!slotList) return;
      slotList.replaceChildren();
      for (const slot of gearData.GEAR_SLOTS) {
        const button = doc.createElement("button");
        button.className = "poe-trade-styler-gear-slot";
        button.type = "button";
        button.classList.toggle("is-active", slot.key === selectedSlotKey);
        button.dataset.poeTradeStylerGearSlot = slot.key;
        button.setAttribute("role", "tab");
        button.setAttribute("aria-selected", String(slot.key === selectedSlotKey));
        const icon = doc.createElement("img");
        icon.className = "poe-trade-styler-gear-slot-icon";
        icon.src = getSafeItemImageUrl(slot.icon);
        icon.alt = "";
        icon.loading = "lazy";
        icon.referrerPolicy = "no-referrer";
        icon.setAttribute("aria-hidden", "true");
        button.append(icon);
        appendText(doc, button, "span", "poe-trade-styler-gear-slot-name", slot.displayName);
        button.addEventListener("click", () => selectSlot(slot.key));
        slotList.append(button);
      }
    }
    function renderBases() {
      if (!baseList) return;
      const bases = gearData.getGearBases(selectedSlotKey);
      baseList.replaceChildren();
      baseList.closest(".poe-trade-styler-gear-base-filter").hidden = bases.length <= 1;
      if (bases.length <= 1) {
        selectedBaseKey = bases[0]?.key || null;
        return;
      }
      const definitions = [
        { key: null, displayName: "ANY" },
        ...bases.map((base) => ({ key: base.key, displayName: base.displayName }))
      ];
      for (const definition of definitions) {
        const button = doc.createElement("button");
        button.className = "poe-trade-styler-gear-base-filter-option";
        button.type = "button";
        button.classList.toggle("is-active", definition.key === selectedBaseKey);
        appendGearBaseLabel(doc, button, definition.displayName);
        button.setAttribute("aria-pressed", String(definition.key === selectedBaseKey));
        button.addEventListener("click", () => {
          selectedBaseKey = definition.key;
          renderBases();
          renderItems();
        });
        baseList.append(button);
      }
    }
    async function chooseItem(item) {
      if (selectionInProgress) return;
      selectionInProgress = true;
      try {
        const accepted = await onSelect(
          selectedSlotKey,
          item?.baseKey || selectedBaseKey,
          item?.key || null
        );
        if (accepted) close();
      } finally {
        selectionInProgress = false;
      }
    }
    function createAnyItem() {
      const button = doc.createElement("button");
      button.className = "poe-trade-styler-gear-item poe-trade-styler-gear-item-any";
      button.type = "button";
      button.dataset.poeTradeStylerGearItem = "any";
      appendText(doc, button, "strong", "poe-trade-styler-gear-item-name", "ANY");
      appendText(
        doc,
        button,
        "span",
        "poe-trade-styler-gear-item-meta",
        selectedBaseKey ? "Any item of this base type" : "Any item in this slot"
      );
      button.addEventListener("click", () => void chooseItem(null));
      return button;
    }
    function createItem(item) {
      const button = doc.createElement("button");
      button.className = "poe-trade-styler-gear-item";
      button.type = "button";
      button.dataset.poeTradeStylerGearItem = item.key;
      button.title = `Choose ${item.displayName}`;
      const icon = doc.createElement("img");
      icon.className = "poe-trade-styler-gear-item-icon";
      icon.src = getSafeItemImageUrl(item.icon);
      icon.alt = "";
      icon.loading = "lazy";
      icon.referrerPolicy = "no-referrer";
      icon.setAttribute("aria-hidden", "true");
      const detail = doc.createElement("span");
      detail.className = "poe-trade-styler-gear-item-detail";
      appendText(doc, detail, "strong", "poe-trade-styler-gear-item-name", item.displayName);
      const properties = formatProperties(item);
      if (properties.length) {
        appendText(
          doc,
          detail,
          "span",
          "poe-trade-styler-gear-item-properties",
          `Quality 20% \xB7 ${properties.join(" \xB7 ")}`
        );
      }
      appendText(
        doc,
        detail,
        "span",
        "poe-trade-styler-gear-item-requirements",
        formatRequirements(item)
      );
      for (const implicit of item.implicits) {
        appendText(
          doc,
          detail,
          "span",
          "poe-trade-styler-gear-item-implicit",
          implicit
        );
      }
      button.append(icon, detail);
      button.addEventListener("click", () => void chooseItem(item));
      return button;
    }
    function renderItems() {
      if (!itemList || !itemSummary) return;
      const items = gearData.getGearItems(selectedSlotKey, selectedBaseKey).filter(
        (item) => item.tradeAvailable && (showRuneforged || !isRuneforgedBase(item))
      );
      itemSummary.textContent = `${items.length} bases \xB7 highest level first`;
      itemList.replaceChildren(createAnyItem(), ...items.map(createItem));
      itemList.scrollTop = 0;
    }
    function render() {
      renderSlots();
      renderBases();
      renderItems();
    }
    function createModal() {
      const overlay = doc.createElement("div");
      overlay.id = "poe-trade-styler-gear-modal";
      overlay.hidden = true;
      overlay.setAttribute("role", "dialog");
      overlay.setAttribute("aria-modal", "true");
      overlay.setAttribute("aria-labelledby", "poe-trade-styler-gear-title");
      const dialog = doc.createElement("div");
      dialog.className = "poe-trade-styler-gear-dialog";
      const top = doc.createElement("header");
      top.className = "poe-trade-styler-gear-top";
      const title = appendText(doc, top, "h2", "poe-trade-styler-gear-title", "Gear Presets");
      title.id = "poe-trade-styler-gear-title";
      const closeButton = doc.createElement("button");
      closeButton.className = "poe-trade-styler-gear-close";
      closeButton.type = "button";
      closeButton.setAttribute("aria-label", "Close Gear Presets");
      closeButton.textContent = "\xD7";
      closeButton.addEventListener("click", close);
      top.append(closeButton);
      const content = doc.createElement("div");
      content.className = "poe-trade-styler-gear-content";
      slotList = doc.createElement("nav");
      slotList.className = "poe-trade-styler-gear-slots";
      slotList.setAttribute("role", "tablist");
      slotList.setAttribute("aria-label", "Gear slot");
      slotList.setAttribute("aria-orientation", "vertical");
      const main = doc.createElement("section");
      main.className = "poe-trade-styler-gear-main";
      const baseFilter = doc.createElement("section");
      baseFilter.className = "poe-trade-styler-gear-base-filter";
      appendText(doc, baseFilter, "h3", "poe-trade-styler-gear-section-title", "Base type");
      baseList = doc.createElement("div");
      baseList.className = "poe-trade-styler-gear-base-filter-list";
      baseFilter.append(baseList);
      const itemsHeader = doc.createElement("header");
      itemsHeader.className = "poe-trade-styler-gear-items-header";
      appendText(doc, itemsHeader, "h3", "poe-trade-styler-gear-section-title", "Choose an item");
      const itemControls = doc.createElement("div");
      itemControls.className = "poe-trade-styler-gear-items-controls";
      const runeforgedToggle = doc.createElement("label");
      runeforgedToggle.className = "poe-trade-styler-gear-runeforged-toggle";
      const runeforgedCheckbox = doc.createElement("input");
      runeforgedCheckbox.type = "checkbox";
      runeforgedCheckbox.checked = false;
      runeforgedCheckbox.setAttribute("aria-label", "Show Runeforged bases");
      runeforgedCheckbox.addEventListener("change", () => {
        showRuneforged = runeforgedCheckbox.checked;
        renderItems();
      });
      runeforgedToggle.append(runeforgedCheckbox);
      appendText(
        doc,
        runeforgedToggle,
        "span",
        "poe-trade-styler-gear-runeforged-toggle-label",
        "Runeforged"
      );
      itemSummary = appendText(
        doc,
        itemControls,
        "span",
        "poe-trade-styler-gear-items-summary",
        ""
      );
      itemControls.append(runeforgedToggle);
      itemsHeader.append(itemControls);
      itemList = doc.createElement("div");
      itemList.className = "poe-trade-styler-gear-items";
      main.append(baseFilter, itemsHeader, itemList);
      content.append(slotList, main);
      dialog.append(top, content);
      overlay.append(dialog);
      overlay.addEventListener("click", (event) => {
        if (event.target === overlay) close();
      });
      doc.body.append(overlay);
      render();
      return overlay;
    }
    function open() {
      if (!modal) modal = createModal();
      selectedSlotKey = presetState.selectedGearSlotKey || selectedSlotKey || gearData.GEAR_SLOTS[0]?.key || "";
      selectedBaseKey = presetState.selectedGearBaseKey || (getSelectedSlot()?.baseKeys.length === 1 ? getSelectedSlot().baseKeys[0] : null);
      render();
      modal.hidden = false;
      doc.documentElement.classList.add("poe-trade-styler-gear-modal-open");
      launcher?.setAttribute("aria-expanded", "true");
      modal.querySelector(".poe-trade-styler-gear-close")?.focus();
    }
    function close() {
      if (!modal || modal.hidden) return false;
      modal.hidden = true;
      doc.documentElement.classList.remove("poe-trade-styler-gear-modal-open");
      launcher?.setAttribute("aria-expanded", "false");
      launcher?.focus();
      return true;
    }
    function createLauncher() {
      const button = doc.createElement("button");
      button.className = "poe-trade-styler-preset poe-trade-styler-gear-preset-button";
      button.type = "button";
      button.dataset.poeTradeStylerPreset = "gear";
      button.setAttribute("aria-label", "Open Gear Presets");
      button.setAttribute("aria-haspopup", "dialog");
      button.setAttribute("aria-expanded", "false");
      button.title = "Open Gear Presets";
      const icon = doc.createElement("img");
      icon.className = "poe-trade-styler-gear-preset-icon";
      icon.src = getSafeItemImageUrl(gearData.GEAR_GENERAL_ICON);
      icon.alt = "";
      icon.referrerPolicy = "no-referrer";
      icon.setAttribute("aria-hidden", "true");
      button.append(icon);
      button.addEventListener("click", async () => {
        if (launcherToggleInProgress) return;
        if (presetState.activePreset !== "gear") {
          open();
          return;
        }
        launcherToggleInProgress = true;
        close();
        try {
          await onDeactivate();
        } finally {
          launcherToggleInProgress = false;
          button.classList.remove("is-active");
          button.setAttribute("aria-pressed", "false");
        }
      });
      return button;
    }
    function removeLauncher() {
      launcher?.closest(".poe-trade-styler-gear-navigation-item")?.remove();
      launcher = null;
      close();
    }
    function decorate() {
      if (!isPoe2Page()) {
        removeLauncher();
        return;
      }
      const previousButton = doc.querySelector('[data-poe-trade-styler-preset="jewels"]') || doc.querySelector('[data-poe-trade-styler-preset="flasks"]');
      const previousItem = previousButton?.closest(".poe-trade-styler-preset-navigation-item");
      if (!previousItem) return;
      launcher = doc.querySelector('[data-poe-trade-styler-preset="gear"]') || launcher || createLauncher();
      launcher.classList.toggle("is-active", presetState.activePreset === "gear");
      launcher.setAttribute("aria-pressed", String(presetState.activePreset === "gear"));
      let navigationItem = launcher.closest(".poe-trade-styler-gear-navigation-item");
      if (!navigationItem) {
        navigationItem = doc.createElement(
          previousItem.tagName.toLowerCase() === "li" ? "li" : "span"
        );
        navigationItem.className = "poe-trade-styler-preset-navigation-item poe-trade-styler-gear-navigation-item";
        navigationItem.append(launcher);
      }
      if (previousItem.nextElementSibling !== navigationItem) {
        previousItem.insertAdjacentElement("afterend", navigationItem);
      }
      if (!modal) modal = createModal();
    }
    return {
      close,
      decorate,
      destroy() {
        removeLauncher();
        modal?.remove();
        modal = null;
        slotList = null;
        baseList = null;
        itemList = null;
        itemSummary = null;
        doc.documentElement.classList.remove("poe-trade-styler-gear-modal-open");
      }
    };
  }

  // src/content/gem-helper/favorites.ts
  function createGemFavorites({
    onChange,
    persistSettings,
    settings
  }) {
    function has(item) {
      return settings.gemItemFavorites.includes(item.key);
    }
    function getItems(items) {
      const favoriteKeys = new Set(settings.gemItemFavorites);
      return items.filter((item) => favoriteKeys.has(item.key));
    }
    function createButton(doc, item) {
      const button = doc.createElement("button");
      const isFavorite = has(item);
      button.className = "poe-trade-styler-gem-item-favorite";
      button.type = "button";
      button.classList.toggle("is-active", isFavorite);
      button.textContent = isFavorite ? "\u2605" : "\u2606";
      button.title = isFavorite ? "Remove from Favorites" : "Add to Favorites";
      button.setAttribute(
        "aria-label",
        isFavorite ? `Remove ${item.name} from Favorites` : `Add ${item.name} to Favorites`
      );
      button.setAttribute("aria-pressed", String(isFavorite));
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const favoriteKeys = new Set(settings.gemItemFavorites);
        if (favoriteKeys.has(item.key)) favoriteKeys.delete(item.key);
        else favoriteKeys.add(item.key);
        settings.gemItemFavorites = [...favoriteKeys];
        persistSettings();
        onChange();
      });
      return button;
    }
    return { createButton, getItems, has };
  }

  // src/content/gem-helper/controller.ts
  var ATTRIBUTE_LABELS = Object.freeze({
    all: "All",
    strength: "Strength",
    dexterity: "Dexterity",
    intelligence: "Intelligence"
  });
  var ATTRIBUTE_SHORT_LABELS = Object.freeze({
    all: "ALL",
    strength: "STR",
    dexterity: "DEX",
    intelligence: "INT"
  });
  function appendText2(doc, parent, tag, className, text) {
    const element = doc.createElement(tag);
    element.className = className;
    element.textContent = text;
    parent.append(element);
    return element;
  }
  function getExternalGemUrl(name) {
    const slug = name.normalize("NFKD").replace(/[\u2018\u2019']/g, "").replace(/\s+/g, "_");
    return `https://poe2db.tw/us/${encodeURIComponent(slug)}`;
  }
  function createGemHelperFeature({
    document: doc = document,
    gemData,
    onDeactivate = async () => void 0,
    onSelect,
    persistSettings = () => void 0,
    presetState,
    settings = { gemItemFavorites: [] },
    styler
  }) {
    let launcher = null;
    let modal = null;
    let list = null;
    let summary = null;
    let searchInput = null;
    let selectedAttribute = "all";
    let favoriteOnly = false;
    let sortDirection = "asc";
    let sortField = "name";
    let selectionInProgress = false;
    let launcherToggleInProgress = false;
    const selectedTags = /* @__PURE__ */ new Set();
    const gemTags = [...new Set(
      gemData.GEM_DEFINITIONS.flatMap((gem) => [...gem.tags])
    )].sort((left, right) => left.localeCompare(right, "en", { sensitivity: "base" }));
    const favorites = createGemFavorites({
      onChange: render,
      persistSettings,
      settings
    });
    function isPoe2Page() {
      return styler.getTradeGameKey(location.pathname) === "poe2" || doc.body.dataset.fixtureGame === "poe2";
    }
    function baseFilteredGems() {
      return gemData.getGems({
        attribute: selectedAttribute,
        query: searchInput?.value || ""
      });
    }
    function matchesTags(gem, tags) {
      return [...tags].every((tag) => gem.tags.includes(tag));
    }
    function filteredGems() {
      const gems = baseFilteredGems().filter((gem) => matchesTags(gem, selectedTags));
      const visibleGems = favoriteOnly ? favorites.getItems(gems) : gems;
      const direction = sortDirection === "asc" ? 1 : -1;
      return [...visibleGems].sort((left, right) => {
        const byName = left.name.localeCompare(right.name, "en", {
          sensitivity: "base"
        });
        const comparison = sortField === "required-level" ? left.requiredLevel - right.requiredLevel || byName : byName;
        return comparison * direction;
      });
    }
    async function chooseGem(gem) {
      if (selectionInProgress) return;
      selectionInProgress = true;
      try {
        if (await onSelect(gem.key)) close();
      } finally {
        selectionInProgress = false;
      }
    }
    function createGemRow(gem) {
      const row = doc.createElement("div");
      row.className = `poe-trade-styler-gem-item is-${gem.attributes.length > 1 ? "hybrid" : gem.attribute}`;
      row.classList.toggle("is-selected", gem.key === presetState.selectedGemKey);
      const button = doc.createElement("button");
      button.className = "poe-trade-styler-gem-item-select";
      button.type = "button";
      button.dataset.poeTradeStylerGem = gem.key;
      button.title = `Choose ${gem.name}`;
      const icon = doc.createElement("img");
      icon.className = "poe-trade-styler-gem-item-icon";
      icon.src = getSafeItemImageUrl(gem.icon);
      icon.alt = "";
      icon.loading = "lazy";
      icon.setAttribute("aria-hidden", "true");
      const detail = doc.createElement("span");
      detail.className = "poe-trade-styler-gem-item-detail";
      appendText2(doc, detail, "strong", "poe-trade-styler-gem-item-name", gem.name);
      appendText2(
        doc,
        detail,
        "span",
        "poe-trade-styler-gem-item-tags",
        gem.tags.join(" \xB7 ")
      );
      appendText2(
        doc,
        detail,
        "span",
        "poe-trade-styler-gem-item-levels",
        `Gemcut ${gem.tier} \xB7 Player ${gem.requiredLevel}`
      );
      button.prepend(icon, detail);
      button.addEventListener("click", () => void chooseGem(gem));
      const externalLink = doc.createElement("a");
      externalLink.className = "poe-trade-styler-gem-item-source";
      externalLink.href = getExternalGemUrl(gem.name);
      externalLink.target = "_blank";
      externalLink.rel = "noopener noreferrer";
      externalLink.textContent = "More info";
      externalLink.title = `View external information for ${gem.name}`;
      row.append(button, favorites.createButton(doc, gem), externalLink);
      return row;
    }
    function render() {
      if (!list || !summary) return;
      const gems = filteredGems();
      summary.textContent = `${gems.length} skill gem${gems.length === 1 ? "" : "s"}`;
      list.replaceChildren(...gems.map(createGemRow));
      list.scrollTop = 0;
      modal?.querySelectorAll(".poe-trade-styler-gem-attribute").forEach((button) => {
        const active = button.dataset.poeTradeStylerGemAttribute === selectedAttribute;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", String(active));
      });
      const allBaseGems = baseFilteredGems();
      const baseGems = favoriteOnly ? favorites.getItems(allBaseGems) : allBaseGems;
      modal?.querySelectorAll(
        ".poe-trade-styler-gem-tag[data-poe-trade-styler-gem-tag]"
      ).forEach((button) => {
        const tag = button.dataset.poeTradeStylerGemTag || "";
        const active = selectedTags.has(tag);
        const candidateTags = active ? selectedTags : /* @__PURE__ */ new Set([...selectedTags, tag]);
        const count = baseGems.filter((gem) => matchesTags(gem, candidateTags)).length;
        button.classList.toggle("is-active", active);
        button.disabled = !active && count === 0;
        button.setAttribute("aria-pressed", String(active));
        button.setAttribute(
          "aria-label",
          `${tag}, ${count} matching gem${count === 1 ? "" : "s"}`
        );
        const countBadge = button.querySelector(
          ".poe-trade-styler-gem-tag-count"
        );
        if (countBadge) countBadge.textContent = String(count);
      });
      const favoriteFilter = modal?.querySelector(
        ".poe-trade-styler-gem-favorites-filter"
      );
      if (favoriteFilter) {
        const favoriteCount = favorites.getItems(
          allBaseGems.filter((gem) => matchesTags(gem, selectedTags))
        ).length;
        favoriteFilter.classList.toggle("is-active", favoriteOnly);
        favoriteFilter.disabled = !favoriteOnly && favoriteCount === 0;
        favoriteFilter.setAttribute("aria-pressed", String(favoriteOnly));
        favoriteFilter.setAttribute(
          "aria-label",
          `Favorites, ${favoriteCount} matching gem${favoriteCount === 1 ? "" : "s"}`
        );
        const countBadge = favoriteFilter.querySelector(
          ".poe-trade-styler-gem-tag-count"
        );
        if (countBadge) countBadge.textContent = String(favoriteCount);
      }
    }
    function createAttributeFilters() {
      const filters = doc.createElement("div");
      filters.className = "poe-trade-styler-gem-attributes";
      ["all", ...gemData.GEM_ATTRIBUTES].forEach((attribute) => {
        const button = doc.createElement("button");
        button.className = `poe-trade-styler-gem-attribute is-${attribute}`;
        button.type = "button";
        button.dataset.poeTradeStylerGemAttribute = attribute;
        button.title = `Show ${ATTRIBUTE_LABELS[attribute].toLowerCase()} skill gems`;
        button.setAttribute("aria-label", ATTRIBUTE_LABELS[attribute]);
        appendText2(
          doc,
          button,
          "span",
          "poe-trade-styler-gem-attribute-icon",
          ATTRIBUTE_SHORT_LABELS[attribute]
        );
        button.addEventListener("click", () => {
          selectedAttribute = attribute;
          render();
        });
        filters.append(button);
      });
      return filters;
    }
    function createSortControls() {
      const controls = doc.createElement("div");
      controls.className = "poe-trade-styler-gem-sort-controls";
      const select = doc.createElement("select");
      select.className = "poe-trade-styler-gem-sort-field";
      select.setAttribute("aria-label", "Sort gems by");
      const nameOption = doc.createElement("option");
      nameOption.value = "name";
      nameOption.textContent = "Name";
      const requiredLevelOption = doc.createElement("option");
      requiredLevelOption.value = "required-level";
      requiredLevelOption.textContent = "Required level + name";
      select.append(nameOption, requiredLevelOption);
      select.value = sortField;
      select.addEventListener("change", () => {
        sortField = select.value === "required-level" ? "required-level" : "name";
        render();
      });
      const directionButton = doc.createElement("button");
      directionButton.className = "poe-trade-styler-gem-sort-direction";
      directionButton.type = "button";
      const syncDirectionButton = () => {
        const ascending = sortDirection === "asc";
        directionButton.textContent = ascending ? "ASC" : "DESC";
        directionButton.title = ascending ? "Sort ascending; click for descending" : "Sort descending; click for ascending";
        directionButton.setAttribute(
          "aria-label",
          ascending ? "Sort ascending" : "Sort descending"
        );
        directionButton.setAttribute("aria-pressed", String(!ascending));
      };
      directionButton.addEventListener("click", () => {
        sortDirection = sortDirection === "asc" ? "desc" : "asc";
        syncDirectionButton();
        render();
      });
      syncDirectionButton();
      controls.append(select, directionButton);
      return controls;
    }
    function createTagFilters() {
      const filters = doc.createElement("div");
      filters.className = "poe-trade-styler-gem-tags";
      filters.style.setProperty(
        "--gem-tag-row-count",
        String(Math.ceil((gemTags.length + 1) / 3))
      );
      filters.setAttribute("role", "group");
      filters.setAttribute("aria-label", "Filter by gem tags");
      const favoriteButton = doc.createElement("button");
      favoriteButton.className = "poe-trade-styler-gem-tag poe-trade-styler-gem-favorites-filter";
      favoriteButton.type = "button";
      const favoriteLabel = appendText2(
        doc,
        favoriteButton,
        "span",
        "poe-trade-styler-gem-tag-label",
        "\u2605 Favorites"
      );
      appendText2(
        doc,
        favoriteButton,
        "span",
        "poe-trade-styler-gem-tag-count",
        "0"
      );
      favoriteLabel.setAttribute("aria-hidden", "true");
      favoriteButton.addEventListener("click", () => {
        favoriteOnly = !favoriteOnly;
        render();
      });
      filters.append(favoriteButton);
      for (const tag of gemTags) {
        const button = doc.createElement("button");
        button.className = "poe-trade-styler-gem-tag";
        button.type = "button";
        button.dataset.poeTradeStylerGemTag = tag;
        const countBadge = appendText2(
          doc,
          button,
          "span",
          "poe-trade-styler-gem-tag-label",
          tag
        );
        appendText2(
          doc,
          button,
          "span",
          "poe-trade-styler-gem-tag-count",
          "0"
        );
        countBadge.setAttribute("aria-hidden", "true");
        button.addEventListener("click", () => {
          if (selectedTags.has(tag)) selectedTags.delete(tag);
          else selectedTags.add(tag);
          render();
        });
        filters.append(button);
      }
      return filters;
    }
    function createTagSidebar() {
      const sidebar = doc.createElement("aside");
      sidebar.className = "poe-trade-styler-gem-tag-sidebar";
      appendText2(
        doc,
        sidebar,
        "h3",
        "poe-trade-styler-gem-tag-sidebar-title",
        "Tags"
      );
      sidebar.append(createTagFilters());
      return sidebar;
    }
    function createModal() {
      const overlay = doc.createElement("div");
      overlay.id = "poe-trade-styler-gem-modal";
      overlay.hidden = true;
      overlay.setAttribute("role", "dialog");
      overlay.setAttribute("aria-modal", "true");
      overlay.setAttribute("aria-labelledby", "poe-trade-styler-gem-title");
      const dialog = doc.createElement("div");
      dialog.className = "poe-trade-styler-gem-dialog";
      const header = doc.createElement("header");
      header.className = "poe-trade-styler-gem-top";
      const title = appendText2(
        doc,
        header,
        "h2",
        "poe-trade-styler-gem-title",
        "Skill Gem Presets"
      );
      title.id = "poe-trade-styler-gem-title";
      const closeButton = doc.createElement("button");
      closeButton.className = "poe-trade-styler-gem-close";
      closeButton.type = "button";
      closeButton.setAttribute("aria-label", "Close Skill Gem Presets");
      closeButton.textContent = "\xD7";
      closeButton.addEventListener("click", close);
      header.append(closeButton);
      searchInput = doc.createElement("input");
      searchInput.className = "poe-trade-styler-gem-search";
      searchInput.type = "search";
      searchInput.placeholder = "Search skill gems or tags\u2026";
      searchInput.setAttribute("aria-label", "Search skill gems or tags");
      searchInput.addEventListener("input", render);
      const catalogueHeader = doc.createElement("header");
      catalogueHeader.className = "poe-trade-styler-gem-catalogue-header";
      catalogueHeader.append(
        searchInput,
        createSortControls(),
        createAttributeFilters()
      );
      summary = appendText2(
        doc,
        catalogueHeader,
        "span",
        "poe-trade-styler-gem-summary",
        ""
      );
      list = doc.createElement("div");
      list.className = "poe-trade-styler-gem-items";
      const catalogue = doc.createElement("section");
      catalogue.className = "poe-trade-styler-gem-catalogue";
      catalogue.append(catalogueHeader, list);
      const content = doc.createElement("div");
      content.className = "poe-trade-styler-gem-content";
      content.append(createTagSidebar(), catalogue);
      dialog.append(header, content);
      overlay.append(dialog);
      overlay.addEventListener("click", (event) => {
        if (event.target === overlay) close();
      });
      doc.body.append(overlay);
      render();
      return overlay;
    }
    function open() {
      if (!modal) modal = createModal();
      render();
      modal.hidden = false;
      doc.documentElement.classList.add("poe-trade-styler-gem-modal-open");
      launcher?.setAttribute("aria-expanded", "true");
      searchInput?.focus();
    }
    function close() {
      if (!modal || modal.hidden) return false;
      modal.hidden = true;
      doc.documentElement.classList.remove("poe-trade-styler-gem-modal-open");
      launcher?.setAttribute("aria-expanded", "false");
      launcher?.focus();
      return true;
    }
    function createLauncher() {
      const button = doc.createElement("button");
      button.className = "poe-trade-styler-preset poe-trade-styler-gem-preset-button";
      button.type = "button";
      button.dataset.poeTradeStylerPreset = "gems";
      button.setAttribute("aria-label", "Open Skill Gem Presets");
      button.setAttribute("aria-haspopup", "dialog");
      button.setAttribute("aria-expanded", "false");
      button.title = "Open Skill Gem Presets";
      const icon = doc.createElement("img");
      icon.className = "poe-trade-styler-gem-preset-icon";
      icon.src = getSafeItemImageUrl(gemData.GEM_GENERAL_ICON);
      icon.alt = "";
      icon.setAttribute("aria-hidden", "true");
      button.append(icon);
      button.addEventListener("click", async () => {
        if (launcherToggleInProgress) return;
        if (presetState.activePreset !== "gems") {
          open();
          return;
        }
        launcherToggleInProgress = true;
        close();
        try {
          await onDeactivate();
        } finally {
          launcherToggleInProgress = false;
          button.classList.remove("is-active");
          button.setAttribute("aria-pressed", "false");
        }
      });
      return button;
    }
    function removeLauncher() {
      launcher?.closest(".poe-trade-styler-gem-navigation-item")?.remove();
      launcher = null;
      close();
    }
    function decorate() {
      if (!isPoe2Page()) {
        removeLauncher();
        return;
      }
      const flaskButton = doc.querySelector('[data-poe-trade-styler-preset="flasks"]');
      const previousItem = flaskButton?.closest(".poe-trade-styler-preset-navigation-item");
      if (!previousItem) return;
      launcher = doc.querySelector('[data-poe-trade-styler-preset="gems"]') || launcher || createLauncher();
      const active = presetState.activePreset === "gems";
      launcher.classList.toggle("is-active", active);
      launcher.setAttribute("aria-pressed", String(active));
      launcher.title = active ? "Open Skill Gem Presets (the selected gem preset is active)" : "Open Skill Gem Presets";
      let item = launcher.closest(".poe-trade-styler-gem-navigation-item");
      if (!item) {
        item = doc.createElement(previousItem.tagName.toLowerCase() === "li" ? "li" : "span");
        item.className = "poe-trade-styler-preset-navigation-item poe-trade-styler-gem-navigation-item";
        item.append(launcher);
      }
      if (previousItem.nextElementSibling !== item) {
        previousItem.insertAdjacentElement("afterend", item);
      }
      if (!modal) modal = createModal();
    }
    return {
      close,
      decorate,
      destroy() {
        removeLauncher();
        modal?.remove();
        modal = null;
        list = null;
        summary = null;
        searchInput = null;
        doc.documentElement.classList.remove("poe-trade-styler-gem-modal-open");
      }
    };
  }

  // src/content/jewel-helper/controller.ts
  function createJewelHelperFeature({
    document: doc,
    jewelData,
    onDeactivate = async () => void 0,
    onSelect,
    onSelectUnique = async () => false,
    presetState,
    styler,
    uniqueData
  }) {
    let launcher = null;
    let menu = null;
    let launcherToggleInProgress = false;
    function isPoe2Page() {
      return styler.getTradeGameKey(location.pathname) === "poe2" || doc.body.dataset.fixtureGame === "poe2";
    }
    function setOpen(open) {
      if (!menu || !launcher) return;
      menu.hidden = !open;
      launcher.setAttribute("aria-expanded", String(open));
    }
    function close() {
      if (!menu || menu.hidden) return false;
      setOpen(false);
      return true;
    }
    function toggle() {
      if (!menu) return;
      setOpen(menu.hidden);
    }
    function createMenu() {
      const uniqueDefinitions = (uniqueData?.getItemsByType("Jewels") || []).map((item) => ({
        base: item.base,
        displayName: item.name,
        icon: item.officialIcon,
        key: item.key,
        requiredLevel: item.level,
        searchText: `${item.name} ${item.base}`
      }));
      return createBaseMenu(
        "jewels",
        jewelData.JEWEL_BASES,
        async (baseKey) => {
          if (await onSelect(baseKey)) close();
        },
        {
          selectUnique: async (name) => {
            if (await onSelectUnique(name)) close();
          },
          uniqueDefinitions
        }
      );
    }
    function createLauncher() {
      const button = doc.createElement("button");
      button.type = "button";
      button.className = "poe-trade-styler-preset poe-trade-styler-jewel-preset-button";
      button.dataset.poeTradeStylerPreset = "jewels";
      button.setAttribute("aria-label", "Jewel preset");
      button.setAttribute("aria-haspopup", "true");
      button.setAttribute("aria-expanded", "false");
      const icon = doc.createElement("img");
      icon.className = "poe-trade-styler-jewel-preset-icon";
      icon.src = getSafeItemImageUrl(jewelData.JEWEL_GENERAL_ICON);
      icon.alt = "";
      icon.referrerPolicy = "no-referrer";
      icon.setAttribute("aria-hidden", "true");
      button.append(icon);
      button.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (launcherToggleInProgress) return;
        if (presetState.activePreset === "jewels") {
          launcherToggleInProgress = true;
          close();
          try {
            await onDeactivate();
          } finally {
            launcherToggleInProgress = false;
            button.classList.remove("is-active");
            button.setAttribute("aria-pressed", "false");
          }
          return;
        }
        toggle();
      });
      return button;
    }
    function removeLauncher() {
      launcher?.closest(".poe-trade-styler-jewel-navigation-item")?.remove();
      launcher = null;
      menu = null;
    }
    function decorate() {
      if (!isPoe2Page()) {
        removeLauncher();
        return;
      }
      const previousButton = doc.querySelector('[data-poe-trade-styler-preset="gems"]') || doc.querySelector('[data-poe-trade-styler-preset="flasks"]');
      const previousItem = previousButton?.closest(".poe-trade-styler-preset-navigation-item");
      if (!previousItem) return;
      launcher = doc.querySelector('[data-poe-trade-styler-preset="jewels"]') || launcher || createLauncher();
      launcher.classList.toggle("is-active", presetState.activePreset === "jewels");
      launcher.setAttribute("aria-pressed", String(presetState.activePreset === "jewels"));
      let item = launcher.closest(".poe-trade-styler-jewel-navigation-item");
      if (!item) {
        item = doc.createElement(previousItem.tagName.toLowerCase() === "li" ? "li" : "span");
        item.className = "poe-trade-styler-preset-navigation-item poe-trade-styler-jewel-navigation-item";
        item.append(launcher);
      }
      if (!menu) {
        menu = createMenu();
        item.append(menu);
      }
      if (previousItem.nextElementSibling !== item) {
        previousItem.insertAdjacentElement("afterend", item);
      }
    }
    return {
      close,
      decorate,
      destroy() {
        removeLauncher();
      }
    };
  }

  // src/content/search-clear/controller.ts
  var BUTTON_CLASS = "poe-trade-styler-search-clear";
  function createSearchClearFeature({
    document: doc = document,
    onClear = () => void 0
  } = {}) {
    let selectionClearTimer = null;
    function sync(input) {
      const searchControl = input.closest(".multiselect");
      if (!searchControl) return;
      let button = searchControl.querySelector(
        `:scope > .${BUTTON_CLASS}`
      );
      if (!button) {
        button = doc.createElement("button");
        button.className = BUTTON_CLASS;
        button.type = "button";
        button.textContent = "\xD7";
        button.title = "Clear search";
        button.setAttribute("aria-label", "Clear item search");
        button.addEventListener("pointerdown", blockHostPointerEvent);
        button.addEventListener("mousedown", blockHostPointerEvent);
        button.addEventListener("click", onDocumentClick);
        searchControl.append(button);
      }
      const hasSelection = Boolean(
        searchControl.querySelector(".multiselect__single, .multiselect__tag")
      );
      button.hidden = input.value.length === 0 && !hasSelection;
    }
    function decorate() {
      const input = getSearchInput(doc);
      if (input) sync(input);
    }
    function scheduleSelectionBackspace(attemptsRemaining = 2) {
      if (selectionClearTimer !== null) clearTimeout(selectionClearTimer);
      selectionClearTimer = setTimeout(() => {
        selectionClearTimer = null;
        const input = getSearchInput(doc);
        const searchControl = input?.closest(".multiselect");
        const hasSelection = searchControl?.querySelector(
          ".multiselect__single, .multiselect__tag"
        );
        if (!input || !searchControl || !hasSelection) {
          if (input) sync(input);
          return;
        }
        input.focus();
        input.dispatchEvent(
          new KeyboardEvent("keydown", {
            bubbles: true,
            cancelable: true,
            code: "Backspace",
            key: "Backspace"
          })
        );
        sync(input);
        if (attemptsRemaining > 1) {
          scheduleSelectionBackspace(attemptsRemaining - 1);
        }
      }, 0);
    }
    function clearFromButton(button) {
      const searchControl = button.closest(".multiselect");
      const input = searchControl ? getSearchInput(searchControl) : null;
      if (!searchControl || !input) return;
      const hasSelection = Boolean(
        searchControl.querySelector(".multiselect__single, .multiselect__tag")
      );
      const nativeClear = searchControl.querySelector(
        ".multiselect__clear, .multiselect__tag-icon, [aria-label='Clear selection'], [title='Clear selection']"
      );
      onClear();
      nativeClear?.click();
      const currentInput = getSearchInput(doc) ?? input;
      currentInput.value = "";
      currentInput.dispatchEvent(new Event("input", { bubbles: true }));
      currentInput.dispatchEvent(new Event("change", { bubbles: true }));
      currentInput.focus();
      if (hasSelection && !nativeClear) {
        scheduleSelectionBackspace();
      }
      sync(currentInput);
    }
    function getEventButton(event) {
      return event.target instanceof Element ? event.target.closest(`.${BUTTON_CLASS}`) : null;
    }
    function blockHostPointerEvent(event) {
      if (!getEventButton(event)) return;
      event.preventDefault();
      event.stopPropagation();
    }
    function onDocumentClick(event) {
      const button = getEventButton(event);
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      clearFromButton(button);
    }
    function onDocumentInput(event) {
      const input = getSearchInput(doc);
      if (input && event.target === input) sync(input);
    }
    doc.addEventListener("input", onDocumentInput);
    doc.addEventListener("pointerdown", blockHostPointerEvent, true);
    doc.addEventListener("mousedown", blockHostPointerEvent, true);
    doc.addEventListener("click", onDocumentClick, true);
    return {
      decorate,
      destroy() {
        if (selectionClearTimer !== null) clearTimeout(selectionClearTimer);
        selectionClearTimer = null;
        doc.removeEventListener("input", onDocumentInput);
        doc.removeEventListener("pointerdown", blockHostPointerEvent, true);
        doc.removeEventListener("mousedown", blockHostPointerEvent, true);
        doc.removeEventListener("click", onDocumentClick, true);
        doc.querySelectorAll(`.${BUTTON_CLASS}`).forEach(
          (button) => button.remove()
        );
      }
    };
  }

  // src/content/composition/decoration-scheduler.ts
  function createDecorationScheduler(tasks, requestFrame = requestAnimationFrame, cancelFrame = typeof cancelAnimationFrame === "function" ? cancelAnimationFrame : () => void 0) {
    let scheduled = false;
    let frameHandle = null;
    function runNow() {
      scheduled = false;
      frameHandle = null;
      for (const task of tasks) {
        try {
          task.run();
        } catch (error) {
          console.error(
            `[POE Trade Helper] Decoration task failed: ${task.name}`,
            error
          );
        }
      }
    }
    function schedule() {
      if (scheduled) {
        return;
      }
      scheduled = true;
      frameHandle = requestFrame(runNow);
    }
    function destroy() {
      if (frameHandle !== null) {
        cancelFrame(frameHandle);
        frameHandle = null;
      }
      scheduled = false;
    }
    return { destroy, runNow, schedule };
  }

  // src/content/composition/search-filter-change.ts
  var SEARCH_SELECTION_ACTION = ".multiselect__option:not(.multiselect__option--disabled), .multiselect__clear, .multiselect__tag-icon, [aria-label='Clear selection'], [title='Clear selection']";
  function isUserSearchFilterChange(event, doc = document) {
    if (!(event.target instanceof Element)) return false;
    const target = event.target;
    const searchInput = getSearchInput(doc);
    const isUserInput = event.isTrusted || event.constructor.name === "InputEvent";
    if ((event.type === "input" || event.type === "change") && target === searchInput && isUserInput) {
      return true;
    }
    if (event.type !== "click") return false;
    if (target.closest("#trade .controls .clear-btn")) return true;
    if (!event.isTrusted) return false;
    const searchControl = searchInput?.closest(".multiselect");
    return Boolean(
      searchControl?.contains(target) && target.closest(SEARCH_SELECTION_ACTION)
    );
  }

  // src/content/composition/app.ts
  function asElement(target) {
    return target instanceof Element ? target : null;
  }
  function createContentApp(dependencies, environment = {}) {
    const doc = environment.document ?? document;
    const browserWindow = environment.window ?? window;
    const { charmData, corruptionData, flaskData, gemData, gearData, jewelData, styler, tabletData, uniqueData, waystoneData } = dependencies;
    let applyState = () => void 0;
    const settingsFeature = createSettingsFeature({
      document: doc,
      onApply: () => applyState()
    });
    const settings = settingsFeature.state;
    const presetState = createPresetState();
    let isUniquePresetActive = () => false;
    const stats = createStatFiltersFeature({
      charmData,
      corruptionData,
      flaskData,
      gearData,
      isUniqueActive: () => isUniquePresetActive(),
      jewelData,
      persistSettings: settingsFeature.persist,
      presetState,
      settings,
      styler,
      tabletData,
      waystoneData
    });
    const quickFilters = createQuickFiltersFeature({
      gemData,
      normalizeText: stats.normalizeText,
      styler,
      waitForElement: stats.waitForElement
    });
    const nativeForm = createNativeTradeForm({
      document: doc,
      normalize: stats.normalizeText,
      waitForElement: stats.waitForElement
    });
    const presets = createPresetsFeature({
      charmData,
      flaskData,
      gemData,
      gearData,
      jewelData,
      nativeForm,
      presetState,
      stats,
      styler,
      tabletData,
      uniqueData,
      waystoneData
    });
    isUniquePresetActive = presets.isUniqueActive;
    const gemHelper = createGemHelperFeature({
      document: doc,
      gemData,
      onDeactivate: presets.deactivate,
      onSelect: presets.selectGem,
      persistSettings: settingsFeature.persist,
      presetState,
      settings,
      styler
    });
    const jewelHelper = createJewelHelperFeature({
      document: doc,
      jewelData,
      onDeactivate: presets.deactivate,
      onSelect: presets.selectJewel,
      onSelectUnique: presets.selectUniqueItem,
      presetState,
      styler,
      uniqueData
    });
    const gearHelper = createGearHelperFeature({
      document: doc,
      gearData,
      onDeactivate: presets.deactivate,
      onSelect: presets.selectGear,
      presetState,
      styler
    });
    const uniqueHelper = createUniqueHelperFeature({
      corruptionData,
      document: doc,
      isActive: presets.isUniqueActive,
      onDeactivate: presets.deactivate,
      onBeforeOpen: async () => {
        return presets.prepareUniqueGroups();
      },
      onSearchItem: presets.searchUniqueItem,
      persistSettings: settingsFeature.persist,
      settings,
      styler,
      uniqueData
    });
    const layout = createLayoutFeature({
      document: doc,
      isStickySearchEnabled: () => settings.stickySearchPanel,
      isTwoColumnEnabled: () => settings.twoColumnLayout,
      styler,
      window: browserWindow
    });
    const deactivatePresetForSearchChange = () => {
      void presets.deactivate();
    };
    const searchClear = createSearchClearFeature({
      document: doc,
      onClear: deactivatePresetForSearchChange
    });
    settingsFeature.mount();
    applyState = () => {
      styler.setBackgroundDisabled(doc, settings.disableBackground);
      styler.setFullWidthEnabled(doc, settings.fullWidthScreen);
      doc.documentElement.classList.toggle(
        "poe-trade-styler-hide-irrelevant-affixes",
        settings.hideIrrelevantAffixes
      );
      styler.setRightSpaceEnabled(doc, settings.rightSpaceForBetterTrading);
      styler.setStickySearchEnabled(doc, settings.stickySearchPanel);
      styler.setTwoColumnEnabled(doc, settings.twoColumnLayout);
      stats.decorateOptions();
      presets.decorate();
      gemHelper.decorate();
      jewelHelper.decorate();
      gearHelper.decorate();
      uniqueHelper.decorate();
      quickFilters.decorate();
      searchClear.decorate();
      layout.sync();
    };
    const onDocumentPointerDown = (event) => {
      const target = asElement(event.target);
      if (target?.closest("#trade .filter-body")) {
        setTimeout(quickFilters.requestSync, 0);
        setTimeout(quickFilters.requestSync, 80);
      }
      if (!target?.closest(".poe-trade-styler-preset-navigation-item")) {
        presets.closeMenus();
      }
      if (!target?.closest(".poe-trade-styler-jewel-navigation-item")) {
        jewelHelper.close();
      }
    };
    const onDocumentKeyDown = (event) => {
      if (quickFilters.handleKeyDown(event)) return;
      if (event.key === "Escape" && uniqueHelper.close()) return;
      if (event.key === "Escape" && gearHelper.close()) return;
      if (event.key === "Escape" && gemHelper.close()) return;
      if (event.key === "Escape" && jewelHelper.close()) return;
      if (event.key === "Escape" && presets.closeMenus()) return;
      if (event.key === "Escape" && quickFilters.closeBoundPopovers()) {
        quickFilters.requestSync();
        return;
      }
      if (event.key === "Escape" && settingsFeature.handleEscape()) return;
    };
    const onViewportChange = () => {
      layout.sync();
    };
    const onDocumentInput = (event) => {
      if (isUserSearchFilterChange(event, doc)) {
        deactivatePresetForSearchChange();
      }
      const target = asElement(event.target);
      if (target?.closest("#trade .filter-body") || target?.matches(TRADE_SELECTORS.searchInput)) {
        quickFilters.requestSync();
      }
    };
    const onDocumentChange = (event) => {
      if (isUserSearchFilterChange(event, doc)) {
        deactivatePresetForSearchChange();
      }
      if (asElement(event.target)?.closest("#trade .filter-body")) {
        quickFilters.requestSync();
      }
    };
    const onDocumentClick = (event) => {
      if (isUserSearchFilterChange(event, doc)) {
        deactivatePresetForSearchChange();
      }
      const target = asElement(event.target);
      if (!quickFilters.isGroupToggleInProgress() && !target?.closest(".poe-trade-styler-quick-rarity-filter") && !target?.closest(".poe-trade-styler-quick-number-filter") && !target?.closest(".poe-trade-styler-quick-bound-filter")) {
        quickFilters.closeBoundPopovers();
      }
      quickFilters.requestSync();
      browserWindow.requestAnimationFrame(layout.sync);
    };
    doc.addEventListener("pointerdown", onDocumentPointerDown);
    doc.addEventListener("keydown", onDocumentKeyDown);
    doc.addEventListener("input", onDocumentInput);
    doc.addEventListener("change", onDocumentChange);
    doc.addEventListener("click", onDocumentClick);
    browserWindow.addEventListener("resize", onViewportChange);
    browserWindow.addEventListener("scroll", onViewportChange, { passive: true });
    const decorationScheduler = createDecorationScheduler(
      [
        { name: "stat-filters", run: stats.decorateOptions },
        { name: "result-modifiers", run: stats.decorateResultModifiers },
        { name: "presets", run: presets.decorate },
        { name: "gem-helper", run: gemHelper.decorate },
        { name: "jewel-helper", run: jewelHelper.decorate },
        { name: "gear-helper", run: gearHelper.decorate },
        { name: "unique-helper", run: uniqueHelper.decorate },
        { name: "quick-filters", run: quickFilters.decorate },
        { name: "search-clear", run: searchClear.decorate },
        { name: "layout", run: layout.sync }
      ],
      browserWindow.requestAnimationFrame.bind(browserWindow),
      browserWindow.cancelAnimationFrame.bind(browserWindow)
    );
    const observer = new MutationObserver(decorationScheduler.schedule);
    observer.observe(doc.body, { childList: true, subtree: true });
    settingsFeature.start();
    return {
      destroy() {
        observer.disconnect();
        decorationScheduler.destroy();
        doc.removeEventListener("pointerdown", onDocumentPointerDown);
        doc.removeEventListener("keydown", onDocumentKeyDown);
        doc.removeEventListener("input", onDocumentInput);
        doc.removeEventListener("change", onDocumentChange);
        doc.removeEventListener("click", onDocumentClick);
        browserWindow.removeEventListener("resize", onViewportChange);
        browserWindow.removeEventListener("scroll", onViewportChange);
        searchClear.destroy();
        layout.destroy();
        settingsFeature.destroy();
        uniqueHelper.destroy();
        gearHelper.destroy();
        gemHelper.destroy();
        jewelHelper.destroy();
      }
    };
  }

  // src/content/composition/legacy-dependencies.ts
  var REQUIRED_GLOBALS = {
    charmData: "Poe2CharmData",
    corruptionData: "Poe2CorruptionData",
    flaskData: "Poe2FlaskData",
    gemData: "Poe2GemData",
    gearData: "Poe2GearData",
    jewelData: "Poe2JewelData",
    styler: "PoeTradeStyler",
    tabletData: "Poe2TabletData",
    uniqueData: "Poe2UniqueData",
    waystoneData: "Poe2WaystoneData"
  };
  function requireLegacyGlobal(root, globalName) {
    const value = Reflect.get(root, globalName);
    if (!value || typeof value !== "object") {
      throw new Error(
        `[POE Trade Helper] Required dependency ${globalName} was not loaded.`
      );
    }
    return value;
  }
  function getLegacyDependencies(root = globalThis) {
    return Object.fromEntries(
      Object.entries(REQUIRED_GLOBALS).map(([key, globalName]) => [
        key,
        requireLegacyGlobal(root, globalName)
      ])
    );
  }

  // src/content/index.ts
  var RUNTIME_KEY = "__poeTradeStylerRuntime";
  function getCurrentRuntime() {
    return Reflect.get(globalThis, RUNTIME_KEY) ?? null;
  }
  if (!getCurrentRuntime()) {
    Reflect.set(globalThis, RUNTIME_KEY, createContentApp(getLegacyDependencies()));
  }
})();
