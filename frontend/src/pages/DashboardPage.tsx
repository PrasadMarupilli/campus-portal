import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const ADMIN_LINKS = [
  { to: "/students", label: "Students", hint: "Manage student records" },
  { to: "/courses", label: "Courses", hint: "Manage the course catalog" },
  { to: "/enrollments", label: "Enrollments", hint: "Enroll students, view rosters" },
  { to: "/attendance", label: "Attendance", hint: "Mark and review attendance" },
  { to: "/announcements", label: "Announcements", hint: "Post campus-wide notices" },
  { to: "/documents", label: "Documents", hint: "Manage student documents" },
];

const STUDENT_LINKS = [
  { to: "/courses", label: "Courses", hint: "Browse the course catalog" },
  { to: "/enrollments", label: "My enrollments", hint: "See what you're enrolled in" },
  { to: "/attendance", label: "My attendance", hint: "Check your attendance record" },
  { to: "/announcements", label: "Announcements", hint: "Campus news and notices" },
  { to: "/documents", label: "My documents", hint: "Upload and download files" },
];

export function DashboardPage() {
  const { email, isAdmin, studentId } = useAuth();
  const links = isAdmin ? ADMIN_LINKS : STUDENT_LINKS;

  return (
    <div className="page">
      <div className="welcome-card">
        <h1>Welcome back</h1>
        <p>{email}</p>
        <div className="welcome-meta">
          <span className={`badge badge-${isAdmin ? "admin" : "student"}`}>{isAdmin ? "Administrator" : "Student"}</span>
          {studentId && <span className="code">{studentId}</span>}
        </div>
      </div>

      <div className="quick-links">
        {links.map((l) => (
          <Link key={l.to} to={l.to} className="quick-link-card">
            <h3>{l.label}</h3>
            <p>{l.hint}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
