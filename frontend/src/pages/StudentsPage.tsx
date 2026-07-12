import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api/client";
import type { Student } from "../types";

export function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ cognitoSub: "", email: "", firstName: "", lastName: "", program: "", year: 1 });

  const load = () => api.get<Student[]>("/students").then(setStudents).catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.post("/students", form);
      setForm({ cognitoSub: "", email: "", firstName: "", lastName: "", program: "", year: 1 });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create student");
    }
  };

  return (
    <div className="page">
      <h1>Students</h1>
      {error && <p className="error">{error}</p>}

      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Program</th>
            <th>Year</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {students.map((s) => (
            <tr key={s.studentId}>
              <td>{s.firstName} {s.lastName}</td>
              <td>{s.email}</td>
              <td>{s.program}</td>
              <td>{s.year}</td>
              <td><span className={`badge badge-${s.status}`}>{s.status}</span></td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Onboard a student</h2>
      <p className="hint">
        The Cognito user account must already exist (created via the seed script or AWS Console/CLI).
        Enter its Cognito "sub" here to link it to a new student record.
      </p>
      <form className="card" onSubmit={onSubmit}>
        <label>
          Cognito sub
          <input value={form.cognitoSub} onChange={(e) => setForm({ ...form, cognitoSub: e.target.value })} required />
        </label>
        <label>
          Email
          <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        </label>
        <label>
          First name
          <input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
        </label>
        <label>
          Last name
          <input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required />
        </label>
        <label>
          Program
          <input value={form.program} onChange={(e) => setForm({ ...form, program: e.target.value })} />
        </label>
        <label>
          Year
          <input type="number" min={1} value={form.year} onChange={(e) => setForm({ ...form, year: Number(e.target.value) })} />
        </label>
        <button type="submit">Create student</button>
      </form>
    </div>
  );
}
