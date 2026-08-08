import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type FaqRow = { id: string; question: string; reponse: string };

/** FAQ accordéon alimentée par la table `faq` (gérée depuis l'admin). */
export default function FaqDynamique() {
  const [items, setItems] = useState<FaqRow[]>([]);
  const [open, setOpen] = useState(0);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase
        .from("faq")
        .select("id, question, reponse")
        .eq("publie", true)
        .order("ordre", { ascending: true });
      if (mounted && data) setItems(data as FaqRow[]);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <section className="v4-faq-section" aria-labelledby="faq-title">
      <div className="v4-faq-head">
        <div className="v4-hero-eyebrow" style={{ justifyContent: "center", width: "100%" }}>
          <span className="dot" />
          FAQ
        </div>
        <h2 id="faq-title">Questions fréquentes</h2>
      </div>
      {items.map((f, i) => (
        <div key={f.id} className={`v4-faq-item ${open === i ? "v4-open" : ""}`}>
          <button type="button" className="v4-faq-q" onClick={() => setOpen(open === i ? -1 : i)}>
            <span>{f.question}</span>
            <span className="plus">{open === i ? "−" : "+"}</span>
          </button>
          {open === i && <div className="v4-faq-a">{f.reponse}</div>}
        </div>
      ))}
    </section>
  );
}
