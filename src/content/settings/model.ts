export interface StylerSettings {
  disableBackground: boolean;
  fullWidthScreen: boolean;
  gemItemFavorites: string[];
  hideIrrelevantAffixes: boolean;
  rightSpaceForBetterTrading: boolean;
  statFilterFavorites: string[];
  stickySearchPanel: boolean;
  twoColumnLayout: boolean;
  uniqueItemFavorites: string[];
}

export const DEFAULT_SETTINGS: Readonly<StylerSettings> = Object.freeze({
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
