import { RouterProvider } from "react-router-dom"
import { router } from "./routes"
import { useLanguage } from "./i18n"

/**
 * Re-mounts the router when the language changes. This guarantees that every
 * page (including components that only call the plain `t()` helper) re-renders
 * with the new language immediately.
 */
export function App() {
  const { language } = useLanguage()
  return <RouterProvider key={language} router={router} />
}
