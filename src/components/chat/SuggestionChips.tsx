import { t } from "../../i18n"
import { CalendarDays, MapPin, Search, Ticket } from "lucide-react"

interface SuggestionChipsProps {
  onSelect: (message: string) => void
  disabled?: boolean
}

const suggestions = [
  {
    label: t("Upcoming events"),
    message: t("Show me upcoming events"),
    icon: CalendarDays,
  },
  {
    label: t("Find by category"),
    message: t("What event categories are available?"),
    icon: Search,
  },
  {
    label: t("Available venues"),
    message: t("What venues are available?"),
    icon: MapPin,
  },
  {
    label: t("Get tickets"),
    message: t("How do I register for an event?"),
    icon: Ticket,
  },
]

export default function SuggestionChips({
  onSelect,
  disabled,
}: SuggestionChipsProps) {
  return (
    <div className="flex gap-2 px-3 pb-2 overflow-x-auto scrollbar-none">
      {suggestions.map((s) => (
        <button
          key={s.label}
          onClick={() => onSelect(s.message)}
          disabled={disabled}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground hover:bg-primary/10 hover:text-primary border border-border transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <s.icon className="w-3 h-3" />
          {s.label}
        </button>
      ))}
    </div>
  )
}
