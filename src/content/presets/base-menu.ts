import { getSafeItemImageUrl } from "../image-assets";

export type BasePresetMode = "charms" | "flasks" | "jewels" | "tablets";

export interface BaseMenuDefinition {
  baseStat?: string;
  displayName: string;
  icon: string;
  key: string;
  requiredLevel?: number;
}

export function createBaseMenu(
  preset: BasePresetMode,
  definitions: readonly BaseMenuDefinition[],
  selectBase: (key: string) => Promise<void>
): HTMLDivElement {
  const singular = preset.replace(/s$/, "");
  const menu = document.createElement("div");
  menu.className = `poe-trade-styler-${singular}-base-menu`;
  menu.hidden = true;
  menu.setAttribute("role", "radiogroup");
  menu.setAttribute("aria-label", `${singular} base`);

  if (preset === "flasks") {
    ["Life Flasks", "Mana Flasks"].forEach((text) => {
      const heading = document.createElement("div");
      heading.className = "poe-trade-styler-flask-column-heading";
      heading.textContent = text;
      menu.append(heading);
    });
  }

  definitions.forEach((definition) => {
    const option = document.createElement("button");
    option.className =
      `poe-trade-styler-base-option poe-trade-styler-${singular}-base-option`;
    option.type = "button";
    option.dataset.poeTradeStylerBaseKey = definition.key;
    option.dataset.poeTradeStylerBasePreset = preset;
    const detail = definition.baseStat ||
      (definition.requiredLevel ? `Requires Level ${definition.requiredLevel}` : "");
    option.title = detail ? `${definition.displayName} — ${detail}` : definition.displayName;
    option.setAttribute("role", "radio");
    option.setAttribute(
      "aria-label",
      detail ? `${definition.displayName}. ${detail}` : definition.displayName
    );
    option.setAttribute("aria-checked", "false");

    const icon = document.createElement("img");
    icon.src = getSafeItemImageUrl(definition.icon);
    icon.referrerPolicy = "no-referrer";
    icon.alt = "";
    icon.setAttribute("aria-hidden", "true");
    const label = document.createElement("span");
    label.className = "poe-trade-styler-base-option-label";
    label.textContent = definition.displayName;
    if (definition.baseStat) {
      label.dataset.poeTradeStylerBaseStat = definition.baseStat;
    }
    option.append(icon, label);
    if (definition.requiredLevel) {
      const level = document.createElement("span");
      level.className = "poe-trade-styler-flask-base-level";
      level.textContent = String(definition.requiredLevel);
      option.append(level);
    }
    option.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      void selectBase(definition.key);
    });
    menu.append(option);
  });

  return menu;
}
