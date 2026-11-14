import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import {
  applyDocumentLanguage,
  getLanguage,
  isRtlLanguage,
  setRuntimeLanguage,
  t,
  type Language,
} from "./translate"

interface LanguageContextType {
  language: Language
  isRtl: boolean
  dir: "rtl" | "ltr"
  setLanguage: (language: Language) => void
  toggleLanguage: () => void
  t: typeof t
}

const LanguageContext = createContext<LanguageContextType | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => getLanguage())

  const setLanguage = useCallback((next: Language) => {
    setRuntimeLanguage(next)
    setLanguageState(next)
  }, [])

  const toggleLanguage = useCallback(() => {
    setLanguageState((current) => {
      const next: Language = current === "ar" ? "en" : "ar"
      setRuntimeLanguage(next)
      return next
    })
  }, [])

  useEffect(() => {
    setRuntimeLanguage(language)
    applyDocumentLanguage(language)
  }, [language])

  const value = useMemo<LanguageContextType>(
    () => ({
      language,
      isRtl: isRtlLanguage(language),
      dir: isRtlLanguage(language) ? "rtl" : "ltr",
      setLanguage,
      toggleLanguage,
      t,
    }),
    [language, setLanguage, toggleLanguage],
  )

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage(): LanguageContextType {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider")
  return ctx
}
