import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Megaphone, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PortalShell } from "@/components/PortalShell";
import { useProfile } from "@/hooks/useProfile";
import { CLASS_LEVELS, type NoticeRow } from "@/lib/portal";

export const Route = createFileRoute("/_authenticated/teacher-notices")({
  head: () => ({
    meta: [
      { title: "Notices — Tution Zone" },
      { name: "description", content: "Publish notices to the students registered under you." },
      { property: "og:title", content: "Notices — Tution Zone" },
      {
        property: "og:description",
        content: "Publish notices to the students registered under you.",
      },
    ],
  }),
  component: TeacherNotices,
});

const inputClass =
  "w-full rounded-xl border border-border bg-input px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring";

function TeacherNotices() {
  const { data: me } = useProfile();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [className, setClassName] = useState("");

  const { data: notices = [] } = useQuery({
    queryKey: ["teacher-notices"],
    enabled: !!me,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notices")
        .select("*")
        .eq("teacher_id", me!.userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as NoticeRow[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error("Write a notice title.");
      const { error } = await supabase.from("notices").insert({
        teacher_id: me!.userId,
        title: title.trim(),
        body: body.trim() || null,
        class_name: className || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Notice published — students notified.");
      setTitle("");
      setBody("");
      queryClient.invalidateQueries({ queryKey: ["teacher-notices"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notices").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Notice removed.");
      queryClient.invalidateQueries({ queryKey: ["teacher-notices"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!me) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="size-6 animate-spin text-aqua" />
      </div>
    );
  }

  return (
    <PortalShell
      role="teacher"
      name={me.profile?.full_name || "Teacher"}
      subtitle={me.email ?? undefined}
    >
      <section className="glass p-4">
        <div className="flex items-center gap-2">
          <Megaphone className="size-5 text-aqua" />
          <h1 className="font-display text-sm font-semibold">Publish a notice</h1>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
          className="mt-4 grid gap-3 sm:grid-cols-2"
        >
          <label className="block">
            <span className="mb-1 block text-[11px] text-muted-foreground">Title</span>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputClass}
              placeholder="Mid-term exam routine"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] text-muted-foreground">
              For which class (optional)
            </span>
            <select
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              className={inputClass}
            >
              <option value="" className="bg-popover">
                All my students
              </option>
              {CLASS_LEVELS.map((c) => (
                <option key={c} value={c} className="bg-popover">
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-[11px] text-muted-foreground">Details</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              className={inputClass}
              placeholder="Exam starts at 10:00 AM in room 302."
            />
          </label>
          <button
            type="submit"
            disabled={create.isPending}
            className="flex items-center justify-center gap-2 rounded-xl bg-[image:var(--gradient-key)] px-4 py-2.5 font-display text-sm font-semibold text-primary-foreground sm:col-span-2 disabled:opacity-60"
          >
            {create.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Publish notice
          </button>
        </form>
      </section>

      <section className="mt-4 glass p-4">
        <h2 className="font-display text-sm font-semibold">Published notices</h2>
        <div className="mt-3 space-y-2">
          {notices.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">No notices yet.</p>
          ) : (
            notices.map((n) => (
              <div key={n.id} className="flex items-start gap-3 glass-soft px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{n.title}</p>
                  {n.body ? (
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{n.body}</p>
                  ) : null}
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {n.class_name ?? "All students"} ·{" "}
                    {new Date(n.created_at).toLocaleString("en-GB")}
                  </p>
                </div>
                <button
                  onClick={() => remove.mutate(n.id)}
                  className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:text-destructive"
                  aria-label="Delete notice"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </section>
    </PortalShell>
  );
}
