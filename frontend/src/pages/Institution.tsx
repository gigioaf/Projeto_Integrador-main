import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Star } from "lucide-react";
import { getActiveUsers, getCurrentUser } from "@/data/mock";
import { toast } from "sonner";

const AVATAR_COLORS = [
  "bg-teal-400",
  "bg-blue-500",
  "bg-cyan-400",
  "bg-purple-500",
  "bg-cyan-500",
  "bg-cyan-400",
];

export default function Institution() {
  const currentUser = getCurrentUser();

  if (currentUser.role === "funcionario") {
    return (
      <div className="p-6 lg:p-8">
        <h1 className="text-2xl font-bold">Acesso restrito</h1>
        <p className="mt-2 text-muted-foreground">Você não tem permissão para visualizar esta página.</p>
      </div>
    );
  }

  const membrosVisiveis = getActiveUsers().filter((m) => m.nivel !== 3);

  const handleSave = () => {
    toast.success("✓ Salvo");
  };

  return (
    <div className="p-6 lg:p-8 min-h-screen bg-[color:var(--background)] flex flex-col">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
        {/* COLUNA ESQUERDA - Forms */}
        <div className="lg:col-span-1 space-y-6 flex flex-col">
          {/* Card Dados da Instituição */}
          <Card className="border-[color:var(--border)] bg-[color:var(--card)]">
            <CardHeader>
              <CardTitle className="font-heading">Dados da Instituição</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-[color:var(--muted)] uppercase">
                  Nome da Instituição
                </Label>
                <Input
                  defaultValue="Azis Instituição"
                  className="rounded-lg bg-[color:var(--surface2)] border-[color:var(--border)]"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-[color:var(--muted)] uppercase">
                  Segmento
                </Label>
                <Input
                  defaultValue="Tecnologia"
                  className="rounded-lg bg-[color:var(--surface2)] border-[color:var(--border)]"
                />
              </div>
              <Button
                onClick={handleSave}
                className="w-full bg-gradient-primary text-white rounded-lg font-bold"
              >
                Salvar
              </Button>
            </CardContent>
          </Card>

          {/* Card Convidar Membro */}
        </div>

        {/* COLUNA DIREITA - Membros */}
        <div className="lg:col-span-2 flex flex-col">
          <Card className="border-[color:var(--border)] bg-[color:var(--card)] flex-1 flex flex-col">
            <CardHeader>
              <CardTitle className="font-heading flex items-center gap-2">
                👥 Membros <span className="text-sm text-purple-400 bg-purple-500/20 px-2 py-1 rounded-full">{membrosVisiveis.length}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <div className="space-y-3 flex-1 overflow-y-auto">
                {membrosVisiveis.map((member, idx) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface2)] hover:bg-[color:var(--surface)] transition-colors"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      {/* Avatar */}
                      <div
                        className={`w-12 h-12 rounded-full ${AVATAR_COLORS[idx % AVATAR_COLORS.length]} flex items-center justify-center flex-shrink-0 font-bold text-white text-sm`}
                      >
                        {member.name
                          .split(" ")
                          .map((n) => n.charAt(0))
                          .join("")
                          .toUpperCase()
                          .slice(0, 2)}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-foreground">{member.name}</p>
                        <p className="text-xs text-[color:var(--muted)]">{member.email}</p>
                      </div>
                    </div>

                    {/* Role Badge */}
                    <div className="flex items-center gap-3">
                      {member.role === "gestor" && (
                        <span className="inline-flex items-center rounded-full border border-purple-500/30 bg-purple-500/10 px-2 py-1 text-xs font-bold text-purple-400">
                          Gestor
                        </span>
                      )}
                      {member.role !== "gestor" && (
                        <span className="text-xs text-[color:var(--muted)] leading-relaxed w-12 text-right">Membro</span>
                      )}
                      <Star className="w-5 h-5 text-gray-500 flex-shrink-0" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
