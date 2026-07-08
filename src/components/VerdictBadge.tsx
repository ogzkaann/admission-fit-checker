import { AlertTriangle, CheckCircle2, CircleSlash, HelpCircle } from "lucide-react";
import type { FitVerdict } from "../domain/types";
import { verdictLabels } from "../domain/labels";
import { Badge, type BadgeProps } from "./ui/badge";

const config: Record<FitVerdict, { variant: BadgeProps["variant"]; icon: typeof CheckCircle2 }> = {
  strong_fit: { variant: "green", icon: CheckCircle2 },
  possible_risky: { variant: "yellow", icon: AlertTriangle },
  not_recommended: { variant: "red", icon: CircleSlash },
  not_enough_data: { variant: "outline", icon: HelpCircle },
};

export function VerdictBadge({ verdict, className }: { verdict: FitVerdict; className?: string }) {
  const { variant, icon: Icon } = config[verdict];
  return (
    <Badge variant={variant} className={`gap-1.5 ${className ?? ""}`}>
      <Icon className="h-3.5 w-3.5" />
      {verdictLabels[verdict]}
    </Badge>
  );
}
