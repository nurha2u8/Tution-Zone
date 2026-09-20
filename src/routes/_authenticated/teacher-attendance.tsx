import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Download, Loader2, Save, ClipboardCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PortalShell } from "@/components/PortalShell";
import { useProfile } from "@/hooks/useProfile";
import {
  downloadCsv,
  formatDate,
  formatTime,
  type AttendanceRow,
  type ClassRow,
  type ProfileRow,
} from "@/lib/portal";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/teacher-attendance")({
  head: () => ({
    meta: [
      { title: "Mark attendance — Tution Zone" },
      { name: "description", content: "Mark present or absent for every student in your class." },
      { property: "og:title", content: "Mark attendance — Tution Zone" },
      {
        property: "og:description",
        content: "Mark present or absent for every student in your class.",
      },
    ],
  }),
  component: TeacherAttendance,
});

function TeacherAttendance() {
  const { data: me } = useProfile();
  const queryClient = useQueryClient();
  const [classId, setClassId] = useState("");
  const [marks, setMarks] = useState<Record<string, "present" | "absent">>({});

  const { data: classes = [] } = useQuery({
    queryKey: ["teacher-classes"],
    enabled: !!me,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select("*")
        .eq("teacher_id", me!.userId)
        .order("scheduled_date", { ascending: false });
      if (error) throw error;
      return data as ClassRow[];
    },
  });

  const selected = classes.find((c) => c.id === classId) ?? null;

  const { data: students = [] } = useQuery({
    queryKey: ["class-students", selected?.class_name, selected?.teacher_id],
    enabled: !!selected,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("role", "student")
        .eq("class_selected", selected!.class_name)
        .eq("teacher_id", selected!.teacher_id)
        .order("full_name");
      if (error) throw error;
      return data as ProfileRow[];
    },
  });


  const { data: existingData } = useQuery({
    queryKey: ["attendance", classId],
    enabled: !!classId,
    queryFn: async () => {
      const { data, error } = await supabase.from("attendance").select("*").eq("class_id", classId);
      if (error) throw error;
      return data as AttendanceRow[];
    },
  });

  const existing = existingData ?? [];

  useEffect(() => {
    if (!existingData) return;
    const next: Record<string, "present" | "absent"> = {};
    for (const row of existingData) next[row.student_id] = row.status;
    setMarks(next);
  }, [existingData]);

  const save = useMutation({
    mutationFn: async () => {
      const rows = students
        .filter((s) => marks[s.id])
        .map((s) => ({ student_id: s.id, class_id: classId, status: marks[s.id]!, marked_at: new Date().toISOString() }));
      if (rows.length === 0) throw new Error("Mark at least one student first.");
      const { error } = await supabase
        .from("attendance")
        .upsert(rows, { onConflict: "student_id,class_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Attendance saved.");
      queryClient.invalidateQueries({ queryKey: ["attendance", classId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function exportCsv() {
    if (!selected) return;
    const rows: (string | number)[][] = [
      ["Student name", "Student ID", "Phone", "Class", "Subject", "Date", "Time", "Status"],
      ...students.map((s) => [
        s.full_name,
        s.student_id ?? "",
        s.phone ?? "",
        selected.class_name,
        selected.subject_name,
        selected.scheduled_date,
        `${formatTime(selected.start_time)}-${formatTime(selected.end_time)}`,
        marks[s.id] ?? "not marked",
      ]),
    ];
    downloadCsv(
      `attendance-${selected.subject_name}-${selected.scheduled_date}.csv`.replace(/\s+/g, "-"),
      rows,
    );
  }

  if (!me) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="size-6 animate-spin text-aqua" />
      </div>
    );
  }

  const presentCount = Object.values(marks).filter((m) => m === "present").length;

  return (
    <PortalShell role="teacher" name={me.profile?.full_name || "Teacher"} subtitle={me.email ?? undefined}>
      <section className="glass p-4">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="size-5 text-aqua" />
          <h1 className="font-display text-sm font-semibold">Mark attendance</h1>
        </div>
        <label className="mt-4 block">
          <span className="mb-1 block text-[11px] text-muted-foreground">Select one of your classes</span>
          <select
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className="w-full rounded-xl border border-border bg-input px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="" className="bg-popover">
              Choose a class…
            </option>
            {classes.map((c) => (
              <option key={c.id} value={c.id} className="bg-popover">
                {c.subject_name} · {c.class_name} · {formatDate(c.scheduled_date)}{" "}
                {formatTime(c.start_time)}
              </option>
            ))}
          </select>
        </label>
      </section>

      {selected ? (
        <section className="mt-4 glass overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <div>
              <p className="font-display text-sm font-semibold">
                {selected.subject_name} · {selected.class_name}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {formatDate(selected.scheduled_date)} · {formatTime(selected.start_time)}–
                {formatTime(selected.end_time)} · {presentCount}/{students.length} present
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={exportCsv}
                className="flex items-center gap-1.5 rounded-xl glass-soft px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                <Download className="size-3.5" /> CSV
              </button>
              <button
                onClick={() => save.mutate()}
                disabled={save.isPending}
                className="flex items-center gap-1.5 rounded-xl bg-[image:var(--gradient-key)] px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60"
              >
                {save.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                Save attendance
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-y border-border text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Student</th>
                  <th className="px-4 py-2 font-medium">ID</th>
                  <th className="px-4 py-2 font-medium">Phone</th>
                  <th className="px-4 py-2 text-right font-medium">Attendance</th>
                </tr>
              </thead>
              <tbody>
                {students.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-xs text-muted-foreground">
                      No students registered for {selected.class_name} yet.
                    </td>
                  </tr>
                ) : (
                  students.map((s) => (
                    <tr key={s.id} className="border-b border-border/60 hover:bg-accent/60">
                      <td className="px-4 py-3 font-medium">{s.full_name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{s.student_id ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{s.phone ?? "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1.5">
                          {(["present", "absent"] as const).map((status) => (
                            <button
                              key={status}
                              onClick={() => setMarks((m) => ({ ...m, [s.id]: status }))}
                              className={cn(
                                "rounded-lg px-3 py-1 text-[11px] font-semibold capitalize transition-colors",
                                marks[s.id] === status
                                  ? status === "present"
                                    ? "bg-aqua/20 text-aqua ring-1 ring-aqua/40"
                                    : "bg-absent/20 text-absent ring-1 ring-absent/40"
                                  : "glass-soft text-muted-foreground",
                              )}
                            >
                              {status}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {selected && existing.length > 0 ? (
        <section className="mt-4 glass p-4">
          <h2 className="font-display text-sm font-semibold">Saved record</h2>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {existing.filter((a) => a.status === "present").length} present ·{" "}
            {existing.filter((a) => a.status === "absent").length} absent · last saved{" "}
            {new Date(
              Math.max(...existing.map((a) => new Date(a.marked_at).getTime())),
            ).toLocaleString("en-GB")}
          </p>
        </section>
      ) : null}
    </PortalShell>
  );
}
