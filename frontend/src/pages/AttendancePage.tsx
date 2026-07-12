import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { api } from "../api/client";
import type { AttendanceRecord, Course, Enrollment, Student } from "../types";

type Status = "present" | "absent" | "late";

const STATUS_LABEL: Record<Status, string> = { present: "Present", absent: "Absent", late: "Late" };

export function AttendancePage() {
  const { isAdmin, studentId } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [studentNames, setStudentNames] = useState<Record<string, string>>({});
  const [courseId, setCourseId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [roster, setRoster] = useState<string[]>([]);
  const [marks, setMarks] = useState<Record<string, Status>>({});

  useEffect(() => {
    api.get<Course[]>("/courses").then(setCourses).catch(() => {});
    if (isAdmin) {
      api
        .get<Student[]>("/students")
        .then((students) => setStudentNames(Object.fromEntries(students.map((s) => [s.studentId, `${s.firstName} ${s.lastName}`]))))
        .catch(() => {});
    }
  }, [isAdmin]);

  const nameFor = (id: string) => studentNames[id] ?? id;

  const loadRoster = async () => {
    if (!courseId) return setError("Select a course first");
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
    if (!courseId) return setError("Select a course first");
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
    if (!courseId) return setError("Select a course first");
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
          Course
          <select value={courseId} onChange={(e) => setCourseId(e.target.value)}>
            <option value="">Select a course…</option>
            {courses.map((c) => (
              <option key={c.courseId} value={c.courseId}>
                {c.courseCode} — {c.title}
              </option>
            ))}
          </select>
        </label>
        {isAdmin && (
          <label>
            Date
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
        )}
        <div className="button-row">
          {isAdmin ? (
            <>
              <button onClick={loadRoster}>Load roster</button>
              <button className="btn-secondary" onClick={loadCourseAttendance}>View marks for date</button>
            </>
          ) : (
            <button onClick={loadOwnAttendance}>View my attendance</button>
          )}
        </div>
      </div>

      {isAdmin && roster.length > 0 && (
        <div className="card">
          <h2>Mark attendance — {date}</h2>
          {roster.map((id) => (
            <div key={id} className="roster-row">
              <span>{nameFor(id)}</span>
              <select value={marks[id]} onChange={(e) => setMarks({ ...marks, [id]: e.target.value as Status })}>
                <option value="present">Present</option>
                <option value="absent">Absent</option>
                <option value="late">Late</option>
              </select>
            </div>
          ))}
          <button onClick={submitAttendance}>Submit attendance</button>
        </div>
      )}

      <table>
        <thead>
          <tr>
            <th>Student</th>
            <th>Date</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <tr key={`${r.studentCourseId}-${r.date}`}>
              <td>{isAdmin ? nameFor(r.studentId) : r.studentId}</td>
              <td>{r.date}</td>
              <td>
                <span className={`badge badge-${r.status}`}>{STATUS_LABEL[r.status]}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
