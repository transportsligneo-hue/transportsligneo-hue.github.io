/**
 * EdlErrorBoundary · capture toute exception de rendu à l'intérieur de
 * l'overlay EDL pour éviter de casser toute la route convoyeur (page
 * "Something went wrong"). Affiche un message lisible avec les actions
 * "Réessayer" et "Retour à la mission".
 */
import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, ArrowLeft } from "lucide-react";

interface Props {
  onClose: () => void;
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class EdlErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[EDL Error Boundary]", error, info?.componentStack);
  }

  private reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;

    const message = this.state.error.message || "Erreur inattendue.";

    return (
      <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#06091e] px-5">
        <div className="max-w-sm w-full rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-center text-white shadow-2xl">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/15 text-red-300">
            <AlertTriangle size={26} />
          </div>
          <h2 className="text-lg font-bold">État des lieux indisponible</h2>
          <p className="mt-2 text-sm text-white/70">
            Une erreur est survenue à l'ouverture de l'inspection. Vos
            données déjà enregistrées sont conservées.
          </p>
          <pre className="mt-3 max-h-32 overflow-auto rounded-md bg-black/40 p-2 text-left font-mono text-[10px] text-red-200">
            {message}
          </pre>
          <div className="mt-5 flex gap-2">
            <button
              onClick={this.reset}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold hover:bg-white/15 transition"
            >
              <RefreshCw size={14} /> Réessayer
            </button>
            <button
              onClick={() => {
                this.setState({ error: null });
                this.props.onClose();
              }}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500/20 px-4 py-3 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/30 transition"
            >
              <ArrowLeft size={14} /> Retour mission
            </button>
          </div>
        </div>
      </div>
    );
  }
}
