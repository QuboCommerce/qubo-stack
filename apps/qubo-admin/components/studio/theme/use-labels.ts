import { useTranslations } from "next-intl";

/** Name of a font weight (400 → "Regular"), empty for unnamed weights. */
export function useWeightName() {
  const t = useTranslations("studio.theme.shared.weights");
  return (w: number) => (t.has(String(w) as "400") ? t(String(w) as "400") : "");
}

/** Display name of a colour role ("onPrimary" → "Primary label"); unknown roles pass through. */
export function useRoleLabel() {
  const t = useTranslations("studio.theme.roles");
  return (role: string) => (t.has(role as "background") ? t(role as "background") : role);
}

/** Name for a duplicated preset ("Warm" → "Warm copy"). */
export function useCopyName() {
  const t = useTranslations("studio.theme.designControls");
  return (name: string) => t("copyName", { name });
}
