import { ar } from "./dictionary"

export type Language = "en" | "ar"

const STORAGE_KEY = "eventflow_language"

function readStoredLanguage(): Language {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === "ar" || stored === "en") return stored
  } catch {
    // Ignore storage access errors (private mode, SSR, tests).
  }
  return "en"
}

let currentLanguage: Language = readStoredLanguage()

export function getLanguage(): Language {
  return currentLanguage
}

export function setRuntimeLanguage(language: Language): void {
  currentLanguage = language
}

export function isRtlLanguage(language: Language = currentLanguage): boolean {
  return language === "ar"
}

/**
 * Translates an English UI string into Arabic when the active language is
 * Arabic. English is used as the dictionary key, so any string without a
 * translation simply falls back to English instead of showing a key.
 */
export function translate(text: string, vars?: Record<string, string | number>): string {
  if (currentLanguage !== "ar") return text
  let translated = ar[text] ?? text
  if (vars) {
    translated = translated.replace(/\{(\w+)\}/g, (match, key: string) => {
      const value = vars[key]
      return value === undefined || value === null ? match : String(value)
    })
  }
  return translated
}

/** Short alias used across components and services. */
export function t(text: string, vars?: Record<string, string | number>): string {
  return translate(text, vars)
}

/** Applies the active language to the document (lang + direction). */
export function applyDocumentLanguage(language: Language = currentLanguage): void {
  if (typeof document === "undefined") return
  const root = document.documentElement
  root.lang = language
  root.dir = isRtlLanguage(language) ? "rtl" : "ltr"
  root.classList.toggle("lang-ar", language === "ar")
  try {
    localStorage.setItem(STORAGE_KEY, language)
  } catch {
    // Ignore storage access errors.
  }
}

// Apply immediately on module load so the first paint already has the correct
// direction and the Arabic font class.
applyDocumentLanguage(currentLanguage)
