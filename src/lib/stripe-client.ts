import { loadStripe, type Stripe } from "@stripe/stripe-js";

type StripeEnv = "sandbox" | "live";

// Clés Stripe *publiables* (pk_…) : conçues pour être publiques côté navigateur.
// Elles ne sont plus stockées dans des fichiers .env versionnés.
const STRIPE_PK_TEST =
  "pk_test_51TPhEQAMZS9oGRsYM4SYlRiHVlgHxyjKoIvj8gIBqD6HjOE1vvJC8ewRACy4Og6ilwGGm09ivUOBrpchdIwDpTX200hpiEGca8";
const STRIPE_PK_LIVE =
  "pk_live_51TVzgsAt3eGFgFz3FuzfIaggsJquF8rd01Pzbn9NncCbpwZe7CdawVaNWWaxpgBSYhQRsWLhiVpKKPwPk94quJaC00Vjohm0Hr";

const clientToken =
  (import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined) ||
  (import.meta.env.PROD ? STRIPE_PK_LIVE : STRIPE_PK_TEST);

// Derive the environment from the token PREFIX. A missing or unrecognized
// token is a configuration error — never silently route to 'live'.
function paymentsEnvironment(): StripeEnv {
  if (clientToken?.startsWith("pk_test_")) return "sandbox";
  if (clientToken?.startsWith("pk_live_")) return "live";
  throw new Error(
    "Stripe payments are not configured for this build. " +
      "Complete Stripe go-live in your Lovable project to enable production checkout.",
  );
}

let stripePromise: Promise<Stripe | null> | null = null;

export function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    // Throws loudly when the token is missing or unrecognized.
    paymentsEnvironment();
    stripePromise = loadStripe(clientToken as string);
  }
  return stripePromise;
}

export function getStripeEnvironment(): StripeEnv {
  return paymentsEnvironment();
}