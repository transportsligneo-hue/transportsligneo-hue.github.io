import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/** Petite bulle d'aide « ? » au survol ou au clic. */
export function HelpTip({ text }: { text: string }) {
  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" aria-label="Aide" className="pp-help">?</button>
        </TooltipTrigger>
        <TooltipContent className="max-w-[240px] text-xs leading-snug">{text}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
