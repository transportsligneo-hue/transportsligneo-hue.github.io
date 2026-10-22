import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type FaqRow = { id: string; question: string; reponse: string };

/** FAQ accordéon (mobile) alimentée par la table `faq` gérée depuis l'admin. */
export default function MobileFaq() {
  const [items, setItems] = useState<FaqRow[]>([]);
  const [open, setOpen] = useState(-1);

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
    <section className="mh2-sec" aria-labelledby="mh2-faq-title">
      <div className="mh2-h2">FAQ</div>
      <h2 id="mh2-faq-title" className="mh2-t2">
        Questions fréquentes
      </h2>
      {items.map((f, i) => (
        <div key={f.id} className={`mh2-faq${open === i ? " is-open" : ""}`}>
          <button type="button" aria-expanded={open === i} onClick={() => setOpen(open === i ? -1 : i)}>
            <span>{f.question}</span>
            <span className="mh2-pl">{open === i ? "−" : "+"}</span>
          </button>
          {open === i && <div className="mh2-a">{f.reponse}</div>}
        </div>
      ))}
    </section>
  );
}
