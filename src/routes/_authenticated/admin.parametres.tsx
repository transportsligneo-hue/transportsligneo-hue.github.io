import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/admin/parametres")({
  component: AdminParametres,
});

const ROLE_DESCRIPTIONS: Record<string, string> = {
  super_admin: "Accès total, gestion des admins et permissions système.",
  admin: "Gestion opérationnelle complète (clients, missions, finance).",
  manager: "Gestion d'une organisation (membres, missions internes).",
  client: "Espace client particulier.",
  convoyeur: "Convoyeur indépendant ou salarié.",
  sous_traitant: "Convoyeur externe partenaire.",
};

function AdminParametres() {
  const [perms, setPerms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("role_permissions")
        .select("*")
        .order("role");
      setPerms(data ?? []);
    } finally {
      setLoading(false);
    }
  }

  const roles = ["super_admin", "admin", "manager", "client", "convoyeur", "sous_traitant"];

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-pro-accent/10 flex items-center justify-center">
            <Shield className="text-pro-accent" size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-pro-text">Paramètres &amp; rôles</h1>
            <p className="text-sm text-pro-muted">Définition des rôles et permissions de la plateforme.</p>
          </div>
        </div>
      </header>

      {/* Rôles */}
      <div className="bg-white border border-pro-border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-pro-border">
          <h2 className="font-semibold text-pro-text">Rôles disponibles</h2>
          <p className="text-xs text-pro-muted mt-1">Hiérarchie des accès dans la plateforme.</p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rôle</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Niveau</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roles.map((r) => (
              <TableRow key={r}>
                <TableCell>
                  <Badge variant="outline" className="font-mono">{r}</Badge>
                </TableCell>
                <TableCell className="text-sm text-pro-text-soft">{ROLE_DESCRIPTIONS[r]}</TableCell>
                <TableCell>
                  {(r === "super_admin" || r === "admin") ? (
                    <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-200">Système</Badge>
                  ) : r === "manager" ? (
                    <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200">Organisation</Badge>
                  ) : (
                    <Badge variant="outline">Utilisateur</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Permissions */}
      <div className="bg-white border border-pro-border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-pro-border">
          <h2 className="font-semibold text-pro-text">Permissions par rôle</h2>
          <p className="text-xs text-pro-muted mt-1">Configuration fine des droits d'accès. Modifiable par les super admins uniquement.</p>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin text-pro-accent" size={20} />
          </div>
        ) : perms.length === 0 ? (
          <div className="text-center py-12 text-sm text-pro-muted">
            Aucune permission configurée. Les rôles utilisent les règles par défaut (RLS).
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rôle</TableHead>
                <TableHead>Permission</TableHead>
                <TableHead>Accordée</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {perms.map((p) => (
                <TableRow key={p.id}>
                  <TableCell><Badge variant="outline" className="font-mono">{p.role}</Badge></TableCell>
                  <TableCell className="text-sm">{p.permission}</TableCell>
                  <TableCell>
                    {p.granted ? (
                      <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200">Oui</Badge>
                    ) : (
                      <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200">Non</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
