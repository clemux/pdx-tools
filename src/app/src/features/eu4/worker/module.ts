import { transfer } from "comlink";
import {
  reduceToTableExpenseLedger,
  reduceToTableLedger,
} from "../utils/budget";
import type {
  CountryCulture,
  CountryDetails,
  CountryExpenses,
  CountryIncome,
  CountryInfo,
  CountryLeader,
  CountryLosses,
  CountryLossesRaw,
  CountryMatcher,
  CountryReligion,
  CountryStateDetails,
  EnhancedCountryInfo,
  GreatAdvisor,
  HealthData,
  IdeaGroup,
  LedgerDatum,
  LocalizedCountryExpense,
  LocalizedCountryIncome,
  LocalizedTag,
  MapDate,
  PlayerHistory,
  ProvinceDetails,
  OwnedDevelopmentStates,
  RawWarInfo,
  RunningMonarch,
  SingleCountryWarCasualties,
  SingleCountryWarCasualtiesRaw,
  GeographicalDevelopment,
  War,
  WarInfo,
  WarRaw,
  CountryAdvisors,
  Estate,
} from "../types/models";
import { MapPayload, QuickTipPayload } from "../types/map";
import { LedgerDataRaw, workLedgerData } from "../utils/ledger";
import { expandLosses } from "../utils/losses";
import { wasm } from "./common";
import { TimelapseIter } from "../../../../../wasm-eu4/pkg/wasm_eu4";
export * from "./init";

export const getRawData = wasm.viewData;
export const melt = () => wasm.melt();

let provinceIdToColorIndex = new Uint16Array();

export function eu4SetProvinceIdToColorIndex(
  _provinceIdToColorIndex: Uint16Array
) {
  provinceIdToColorIndex = _provinceIdToColorIndex;
}

export function eu4GetProvinceIdToColorIndex() {
  return provinceIdToColorIndex;
}

export type MapColors = {
  primary: Uint8Array;
  secondary: Uint8Array;
  country?: Uint8Array;
};

export function eu4MapColors(payload: MapPayload): MapColors {
  const arr = wasm.save.map_colors(payload);
  if (payload.kind == "political") {
    const primary = arr.subarray(0, arr.length / 2);
    const secondary = arr.subarray(arr.length / 2);
    const country = primary;
    return transfer({ primary, secondary, country }, [arr.buffer]);
  } else if (payload.kind == "battles") {
    const primary = arr.subarray(0, arr.length / 3);
    const secondary = arr.subarray(arr.length / 3, (arr.length * 2) / 3);
    const country = arr.subarray((arr.length * 2) / 3);
    return transfer({ primary, secondary, country }, [arr.buffer]);
  } else if (payload.date != null && payload.kind == "religion") {
    const primary = arr.subarray(0, arr.length / 3);
    const secondary = arr.subarray(arr.length / 3, (arr.length * 2) / 3);
    const country = arr.subarray((arr.length * 2) / 3);
    return transfer({ primary, secondary, country }, [arr.buffer]);
  } else {
    const primary = arr.subarray(0, arr.length / 2);
    const secondary = arr.subarray(arr.length / 2);
    return transfer({ primary, secondary }, [arr.buffer]);
  }
}

export type MapTimelapseItem = {
  date: MapDate;
  primary: Uint8Array;
  secondary: Uint8Array;
  country: Uint8Array;
};

let mapCursor: TimelapseIter | undefined;
export function mapTimelapseNext(): MapTimelapseItem | undefined {
  const item = mapCursor?.next();
  if (item === undefined || mapCursor === undefined) {
    mapCursor?.free();
    return undefined;
  }

  const date = item.date() as MapDate;
  const arr = item.data();
  const parts = mapCursor.parts();
  if (parts == 2) {
    const primary = arr.subarray(0, arr.length / parts);
    const secondary = arr.subarray(arr.length / parts);
    const country = primary;
    return transfer({ date, primary, secondary, country }, [arr.buffer]);
  } else if (parts == 3) {
    const primary = arr.subarray(0, arr.length / parts);
    const secondary = arr.subarray(
      arr.length / parts,
      (arr.length * 2) / parts
    );
    const country = arr.subarray((arr.length * 2) / parts);
    return transfer({ date, primary, secondary, country }, [arr.buffer]);
  } else {
    throw new Error("unexpected parts");
  }
}

