import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { AuthProvider } from "./contexts/AuthContext"
import { SettingsProvider } from "./contexts/SettingsContext"
import { ThemeProvider } from "./contexts/ThemeContext"
import { LanguageProvider } from "./i18n"
import { App } from "./App"
import "./index.css"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LanguageProvider>
      <ThemeProvider>
        <SettingsProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </SettingsProvider>
      </ThemeProvider>
    </LanguageProvider>
  </StrictMode>,
)
