/**
 * RecaptchaNotice — mention légale obligatoire pour reCAPTCHA v3.
 * À placer sous tout formulaire de connexion / inscription / contact.
 */
export function RecaptchaNotice({ className = "" }: { className?: string }) {
  return (
    <p className={`text-[10px] leading-relaxed text-pro-muted text-center ${className}`}>
      Protégé par reCAPTCHA et soumis à la{" "}
      <a
        href="https://policies.google.com/privacy"
        target="_blank"
        rel="noopener noreferrer"
        className="underline hover:text-pro-text transition"
      >
        Politique de Confidentialité
      </a>{" "}
      et aux{" "}
      <a
        href="https://policies.google.com/terms"
        target="_blank"
        rel="noopener noreferrer"
        className="underline hover:text-pro-text transition"
      >
        Termes d'Utilisation
      </a>{" "}
      de Google.
    </p>
  );
}
