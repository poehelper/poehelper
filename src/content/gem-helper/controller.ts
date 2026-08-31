import type {
  GemAttribute,
  GemDataPort,
  GemDefinition,
  StylerPort
} from "../ports";
import type { PresetState } from "../presets/state";
import { getSafeItemImageUrl } from "../image-assets";
import {
  createGemFavorites,
  type GemFavoritesSettings
} from "./favorites";

export interface GemHelperFeature {
  close(): boolean;
  decorate(): void;
  destroy(): void;
}

type GemSelectionHandler = (key: string) => Promise<boolean>;
type AttributeFilter = GemAttribute | "all";
type GemSortField = "name" | "required-level";
type SortDirection = "asc" | "desc";

const ATTRIBUTE_LABELS: Readonly<Record<AttributeFilter, string>> = Object.freeze({
  all: "All",
  strength: "Strength",
  dexterity: "Dexterity",
  intelligence: "Intelligence"
});

const ATTRIBUTE_SHORT_LABELS: Readonly<Record<AttributeFilter, string>> = Object.freeze({
  all: "ALL",
  strength: "STR",
  dexterity: "DEX",
  intelligence: "INT"
});

function appendText(
  doc: Document,
  parent: ParentNode,
  tag: string,
  className: string,
  text: string
): HTMLElement {
  const element = doc.createElement(tag);
  element.className = className;
  element.textContent = text;
  parent.append(element);
  return element;
}

