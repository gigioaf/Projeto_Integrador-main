import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Edit2 } from "lucide-react";
import { toast } from "sonner";
import { getApiUrl, getAuthHeaders } from "@/lib/api";

interface UserProfile {
  id: number;
  name: string;
  email: string;
  role: "admin" | "gestor" | "funcionario";
  nivel: number;
  position: string | null;
  points: number;
  gestorId: number | null;
  badges_count: number;
  tasks_count: number;
  ranking_position: number | null;
}

interface PointsHistoryItem {
  id: number;
  title: string;
  points: number;
  completed_at: string;
}

const roleLabelMap: Record<string, string> = {
  admin: "Admin",
  gestor: "Gestor",
  funcionario: "Funcionário",
};

const AVAILABLE_EMOJIS = [
  "👩", "👩‍🦰", "👩‍🦱", "👩‍🦲", "👩‍🦳", "👨", "👨‍🦰", "👨‍🦱", "👨‍🦲", "👨‍🦳",
  "👧", "👦", "👴", "👵", "👨‍💼", "👩‍💼", "👨‍⚕️", "👩‍⚕️", "👨‍🍳", "👩‍🍳",
  "👨‍💻", "👩‍💻", "👨‍🎓", "👩‍🎓", "👨‍🎨", "👩‍🎨", "🧑‍🚀", "🧑‍🎬", "🧑‍🎤", "😊"
];

const LoadingSkeleton = () => (
  <div className="p-6 lg:p-8 space-y-6">
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Skeleton className="h-96 rounded-2xl" />
      <div className="lg:col-span-2 space-y-6">
        <Skeleton className="h-52 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    </div>
    <Skeleton className="h-64 rounded-2xl" />
  </div>
);

