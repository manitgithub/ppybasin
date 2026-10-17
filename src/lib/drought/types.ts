import type seasonal from "./data/seasonal-snapshot.json";
import type monthly from "./data/monthly-snapshot.json";
import type tmd from "./data/tmd-snapshot.json";

export type SeasonalData = Omit<typeof seasonal, "tambons"> & {
  tambons: (Omit<(typeof seasonal.tambons)[number], "firstDroughtMonth"> & { firstDroughtMonth: string | null })[];
};
export type MonthlyData = typeof monthly;
export type TmdData = typeof tmd;
export type DroughtDataset<T> = {
  data: T;
  mode: "live" | "snapshot";
  checkedAt: string;
  stale: boolean;
  warnings: string[];
};
export type DroughtPayload = {
  checkedAt: string;
  seasonal: DroughtDataset<SeasonalData>;
  tmd: DroughtDataset<TmdData>;
  monthly: DroughtDataset<MonthlyData>;
};
