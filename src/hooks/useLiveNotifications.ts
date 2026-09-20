import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Notif = { id: string; title: string; body: string | null; created_at: string };

/**
 * Keeps notifications flowing in every environment: realtime when the socket is
 * available, plus a short polling fallback (works inside an APK webview too).
 * New items raise an in-app toast and, when allowed, a system notification.
 */
export function useLiveNotifications(enabled: boolean) {
  const queryClient = useQueryClient();
  const seen = useRef<Set<string> | null>(null);

  const { data } = useQuery({
    queryKey: ["live-notifications"],
    enabled,
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id,title,body,created_at")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data ?? []) as Notif[];
    },
  });

  // Ask once for permission to show system notifications.
  useEffect(() => {
    if (!enabled || typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "default") void Notification.requestPermission();
  }, [enabled]);

  // Announce anything that arrived after the first load.
  useEffect(() => {
    if (!data) return;
    if (seen.current === null) {
      seen.current = new Set(data.map((n) => n.id));
      return;
    }
    const fresh = data.filter((n) => !seen.current!.has(n.id));
    for (const n of fresh) {
      seen.current.add(n.id);
      toast(n.title, { description: n.body ?? undefined });
      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
        try {
          new Notification(n.title, { body: n.body ?? "", icon: "/app-icon-512.png" });
        } catch {
          /* webviews may block constructing notifications directly */
        }
      }
    }
    if (fresh.length > 0) {
      queryClient.invalidateQueries({ queryKey: ["unread-notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["student-classes"] });
      queryClient.invalidateQueries({ queryKey: ["student-notices"] });
    }
  }, [data, queryClient]);

  // Realtime push when the channel is available.
  useEffect(() => {
    if (!enabled) return;
    const channel = supabase
      .channel("notifications-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["live-notifications"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [enabled, queryClient]);
}
