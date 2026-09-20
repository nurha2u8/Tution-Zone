export const CLASS_LEVELS = [
  "Hons 1st Year",
  "Hons 2nd Year",
  "Hons 3rd Year",
  "Hons 4th Year",
  "MBA 1st Year",
  "MBA 2nd Year",
  "Class 6",
  "Class 7",
  "Class 8",
  "Class 9",
  "Class 10",
  "Class 11",
  "Class 12",
];

export const DEPARTMENTS = ["Marketing", "Finance", "Management", "Accounting"];

/** Hons / MBA levels use departments; school classes (6–12) use a subject name. */
export function usesDepartment(className: string) {
  return /^(Hons|MBA)/i.test(className);
}

/** Auto-generated student ID, e.g. 2026-48213. */
export function generateStudentId() {
  const year = new Date().getFullYear();
  return `${year}-${Math.floor(10000 + Math.random() * 90000)}`;
}


export type ClassRow = {
  id: string;
  teacher_id: string;
  class_name: string;
  subject_name: string;
  department: string | null;
  scheduled_date: string;
  start_time: string;
  end_time: string;
  notes: string | null;
  created_at: string;
};

export type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string;
  student_id: string | null;
  phone: string | null;
  class_selected: string | null;
  subject_selected: string | null;
  department: string | null;
  teacher_id: string | null;
  teacher_code: string | null;
  role: string;
};

export type NoticeRow = {
  id: string;
  teacher_id: string;
  title: string;
  body: string | null;
  class_name: string | null;
  created_at: string;
};

export type AttendanceRow = {
  id: string;
  student_id: string;
  class_id: string;
  status: "present" | "absent";
  marked_at: string;
};

export function formatDate(date: string) {
  const d = new Date(`${date}T00:00:00`);
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function formatTime(time: string) {
  return time.slice(0, 5);
}

export function classDateTime(date: string, time: string) {
  return new Date(`${date}T${time}`);
}

export function isUpcoming(c: ClassRow) {
  return classDateTime(c.scheduled_date, c.end_time).getTime() >= Date.now();
}

export function countdown(c: ClassRow) {
  const diff = classDateTime(c.scheduled_date, c.start_time).getTime() - Date.now();
  if (diff <= 0) return "Now";
  const mins = Math.floor(diff / 60000);
  const days = Math.floor(mins / 1440);
  if (days >= 1) return `${days}d`;
  const h = Math.floor(mins / 60);
  return h >= 1 ? `${h}h ${mins % 60}m` : `${mins}m`;
}

export function initials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "?"
  );
}

export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows
    .map((r) =>
      r.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","),
    )
    .join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
