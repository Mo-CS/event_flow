import { createBrowserRouter } from "react-router-dom"
import { AppLayout } from "../components/layout/AppLayout"
import { PublicLayout } from "../components/layout/PublicLayout"
import { ProtectedRoute } from "./ProtectedRoute"
import { PublicRoute } from "./PublicRoute"
import { Home } from "../pages/Home"
import { Events } from "../pages/Events"
import { EventDetail } from "../pages/EventDetail"
import { EventEvaluation } from "../pages/EventEvaluation"
import { Login } from "../pages/Login"
import { Register } from "../pages/Register"
import { ForgotPassword } from "../pages/ForgotPassword"
import { ResetPassword } from "../pages/ResetPassword"
import { About } from "../pages/About"
import { Contact } from "../pages/Contact"
import { Dashboard } from "../pages/Dashboard"
import { UserManagement } from "../pages/UserManagement"
import { UserDetail } from "../pages/UserDetail"
import { CategoryManagement } from "../pages/CategoryManagement"
import { VenueManagement } from "../pages/VenueManagement"
import { EventManagement } from "../pages/EventManagement"
import { EventForm } from "../pages/EventForm"
import { ScheduleManagement } from "../pages/ScheduleManagement"
import { RegistrationManagement } from "../pages/RegistrationManagement"
import { AttendanceManagement } from "../pages/AttendanceManagement"
import { InvitationManagement } from "../pages/InvitationManagement"
import { EventCosts } from "../pages/EventCosts"
import { EvaluationManagement } from "../pages/EvaluationManagement"
import { EventOrganizers } from "../pages/EventOrganizers"
import { EventChat } from "../pages/EventChat"
import { Profile } from "../pages/Profile"
import { TicketDetail } from "../pages/TicketDetail"
import { Notifications } from "../pages/Notifications"
import { FileManagement } from "../pages/FileManagement"
import { Reports } from "../pages/Reports"
import { FeedbackManagement } from "../pages/FeedbackManagement"
import { SystemSettings } from "../pages/SystemSettings"
import { SecurityCenter } from "../pages/SecurityCenter"
import { EventMeeting } from "../pages/EventMeeting"
import { Bans } from "../pages/Bans"
import { EventRequestForm } from "../pages/EventRequestForm"
import { EventRequests } from "../pages/EventRequests"
import { Finance } from "../pages/Finance"
import { Audience } from "../pages/Audience"
import { Campaigns } from "../pages/Campaigns"
import { Broadcast } from "../pages/Broadcast"
import { PasswordResets } from "../pages/PasswordResets"
import { ChangePassword } from "../pages/ChangePassword"
import { RestoreAccount } from "../pages/RestoreAccount"
import { NotFound } from "../pages/NotFound"

export const router = createBrowserRouter([
  {
    path: "/",
    element: <PublicLayout />,
    children: [
      { index: true, element: <PublicRoute><Home /></PublicRoute> },
      { path: "events", element: <Events /> },
      { path: "events/:id", element: <EventDetail /> },
      { path: "events/:id/evaluate", element: <ProtectedRoute roles={["attendee"]}><EventEvaluation /></ProtectedRoute> },
      { path: "about", element: <PublicRoute><About /></PublicRoute> },
      { path: "contact", element: <PublicRoute><Contact /></PublicRoute> },
      { path: "login", element: <Login /> },
      { path: "register", element: <Register /> },
      { path: "forgot-password", element: <ForgotPassword /> },
      { path: "reset-password", element: <ResetPassword /> },
      { path: "restore-account", element: <RestoreAccount /> },
    ],
  },
  {
    path: "/dashboard",
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Dashboard /> },
      { path: "admin/users", element: <ProtectedRoute roles={["admin"]}><UserManagement /></ProtectedRoute> },
      { path: "admin/users/:id", element: <ProtectedRoute roles={["admin"]}><UserDetail /></ProtectedRoute> },
      { path: "admin/categories", element: <ProtectedRoute roles={["admin"]}><CategoryManagement /></ProtectedRoute> },
      { path: "admin/venues", element: <ProtectedRoute roles={["admin"]}><VenueManagement /></ProtectedRoute> },
      { path: "admin/files", element: <ProtectedRoute roles={["admin"]}><FileManagement /></ProtectedRoute> },
      { path: "admin/reports", element: <ProtectedRoute roles={["admin"]}><Reports /></ProtectedRoute> },
      { path: "admin/settings", element: <ProtectedRoute roles={["admin"]}><SystemSettings /></ProtectedRoute> },
      { path: "admin/security", element: <ProtectedRoute roles={["admin"]}><SecurityCenter /></ProtectedRoute> },
      { path: "feedback", element: <ProtectedRoute roles={["organizer", "admin"]}><FeedbackManagement /></ProtectedRoute> },
      { path: "change-password", element: <ChangePassword /> },
      { path: "event-requests", element: <EventRequests /> },
      { path: "event-requests/new", element: <EventRequestForm /> },
      { path: "bans", element: <ProtectedRoute roles={["organizer", "admin"]}><Bans /></ProtectedRoute> },
      { path: "finance", element: <ProtectedRoute roles={["organizer", "admin"]}><Finance /></ProtectedRoute> },
      { path: "audience", element: <Audience /> },
      { path: "campaigns", element: <Campaigns /> },
      { path: "admin/broadcast", element: <ProtectedRoute roles={["admin"]}><Broadcast /></ProtectedRoute> },
      { path: "admin/password-resets", element: <ProtectedRoute roles={["admin"]}><PasswordResets /></ProtectedRoute> },
      { path: "events", element: <ProtectedRoute roles={["organizer", "admin"]}><EventManagement /></ProtectedRoute> },
      { path: "events/new", element: <ProtectedRoute roles={["organizer", "admin"]}><EventForm /></ProtectedRoute> },
      { path: "events/:id/edit", element: <ProtectedRoute roles={["organizer", "admin"]}><EventForm /></ProtectedRoute> },
      { path: "events/:eventId/schedule", element: <ProtectedRoute roles={["organizer", "admin"]}><ScheduleManagement /></ProtectedRoute> },
      { path: "events/:eventId/registrations", element: <ProtectedRoute roles={["organizer", "admin"]}><RegistrationManagement /></ProtectedRoute> },
      { path: "events/:eventId/attendance", element: <ProtectedRoute roles={["organizer", "admin"]}><AttendanceManagement /></ProtectedRoute> },
      { path: "events/:eventId/invitations", element: <ProtectedRoute roles={["organizer", "admin"]}><InvitationManagement /></ProtectedRoute> },
      { path: "events/:eventId/costs", element: <ProtectedRoute roles={["organizer", "admin"]}><EventCosts /></ProtectedRoute> },
      { path: "events/:eventId/evaluation", element: <ProtectedRoute roles={["organizer", "admin"]}><EvaluationManagement /></ProtectedRoute> },
      { path: "events/:eventId/organizers", element: <ProtectedRoute roles={["admin"]}><EventOrganizers /></ProtectedRoute> },
      { path: "events/:eventId/chat", element: <ProtectedRoute roles={["organizer", "admin", "attendee"]}><EventChat /></ProtectedRoute> },
      { path: "events/:eventId/meeting", element: <ProtectedRoute roles={["attendee", "organizer", "admin"]}><EventMeeting /></ProtectedRoute> },
      { path: "profile", element: <Profile /> },
      { path: "tickets/:id", element: <TicketDetail /> },
      { path: "notifications", element: <Notifications /> },
    ],
  },
  {
    path: "*",
    element: <NotFound />,
  },
])
