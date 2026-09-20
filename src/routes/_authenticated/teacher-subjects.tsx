import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { BookOpen, Plus, Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PortalShell } from "@/components/PortalShell";
import { useProfile } from "@/hooks/useProfile";

export const Route = createFileRoute("/_authenticated/teacher-subjects")({
  head: () => ({
    meta: [
      { title: "Subjects — Tution Zone" },
      { name: "description", content: "Add and manage the subjects used across your class schedule." },
      { property: "og:title", content: "Subjects — Tution Zone" },
      {
        property: "og:description",
        content: "Add and manage the subjects used across your class schedule.",
      },
    ],
  }),
  component: TeacherSubjects,
});

function TeacherSubjects() {
  const { data: me } = useProfile();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");

  const { data: subjects = [] } = useQuery({
    queryKey: ["subjects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("subjects").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: classes = [] } = useQuery({
    queryKey: ["teacher-classes"],
    enabled: !!me,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select("*")
        .eq("teacher_id", me!.userId);
      if (error) throw error;
      return data;
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("subjects")
        .insert({ name: name.trim(), created_by: me!.userId });
      if (error) throw new Error(error.message.includes("duplicate") ? "That subject already exists." : error.message);
    },
    onSuccess: () => {
      setName("");
      toast.success("Subject added.");
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("subjects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Subject removed.");
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
    },
    onError: () => toast.error("You can only remove subjects you created."),
  });

  if (!me) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="size-6 animate-spin text-aqua" />
      </div>
    );
  }

  return (
    <PortalShell role="teacher" name={me.profile?.full_name || "Teacher"} subtitle={me.email ?? undefined}>
      <section className="glass p-4">
        <div className="flex items-center gap-2">
          <BookOpen className="size-5 text-aqua" />
          <h1 className="font-display text-sm font-semibold">Subjects</h1>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) add.mutate();
          }}
          className="mt-4 flex gap-2"
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New subject name"
            className="w-full rounded-xl border border-border bg-input px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
          />
          <button
            type="submit"
            className="flex shrink-0 items-center gap-1.5 rounded-xl bg-[image:var(--gradient-key)] px-4 text-sm font-semibold text-primary-foreground"
          >
            <Plus className="size-4" /> Add
          </button>
        </form>
      </section>

      <section className="mt-4 grid gap-3 sm:grid-cols-2">
        {subjects.map((s) => {
          const used = classes.filter((c) => c.subject_name === s.name).length;
          return (
            <div key={s.id} className="flex items-center justify-between glass p-4">
              <div>
                <p className="font-display text-sm font-semibold">{s.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {used} scheduled {used === 1 ? "class" : "classes"}
                </p>
              </div>
              {s.created_by === me.userId ? (
                <button
                  onClick={() => remove.mutate(s.id)}
                  className="grid size-8 place-items-center rounded-lg glass-soft text-muted-foreground hover:text-destructive"
                  aria-label="Remove subject"
                >
                  <Trash2 className="size-3.5" />
                </button>
              ) : null}
            </div>
          );
        })}
      </section>
    </PortalShell>
  );
}
