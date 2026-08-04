export type RoleName = "admin" | "organizer" | "attendee"

export interface Role {
  id: string
  name: RoleName
  description: string
}

export interface User {
  id: string
  email: string
  createdAt: string
  updatedAt: string
  suspended?: boolean
}

export interface Profile {
  id: string
  userId: string
  firstName: string
  lastName: string
  phoneNumber: string
  avatarUrl: string
  roleId: string
}

export interface Category {
  id: string
  name: string
  description: string
  iconUrl: string
  colorCode: string
  deletedAt?: string
}

export interface Venue {
  id: string
  name: string
  address: string
  capacity: number
  facilities: Record<string, boolean>
  imageUrls: string[]
  deletedAt?: string
}

export type EventStatus = "draft" | "published" | "archived"
export type EventVisibility = "public" | "private"

export interface Event {
  id: string
  title: string
  description: string
  coverImageUrl: string
  organizerId: string
  venueId: string
  capacity: number
  registrationDeadline: string
  startDate: string
  endDate: string
  status: EventStatus
  visibility: EventVisibility
  contactEmail: string
  categoryId: string
  deletedAt?: string
}

export type AuditAction = "create" | "update" | "delete" | "login" | "logout" | "register" | "suspend" | "activate" | "publish" | "archive" | "check_in" | "check_out" | "cancel"

export interface AuditLog {
  id: string
  userId: string
  action: AuditAction
  entityType: string
  entityId: string
  details: string
  ipAddress: string
  createdAt: string
}

export interface EventImage {
  id: string
  eventId: string
  imageUrl: string
  description: string
}

export interface Session {
  id: string
  eventId: string
  title: string
  description: string
  startTime: string
  endTime: string
  roomName: string
}

export interface Speaker {
  id: string
  sessionId: string
  name: string
  bio: string
  imageUrl: string
}

export interface InvitationLink {
  id: string
  eventId: string
  email: string
  code: string
  used: boolean
  usedAt: string | null
  createdAt: string
}

export type RegistrationStatus = "pending" | "confirmed" | "cancelled" | "waitlisted"

export interface Registration {
  id: string
  eventId: string
  attendeeId: string
  registeredAt: string
  status: RegistrationStatus
}

export type TicketStatus = "valid" | "used" | "invalid"

export interface Ticket {
  id: string
  registrationId: string
  uniqueCode: string
  qrCodeUrl: string
  issuedAt: string
  status: TicketStatus
}

export interface Attendance {
  id: string
  ticketId: string
  checkInTime: string
  checkOutTime: string
}

export type NotificationType = "event_reminder" | "registration_confirmation" | "event_update" | "check_in"

export interface Notification {
  id: string
  userId: string
  type: NotificationType
  message: string
  readAt: string | null
  createdAt: string
}

export interface FileItem {
  id: string
  name: string
  url: string
  type: string
  size: number
  uploadedBy: string
  createdAt: string
}

export interface EmailTemplate {
  id: string
  type: string
  subject: string
  body: string
}

export interface AppSettings {
  appName: string
  timezone: string
  dateFormat: string
  primaryColor: string
  logoUrl: string
  faviconUrl: string
  emailTemplates: EmailTemplate[]
}

export interface Feedback {
  id: string
  eventId: string
  attendeeId: string
  rating: number
  comment: string
  submittedAt: string
  response?: string
  respondedAt?: string
}
