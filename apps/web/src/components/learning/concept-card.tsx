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
      className="neo-panel pointer-events-auto w-full max-w-sm bg-[var(--surface)] p-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-black uppercase tracking-wide">
            Concept Card
          </p>
          <h4 className="text-sm font-black">{concept.title}</h4>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={onDismiss}
          aria-label="Dismiss concept card"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <p className="mt-2 text-xs leading-relaxed">{concept.description}</p>
    </motion.article>
  );
}
