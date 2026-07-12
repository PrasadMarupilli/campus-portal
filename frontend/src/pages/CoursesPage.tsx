import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthContext";
import { api } from "../api/client";
import type { Course } from "../types";

export function CoursesPage() {
  const { isAdmin } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ courseCode: "", title: "", department: "", credits: 3, instructor: "", semester: "" });

  const load = () => api.get<Course[]>("/courses").then(setCourses).catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.post("/courses", form);
      setForm({ courseCode: "", title: "", department: "", credits: 3, instructor: "", semester: "" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create course");
    }
  };

  return (
    <div className="page">
      <h1>Courses</h1>
      {error && <p className="error">{error}</p>}

      <table>
        <thead>
          <tr>
            <th>Course ID</th>
            <th>Code</th>
            <th>Title</th>
            <th>Department</th>
            <th>Credits</th>
            <th>Instructor</th>
            <th>Semester</th>
          </tr>
        </thead>
        <tbody>
          {courses.map((c) => (
            <tr key={c.courseId}>
              <td><span className="code">{c.courseId}</span></td>
              <td>{c.courseCode}</td>
              <td>{c.title}</td>
              <td>{c.department}</td>
              <td>{c.credits}</td>
              <td>{c.instructor}</td>
              <td>{c.semester}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {isAdmin && (
        <>
          <h2>Add a course</h2>
          <form className="card" onSubmit={onSubmit}>
            <label>
              Course code
              <input value={form.courseCode} onChange={(e) => setForm({ ...form, courseCode: e.target.value })} required />
            </label>
            <label>
              Title
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            </label>
            <label>
              Department
              <input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
            </label>
            <label>
              Credits
              <input type="number" min={1} value={form.credits} onChange={(e) => setForm({ ...form, credits: Number(e.target.value) })} />
            </label>
            <label>
              Instructor
              <input value={form.instructor} onChange={(e) => setForm({ ...form, instructor: e.target.value })} />
            </label>
            <label>
              Semester
              <input value={form.semester} onChange={(e) => setForm({ ...form, semester: e.target.value })} />
            </label>
            <button type="submit">Create course</button>
          </form>
        </>
      )}
    </div>
  );
}
