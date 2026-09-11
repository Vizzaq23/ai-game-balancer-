export type Match = {
  weapon: string;
  kills: number;
  deaths: number;
  player_id?: string;
  team?: string;
  damage_done?: number;
};
export type Metrics = {
  records: number;
  kills: number;
  deaths: number;
  kd: number | null;
  damage: number | null;
  damage_records: number;
  average_damage: number | null;
};
export type Status =
  | "potential_overpowered"
  | "potential_underpowered"
  | "within_tolerance"
  | "insufficient_data"
  | "unavailable";
export type Weapon = Metrics & {
  weapon: string;
  delta: number | null;
  usage_share: number;
  status: Status;
  suggestion: string;
};
export type Filters = { weapon: string; team: string };
export type Analysis = {
  summary: Metrics & { weapons: number; teams: number; signals: number };
  weapons: Weapon[];
  teams: (Metrics & { team: string })[];
  filters: Partial<Filters>;
  tolerance: number;
  total_records: number;
  options: { weapons: string[]; teams: string[] };
  warnings: string[];
  methodology: string;
  minimum_sample: number;
};
export type Explanation = {
  source: "built_in" | "openai";
  text: string;
  notice?: string;
};
export const statusLabels: Record<Status, string> = {
  potential_overpowered: "Potentially overpowered",
  potential_underpowered: "Potentially underpowered",
  within_tolerance: "Within tolerance",
  insufficient_data: "Insufficient data",
  unavailable: "K/D unavailable",
};
export const colors: Record<Status, string> = {
  potential_overpowered: "#f0b878",
  potential_underpowered: "#9ba7ff",
  within_tolerance: "#b8e67b",
  insufficient_data: "#80909f",
  unavailable: "#80909f",
};
export const number = (n: number | null | undefined, digits = 0) =>
  n == null
    ? "N/A"
    : n.toLocaleString("en-US", {
        maximumFractionDigits: digits,
        minimumFractionDigits: digits,
      });