function getExternalGemUrl(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[\u2018\u2019']/g, "")
    .replace(/\s+/g, "_");
  return `https://poe2db.tw/us/${encodeURIComponent(slug)}`;
}

export function createGemHelperFeature({
  document: doc = document,
  gemData,
  onDeactivate = async () => undefined,
  onSelect,
  persistSettings = () => undefined,
  presetState,
  settings = { gemItemFavorites: [] },
  styler
}: {
  document?: Document;
  gemData: GemDataPort;
  onDeactivate?: () => Promise<void>;
  onSelect: GemSelectionHandler;
  persistSettings?: () => void;
  presetState: PresetState;
  settings?: GemFavoritesSettings;
  styler: StylerPort;
}): GemHelperFeature {
  let launcher: HTMLButtonElement | null = null;
  let modal: HTMLDivElement | null = null;
  let list: HTMLDivElement | null = null;
  let summary: HTMLElement | null = null;
  let searchInput: HTMLInputElement | null = null;
  let selectedAttribute: AttributeFilter = "all";
  let favoriteOnly = false;
  let sortDirection: SortDirection = "asc";
  let sortField: GemSortField = "name";
  let selectionInProgress = false;
  let launcherToggleInProgress = false;
  const selectedTags = new Set<string>();
  const gemTags = [...new Set(
    gemData.GEM_DEFINITIONS.flatMap((gem) => [...gem.tags])
  )].sort((left, right) => left.localeCompare(right, "en", { sensitivity: "base" }));
  const favorites = createGemFavorites({
    onChange: render,
    persistSettings,
    settings
  });
  function isPoe2Page(): boolean {
    return (
      styler.getTradeGameKey(location.pathname) === "poe2" ||
      doc.body.dataset.fixtureGame === "poe2"
    );
  }

  function baseFilteredGems(): GemDefinition[] {
    return gemData.getGems({
      attribute: selectedAttribute,
      query: searchInput?.value || ""
    });
  }

  function matchesTags(gem: GemDefinition, tags: Iterable<string>): boolean {
    return [...tags].every((tag) => gem.tags.includes(tag));
  }

  function filteredGems(): GemDefinition[] {
    const gems = baseFilteredGems().filter((gem) => matchesTags(gem, selectedTags));
    const visibleGems = favoriteOnly ? favorites.getItems(gems) : gems;
    const direction = sortDirection === "asc" ? 1 : -1;
    return [...visibleGems].sort((left, right) => {
      const byName = left.name.localeCompare(right.name, "en", {
        sensitivity: "base"
      });
      const comparison = sortField === "required-level"
        ? left.requiredLevel - right.requiredLevel || byName
        : byName;
      return comparison * direction;
    });
  }

  async function chooseGem(gem: GemDefinition): Promise<void> {
    if (selectionInProgress) return;
    selectionInProgress = true;
    try {
      if (await onSelect(gem.key)) close();
    } finally {
      selectionInProgress = false;
    }
  }

  function createGemRow(gem: GemDefinition): HTMLDivElement {
    const row = doc.createElement("div");
    row.className = `poe-trade-styler-gem-item is-${
      gem.attributes.length > 1 ? "hybrid" : gem.attribute
    }`;
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
    appendText(doc, detail, "strong", "poe-trade-styler-gem-item-name", gem.name);
    appendText(
      doc,
      detail,
      "span",
      "poe-trade-styler-gem-item-tags",
      gem.tags.join(" · ")
    );
    appendText(
      doc,
      detail,
      "span",
      "poe-trade-styler-gem-item-levels",
      `Gemcut ${gem.tier} · Player ${gem.requiredLevel}`
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

  function render(): void {
    if (!list || !summary) return;
    const gems = filteredGems();
    summary.textContent = `${gems.length} skill gem${gems.length === 1 ? "" : "s"}`;
    list.replaceChildren(...gems.map(createGemRow));
    list.scrollTop = 0;
    modal
      ?.querySelectorAll<HTMLButtonElement>(".poe-trade-styler-gem-attribute")
      .forEach((button) => {
        const active = button.dataset.poeTradeStylerGemAttribute === selectedAttribute;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", String(active));
      });
    const allBaseGems = baseFilteredGems();
    const baseGems = favoriteOnly
      ? favorites.getItems(allBaseGems)
      : allBaseGems;
    modal
      ?.querySelectorAll<HTMLButtonElement>(
        ".poe-trade-styler-gem-tag[data-poe-trade-styler-gem-tag]"
      )
      .forEach((button) => {
        const tag = button.dataset.poeTradeStylerGemTag || "";
        const active = selectedTags.has(tag);
        const candidateTags = active
          ? selectedTags
          : new Set([...selectedTags, tag]);
        const count = baseGems.filter((gem) => matchesTags(gem, candidateTags)).length;
        button.classList.toggle("is-active", active);
        button.disabled = !active && count === 0;
        button.setAttribute("aria-pressed", String(active));
        button.setAttribute(
          "aria-label",
          `${tag}, ${count} matching gem${count === 1 ? "" : "s"}`
        );
        const countBadge = button.querySelector<HTMLElement>(
          ".poe-trade-styler-gem-tag-count"
        );
        if (countBadge) countBadge.textContent = String(count);
      });
    const favoriteFilter = modal?.querySelector<HTMLButtonElement>(
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
      const countBadge = favoriteFilter.querySelector<HTMLElement>(
        ".poe-trade-styler-gem-tag-count"
      );
      if (countBadge) countBadge.textContent = String(favoriteCount);
    }
  }

  function createAttributeFilters(): HTMLDivElement {
    const filters = doc.createElement("div");
    filters.className = "poe-trade-styler-gem-attributes";
    (["all", ...gemData.GEM_ATTRIBUTES] as AttributeFilter[]).forEach((attribute) => {
      const button = doc.createElement("button");
      button.className =
        `poe-trade-styler-gem-attribute is-${attribute}`;
      button.type = "button";
      button.dataset.poeTradeStylerGemAttribute = attribute;
      button.title = `Show ${ATTRIBUTE_LABELS[attribute].toLowerCase()} skill gems`;
      button.setAttribute("aria-label", ATTRIBUTE_LABELS[attribute]);
      appendText(
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

  function createSortControls(): HTMLDivElement {
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
    const syncDirectionButton = (): void => {
      const ascending = sortDirection === "asc";
      directionButton.textContent = ascending ? "ASC" : "DESC";
      directionButton.title = ascending
        ? "Sort ascending; click for descending"
        : "Sort descending; click for ascending";
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

  function createTagFilters(): HTMLDivElement {
    const filters = doc.createElement("div");
    filters.className = "poe-trade-styler-gem-tags";
    filters.style.setProperty(
      "--gem-tag-row-count",
      String(Math.ceil((gemTags.length + 1) / 3))
    );
    filters.setAttribute("role", "group");
    filters.setAttribute("aria-label", "Filter by gem tags");
    const favoriteButton = doc.createElement("button");
    favoriteButton.className =
      "poe-trade-styler-gem-tag poe-trade-styler-gem-favorites-filter";
    favoriteButton.type = "button";
    const favoriteLabel = appendText(
      doc,
      favoriteButton,
      "span",
      "poe-trade-styler-gem-tag-label",
      "★ Favorites"
    );
    appendText(
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
      const countBadge = appendText(
        doc,
        button,
        "span",
        "poe-trade-styler-gem-tag-label",
        tag
      );
      appendText(
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

  function createTagSidebar(): HTMLElement {
    const sidebar = doc.createElement("aside");
    sidebar.className = "poe-trade-styler-gem-tag-sidebar";
    appendText(
      doc,
      sidebar,
      "h3",
      "poe-trade-styler-gem-tag-sidebar-title",
      "Tags"
    );
    sidebar.append(createTagFilters());
    return sidebar;
  }

  function createModal(): HTMLDivElement {
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
    const title = appendText(
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
    closeButton.textContent = "×";
    closeButton.addEventListener("click", close);
    header.append(closeButton);

    searchInput = doc.createElement("input");
    searchInput.className = "poe-trade-styler-gem-search";
    searchInput.type = "search";
    searchInput.placeholder = "Search skill gems or tags…";
    searchInput.setAttribute("aria-label", "Search skill gems or tags");
    searchInput.addEventListener("input", render);

    const catalogueHeader = doc.createElement("header");
    catalogueHeader.className = "poe-trade-styler-gem-catalogue-header";
    catalogueHeader.append(
      searchInput,
      createSortControls(),
      createAttributeFilters()
    );
    summary = appendText(
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

  function open(): void {
    if (!modal) modal = createModal();
    render();
    modal.hidden = false;
    doc.documentElement.classList.add("poe-trade-styler-gem-modal-open");
    launcher?.setAttribute("aria-expanded", "true");
    searchInput?.focus();
  }

  function close(): boolean {
    if (!modal || modal.hidden) return false;
    modal.hidden = true;
    doc.documentElement.classList.remove("poe-trade-styler-gem-modal-open");
    launcher?.setAttribute("aria-expanded", "false");
    launcher?.focus();
    return true;
  }

  function createLauncher(): HTMLButtonElement {
    const button = doc.createElement("button");
    button.className =
      "poe-trade-styler-preset poe-trade-styler-gem-preset-button";
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

  function removeLauncher(): void {
    launcher?.closest(".poe-trade-styler-gem-navigation-item")?.remove();
    launcher = null;
    close();
  }

  function decorate(): void {
    if (!isPoe2Page()) {
      removeLauncher();
      return;
    }
    const flaskButton = doc.querySelector('[data-poe-trade-styler-preset="flasks"]');
    const previousItem = flaskButton?.closest(".poe-trade-styler-preset-navigation-item");
    if (!previousItem) return;
    launcher =
      doc.querySelector<HTMLButtonElement>('[data-poe-trade-styler-preset="gems"]') ||
      launcher ||
      createLauncher();
    const active = presetState.activePreset === "gems";
    launcher.classList.toggle("is-active", active);
    launcher.setAttribute("aria-pressed", String(active));
    launcher.title = active
      ? "Open Skill Gem Presets (the selected gem preset is active)"
      : "Open Skill Gem Presets";
    let item = launcher.closest(".poe-trade-styler-gem-navigation-item");
    if (!item) {
      item = doc.createElement(previousItem.tagName.toLowerCase() === "li" ? "li" : "span");
      item.className =
        "poe-trade-styler-preset-navigation-item poe-trade-styler-gem-navigation-item";
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