export function mapTimelapse(payload: {
  kind: "political" | "religion" | "battles";
  interval: "year" | "month" | "week" | "day";
  start: number | null;
}) {
  mapCursor = wasm.save.map_cursor(payload);
}

export function eu4GetCountries(): EnhancedCountryInfo[] {
  const countries = wasm.save.get_countries() as CountryInfo[];

  // name with accents and diacritics removed (eg: Lübeck -> Lubeck)
  // https://stackoverflow.com/a/37511463/433785
  return countries.map((x) => ({
    ...x,
    normalizedName: x.name.normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
  }));
}

export function eu4GetCountry(tag: string) {
  return wasm.save.get_country(tag) as CountryDetails;
}

export function eu4GetCountryRulers(tag: string): RunningMonarch[] {
  const save = wasm.save;
  return save.get_country_rulers(tag) as RunningMonarch[];
}

export function eu4GetCountryAdvisors(tag: string): CountryAdvisors {
  const save = wasm.save;
  return save.get_country_advisors(tag);
}

export function eu4GetCountryProvinceReligion(tag: string): CountryReligion[] {
  const save = wasm.save;
  return save.get_country_province_religion(tag) as CountryReligion[];
}

export function eu4GetCountryProvinceCulture(tag: string): CountryCulture[] {
  const save = wasm.save;
  return save.get_country_province_culture(tag) as CountryCulture[];
}

export function eu4GetCountryLeaders(tag: string): CountryLeader[] {
  const save = wasm.save;
  return save.get_country_leaders(tag) as CountryLeader[];
}

export function eu4GetCountryStates(tag: string): CountryStateDetails[] {
  const save = wasm.save;
  return save.get_country_states(tag) as CountryStateDetails[];
}

export function eu4GetCountryEstates(tag: string): Estate[] {
  const save = wasm.save;
  return save.get_country_estates(tag) as Estate[];
}

export function eu4InitialMapPosition() {
  const result = wasm.save.initial_map_position();
  return result as [number, number];
}

export function eu4MapPositionOf(tag: string) {
  const result = wasm.save.map_position_of_tag(tag);
  return result as [number, number];
}

export function eu4GetPlayerHistories(): PlayerHistory[] {
  const save = wasm.save;
  return save.get_player_histories() as PlayerHistory[];
}

export function eu4MatchingCountries(matcher: CountryMatcher): LocalizedTag[] {
  const save = wasm.save;
  return save.matching_countries(matcher) as LocalizedTag[];
}

export function eu4GetNationIdeaGroups(matcher: CountryMatcher): IdeaGroup[] {
  const result = wasm.save.get_nation_idea_groups(matcher) as [
    number,
    string,
    number
  ][];

  return result.map(([groupRank, groupName, completedIdeas]) => ({
    groupRank,
    groupName,
    completedIdeas,
  }));
}

export function eu4GetAnnualIncomeData(filter: CountryMatcher): LedgerDatum[] {
  const data = wasm.save.get_annual_income_ledger(filter) as LedgerDataRaw;
  return workLedgerData(data);
}

export function eu4GetAnnualNationSizeData(
  filter: CountryMatcher
): LedgerDatum[] {
  const data = wasm.save.get_annual_nation_size_ledger(filter) as LedgerDataRaw;
  return workLedgerData(data);
}

export function eu4GetAnnualScoreData(filter: CountryMatcher): LedgerDatum[] {
  const data = wasm.save.get_annual_score_ledger(filter) as LedgerDataRaw;
  return workLedgerData(data);
}

export function eu4GetAnnualInflationData(
  filter: CountryMatcher
): LedgerDatum[] {
  const data = wasm.save.get_annual_inflation_ledger(filter) as LedgerDataRaw;
  return workLedgerData(data);
}

export function eu4GetHealth(filter: CountryMatcher): HealthData {
  return wasm.save.get_health(filter) as HealthData;
}

