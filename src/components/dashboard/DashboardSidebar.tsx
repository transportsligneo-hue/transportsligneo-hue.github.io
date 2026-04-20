import { Link, useLocation } from "@tanstack/react-router";
import { LogOut, Menu, X, type LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";

export interface SidebarItem {
  to: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  badge?: ReactNode;
}

interface Props {
  title: string;
  subtitle?: string;
  items: SidebarItem[];
  /** Contenu rendu dans le main */
  children: ReactNode;
}

export function DashboardSidebar({ title, subtitle, items, children }: Props) {
  const location = useLocation();
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen flex section-bg">
      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-navy/95 border-b border-primary/20 px-4 py-3 flex items-center justify-between backdrop-blur-sm">
        <span className="font-heading text-primary text-sm tracking-[0.1em] uppercase">{title}</span>
        <button onClick={() => setOpen(!open)} className="text-cream/70" aria-label="Menu">
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Sidebar */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 w-64 bg-navy/85 border-r border-primary/20 flex flex-col transition-transform duration-300 ${
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        } md:translate-x-0 pt-14 md:pt-0`}
      >
        <div className="p-6 border-b border-primary/15 hidden md:block">
          <h2 className="font-heading text-primary text-lg tracking-[0.1em] uppercase">{title}</h2>
          {subtitle && <p className="text-cream/40 text-xs mt-1">{subtitle}</p>}
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {items.map((item) => {
            const isActive = item.exact
              ? location.pathname === item.to
              : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded text-sm transition-all ${
                  isActive
                    ? "bg-primary/15 text-primary border border-primary/30 shadow-[0_0_15px_rgba(212,175,55,0.1)]"
                    : "text-cream/60 hover:text-primary hover:bg-primary/5 border border-transparent"
                }`}
              >
                <item.icon size={17} />
                <span className="flex-1">{item.label}</span>
                {item.badge}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-primary/15">
          <button
            onClick={() => logout()}
            className="flex items-center gap-3 px-4 py-2.5 rounded text-sm text-cream/60 hover:text-destructive hover:bg-destructive/10 transition-colors w-full"
          >
            <LogOut size={17} />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Backdrop */}
      {open && (
        <div className="fixed inset-0 z-30 bg-black/60 md:hidden" onClick={() => setOpen(false)} />
      )}

      {/* Main */}
      <main className="flex-1 overflow-auto pt-14 md:pt-0">
        <div className="p-5 md:p-8 max-w-6xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
