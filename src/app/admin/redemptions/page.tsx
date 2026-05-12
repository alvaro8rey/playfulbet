import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/Card";
import { formatDateShort } from "@/utils";
import { Mail, Phone, MapPin, FileText, CheckCircle, Clock, AlertCircle } from "lucide-react";

interface Redemption {
  id: string;
  reward_id: number;
  nombre: string;
  email: string;
  telefono: string | null;
  direccion: string;
  notas: string | null;
  status: "pending" | "processing" | "completed" | "cancelled";
  created_at: string;
  reward: {
    nombre: string;
    puntos_necesarios: number;
  };
  profile: {
    username: string;
  };
}

function StatusBadge({ status }: { status: string }) {
  const statusConfig = {
    pending: { label: "Pendiente", icon: Clock, bg: "bg-pending/10", text: "text-pending" },
    processing: { label: "En proceso", icon: AlertCircle, bg: "bg-blue/10", text: "text-blue" },
    completed: { label: "Completado", icon: CheckCircle, bg: "bg-accent/10", text: "text-accent" },
    cancelled: { label: "Cancelado", icon: AlertCircle, bg: "bg-loss/10", text: "text-loss" },
  };

  const config = statusConfig[status as keyof typeof statusConfig];
  const Icon = config.icon;

  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${config.bg} ${config.text}`}>
      <Icon size={14} />
      {config.label}
    </div>
  );
}

export default async function AdminRedemptionsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("user_id", user.id).single();
  if (!profile?.is_admin) redirect("/dashboard");

  const { data: redemptions } = await supabase
    .from("redemptions")
    .select(
      `
      id,
      reward_id,
      user_id,
      nombre,
      email,
      telefono,
      direccion,
      notas,
      status,
      created_at,
      reward:rewards(nombre, puntos_necesarios),
      profile:profiles(username)
    `
    )
    .order("created_at", { ascending: false });

  const stats = {
    total: redemptions?.length || 0,
    pending: redemptions?.filter((r) => r.status === "pending").length || 0,
    processing: redemptions?.filter((r) => r.status === "processing").length || 0,
    completed: redemptions?.filter((r) => r.status === "completed").length || 0,
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="font-display font-black text-3xl text-text-primary mb-1">Canjes de Premios</h1>
          <p className="text-text-muted text-sm">Gestión de canjes realizados por usuarios</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="p-4">
            <p className="text-text-muted text-xs mb-2">Total</p>
            <p className="text-text-primary font-bold text-2xl">{stats.total}</p>
          </Card>
          <Card className="p-4">
            <p className="text-text-muted text-xs mb-2">Pendientes</p>
            <p className="text-pending font-bold text-2xl">{stats.pending}</p>
          </Card>
          <Card className="p-4">
            <p className="text-text-muted text-xs mb-2">En proceso</p>
            <p className="text-blue font-bold text-2xl">{stats.processing}</p>
          </Card>
          <Card className="p-4">
            <p className="text-text-muted text-xs mb-2">Completados</p>
            <p className="text-accent font-bold text-2xl">{stats.completed}</p>
          </Card>
        </div>

        {/* Redemptions List */}
        <div>
          <h2 className="font-display font-bold text-xl text-text-primary mb-4">Todos los Canjes</h2>

          {(!redemptions || redemptions.length === 0) ? (
            <Card className="p-10 text-center">
              <p className="text-text-primary font-semibold mb-2">Sin canjes aún</p>
              <p className="text-text-muted text-sm">Cuando los usuarios canjeen premios, aparecerán aquí</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {redemptions.map((redemption: any) => (
                <Card key={redemption.id} className="p-5">
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <p className="font-semibold text-text-primary">{redemption.nombre}</p>
                          <p className="text-text-muted text-xs font-medium">@{redemption.profile?.username}</p>
                        </div>
                        <p className="text-accent font-bold text-sm">{redemption.reward?.nombre}</p>
                      </div>
                      <StatusBadge status={redemption.status} />
                    </div>

                    {/* Contact Info */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      <div className="flex items-center gap-2 text-text-secondary">
                        <Mail size={16} className="flex-shrink-0 text-text-muted" />
                        <span>{redemption.email}</span>
                      </div>

                      {redemption.telefono && (
                        <div className="flex items-center gap-2 text-text-secondary">
                          <Phone size={16} className="flex-shrink-0 text-text-muted" />
                          <span>{redemption.telefono}</span>
                        </div>
                      )}

                      <div className="flex items-start gap-2 text-text-secondary sm:col-span-2">
                        <MapPin size={16} className="flex-shrink-0 text-text-muted mt-0.5" />
                        <span>{redemption.direccion}</span>
                      </div>
                    </div>

                    {/* Notes */}
                    {redemption.notas && (
                      <div className="flex items-start gap-2 bg-surface-2 rounded-lg p-3 text-sm">
                        <FileText size={16} className="flex-shrink-0 text-text-muted mt-0.5" />
                        <span className="text-text-secondary">{redemption.notas}</span>
                      </div>
                    )}

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-3 border-t border-border text-xs text-text-muted">
                      <span>{formatDateShort(redemption.created_at)}</span>
                      <span>{redemption.reward?.puntos_necesarios.toLocaleString()} puntos</span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

export const dynamic = "force-dynamic";
