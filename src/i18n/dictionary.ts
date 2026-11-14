/**
 * Arabic UI dictionary.
 *
 * Keys are the exact English source strings used in the interface. Missing
 * entries fall back to English, which keeps every screen usable while the
 * dictionary is extended.
 */
import { common } from "./ar/common"
import { auth } from "./ar/auth"
import { publicPages } from "./ar/public"
import { dashboard } from "./ar/dashboard"
import { events } from "./ar/events"
import { admin } from "./ar/admin"
import { additions } from "./ar/additions"
import { chat } from "./ar/chat"
import { errors } from "./ar/errors"
import { chunk1 } from "./ar/chunk1"
import { chunk2 } from "./ar/chunk2"
import { chunk3 } from "./ar/chunk3"
import { chunk4 } from "./ar/chunk4"
import { chunk5 } from "./ar/chunk5"
import { chunk6 } from "./ar/chunk6"
import { uiMessages } from "./ar/ui-messages"
import { labels } from "./ar/labels"
import { templates } from "./ar/templates"

export const ar: Record<string, string> = {
  ...common,
  ...auth,
  ...publicPages,
  ...dashboard,
  ...events,
  ...admin,
  ...additions,
  ...chat,
  ...errors,
  ...chunk1,
  ...chunk2,
  ...chunk3,
  ...chunk4,
  ...chunk5,
  ...chunk6,
  ...uiMessages,
  ...labels,
  ...templates,
}
