import type { ReactNode } from "react";
import FleetPageHeader, {
  FleetHeaderButton,
  type FleetHeaderStat,
} from "@/components/flotte/FleetPageHeader";

type Props = {
  breadcrumb: string;
  eyebrow: string;
  title: ReactNode;
  highlight?: string;
  subtitle?: ReactNode;
  badge?: string | null;
  actions?: ReactNode;
  stats?: FleetHeaderStat[];
};

/** En-tête harmonisé de l'Espace Client particulier (accent bleu). */
export default function ClientPageHeader(props: Props) {
  return <FleetPageHeader space="Espace client" {...props} />;
}

export function ClientHeaderButton(
  props: Omit<Parameters<typeof FleetHeaderButton>[0], "accent">,
) {
  return <FleetHeaderButton accent="blue" {...props} />;
}
