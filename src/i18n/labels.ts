import { t } from "./translate"

/**
 * Maps internal enum values (statuses, roles, modes…) to translated labels.
 * Unknown values are returned unchanged so newly added backend values remain
 * readable instead of disappearing.
 */
function mapLabel(value: string | null | undefined, keys: Record<string, string>): string {
  if (!value) return ""
  const key = keys[value] ?? value
  return t(key)
}

const STATUS_KEYS: Record<string, string> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
  pending: "Pending",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
  waitlisted: "Waitlisted",
  valid: "Valid",
  used: "Used",
  invalid: "Invalid",
  scheduled: "Scheduled",
  sending: "Sending",
  sent: "Sent",
  failed: "Failed",
  approved: "Approved",
  rejected: "Rejected",
  needs_info: "Needs info",
  reviewing: "Reviewing",
  expired: "Expired",
  revoked: "Revoked",
  completed: "Completed",
  active: "Active",
  inactive: "Inactive",
  suspended: "Suspended",
  subscribed: "Subscribed",
  unsubscribed: "Unsubscribed",
  deleted_account: "Deleted account",
}

const ROLE_KEYS: Record<string, string> = {
  admin: "Admin",
  organizer: "Organizer",
  attendee: "Attendee",
  user: "User",
}

const EVENT_TYPE_KEYS: Record<string, string> = {
  online: "Online",
  in_person: "In person",
  hybrid: "Hybrid",
}

const AUDIENCE_SOURCE_KEYS: Record<string, string> = {
  manual: "Manual",
  registration: "Registration",
  import: "Import",
}

const CHANNEL_KEYS: Record<string, string> = {
  in_app: "In-app",
  email: "Email",
  both: "Both",
}

const SCOPE_KEYS: Record<string, string> = {
  global: "Global",
  event: "Event",
  category: "Category",
  general: "General pool",
}

const RATING_TYPE_KEYS: Record<string, string> = {
  numeric: "Numeric",
  stars: "Stars",
}

export function statusLabel(value: string | null | undefined): string {
  return mapLabel(value, STATUS_KEYS)
}

export function roleLabel(value: string | null | undefined): string {
  return mapLabel(value, ROLE_KEYS)
}

export function eventTypeLabel(value: string | null | undefined): string {
  return mapLabel(value, EVENT_TYPE_KEYS)
}

export function attendanceModeLabel(value: string | null | undefined): string {
  return mapLabel(value, EVENT_TYPE_KEYS)
}

export function audienceSourceLabel(value: string | null | undefined): string {
  return mapLabel(value, AUDIENCE_SOURCE_KEYS)
}

export function channelLabel(value: string | null | undefined): string {
  return mapLabel(value, CHANNEL_KEYS)
}

export function scopeLabel(value: string | null | undefined): string {
  return mapLabel(value, SCOPE_KEYS)
}

export function ratingTypeLabel(value: string | null | undefined): string {
  return mapLabel(value, RATING_TYPE_KEYS)
}
