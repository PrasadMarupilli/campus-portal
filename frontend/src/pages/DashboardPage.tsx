import { useAuth } from "../auth/AuthContext";

export function DashboardPage() {
  const { email, isAdmin, studentId } = useAuth();

  return (
    <div className="page">
      <h1>Dashboard</h1>
      <p>Signed in as {email}</p>
      <p>Role: {isAdmin ? "Administrator" : "Student"}</p>
      {studentId && <p>Student ID: {studentId}</p>}
    </div>
  );
}
