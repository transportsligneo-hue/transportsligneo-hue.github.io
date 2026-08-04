import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { ModuleProgress, TrainingModule } from "./types";
import { useAuth } from "@/hooks/useAuth";

type State = {
  modules: TrainingModule[];
  progress: Record<string, ModuleProgress>;
  loading: boolean;
};

export function useTraining() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [state, setState] = useState<State>({ modules: [], progress: {}, loading: true });

  const load = useCallback(async () => {
    const [{ data: mods }, prog] = await Promise.all([
      supabase.rpc("get_training_modules"),
      userId
        ? supabase.from("module_progress").select("*").eq("user_id", userId)
        : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    ]);
    const progress: Record<string, ModuleProgress> = {};
    for (const row of ((prog as { data?: Record<string, unknown>[] }).data ?? [])) {
      const r = row as unknown as ModuleProgress & { checklist_state: Record<string, boolean> | null };
      progress[r.module_id] = {
        module_id: r.module_id,
        checklist_state: r.checklist_state ?? {},
        case_study_answer: r.case_study_answer ?? null,
        quiz_score: r.quiz_score ?? null,
        attempts_count: r.attempts_count ?? 0,
        completed: !!r.completed,
        completed_at: r.completed_at ?? null,
      };
    }
    setState({
      modules: ((mods as unknown as TrainingModule[]) ?? []).slice().sort((a, b) => a.order_index - b.order_index),
      progress,
      loading: false,
    });
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveChecklist = useCallback(
    async (moduleId: string, checklist: Record<string, boolean>) => {
      if (!userId) return;
      setState((s) => ({
        ...s,
        progress: {
          ...s.progress,
          [moduleId]: {
            module_id: moduleId,
            checklist_state: checklist,
            case_study_answer: s.progress[moduleId]?.case_study_answer ?? null,
            quiz_score: s.progress[moduleId]?.quiz_score ?? null,
            attempts_count: s.progress[moduleId]?.attempts_count ?? 0,
            completed: s.progress[moduleId]?.completed ?? false,
            completed_at: s.progress[moduleId]?.completed_at ?? null,
          },
        },
      }));
      await supabase
        .from("module_progress")
        .upsert(
          { user_id: userId, module_id: moduleId, checklist_state: checklist },
          { onConflict: "user_id,module_id" },
        );
    },
    [userId],
  );

  const markCompleted = useCallback(
    async (moduleId: string) => {
      if (!userId) return;
      await supabase
        .from("module_progress")
        .upsert(
          { user_id: userId, module_id: moduleId, completed: true, completed_at: new Date().toISOString() },
          { onConflict: "user_id,module_id" },
        );
      await load();
    },
    [userId, load],
  );

  const touchVisit = useCallback(
    async (moduleId: string) => {
      if (!userId) return;
      await supabase
        .from("profiles")
        .update({ last_module_visited: moduleId, training_started_at: new Date().toISOString() })
        .eq("id", userId)
        .is("training_started_at", null);
      await supabase.from("profiles").update({ last_module_visited: moduleId }).eq("id", userId);
    },
    [userId],
  );

  const completedCount = state.modules.filter((m) => state.progress[m.id]?.completed).length;
  const percent = state.modules.length ? Math.round((completedCount / state.modules.length) * 100) : 0;

  return { ...state, reload: load, saveChecklist, markCompleted, touchVisit, completedCount, percent, userId };
}
