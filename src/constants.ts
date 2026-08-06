export const APP_NAME = "EventFlow"
export const APP_TAGLINE = "Discover & Manage Events"

export const EVENT_STATUS = {
  DRAFT: "draft",
  PUBLISHED: "published",
  ARCHIVED: "archived",
} as const

export const EVENT_VISIBILITY = {
  PUBLIC: "public",
  PRIVATE: "private",
} as const

export const REGISTRATION_STATUS = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  CANCELLED: "cancelled",
} as const

export const TICKET_STATUS = {
  VALID: "valid",
  USED: "used",
  INVALID: "invalid",
} as const

export const ROLES = {
  ADMIN: "admin",
  ORGANIZER: "organizer",
  ATTENDEE: "attendee",
} as const

export const NOTIFICATION_TYPES = {
  EVENT_REMINDER: "event_reminder",
  REGISTRATION_CONFIRMATION: "registration_confirmation",
  EVENT_UPDATE: "event_update",
  CHECK_IN: "check_in",
  CHAT_MESSAGE: "chat_message",
  INVITATION: "invitation",
  INVITATION_USED: "invitation_used",
  WAITLIST_PROMOTION: "waitlist_promotion",
  EVALUATION: "evaluation",
} as const

export const EVENT_TYPES = {
  IN_PERSON: "in_person",
  ONLINE: "online",
} as const

export const COST_TYPES = {
  PLANNED: "planned",
  ACTUAL: "actual",
} as const

export const COST_NEED_TYPES = [
  "catering",
  "cleaning",
  "furniture",
  "technology",
  "decoration",
  "printing",
  "transport",
  "security",
  "other",
] as const

export const RATING_TYPES = {
  NUMERIC: "numeric",
  STARS: "stars",
} as const

export const EVALUATION_PRIVACY = {
  SECRET: "secret",
  PUBLIC: "public",
} as const

export const MOCK_DELAY = {
  SHORT: 200,
  MEDIUM: 500,
  LONG: 1000,
} as const

export const DEMO_ACCOUNTS = [
  { email: "admin@eventflow.com", role: "Admin" },
  { email: "organizer@eventflow.com", role: "Organizer" },
  { email: "attendee@eventflow.com", role: "Attendee" },
] as const
