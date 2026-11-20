import { weekdays, type OpeningHoursRule, type Weekday } from "@qubo/db/schema";

export { weekdays, type OpeningHoursRule, type Weekday };

export type DayHours = { open: boolean; opens: string; closes: string };

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Rules to one row per weekday, so a form can show seven lines. Closed days keep the previous times as a convenience. */
export function expandHours(rules: OpeningHoursRule[]): Record<Weekday, DayHours> {
  const out = Object.fromEntries(weekdays.map((d) => [d, { open: false, opens: "09:00", closes: "18:00" }])) as Record<Weekday, DayHours>;
  for (const rule of rules) for (const d of rule.days) if (out[d]) out[d] = { open: true, opens: rule.opens, closes: rule.closes };
  return out;
}

/** Seven rows back to rules: days with identical times share one rule, in weekday order. Invalid times drop the day. */
export function collapseHours(days: Record<Weekday, DayHours>): OpeningHoursRule[] {
  const rules: OpeningHoursRule[] = [];
  for (const d of weekdays) {
    const day = days[d];
    if (!day?.open || !TIME.test(day.opens) || !TIME.test(day.closes) || day.opens >= day.closes) continue;
    const match = rules.find((r) => r.opens === day.opens && r.closes === day.closes);
    if (match) match.days.push(d);
    else rules.push({ days: [d], opens: day.opens, closes: day.closes });
  }
  return rules;
}

/** Reads the `hours_<day>_*` fields a Business form posts. */
export function hoursFromForm(get: (name: string) => string): OpeningHoursRule[] {
  const days = Object.fromEntries(
    weekdays.map((d) => [d, { open: get(`hours_${d}_open`) === "on", opens: get(`hours_${d}_opens`), closes: get(`hours_${d}_closes`) }]),
  ) as Record<Weekday, DayHours>;
  return collapseHours(days);
}

/** schema.org LocalBusiness subtypes worth offering; anything else is a plain LocalBusiness. `key` indexes `settings.businessTypes` messages. */
export const businessTypes = [
  { value: "", key: "general" },
  { value: "Store", key: "Store" },
  { value: "WholesaleStore", key: "WholesaleStore" },
  { value: "HardwareStore", key: "HardwareStore" },
  { value: "FoodEstablishment", key: "FoodEstablishment" },
  { value: "Restaurant", key: "Restaurant" },
  { value: "Bakery", key: "Bakery" },
  { value: "ProfessionalService", key: "ProfessionalService" },
  { value: "HomeAndConstructionBusiness", key: "HomeAndConstructionBusiness" },
  { value: "HealthAndBeautyBusiness", key: "HealthAndBeautyBusiness" },
  { value: "AutomotiveBusiness", key: "AutomotiveBusiness" },
  { value: "LodgingBusiness", key: "LodgingBusiness" },
  { value: "MedicalBusiness", key: "MedicalBusiness" },
  { value: "LegalService", key: "LegalService" },
  { value: "FinancialService", key: "FinancialService" },
  { value: "RealEstateAgent", key: "RealEstateAgent" },
  { value: "TravelAgency", key: "TravelAgency" },
  { value: "SportsActivityLocation", key: "SportsActivityLocation" },
  { value: "EntertainmentBusiness", key: "EntertainmentBusiness" },
] as const;
