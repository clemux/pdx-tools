import { compatibilityReport } from "@/lib/compatibility";
import { check } from "@/lib/isPresent";
import { IMG_HEIGHT, IMG_WIDTH, WebGLMap } from "map";
import { useSaveQuery } from "@/services/appApi";
import { createContext, useContext, useMemo } from "react";
import { StoreApi, createStore, useStore } from "zustand";
import { loadTerrainOverlayImages } from "../features/map/resources";
import { MapPayload } from "../types/map";
import {
  CountryMatcher,
  EnhancedMeta,
  Achievements,
  EnhancedCountryInfo,
  MapDate,
} from "../types/models";
import { getEu4Worker } from "../worker";
import type { MapTimelapseItem } from "../worker/module";

export const emptyEu4CountryFilter: CountryMatcher = {
  players: "none",
  ai: "none",
  subcontinents: [],
  include: [],
  exclude: [],
  includeSubjects: false,
};

export const initialEu4CountryFilter: CountryMatcher = {
  ...emptyEu4CountryFilter,
  players: "all",
  ai: "alive",
};

type Eu4StateProps = {
  save: {
    meta: EnhancedMeta;
    achievements: Achievements;
    countries: EnhancedCountryInfo[];
    defaultSelectedCountry: string;
    saveInfo:
      | { kind: "sync"; data: string }
      | { kind: "async"; saveId: string };
    initialPoliticalMapColors: Uint8Array;
  };
  map: WebGLMap;
};

type Eu4State = Eu4StateProps & {
  mapMode: MapPayload["kind"];
  showSecondaryColor: boolean;
  paintSubjectInOverlordHue: boolean;
  countryFilter: CountryMatcher;
  renderTerrain: boolean;
  showProvinceBorders: boolean;
  showCountryBorders: boolean;
  showMapModeBorders: boolean;
  selectedTag: string;
  countryDrawerVisible: boolean;
  selectedDate: MapDate;
  showOneTimeLineItems: boolean;
  prefereredValueFormat: "absolute" | "percent";
  actions: {
    closeCountryDrawer: () => void;
    openCountryDrawer: () => void;
    panToTag: (tag: string, offset?: number) => Promise<void>;
    setMapMode: (mode: Eu4State["mapMode"]) => Promise<void>;
    setMapShowStripes: (enabled: boolean) => Promise<void>;
    setPaintSubjectInOverlordHue: (enabled: boolean) => Promise<void>;
    setShowProvinceBorders: (enabled: boolean) => void;
    setShowCountryBorders: (enabled: boolean) => void;
    setShowMapModeBorders: (enabled: boolean) => void;
    setTerrainOverlay: (enabled: boolean) => Promise<void> | undefined;
    setPrefersPercents: (enabled: boolean) => void;
    setShowOneTimeLineItems: (enabled: boolean) => void;
    setSelectedTag: (tag: string) => void;
    setSelectedDate: (date: Eu4State["selectedDate"] | null) => void;
    setSelectedDateDay: (days: number) => Promise<void>;
    setSelectedDateText: (text: string) => Promise<void>;
    updateProvinceColors: () => Promise<void>;
    updateMap: (frame: MapTimelapseItem) => void;
    updateTagFilter: (matcher: Partial<CountryMatcher>) => Promise<void>;
    updateSave: (save: {
      meta: EnhancedMeta;
      achievements: Achievements;
      countries: EnhancedCountryInfo[];
    }) => Promise<void>;
    zoomIn: () => void;
    zoomOut: () => void;
  };
};

export type Eu4Store = StoreApi<Eu4State>;
type Eu4StoreInit = Eu4StateProps & { store: Eu4Store | null };
export const Eu4SaveContext = createContext<Eu4Store | null>(null);

