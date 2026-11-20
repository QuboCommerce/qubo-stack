import { getLocale } from "next-intl/server";
import { formatters } from "./format";

/** Server components and actions: `const f = await getFormatters(); f.money(12)`, in the active language. */
export async function getFormatters() {
  return formatters(await getLocale());
}
