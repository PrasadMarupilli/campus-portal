import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthContext";
import { api } from "../api/client";
import type { Enrollment } from "../types";

export function EnrollmentPage() {
  const { isAdmin, studentId } = useAuth();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lookupCourseId, setLookupCourseId] = useState("");
  const [form, setForm] = useState({ studentId: "", courseId: "" });

  const loadOwn = () => {
    if (!studentId) return;
    api.get<Enrollment[]>(`/enrollments/student/${studentId}`).then(setEnrollments).catch((e) => setError(e.message));
  };

  useEffect(() => {
    if (!isAdmin) loadOwn();
  }, [isAdmin, studentId]);

  const lookupByCourse = async () => {
    setError(null);
    try {
      const result = await api.get<Enrollment[]>(`/enrollments/course/${lookupCourseId}`);
      setEnrollments(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lookup failed");
    }
  };

  const onEnroll = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.post("/enrollments", form);
      setForm({ studentId: "", courseId: "" });
      if (lookupCourseId) lookupByCourse();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enrollment failed");
    }
  };

  return (
    <div className="page">
      <h1>Enrollments</h1>
      {error && <p className="error">{error}</p>}

      {isAdmin && (
        <div className="card">
          <label>
            Look up roster by course ID
            <input value={lookupCourseId} onChange={(e) => setLookupCourseId(e.target.value)} />
          </label>
          <button onClick={lookupByCourse}>Look up</button>
        </div>
      )}

      <table>
        <thead>
          <tr>
            <th>Student ID</th>
            <th>Course ID</th>
            <th>Status</th>
            <th>Enrolled at</th>
          </tr>
        </thead>
        <tbody>
          {enrollments.map((e) => (
            <tr key={`${e.studentId}-${e.courseId}`}>
              <td>{e.studentId}</td>
              <td>{e.courseId}</td>
              <td>{e.status}</td>
              <td>{e.enrolledAt}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {isAdmin && (
        <>
          <h2>Enroll a student</h2>
          <form className="card" onSubmit={onEnroll}>
            <label>
              Student ID
              <input value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })} required />
            </label>
            <label>
              Course ID
              <input value={form.courseId} onChange={(e) => setForm({ ...form, courseId: e.target.value })} required />
            </label>
            <button type="submit">Enroll</button>
          </form>
        </>
      )}
    </div>
  );
}