export const createEu4Store = async ({
  store: prevStore,
  save,
  map,
}: Eu4StoreInit) => {
  const defaults = {
    mapMode: "political",
    paintSubjectInOverlordHue: false,
    showSecondaryColor: true,
    showOneTimeLineItems: true,
    prefereredValueFormat: "absolute",
    countryFilter: initialEu4CountryFilter,
    showProvinceBorders: true,
    showCountryBorders: true,
    showMapModeBorders: false,
    countryDrawerVisible: false,
  } as const;

  const syncMapSettings = (state: Eu4State) => {
    const report = compatibilityReport().webgl2;
    state.map.renderTerrain =
      state.renderTerrain && report.enabled && !report.performanceCaveat;
    state.map.showProvinceBorders = state.showProvinceBorders;
    state.map.showCountryBorders = selectShowCountryBorders(state);
    state.map.showMapModeBorders = state.showMapModeBorders;

    persistMapSettings({
      renderTerrain: state.renderTerrain,
      showProvinceBorders: state.showProvinceBorders,
      showCountryBorders: state.showCountryBorders,
      showMapModeBorders: state.showMapModeBorders,
    });
  };

  const settings = loadSettings();
  const store = createStore<Eu4State>()((set, get) => ({
    ...defaults,
    ...prevStore?.getState(),
    save,
    map,
    ...settings,
    selectedTag: save.defaultSelectedCountry,
    selectedDate: selectDefaultDate(save.meta),
    actions: {
      closeCountryDrawer: () => set({ countryDrawerVisible: false }),
      openCountryDrawer: () => set({ countryDrawerVisible: true }),
      panToTag: async (tag, offset?: number) => {
        const pos = await getEu4Worker().eu4MapPositionOf(tag);
        map.scale = map.maxScale * (1 / 2);
        focusCameraOn(map, pos, { offsetX: offset });
        map.redrawViewport();
      },
      setMapMode: async (mode: Eu4State["mapMode"]) => {
        if (!dateEnabledMapMode(mode) && dateEnabledMapMode(get().mapMode)) {
          get().map.updateCountryProvinceColors(
            get().save.initialPoliticalMapColors
          );
        }

        set({ mapMode: mode });
        syncMapSettings(get());
        await get().actions.updateProvinceColors();
        get().map.redrawMapImage();
      },
      setMapShowStripes: async (show: boolean) => {
        set({ showSecondaryColor: show });
        await get().actions.updateProvinceColors();
        get().map.redrawMapImage();
      },
      setPaintSubjectInOverlordHue: async (enabled: boolean) => {
        set({ paintSubjectInOverlordHue: enabled });
        await get().actions.updateProvinceColors();
        get().map.redrawMapImage();
      },
      setShowProvinceBorders: (enabled: boolean) => {
        set({ showProvinceBorders: enabled });
        syncMapSettings(get());
        get().map.redrawMapImage();
      },
      setShowCountryBorders: (enabled: boolean) => {
        if (get().mapMode == "political") {
          set({ showMapModeBorders: enabled });
        }

        set({ showCountryBorders: enabled });
        syncMapSettings(get());
        get().map.redrawMapImage();
      },
      setShowMapModeBorders: (enabled: boolean) => {
        set({ showMapModeBorders: enabled });
        syncMapSettings(get());
        get().map.redrawMapImage();
      },

      setTerrainOverlay: async (enabled: boolean) => {
        set({ renderTerrain: enabled });
        syncMapSettings(get());
        if (get().map.renderTerrain) {
          await loadTerrainImages(get().map, selectSaveVersion(get()));
        }
        map.redrawMapImage();
      },
      setSelectedDate: (date: Eu4State["selectedDate"] | null) => {
        if (date !== null) {
          set({ selectedDate: date });
        } else {
          set({ selectedDate: selectDefaultDate(get().save.meta) });
        }
      },
      setSelectedDateDay: async (days: number) => {
        const text = await getEu4Worker().eu4DaysToDate(days);
        get().actions.setSelectedDate({ days, text });
        await get().actions.updateProvinceColors();
        get().map.redrawMapImage();
      },
      setSelectedDateText: async (text: string) => {
        const days = await getEu4Worker().eu4DateToDays(text);
        get().actions.setSelectedDate({ days, text });
        await get().actions.updateProvinceColors();
        get().map.redrawMapImage();
      },

      setSelectedTag: (tag: string) =>
        set({ selectedTag: tag, countryDrawerVisible: true }),
      setPrefersPercents: (checked: boolean) =>
        set({ prefereredValueFormat: checked ? "percent" : "absolute" }),
      setShowOneTimeLineItems: (checked: boolean) =>
        set({ showOneTimeLineItems: checked }),

      updateTagFilter: async (matcher: Partial<CountryMatcher>) => {
        const newFilter = { ...get().countryFilter, ...matcher };
        set({ countryFilter: newFilter });
        await get().actions.updateProvinceColors();
        get().map.redrawMapImage();
      },
      updateProvinceColors: async () => {
        const payload = selectMapPayload(get());
        const colors = await getEu4Worker().eu4MapColors(payload);
        if (colors.country) {
          get().map.updateCountryProvinceColors(colors.country);
        }

        const secondary = get().showSecondaryColor
          ? colors.secondary
          : colors.primary;
        get().map.updateProvinceColors(colors.primary, secondary);
      },
      updateMap: (frame: MapTimelapseItem) => {
        get().actions.setSelectedDate(frame.date);
        get().map.updateCountryProvinceColors(frame.country);
        const stripes = get().showSecondaryColor
          ? frame.secondary
          : frame.primary;
        get().map.updateProvinceColors(frame.primary, stripes);
      },
      async updateSave({ meta, achievements, countries }) {
        set({
          save: {
            ...get().save,
            meta,
            achievements,
            countries,
          },
          selectedDate: selectDefaultDate(meta),
        });

        await get().actions.updateProvinceColors();
        get().map.redrawMapImage();
      },
      zoomIn: () => {
        get().map.zoomIn();
        get().map.redrawViewport();
      },
      zoomOut: () => {
        get().map.zoomOut();
        get().map.redrawViewport();
      },
    },
  }));

  const state = store.getState();
  syncMapSettings(state);
  if (map.renderTerrain) {
    await loadTerrainImages(map, selectSaveVersion(state));
  }

  await state.actions.updateProvinceColors();
  return store;
};

