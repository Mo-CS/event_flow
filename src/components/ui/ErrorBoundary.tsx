import { t } from "../../i18n"
import { Component, type ErrorInfo, type ReactNode } from "react"
import { AlertTriangle } from "lucide-react"

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
          <AlertTriangle size={48} className="text-destructive" />
          <h2 className="text-xl font-semibold">{t("Something went wrong")}</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            {this.state.error?.message ?? t("An unexpected error occurred.")}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm hover:opacity-90"
          >
            {t("Try again")}
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
