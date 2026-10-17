import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// tailwind-merge has to know the design's own scales (src/styles/app.css):
// without them it takes text-page-title for a color and drops it next to
// text-muted, or merges rounded-card away.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["page-title", "card-title", "body", "caption", "label"],
      radius: ["control", "card", "dialog", "sheet"],
      shadow: ["pop"],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
