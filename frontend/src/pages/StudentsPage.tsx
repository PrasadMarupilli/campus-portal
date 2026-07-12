import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api/client";
import type { Student } from "../types";

interface CreatedStudent extends Student {
  temporaryPassword: string;
}

export function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedStudent | null>(null);
  const [form, setForm] = useState({ email: "", firstName: "", lastName: "", program: "", year: 1, password: "" });

  const load = () => api.get<Student[]>("/students").then(setStudents).catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setCreated(null);
    try {
      const result = await api.post<CreatedStudent>("/students", form);
      setCreated(result);
      setForm({ email: "", firstName: "", lastName: "", program: "", year: 1, password: "" });
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
            <th>Student ID</th>
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
              <td><span className="code">{s.studentId}</span></td>
              <td>{s.firstName} {s.lastName}</td>
              <td>{s.email}</td>
              <td>{s.program}</td>
              <td>{s.year}</td>
              <td><span className={`badge badge-${s.status}`}>{s.status}</span></td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Add a student</h2>
      <p className="hint">
        Creates their login and student record together — share the credentials below with them once created.
      </p>

      {created && (
        <div className="card success-card">
          <h3>Student created</h3>
          <p>Share these login details with {created.firstName} — this password is shown only once.</p>
          <div className="credential-row"><span>Student ID</span><span className="code">{created.studentId}</span></div>
          <div className="credential-row"><span>Email</span><span className="code">{created.email}</span></div>
          <div className="credential-row"><span>Password</span><span className="code">{created.temporaryPassword}</span></div>
        </div>
      )}

      <form className="card" onSubmit={onSubmit}>
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
        <label>
          Initial password <span className="hint-inline">(leave blank to auto-generate)</span>
          <input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Auto-generated if empty" />
        </label>
        <button type="submit">Create student</button>
      </form>
    </div>
  );
}
