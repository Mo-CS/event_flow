import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { RouterProvider } from "react-router-dom"
import { AuthProvider } from "./contexts/AuthContext"
import { SettingsProvider } from "./contexts/SettingsContext"
import { ThemeProvider } from "./contexts/ThemeContext"
import { router } from "./routes"
import "./index.css"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <SettingsProvider>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </SettingsProvider>
    </ThemeProvider>
  </StrictMode>,
)
