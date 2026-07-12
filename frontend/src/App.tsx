import { Link, Route, Routes, useNavigate } from "react-router-dom";
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

  return (
    <nav className="navbar">
      <Link to="/dashboard">Dashboard</Link>
      {isAdmin && <Link to="/students">Students</Link>}
      <Link to="/courses">Courses</Link>
      <Link to="/enrollments">Enrollments</Link>
      <Link to="/attendance">Attendance</Link>
      <Link to="/announcements">Announcements</Link>
      <Link to="/documents">Documents</Link>
      <button
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
