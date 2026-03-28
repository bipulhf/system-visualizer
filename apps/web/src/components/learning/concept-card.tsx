import { useEffect } from "react";
import { motion } from "motion/react";
import { X } from "lucide-react";
import { Button } from "~/components/ui/button";
import type { ConceptDefinition } from "~/lib/learning-content";

export function ConceptCard({
  concept,
  onDismiss,
}: {
  concept: ConceptDefinition | null;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!concept) {
      return;
    }

    const timer = setTimeout(() => {
      onDismiss();
    }, 8000);

    return () => {
      clearTimeout(timer);
    };
  }, [concept, onDismiss]);

  if (!concept) {
    return null;
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 18, x: 18 }}
      animate={{ opacity: 1, y: 0, x: 0 }}
      exit={{ opacity: 0, y: 12, x: 12 }}
      transition={{ duration: 0.24, ease: "easeOut" }}
      className="card pointer-events-auto w-full max-w-sm rounded-xl p-3 shadow-lg"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            Concept Card
          </p>
          <h4 className="text-sm font-semibold">{concept.title}</h4>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onDismiss}
          aria-label="Dismiss concept card"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">
        {concept.description}
      </p>
    </motion.article>
  );
}