export function eu4GetCountriesIncome(
  filter: CountryMatcher,
  percent: boolean,
  recurringOnly: boolean
): CountryIncome[] {
  const data = wasm.save.get_countries_income(filter) as Record<
    string,
    LocalizedCountryIncome
  >;

  return reduceToTableLedger(data, percent, recurringOnly);
}

export function eu4GetCountriesExpenses(
  filter: CountryMatcher,
  percent: boolean,
  recurringOnly: boolean
): CountryExpenses[] {
  const data = wasm.save.get_countries_expenses(filter) as Record<
    string,
    LocalizedCountryExpense
  >;

  return reduceToTableExpenseLedger(data, percent, recurringOnly);
}

export function eu4GetCountriesTotalExpenses(
  filter: CountryMatcher,
  percent: boolean,
  recurringOnly: boolean
): CountryExpenses[] {
  const data = wasm.save.get_countries_total_expenses(filter) as Record<
    string,
    LocalizedCountryExpense
  >;

  return reduceToTableExpenseLedger(data, percent, recurringOnly);
}

export function eu4GeographicalDevelopment(
  filter: CountryMatcher
): GeographicalDevelopment {
  return wasm.save.geographical_development(filter);
}

export function eu4OwnedDevelopmentStates(
  filter: CountryMatcher
): OwnedDevelopmentStates[] {
  return wasm.save.owned_development_states(filter);
}

export function eu4GetCountriesWarLosses(
  filter: CountryMatcher
): CountryLosses[] {
  const result = wasm.save.countries_war_losses(filter) as CountryLossesRaw[];

  return result.map(({ losses, ...rest }) => {
    return {
      ...rest,
      ...expandLosses(losses),
    };
  });
}

export function eu4GetSingleCountryCasualties(
  tag: string
): SingleCountryWarCasualties[] {
  const raw = wasm.save.get_country_casualties(
    tag
  ) as SingleCountryWarCasualtiesRaw[];
  return raw.map((x) => ({
    ...x,
    losses: expandLosses(x.losses),
  }));
}

export function eu4GetWars(filter: CountryMatcher): War[] {
  const data = wasm.save.wars(filter) as WarRaw[];
  return data.map((x) => {
    const attackerLosses = expandLosses(x.attackers.losses);
    const defenderLosses = expandLosses(x.defenders.losses);
    return {
      ...x,
      totalBattleLosses:
        attackerLosses.totalBattle + defenderLosses.totalBattle,
      totalAttritionLosses:
        attackerLosses.totalAttrition + defenderLosses.totalAttrition,
      attackers: {
        ...x.attackers,
        losses: expandLosses(x.attackers.losses),
      },
      defenders: {
        ...x.defenders,
        losses: expandLosses(x.defenders.losses),
      },
    } as War;
  });
}

export function eu4GetWarInfo(war: string): WarInfo {
  const raw = wasm.save.get_war(war) as RawWarInfo;
  return {
    ...raw,
    attacker_participants: raw.attacker_participants.map((x) => ({
      ...x,
      losses: expandLosses(x.losses),
    })),
    defender_participants: raw.defender_participants.map((x) => ({
      ...x,
      losses: expandLosses(x.losses),
    })),
  };
}

export function eu4DateToDays(s: string): number {
  return wasm.save.date_to_days(s);
}

export function eu4DaysToDate(s: number): string {
  return wasm.save.days_to_date(s);
}

export function eu4GetProvinceDeteails(id: number): ProvinceDetails | null {
  return wasm.save.get_province_details(id);
}

export function eu4GetMapTooltip(
  province: number,
  payload: MapPayload["kind"],
  date: number | undefined
): QuickTipPayload | null {
  return wasm.save.map_quick_tip(province, payload, date) ?? null;
}

export async function eu4SaveHash(): Promise<string> {
  return wasm.module.save_checksum(await wasm.viewData());
}

export async function eu4DownloadData(): Promise<Uint8Array> {
  const data = await wasm.viewData();
  const dataOffset = wasm.module.data_offset(data);
  const out =
    dataOffset === undefined
      ? wasm.module.download_transformation(data)
      : data.subarray(dataOffset);
  return transfer(out, [out.buffer]);
}
