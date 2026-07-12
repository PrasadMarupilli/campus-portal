export interface Student {
  studentId: string;
  cognitoSub: string;
  email: string;
  firstName: string;
  lastName: string;
  program: string;
  year: number;
  status: "active" | "inactive";
  createdAt: string;
}

export interface Course {
  courseId: string;
  courseCode: string;
  title: string;
  department: string;
  credits: number;
  instructor: string;
  semester: string;
}

export interface Enrollment {
  enrollmentId: string;
  studentId: string;
  courseId: string;
  enrolledAt: string;
  status: "enrolled" | "dropped" | "completed";
  grade?: string;
}

export interface AttendanceRecord {
  studentCourseId: string;
  date: string;
  studentId: string;
  courseId: string;
  status: "present" | "absent" | "late";
  markedBy: string;
  markedAt: string;
}

export type AnnouncementAudience = "ALL" | "STUDENTS" | "ADMINS";

export interface Announcement {
  announcementId: string;
  title: string;
  body: string;
  audience: AnnouncementAudience;
  createdBy: string;
  createdAt: string;
  pinned: boolean;
}

export type DocumentType = "assignment" | "certificate" | "id-card" | "other";

export interface DocumentMeta {
  studentId: string;
  documentId: string;
  s3Key: string;
  fileName: string;
  contentType: string;
  docType: DocumentType;
  uploadedAt: string;
  uploadedBy: string;
  courseId?: string;
  sizeBytes?: number;
}
