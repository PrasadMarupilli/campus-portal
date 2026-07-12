import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { api } from "../api/client";
import type { DocumentMeta, DocumentType } from "../types";

export function DocumentsPage() {
  const { isAdmin, studentId } = useAuth();
  const [documents, setDocuments] = useState<DocumentMeta[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<DocumentType>("assignment");
  const [targetStudentId, setTargetStudentId] = useState("");

  const load = () => api.get<DocumentMeta[]>("/documents").then(setDocuments).catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  const onUpload = async () => {
    if (!file) return;
    setError(null);
    try {
      const ownerId = isAdmin ? targetStudentId : studentId;
      if (!ownerId) throw new Error("Student ID is required");
      const query = isAdmin ? `?studentId=${encodeURIComponent(ownerId)}` : "";
      const { uploadUrl } = await api.post<{ uploadUrl: string; documentId: string }>(
        `/documents/upload-url${query}`,
        { fileName: file.name, contentType: file.type || "application/octet-stream", docType }
      );
      await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file });
      setFile(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    }
  };

  const onDownload = async (doc: DocumentMeta) => {
    setError(null);
    try {
      const { downloadUrl } = await api.get<{ downloadUrl: string }>(
        `/documents/${doc.documentId}/download-url?studentId=${encodeURIComponent(doc.studentId)}`
      );
      window.open(downloadUrl, "_blank");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
    }
  };

  const onDelete = async (doc: DocumentMeta) => {
    setError(null);
    try {
      await api.del(`/documents/${doc.documentId}?studentId=${encodeURIComponent(doc.studentId)}`);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  return (
    <div className="page">
      <h1>Documents</h1>
      {error && <p className="error">{error}</p>}

      <table>
        <thead>
          <tr>
            <th>File name</th>
            <th>Type</th>
            <th>Owner</th>
            <th>Uploaded at</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {documents.map((d) => (
            <tr key={d.documentId}>
              <td>{d.fileName}</td>
              <td>{d.docType}</td>
              <td>{d.studentId}</td>
              <td>{new Date(d.uploadedAt).toLocaleString()}</td>
              <td>
                <button onClick={() => onDownload(d)}>Download</button>
                <button onClick={() => onDelete(d)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Upload a document</h2>
      <div className="card">
        {isAdmin && (
          <label>
            Student ID (upload on behalf of)
            <input value={targetStudentId} onChange={(e) => setTargetStudentId(e.target.value)} />
          </label>
        )}
        <label>
          Document type
          <select value={docType} onChange={(e) => setDocType(e.target.value as DocumentType)}>
            <option value="assignment">Assignment</option>
            <option value="certificate">Certificate</option>
            <option value="id-card">ID card</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label>
          File
          <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
        <button onClick={onUpload} disabled={!file}>Upload</button>
      </div>
    </div>
  );
}