const selectDefaultDate = (meta: EnhancedMeta) => ({
  text: meta.date,
  days: meta.total_days,
});

const selectSaveVersion = (state: Eu4State) =>
  `${state.save.meta.savegame_version.first}.${state.save.meta.savegame_version.second}`;

export const selectMapPayload = (state: Eu4State): MapPayload => ({
  kind: state.mapMode,
  tagFilter: state.countryFilter,
  date: selectDate(state.mapMode, state.save.meta, state.selectedDate)
    .enabledDays,
  paintSubjectInOverlordHue: state.paintSubjectInOverlordHue,
});

export function useEu4Context() {
  return check(useContext(Eu4SaveContext), "Missing Eu4 Save Context");
}

function useEu4Store<T>(
  selector: (state: Eu4State) => T,
  equalityFn?: (left: T, right: T) => boolean
): T {
  return useStore(useEu4Context(), selector, equalityFn);
}

export const useEu4Map = () => useEu4Store((x) => x.map);
export const useEu4Actions = () => useEu4Store((x) => x.actions);
export const useEu4MapMode = () => useEu4Store((x) => x.mapMode);
export const useTerrainOverlay = () => useEu4Store((x) => x.renderTerrain);
export const useMapShowStripes = () => useEu4Store((x) => x.showSecondaryColor);
export const useShowProvinceBorders = () =>
  useEu4Store((x) => x.showProvinceBorders);
export const useShowCountryBorders = () =>
  useEu4Store(selectShowCountryBorders);
export const selectShowCountryBorders = (x: Eu4State) =>
  x.mapMode == "political" ? x.showMapModeBorders : x.showCountryBorders;
export const useShowMapModeBorders = () =>
  useEu4Store((x) => x.showMapModeBorders);
export const usePaintSubjectInOverlordHue = () =>
  useEu4Store((x) => x.paintSubjectInOverlordHue);
export const useEu4Meta = () => useEu4Store((x) => x.save.meta);
export const useAchievements = () => useEu4Store((x) => x.save.achievements);
export const useSelectedTag = () => useEu4Store((x) => x.selectedTag);
export const useTagFilter = () => useEu4Store((x) => x.countryFilter);
export const useValueFormatPreference = () =>
  useEu4Store((x) => x.prefereredValueFormat);
export const useShowOnetimeLineItems = () =>
  useEu4Store((x) => x.showOneTimeLineItems);
export const useCountryDrawerVisible = () =>
  useEu4Store((x) => x.countryDrawerVisible);

export function useEu4ModList() {
  const meta = useEu4Meta();

  return meta.mod_enabled.length > 0
    ? meta.mod_enabled
    : meta.mods_enabled_names.map((x) => x.name);
}

export const useIsServerSaveFile = () => {
  const info = useEu4Store((x) => x.save.saveInfo);
  return info.kind === "async";
};

