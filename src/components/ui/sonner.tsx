/**
 * Toaster premium Transports Ligneo · bandeau opaque, glass léger, contraste AA,
 * positionnement responsive (top-center mobile / top-right desktop), animations 60fps
 * respectant prefers-reduced-motion. Compatible avec tous les appels `toast.*` existants.
 */
import { Toaster as Sonner } from "sonner";
import { useEffect, useState } from "react";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return (
    <Sonner
      position={isMobile ? "top-center" : "top-right"}
      expand
      visibleToasts={4}
      gap={12}
      offset={isMobile ? 16 : 20}
      swipeDirections={isMobile ? ["top", "left", "right"] : ["right"]}
      duration={5000}
      closeButton
      toastOptions={{
        unstyled: false,
        classNames: {
          toast: [
            "group relative overflow-hidden select-none",
            "w-full max-w-[420px] pointer-events-auto",
            "rounded-2xl border p-4 pr-10",
            "shadow-[0_20px_50px_-20px_rgba(6,18,56,0.55)]",
            "bg-[#0b1230]/95 backdrop-blur-xl backdrop-saturate-150",
            "border-white/10 text-[#f5f1e8]",
            "flex items-start gap-3",
            "motion-safe:animate-[fade-in_0.28s_ease-out]",
          ].join(" "),
          title: "text-sm font-semibold leading-snug text-[#faf7ef]",
          description: "text-[13px] leading-snug text-[#c7cde0] mt-0.5",
          icon: [
            "shrink-0 w-10 h-10 rounded-xl flex items-center justify-center",
            "bg-white/8 border border-white/10 text-[#e7c76a]",
          ].join(" "),
          content: "flex-1 min-w-0",
          closeButton: [
            "!absolute !top-2 !right-2 !left-auto !translate-x-0 !translate-y-0",
            "!w-7 !h-7 !rounded-full",
            "!bg-white/8 hover:!bg-white/16 !border-white/10 !text-[#f5f1e8]",
            "transition-colors",
          ].join(" "),
          actionButton: [
            "!bg-[#e7c76a] !text-[#0b1230] hover:!bg-[#f0d78c]",
            "!rounded-lg !px-3 !py-1.5 !text-xs !font-semibold",
            "!shadow-none !border-0",
          ].join(" "),
          cancelButton: [
            "!bg-white/8 !text-[#c7cde0] hover:!bg-white/14",
            "!rounded-lg !px-3 !py-1.5 !text-xs !font-medium !border-white/10",
          ].join(" "),
          success: "!border-[#3dd68c]/40 !shadow-[0_20px_50px_-20px_rgba(61,214,140,0.35)] [&_[data-icon]]:!bg-[#3dd68c]/15 [&_[data-icon]]:!text-[#7ee5b0] [&_[data-icon]]:!border-[#3dd68c]/30",
          error: "!border-[#ef4a4a]/40 !shadow-[0_20px_50px_-20px_rgba(239,74,74,0.4)] [&_[data-icon]]:!bg-[#ef4a4a]/15 [&_[data-icon]]:!text-[#ff8a8a] [&_[data-icon]]:!border-[#ef4a4a]/30",
          warning: "!border-[#f5b544]/40 !shadow-[0_20px_50px_-20px_rgba(245,181,68,0.35)] [&_[data-icon]]:!bg-[#f5b544]/15 [&_[data-icon]]:!text-[#ffd989] [&_[data-icon]]:!border-[#f5b544]/30",
          info: "!border-[#4d9aff]/40 !shadow-[0_20px_50px_-20px_rgba(77,154,255,0.35)] [&_[data-icon]]:!bg-[#4d9aff]/15 [&_[data-icon]]:!text-[#a8caff] [&_[data-icon]]:!border-[#4d9aff]/30",
        },
      }}
      style={
        {
          // Barre d'accent verticale à gauche via ::before défini plus bas
          "--width": "420px",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
