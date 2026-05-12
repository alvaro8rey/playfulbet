"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/Card";
import { RedemptionCard } from "@/components/RedemptionCard";

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

export default function AdminRedemptionsPage() {
  const supabase = createClient();
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRedemptions = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
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

      if (data) {
        setRedemptions(data);
      }
    } catch (error) {
      console.error("Error fetching redemptions:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRedemptions();
  }, []);

  const stats = {
    total: redemptions.length,
    pending: redemptions.filter((r) => r.status === "pending").length,
    processing: redemptions.filter((r) => r.status === "processing").length,
    completed: redemptions.filter((r) => r.status === "completed").length,
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

          {loading ? (
            <Card className="p-10 text-center">
              <p className="text-text-muted">Cargando canjes...</p>
            </Card>
          ) : redemptions.length === 0 ? (
            <Card className="p-10 text-center">
              <p className="text-text-primary font-semibold mb-2">Sin canjes aún</p>
              <p className="text-text-muted text-sm">Cuando los usuarios canjeen premios, aparecerán aquí</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {redemptions.map((redemption) => (
                <RedemptionCard
                  key={redemption.id}
                  redemption={redemption}
                  onStatusChange={fetchRedemptions}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