export default function Profile() {
  const queryClient = useQueryClient();
  const [selectedEmoji, setSelectedEmoji] = useState("👩‍💼");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [formData, setFormData] = useState({ name: "", email: "", position: "" });
  const pickerRef = useRef<HTMLDivElement>(null);

  const { data: profile, isLoading: loadingProfile, error: profileError } = useQuery<UserProfile>({
    queryKey: ["my-profile"],
    queryFn: async () => {
      const res = await fetch(getApiUrl("/api/users/me"), {
        headers: { ...getAuthHeaders() },
      });
      if (!res.ok) throw new Error("Erro ao buscar perfil");
      return res.json();
    },
  });

  const { data: pointsHistory = [], isLoading: loadingHistory } = useQuery<PointsHistoryItem[]>({
    queryKey: ["my-points-history"],
    queryFn: async () => {
      const res = await fetch(getApiUrl("/api/users/me/points-history"), {
        headers: { ...getAuthHeaders() },
      });
      if (!res.ok) throw new Error("Erro ao buscar histórico");
      return res.json();
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: { name: string; email: string; position: string }) => {
      const res = await fetch(getApiUrl("/api/users/me"), {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erro ao salvar");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      toast.success("Perfil atualizado com sucesso!");
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Erro ao salvar";
      toast.error(message);
    },
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        name: profile.name,
        email: profile.email,
        position: profile.position ?? "",
      });
    }
  }, [profile]);

  const handleSave = () => {
    saveMutation.mutate({
      name: formData.name,
      email: formData.email,
      position: formData.position,
    });
  };

  const handleEmojiSelect = (emoji: string) => {
    setSelectedEmoji(emoji);
    setShowEmojiPicker(false);
    toast.success("Avatar atualizado com sucesso!");
  };

  const formatDate = (value?: string | null) => {
    if (!value) return "Data indisponível";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Data indisponível";
    return date.toLocaleDateString("pt-BR");
  };

  const stats = [
    {
      label: "Pontos",
      value: (profile?.points ?? 0).toLocaleString("pt-BR"),
      color: "text-yellow-400",
    },
    {
      label: "Ranking",
      value: profile?.ranking_position ? `#${profile.ranking_position}` : "—",
      color: "text-purple-400",
    },
    {
      label: "Selos",
      value: String(profile?.badges_count ?? 0),
      color: "text-green-400",
    },
    {
      label: "Tarefas",
      value: String(profile?.tasks_count ?? 0),
      color: "text-blue-400",
    },
  ];

  if (loadingProfile) {
    return <LoadingSkeleton />;
  }

  if (profileError || !profile) {
    return (
      <div className="p-6 lg:p-8 min-h-screen bg-[color:var(--background)] flex items-center justify-center">
        <Card className="border-red-500/50 bg-red-500/10 max-w-md w-full">
          <CardContent className="pt-6">
            <p className="text-red-400 text-center font-semibold">
              {profileError instanceof Error ? profileError.message : "Erro ao carregar perfil"}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 min-h-screen bg-[color:var(--background)] flex flex-col">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8 flex-grow">
        <Card className="border-[color:var(--border)] bg-[color:var(--card)] lg:col-span-1 relative overflow-hidden flex flex-col">
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-br from-purple-500/20 to-transparent rounded-full blur-3xl" />
          <CardContent className="p-6 relative z-10 flex-1 flex flex-col">
            <div className="mb-6 flex justify-center relative">
              <div className="relative">
                <div className="w-32 h-32 rounded-2xl bg-gradient-primary flex items-center justify-center text-6xl border-4 border-purple-500/30 shadow-lg">
                  {selectedEmoji}
                </div>
                <button
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="absolute bottom-2 right-2 bg-purple-500 hover:bg-purple-600 text-white rounded-full p-2 transition-colors"
                  title="Editar avatar"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>
              {showEmojiPicker && (
                <div
                  ref={pickerRef}
                  className="absolute top-40 left-1/2 -translate-x-1/2 bg-[color:var(--surface2)] border border-[color:var(--border)] rounded-[1rem] p-4 w-72 z-50 shadow-lg animate-in fade-in scale-95"
                >
                  <div className="grid grid-cols-6 gap-2 max-h-48 overflow-y-auto">
                    {AVAILABLE_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => handleEmojiSelect(emoji)}
                        className="text-3xl hover:bg-[color:var(--surface)] rounded-lg p-2 transition-colors"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {profile.nivel && (
                <div className="absolute -top-3 -right-3 bg-purple-500 px-3 py-1 rounded-full text-xs font-bold text-white">
                  Nível {profile.nivel}
                </div>
              )}
            </div>
            <h2 className="text-2xl font-heading font-bold text-foreground text-center mb-2">
              {profile.name}
            </h2>
            <div className="flex justify-center mb-6">
              <span className="inline-flex items-center rounded-full bg-blue-500/20 px-3 py-1 text-xs font-bold text-blue-400 border border-blue-500/30">
                {roleLabelMap[profile?.role ?? "funcionario"]}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-6">
              {stats.map((stat, i) => (
                <div key={i} className="rounded-lg bg-[color:var(--surface2)] p-3 text-center border border-[color:var(--border)]">
                  <div className={`text-2xl font-heading font-bold ${stat.color} mb-1`}>
                    {stat.value}
                  </div>
                  <div className="text-xs text-[color:var(--muted)] font-semibold">{stat.label}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-6 flex flex-col">
          <Card className="border-[color:var(--border)] bg-[color:var(--card)]">
            <CardHeader>
              <CardTitle className="font-heading">Dados Pessoais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-[color:var(--muted)] uppercase">Nome</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="rounded-lg bg-[color:var(--surface2)] border-[color:var(--border)]"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-[color:var(--muted)] uppercase">Email</Label>
                  <Input
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    type="email"
                    className="rounded-lg bg-[color:var(--surface2)] border-[color:var(--border)]"
                  />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-[color:var(--muted)] uppercase">Cargo</Label>
                  <Input
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                    className="rounded-lg bg-[color:var(--surface2)] border-[color:var(--border)]"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-[color:var(--muted)] uppercase">Equipe</Label>
                  <Input
                    value={roleLabelMap[profile?.role ?? "funcionario"]}
                    readOnly
                    disabled
                    className="rounded-lg bg-[color:var(--surface2)] border-[color:var(--border)] opacity-60 cursor-not-allowed"
                  />
                </div>
              </div>
              <Button
                onClick={handleSave}
                disabled={saveMutation.isPending}
                className="w-full bg-gradient-primary text-white rounded-lg font-bold"
              >
                {saveMutation.isPending ? "Salvando..." : "Salvar alterações"}
              </Button>
            </CardContent>
          </Card>

        </div>
      </div>

      <Card className="border-[color:var(--border)] bg-[color:var(--card)] w-full">
        <CardHeader>
          <CardTitle className="font-heading">📋 Histórico de Pontos</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingHistory ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-lg" />
              ))}
            </div>
          ) : pointsHistory.length === 0 ? (
            <p className="text-sm text-[color:var(--muted)] text-center py-8">Nenhuma tarefa concluída ainda.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {pointsHistory.map((entry) => (
                <div key={entry.id} className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface2)] p-4">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center text-lg flex-shrink-0">
                      ⚡
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-foreground">{entry.title}</p>
                      <p className="text-xs text-[color:var(--muted)]">
                        {formatDate(entry.completed_at)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-heading font-bold text-purple-400">+{entry.points} ⭐</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
