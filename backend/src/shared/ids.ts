// Short, human-readable IDs for display-heavy entities. These are not
// collision-checked (fine at demo scale) - they exist so admins deal with
// codes like "110MC23" instead of raw UUIDs, not to guarantee uniqueness
// under contention.

export function generateCourseId(department?: string): string {
  const num = Math.floor(100 + Math.random() * 900); // 3 digits
  const deptCode = (department ?? "")
    .replace(/[^A-Za-z]/g, "")
    .toUpperCase()
    .padEnd(2, "X")
    .slice(0, 2);
  const yy = String(new Date().getFullYear()).slice(-2);
  return `${num}${deptCode}${yy}`;
}

export function generateEnrollmentId(): string {
  const letter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
  const yy = String(new Date().getFullYear()).slice(-2);
  const rand = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10)).join("");
  return `${letter}${yy}${rand}`;
}

// Satisfies the User Pool's password policy (min 8, upper, lower, digit).
export function generateTempPassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const all = upper + lower + digits;
  const pick = (chars: string) => chars[Math.floor(Math.random() * chars.length)];
  const rest = Array.from({ length: 7 }, () => pick(all)).join("");
  return `${pick(upper)}${pick(lower)}${pick(digits)}${rest}`;
}
