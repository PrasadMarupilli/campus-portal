import { NavLink, Route, Routes, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { StudentsPage } from "./pages/StudentsPage";
import { CoursesPage } from "./pages/CoursesPage";
import { EnrollmentPage } from "./pages/EnrollmentPage";
import { AttendancePage } from "./pages/AttendancePage";
import { AnnouncementsPage } from "./pages/AnnouncementsPage";
import { DocumentsPage } from "./pages/DocumentsPage";

function NavBar() {
  const { isAuthenticated, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();

  if (!isAuthenticated) return null;

  const linkClass = ({ isActive }: { isActive: boolean }) => `nav-link${isActive ? " active" : ""}`;

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <span className="brand-mark">CP</span>
        <span className="brand-name">Campus Portal</span>
      </div>
      <div className="navbar-links">
        <NavLink to="/dashboard" className={linkClass}>Dashboard</NavLink>
        {isAdmin && <NavLink to="/students" className={linkClass}>Students</NavLink>}
        <NavLink to="/courses" className={linkClass}>Courses</NavLink>
        <NavLink to="/enrollments" className={linkClass}>Enrollments</NavLink>
        <NavLink to="/attendance" className={linkClass}>Attendance</NavLink>
        <NavLink to="/announcements" className={linkClass}>Announcements</NavLink>
        <NavLink to="/documents" className={linkClass}>Documents</NavLink>
      </div>
      <button
        className="btn-secondary"
        onClick={async () => {
          await signOut();
          navigate("/login");
        }}
      >
        Sign out
      </button>
    </nav>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NavBar />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/students" element={<ProtectedRoute adminOnly><StudentsPage /></ProtectedRoute>} />
        <Route path="/courses" element={<ProtectedRoute><CoursesPage /></ProtectedRoute>} />
        <Route path="/enrollments" element={<ProtectedRoute><EnrollmentPage /></ProtectedRoute>} />
        <Route path="/attendance" element={<ProtectedRoute><AttendancePage /></ProtectedRoute>} />
        <Route path="/announcements" element={<ProtectedRoute><AnnouncementsPage /></ProtectedRoute>} />
        <Route path="/documents" element={<ProtectedRoute><DocumentsPage /></ProtectedRoute>} />
        <Route path="*" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      </Routes>
    </AuthProvider>
  );
}
