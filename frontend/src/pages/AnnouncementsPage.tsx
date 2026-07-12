import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthContext";
import { api } from "../api/client";
import type { Announcement, AnnouncementAudience } from "../types";

export function AnnouncementsPage() {
  const { isAdmin } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", body: "", audience: "ALL" as AnnouncementAudience, pinned: false });

  const load = () => api.get<Announcement[]>("/announcements").then(setAnnouncements).catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.post("/announcements", form);
      setForm({ title: "", body: "", audience: "ALL", pinned: false });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post announcement");
    }
  };

  return (
    <div className="page">
      <h1>Announcements</h1>
      {error && <p className="error">{error}</p>}

      <ul className="announcement-list">
        {announcements.map((a) => (
          <li key={a.announcementId} className={`card announcement-card${a.pinned ? " pinned" : ""}`}>
            <h3>{a.pinned && <span className="pin-icon" aria-hidden>📌</span>}{a.title}</h3>
            <p>{a.body}</p>
            <div className="announcement-meta">
              <span className={`badge badge-audience-${a.audience.toLowerCase()}`}>{a.audience}</span>
              <span className="timestamp">{new Date(a.createdAt).toLocaleString()}</span>
            </div>
          </li>
        ))}
      </ul>

      {isAdmin && (
        <>
          <h2>Post an announcement</h2>
          <form className="card" onSubmit={onSubmit}>
            <label>
              Title
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            </label>
            <label>
              Body
              <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} required />
            </label>
            <label>
              Audience
              <select value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value as AnnouncementAudience })}>
                <option value="ALL">All</option>
                <option value="STUDENTS">Students</option>
                <option value="ADMINS">Admins</option>
              </select>
            </label>
            <label className="checkbox-label">
              <input type="checkbox" checked={form.pinned} onChange={(e) => setForm({ ...form, pinned: e.target.checked })} />
              Pin this announcement
            </label>
            <button type="submit">Post</button>
          </form>
        </>
      )}
    </div>
  );
}
