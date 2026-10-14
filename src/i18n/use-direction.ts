import { useLocale } from "use-intl";
import { getDirection, isLocale } from "./config";

// "rtl" on Arabic pages: for what the layout's logical properties can't
// express (which way a panel is swiped away).
export function useDirection(): "rtl" | "ltr" {
  const locale = useLocale();
  return isLocale(locale) ? getDirection(locale) : "ltr";
}
