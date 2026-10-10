import type { ResolverTripType } from "./client-pricing";
import type { TripType } from "./reservation-pricing";

export type GroupedTripType = "aller-simple" | "aller-retour" | "recharge";

export const GROUPED_TRIP_CHOICES: { value: GroupedTripType; label: string }[] = [
  { value: "aller-simple", label: "Livraison simple" },
  { value: "aller-retour", label: "restitution et livraison" },
  { value: "recharge", label: "Recharge uniquement" },
];

export function groupedDestination(type: GroupedTripType, depart: string, arrivee: string): string {
  return type === "recharge" ? depart : arrivee;
}

export function groupedResolverTrip(type: GroupedTripType): ResolverTripType {
  return type === "aller-retour" ? "aller_retour" : "aller";
}

export function groupedStandardTrip(type: GroupedTripType): TripType {
  return type === "aller-retour" ? "aller_retour" : "aller_simple";
}

export function groupedTripLabel(type: GroupedTripType): string {
  return GROUPED_TRIP_CHOICES.find((choice) => choice.value === type)?.label ?? "Livraison simple";
}