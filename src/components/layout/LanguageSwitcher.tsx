import { Languages } from "lucide-react"
import { t, useLanguage } from "../../i18n"

/**
 * Global language switch. It is rendered in both the public header and the
 * dashboard header, so the language can be changed from any part of the app.
 */
export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { language, toggleLanguage } = useLanguage()
  const nextLabel = language === "ar" ? "English" : "العربية"

  return (
    <button
      type="button"
      onClick={toggleLanguage}
      title={t("Switch language")}
      aria-label={t("Switch language")}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
    >
      <Languages size={18} />
      {!compact && <span className="font-medium">{nextLabel}</span>}
    </button>
  )
}
