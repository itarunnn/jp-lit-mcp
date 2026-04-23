export type IssuedAtPrecision = "day" | "month" | "year" | "unknown";

export interface DateInfo {
  issuedAt: string | null;
  issuedAtLabel: string | null;
  issuedAtPrecision: IssuedAtPrecision;
}
