export type QuizQuestion = { question: string; choices: string[] };
export type CaseStudyChoice = { label: string };
export type CaseStudy = { scenario?: string | null; choices: CaseStudyChoice[] };

export type TrainingModule = {
  id: string;
  order_index: number;
  title: string;
  tag: string | null;
  duration_minutes: number;
  objectives: string[];
  content: string;
  video_url: string | null;
  resource_url: string | null;
  resource_label: string | null;
  checklist_items: string[];
  case_study: CaseStudy;
  quiz_questions: QuizQuestion[];
  last_updated: string;
};

export type ModuleProgress = {
  module_id: string;
  checklist_state: Record<string, boolean>;
  case_study_answer: number | null;
  quiz_score: number | null;
  attempts_count: number;
  completed: boolean;
  completed_at: string | null;
};

export const PASS_SCORE = 100;

export function moduleStatus(p?: ModuleProgress): "todo" | "in_progress" | "done" {
  if (!p) return "todo";
  if (p.completed) return "done";
  const started =
    (p.quiz_score !== null && p.quiz_score !== undefined) ||
    p.case_study_answer !== null ||
    Object.values(p.checklist_state || {}).some(Boolean);
  return started ? "in_progress" : "todo";
}

export const STATUS_LABEL: Record<"todo" | "in_progress" | "done", string> = {
  todo: "À faire",
  in_progress: "En cours",
  done: "Terminé",
};

/** Extrait le glossaire [[terme|définition]] d'un contenu de module. */
export function extractGlossary(content: string): { term: string; definition: string }[] {
  const out: { term: string; definition: string }[] = [];
  const re = /\[\[([^\]|]+)\|([^\]]+)\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const term = (m[1] ?? "").trim();
    const definition = (m[2] ?? "").trim();
    if (term && !out.some((g) => g.term.toLowerCase() === term.toLowerCase())) out.push({ term, definition });
  }
  return out;
}

/** Contenu texte brut (recherche) : retire la syntaxe. */
export function plainText(content: string): string {
  return content
    .replace(/\[\[([^\]|]+)\|[^\]]+\]\]/g, "$1")
    .replace(/^(##|!!|>>|-)\s?/gm, "")
    .trim();
}