export const useServerSaveFile = () => {
  const info = useEu4Store((x) => x.save.saveInfo);
  const id = info.kind === "async" ? info.saveId : "";
  const saveQuery = useSaveQuery(id, { enabled: !!id });
  return saveQuery.data;
};

export const useSaveFilename = () => {
  const info = useEu4Store((x) => x.save.saveInfo);
  const serverFile = useServerSaveFile();
  if (info.kind === "sync") {
    return info.data;
  } else {
    return serverFile?.filename ?? "savegame.eu4";
  }
};

export const useCountryNameLookup = () => {
  const countries = useEu4Store((x) => x.save.countries);
  return useMemo(
    () => new Map(countries.map((x) => [x.normalizedName, x])),
    [countries]
  );
};

const useCountryFiltering = (cb: (arg: EnhancedCountryInfo) => boolean) => {
  const countries = useEu4Store((x) => x.save.countries).filter(cb);
  countries.sort((a, b) => a.tag.localeCompare(b.tag));
  return countries;
};

const isHumanFilter = (x: EnhancedCountryInfo) => x.is_human;
export const useHumanCountries = () => useCountryFiltering(isHumanFilter);
const isAiFilter = (x: EnhancedCountryInfo) => !x.is_human;
export const useAiCountries = () => useCountryFiltering(isAiFilter);
const isAliveAiFilter = (x: EnhancedCountryInfo) => !x.is_human && x.is_alive;
export const useAliveAiCountries = () => useCountryFiltering(isAliveAiFilter);

export const useIsDatePickerEnabled = () => {
  const mode = useEu4MapMode();
  return dateEnabledMapMode(mode);
};

const dateEnabledMapMode = (mode: MapPayload["kind"]) => {
  return mode === "political" || mode === "religion" || mode === "battles";
};

const selectDate = (
  mode: MapPayload["kind"],
  meta: EnhancedMeta,
  date: MapDate
) => {
  if (!dateEnabledMapMode(mode)) {
    return {
      kind: "disabled",
      days: meta.total_days,
      text: meta.date,
      enabledDays: null,
    } as const;
  }

  const isCustom = date.days !== meta.total_days;
  return {
    ...date,
    kind: isCustom ? "custom" : "latest",
    enabledDays: isCustom ? date.days : null,
  } as const;
};

export const useSelectedDate = () => {
  const selectedDate = useEu4Store((x) => x.selectedDate);
  const mode = useEu4MapMode();
  const meta = useEu4Meta();
  return useMemo(
    () => selectDate(mode, meta, selectedDate),
    [mode, meta, selectedDate]
  );
};

async function loadTerrainImages(map: WebGLMap, version: string) {
  const images = await loadTerrainOverlayImages(version);
  map.updateTerrainTextures(images);
}

type PersistedMapSettings = {
  renderTerrain: boolean;
  showProvinceBorders: boolean;
  showCountryBorders: boolean;
  showMapModeBorders: boolean;
};

function persistMapSettings(settings: PersistedMapSettings) {
  localStorage.setItem("map-settings", JSON.stringify(settings));
}

function loadSettings(): PersistedMapSettings {
  const deprecatedSettings = {
    renderTerrain: !!JSON.parse(
      localStorage.getItem("map-show-terrain") ?? "false"
    ),
  };

  const mapSettings = JSON.parse(localStorage.getItem("map-settings") ?? "{}");
  return {
    ...deprecatedSettings,
    ...mapSettings,
  };
}

type FocusCameraOnProps = {
  offsetX: number;
  width: number;
  height: number;
};

export function focusCameraOn(
  map: WebGLMap,
  [x, y]: number[],
  options?: Partial<FocusCameraOnProps>
) {
  const width = options?.width ?? map.gl.canvas.width;
  const height = options?.height ?? map.gl.canvas.height;

  const IMG_ASPECT = IMG_WIDTH / IMG_HEIGHT;
  const initX = ((x - IMG_WIDTH / 2) / (IMG_WIDTH / 2)) * (width / 2);
  const initY =
    (((y - IMG_HEIGHT / 2) / (IMG_HEIGHT / 2)) * (height / 2)) /
    (IMG_ASPECT / (width / height));

  map.focusPoint = [initX, initY];

  if (options?.offsetX) {
    map.focusPoint[0] = initX + options.offsetX / 2 / map.scale;
  }
}
