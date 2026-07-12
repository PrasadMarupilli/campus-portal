import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthContext";
import { api } from "../api/client";
import type { Course, Enrollment, Student } from "../types";

export function EnrollmentPage() {
  const { isAdmin, studentId } = useAuth();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lookupCourseId, setLookupCourseId] = useState("");
  const [form, setForm] = useState({ studentId: "", courseId: "" });

  const courseLabel = (id: string) => {
    const c = courses.find((c) => c.courseId === id);
    return c ? `${c.courseCode} — ${c.title}` : id;
  };
  const studentLabel = (id: string) => {
    const s = students.find((s) => s.studentId === id);
    return s ? `${s.firstName} ${s.lastName}` : id;
  };

  const loadOwn = () => {
    if (!studentId) return;
    api.get<Enrollment[]>(`/enrollments/student/${studentId}`).then(setEnrollments).catch((e) => setError(e.message));
  };

  useEffect(() => {
    api.get<Course[]>("/courses").then(setCourses).catch(() => {});
    if (isAdmin) {
      api.get<Student[]>("/students").then(setStudents).catch(() => {});
    } else {
      loadOwn();
    }
  }, [isAdmin, studentId]);

  const lookupByCourse = async () => {
    if (!lookupCourseId) return setError("Select a course first");
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
            Look up roster by course
            <select value={lookupCourseId} onChange={(e) => setLookupCourseId(e.target.value)}>
              <option value="">Select a course…</option>
              {courses.map((c) => (
                <option key={c.courseId} value={c.courseId}>
                  {c.courseCode} — {c.title}
                </option>
              ))}
            </select>
          </label>
          <button onClick={lookupByCourse}>Look up</button>
        </div>
      )}

      <table>
        <thead>
          <tr>
            <th>Enrollment ID</th>
            <th>Student</th>
            <th>Course</th>
            <th>Status</th>
            <th>Enrolled at</th>
          </tr>
        </thead>
        <tbody>
          {enrollments.map((e) => (
            <tr key={e.enrollmentId}>
              <td><span className="code">{e.enrollmentId}</span></td>
              <td>{isAdmin ? studentLabel(e.studentId) : e.studentId}</td>
              <td><span className="code">{e.courseId}</span> {courseLabel(e.courseId)}</td>
              <td>
                <span className={`badge badge-${e.status}`}>{e.status}</span>
              </td>
              <td>{new Date(e.enrolledAt).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {isAdmin && (
        <>
          <h2>Enroll a student</h2>
          <form className="card" onSubmit={onEnroll}>
            <label>
              Student
              <select value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })} required>
                <option value="">Select a student…</option>
                {students.map((s) => (
                  <option key={s.studentId} value={s.studentId}>
                    {s.firstName} {s.lastName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Course
              <select value={form.courseId} onChange={(e) => setForm({ ...form, courseId: e.target.value })} required>
                <option value="">Select a course…</option>
                {courses.map((c) => (
                  <option key={c.courseId} value={c.courseId}>
                    {c.courseCode} — {c.title}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit">Enroll</button>
          </form>
        </>
      )}
    </div>
  );
}
