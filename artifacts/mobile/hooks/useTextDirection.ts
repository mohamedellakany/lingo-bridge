import type { TextStyle } from "react-native";

// Unicode ranges for right-to-left scripts (Arabic, Hebrew, etc.).
const RTL_CHAR = /[\u0591-\u07FF\u08A0-\u08FF\uFB1D-\uFDFD\uFE70-\uFEFF]/;

/** Returns true if the text contains right-to-left script characters. */
export function isRTL(text: string | undefined | null): boolean {
  if (!text) return false;
  return RTL_CHAR.test(text);
}

/**
 * Style helper that aligns and orders text based on its content, so Arabic (and
 * other RTL languages) render correctly regardless of the device locale.
 */
export function directionStyle(text: string | undefined | null): TextStyle {
  const rtl = isRTL(text);
  return {
    writingDirection: rtl ? "rtl" : "ltr",
    textAlign: rtl ? "right" : "left",
  };
}
