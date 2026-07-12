import { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { api } from "../api/client";
import type { AttendanceRecord, Enrollment } from "../types";

type Status = "present" | "absent" | "late";

export function AttendancePage() {
  const { isAdmin, studentId } = useAuth();
  const [courseId, setCourseId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [roster, setRoster] = useState<string[]>([]);
  const [marks, setMarks] = useState<Record<string, Status>>({});

  const loadRoster = async () => {
    setError(null);
    try {
      const enrollments = await api.get<Enrollment[]>(`/enrollments/course/${courseId}`);
      const studentIds = enrollments.map((e) => e.studentId);
      setRoster(studentIds);
      setMarks(Object.fromEntries(studentIds.map((id) => [id, "present" as Status])));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load roster");
    }
  };

  const submitAttendance = async () => {
    setError(null);
    try {
      await api.post("/attendance", {
        courseId,
        date,
        marks: roster.map((id) => ({ studentId: id, status: marks[id] })),
      });
      loadCourseAttendance();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to mark attendance");
    }
  };

  const loadCourseAttendance = async () => {
    setError(null);
    try {
      const result = await api.get<AttendanceRecord[]>(`/attendance/course/${courseId}?date=${date}`);
      setRecords(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load attendance");
    }
  };

  const loadOwnAttendance = async () => {
    if (!studentId) return;
    setError(null);
    try {
      const result = await api.get<AttendanceRecord[]>(`/attendance/student/${studentId}/course/${courseId}`);
      setRecords(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load attendance");
    }
  };

  return (
    <div className="page">
      <h1>Attendance</h1>
      {error && <p className="error">{error}</p>}

      <div className="card">
        <label>
          Course ID
          <input value={courseId} onChange={(e) => setCourseId(e.target.value)} />
        </label>
        {isAdmin && (
          <label>
            Date
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
        )}
        {isAdmin ? (
          <>
            <button onClick={loadRoster}>Load roster</button>
            <button onClick={loadCourseAttendance}>View marks for date</button>
          </>
        ) : (
          <button onClick={loadOwnAttendance}>View my attendance</button>
        )}
      </div>

      {isAdmin && roster.length > 0 && (
        <div className="card">
          <h2>Mark attendance — {date}</h2>
          {roster.map((id) => (
            <div key={id} className="roster-row">
              <span>{id}</span>
              <select value={marks[id]} onChange={(e) => setMarks({ ...marks, [id]: e.target.value as Status })}>
                <option value="present">present</option>
                <option value="absent">absent</option>
                <option value="late">late</option>
              </select>
            </div>
          ))}
          <button onClick={submitAttendance}>Submit attendance</button>
        </div>
      )}

      <table>
        <thead>
          <tr>
            <th>Student ID</th>
            <th>Date</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <tr key={`${r.studentCourseId}-${r.date}`}>
              <td>{r.studentId}</td>
              <td>{r.date}</td>
              <td>{r.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
