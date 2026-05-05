import { motion } from "framer-motion";
import { Gift, Star, ShoppingCart, History, Plus, Pencil, Trash2, Edit2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getCurrentUser } from "@/data/mock";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { getApiUrl, getAuthHeaders, fetchApi } from "@/lib/api";

const AVAILABLE_EMOJIS = [
  "🎁", "🎀", "🎉", "🎊", "🎈", "🎯", "🏆", "🥇", "⭐", "✨",
  "💎", "💍", "👑", "🔥", "⚡", "🌟", "🎪", "🎭", "🎨", "🎬",
  "🎮", "🎲", "🎰", "🧩", "🎳", "🏅", "🎖️", "📚", "📖", "📝"
];

interface Reward {
  id: string;
  name: string;
  title?: string;
  description: string;
  cost: number;
  points_cost?: number;
  stock: number;
  quantity?: number;
  created_at: string;
  updated_at: string;
  emoji?: string;
}

function normalizeReward(raw: any): Reward {
  const points_cost = raw.points_cost ?? raw.cost ?? 0
  const quantity = raw.quantity ?? raw.stock ?? 0
  const storedEmoji = localStorage.getItem(`reward_emoji_${raw.id}`)
  return {
    id: raw.id?.toString?.() ?? "",
    name: raw.name ?? raw.title ?? "",
    title: raw.title ?? raw.name ?? "",
    description: raw.description ?? "",
    cost: points_cost,
    points_cost,
    stock: quantity,
    quantity,
    created_at: raw.created_at ?? raw.createdAt ?? "",
    updated_at: raw.updated_at ?? raw.updatedAt ?? "",
    emoji: storedEmoji || "🎁"
  }
}

interface Redemption {
  id: string;
  reward_id: string;
  user_id: string;
  cost: number;
  voucher_code: string;
  status: string;
  created_at: string;
  reward_name: string;
  reward_description: string;
}

interface ConfettiOverlayProps {
  onEnd: () => void;
}

function ConfettiOverlay({ onEnd }: ConfettiOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number | null = null;
    let particles: Array<any> = [];
    let W = 420;
    let H = 420;

    const COLORS = [
      '#FF6B6B','#FF8E53','#FFD166','#06D6A0',
      '#118AB2','#A855F7','#F472B6','#34D399',
      '#60A5FA','#FBBF24','#FB923C','#E879F9',
      '#fff','#fff'
    ];

    const SHAPES = ['rect','circle','strip'];

    const rand = (a: number, b: number) => a + Math.random() * (b - a);
    const randItem = (arr: Array<any>) => arr[Math.floor(Math.random() * arr.length)];

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      W = rect.width;
      H = rect.height;
      canvas.width = rect.width;
      canvas.height = rect.height;
    };

    const createParticle = (ox: number, oy: number) => {
      const angle = rand(-Math.PI * 0.85, -Math.PI * 0.15);
      const speed = rand(6, 22);
      const shape = randItem(SHAPES);
      const color = randItem(COLORS);
      const size = shape === 'strip' ? { w: rand(3, 6), h: rand(10, 20) } : { w: rand(5, 13), h: rand(5, 13) };
      return {
        x: ox,
        y: oy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        ax: rand(-0.15, 0.15),
        ay: rand(0.25, 0.55),
        rot: rand(0, Math.PI * 2),
        rotSpeed: rand(-0.18, 0.18),
        color,
        shape,
        w: size.w,
        h: size.h,
        life: 1,
        decay: rand(0.012, 0.022),
        wobble: rand(0, Math.PI * 2),
        wobbleSpeed: rand(0.08, 0.18),
        wobbleAmp: rand(0.4, 1.2),
      };
    };

    const loop = () => {
      ctx.clearRect(0, 0, W, H);
      let alive = false;

      for (const p of particles) {
        if (p._delay > 0) {
          p._delay -= 1;
          continue;
        }
        if (!p._born) p._born = true;

        p.x += p.vx;
        p.y += p.vy;
        p.vx += p.ax;
        p.vy += p.ay;
        p.vx *= 0.992;
        p.vy *= 0.992;
        p.rot += p.rotSpeed;
        p.wobble += p.wobbleSpeed;
        p.life -= p.decay;

        if (p.life <= 0) continue;
        alive = true;

        ctx.save();
        ctx.globalAlpha = Math.min(1, p.life * 2);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);

        const wob = Math.sin(p.wobble) * p.wobbleAmp;
        ctx.fillStyle = p.color;

        if (p.shape === 'rect') {
          ctx.fillRect(-p.w / 2 + wob, -p.h / 2, p.w, p.h);
        } else if (p.shape === 'circle') {
          ctx.beginPath();
          ctx.ellipse(wob, 0, p.w / 2, p.h / 2, 0, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(-p.w / 2 + wob * 0.5, -p.h / 2, p.w, p.h);
        }

        ctx.restore();
      }

      if (alive) {
        animId = requestAnimationFrame(loop);
      } else {
        animId = null;
        onEnd();
      }
    };

    resize();
    window.addEventListener('resize', resize);

    const ox = W;
    const oy = H;
    const COUNT = 160;

    for (let i = 0; i < COUNT; i++) {
      const delay = Math.floor(i / 8);
      const p = createParticle(ox, oy);
      p._delay = delay;
      p._born = false;
      particles.push(p);
    }

    animId = requestAnimationFrame(loop);

    return () => {
      if (animId !== null) cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, [onEnd]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        bottom: 0,
        right: 0,
        width: '420px',
        height: '420px',
        pointerEvents: 'none',
        zIndex: 9999,
      }}
    />
  );
}

export default function Rewards() {
  const currentUser = getCurrentUser();
  const initialPoints = Number(currentUser.points ?? 0);
  const [points, setPoints] = useState(initialPoints);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const [showChest, setShowChest] = useState(false);
  const [pendingRedeemToast, setPendingRedeemToast] = useState<{ title: string; description: string } | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newReward, setNewReward] = useState({ title: "", description: "", points_cost: 0, quantity: 0 });
  const [selectedEmojiCreate, setSelectedEmojiCreate] = useState("🎁");
  const [showEmojiPickerCreate, setShowEmojiPickerCreate] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingReward, setEditingReward] = useState<Reward | null>(null);
  const [editing, setEditing] = useState(false);
  const [editReward, setEditReward] = useState({ title: "", description: "", points_cost: 0, quantity: 0 });
  const [selectedEmojiEdit, setSelectedEmojiEdit] = useState("🎁");
  const [showEmojiPickerEdit, setShowEmojiPickerEdit] = useState(false);
  const pickerRefCreate = useRef<HTMLDivElement>(null);
  const pickerRefEdit = useRef<HTMLDivElement>(null);

  const loadUserPoints = async () => {
    try {
      const response = await fetchApi("/api/users/me");
      if (response.ok) {
        const userData = await response.json();
        if (userData.points != null) {
          setPoints(userData.points);
          const stored = localStorage.getItem("azis_user");
          if (stored) {
            const parsed = JSON.parse(stored);
            localStorage.setItem("azis_user", JSON.stringify({ ...parsed, points: userData.points }));
          }
        }
      }
    } catch (error) {
      console.error("Error loading user points:", error);
    }
  };

  const loadRewards = async () => {
    try {
      const response = await fetchApi("/api/rewards");
      if (response.ok) {
        const data = await response.json();
        const rawRewards = data.data || data.rewards || [];
        setRewards(Array.isArray(rawRewards) ? rawRewards.map(normalizeReward) : []);
      }
    } catch (error) {
      console.error("Error loading rewards:", error);
      toast.error("Erro ao carregar recompensas");
    }
  };

  const loadRedemptions = async () => {
    try {
      const response = await fetchApi("/api/rewards/my-redemptions");
      if (response.ok) {
        const data = await response.json();
        setRedemptions(data.data || data.redemptions || []);
      } else if (response.status === 404) {
        try {
          const fallback = await fetchApi("/api/rewards/history");
          if (fallback.ok) {
            const data = await fallback.json();
            setRedemptions(data.data || data.redemptions || []);
          }
        } catch (fallbackError) {
          console.error("Fallback history failed:", fallbackError);
        }
      }
    } catch (error) {
      console.error("Error loading redemptions:", error);
    }
  };

  const loadData = async () => {
    setLoading(true);
    await Promise.all([loadRewards(), loadRedemptions(), loadUserPoints()]);
    setLoading(false);
  };

  // Histórico removido - funcionalidade desativada pelo cliente.


  const handleRedeem = async (reward: Reward) => {
    if (points < reward.cost) {
      toast.error("Pontos insuficientes!");
      return;
    }

    setRedeeming(reward.id);
    try {
      const response = await fetchApi(`/api/rewards/${reward.id}/redeem`, {
        method: "POST",
        headers: getAuthHeaders(),
      });

      const data = await response.json();
      if (response.ok) {
        setPoints(data.userPoints ?? data.data?.remaining_points ?? (points - reward.cost));

        // Sincroniza com servidor após resgate para evitar divergência e garantir campos reward_name
        await loadUserPoints();
        await loadRewards();
        await loadRedemptions();

        setShowChest(true);
        setPendingRedeemToast({
          title: `🎉 "${reward.name || reward.title}" resgatado com sucesso!`,
          description: "",
        });
      } else {
        toast.error(data.message || "Erro ao resgatar recompensa");
      }
    } catch (error) {
      console.error("Error redeeming reward:", error);
      toast.error("Erro ao resgatar recompensa");
    } finally {
      setRedeeming(null);
    }
  };

  const handleCreateReward = async () => {
    if (!newReward.title) {
      toast.error("Título é obrigatório");
      return;
    }
    if (newReward.points_cost <= 0) {
      toast.error("Custo deve ser maior que 0");
      return;
    }
    if (newReward.quantity < 0) {
      toast.error("Quantidade não pode ser negativa");
      return;
    }

    setCreating(true);
    try {
      const response = await fetchApi("/api/rewards", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: newReward.title,
          description: newReward.description,
          points_cost: newReward.points_cost,
          quantity: newReward.quantity,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        const createdReward = normalizeReward(data.data || data.reward || {});
        createdReward.emoji = selectedEmojiCreate;
        localStorage.setItem(`reward_emoji_${createdReward.id}`, selectedEmojiCreate);
        setRewards((prev) => [createdReward, ...prev]);
        setIsCreateModalOpen(false);
        setNewReward({ title: "", description: "", points_cost: 0, quantity: 0 });
        setSelectedEmojiCreate("🎁");
        setShowEmojiPickerCreate(false);
        toast.success("Recompensa criada com sucesso!");
      } else {
        toast.error(data.message || "Erro ao criar recompensa");
      }
    } catch (error) {
      console.error("Error creating reward:", error);
      toast.error("Erro ao criar recompensa. Verifique sua conexão e tente novamente.");
    } finally {
      setCreating(false);
    }
  };

  const openEditModal = (reward: Reward) => {
    setEditingReward(reward);
    setEditReward({
      title: reward.title || reward.name || "",
      description: reward.description || "",
      points_cost: reward.points_cost || reward.cost || 0,
      quantity: reward.quantity || reward.stock || 0,
    });
    setSelectedEmojiEdit(reward.emoji || "🎁");
    setShowEmojiPickerEdit(false);
    setIsEditModalOpen(true);
  };

  const handleUpdateReward = async () => {
    if (!editingReward) return;

    if (!editReward.title) {
      toast.error("Título é obrigatório");
      return;
    }
    if (editReward.points_cost <= 0) {
      toast.error("Custo deve ser maior que 0");
      return;
    }
    if (editReward.quantity < 0) {
      toast.error("Quantidade não pode ser negativa");
      return;
    }

    setEditing(true);
    try {
      const response = await fetchApi(`/api/rewards/${editingReward.id}`, {
        method: "PUT",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: editReward.title,
          description: editReward.description,
          points_cost: editReward.points_cost,
          quantity: editReward.quantity,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        const updatedReward = normalizeReward({
          ...(data.data || data.reward || {}),
          title: editReward.title,
          name: editReward.title,
          description: editReward.description,
          points_cost: editReward.points_cost,
          quantity: editReward.quantity,
        });
        updatedReward.emoji = selectedEmojiEdit;
        localStorage.setItem(`reward_emoji_${editingReward.id}`, selectedEmojiEdit);

        setRewards((prev) =>
          prev.map((r) => (r.id === editingReward.id ? updatedReward : r))
        );
        setIsEditModalOpen(false);
        setEditingReward(null);
        toast.success("Recompensa atualizada com sucesso!");
      } else {
        toast.error(data.message || "Erro ao atualizar recompensa");
      }
    } catch (error) {
      console.error("Error updating reward:", error);
      toast.error("Erro ao atualizar recompensa. Tente novamente.");
    } finally {
      setEditing(false);
    }
  };

  const handleDeleteReward = async (rewardId: string | number) => {
    if (!window.confirm("Tem certeza que deseja excluir esta recompensa?")) return;
    try {
      const response = await fetchApi(`/api/rewards/${rewardId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      const data = await response.json();

      if (response.ok) {
        setRewards((prev) => prev.filter((r) => r.id !== rewardId));
        toast.success("Recompensa excluída com sucesso!");
      } else {
        toast.error(data.message || "Erro ao excluir recompensa");
      }
    } catch (error) {
      console.error("Error deleting reward:", error);
      toast.error("Erro ao excluir recompensa");
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadUserPoints, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-6 lg:p-8 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground flex items-center gap-3">
            <Gift className="w-8 h-8 text-accent" />
            Recompensas
          </h1>
          <p className="text-muted-foreground mt-1">Troque seus pontos por prêmios incríveis</p>
        </div>

        <div className="flex items-center gap-2">
          {currentUser.nivel === 3 && (
            <Button onClick={() => setIsCreateModalOpen(true)} size="sm" variant="secondary" className="mr-2">
              <Plus className="w-4 h-4 mr-1" /> Nova Recompensa
            </Button>
          )}
          <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-5 py-3">
            <Star className="w-5 h-5 text-warning" />
            <span className="text-2xl font-heading font-bold text-foreground">{points.toLocaleString()}</span>
            <span className="text-muted-foreground text-sm">pontos</span>
          </div>
        </div>
      </div>

      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Nova Recompensa</DialogTitle>
            <DialogDescription>Informe os dados para adicionar novo item ao catálogo</DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-4">
            <div>
              <Label htmlFor="reward-title">Título</Label>
              <Input
                id="reward-title"
                value={newReward.title}
                onChange={(e) => setNewReward((prev) => ({ ...prev, title: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="reward-description">Descrição</Label>
              <Input
                id="reward-description"
                value={newReward.description}
                onChange={(e) => setNewReward((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="reward-cost">Custo de pontos</Label>
              <Input
                id="reward-cost"
                type="text"
                maxLength={6}
                placeholder="ex: 100"
                value={newReward.points_cost ? newReward.points_cost.toString() : ""}
                onChange={(e) => {
                  const sanitized = e.target.value.replace(/[^\d]/g, "").slice(0, 6);
                  const val = sanitized ? Number(sanitized) : 0;
                  setNewReward((prev) => ({ ...prev, points_cost: val }));
                }}
              />
            </div>
            <div>
              <Label htmlFor="reward-quantity">Quantidade</Label>
              <Input
                id="reward-quantity"
                type="text"
                maxLength={4}
                placeholder="ex: 5"
                value={newReward.quantity ? newReward.quantity.toString() : ""}
                onChange={(e) => {
                  const sanitized = e.target.value.replace(/[^\d]/g, "").slice(0, 4);
                  const val = sanitized ? Number(sanitized) : 0;
                  setNewReward((prev) => ({ ...prev, quantity: val }));
                }}
              />
            </div>
            <div>
              <Label>Emoji da Recompensa</Label>
              <div className="flex items-center gap-2 relative">
                <button
                  type="button"
                  onClick={() => setShowEmojiPickerCreate(!showEmojiPickerCreate)}
                  className="w-12 h-10 rounded-lg bg-secondary border border-border flex items-center justify-center text-2xl hover:bg-secondary/80 transition-colors"
                >
                  {selectedEmojiCreate}
                </button>
                <span className="text-sm text-muted-foreground">Clique para escolher um emoji</span>
              </div>
              {showEmojiPickerCreate && (
                <div
                  ref={pickerRefCreate}
                  className="absolute mt-2 bg-card border border-border rounded-lg p-3 w-80 z-50 shadow-lg"
                >
                  <div className="grid grid-cols-6 gap-2 max-h-40 overflow-y-auto">
                    {AVAILABLE_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => {
                          setSelectedEmojiCreate(emoji);
                          setShowEmojiPickerCreate(false);
                        }}
                        className="text-2xl hover:bg-secondary rounded-lg p-2 transition-colors"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setIsCreateModalOpen(false)} variant="outline">
              Cancelar
            </Button>
            <Button onClick={handleCreateReward} disabled={creating}>
              {creating ? "Criando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Recompensa</DialogTitle>
            <DialogDescription>Atualize os dados da recompensa selecionada</DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-4">
            <div>
              <Label htmlFor="edit-reward-title">Título</Label>
              <Input
                id="edit-reward-title"
                value={editReward.title}
                onChange={(e) => setEditReward((prev) => ({ ...prev, title: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="edit-reward-description">Descrição</Label>
              <Input
                id="edit-reward-description"
                value={editReward.description}
                onChange={(e) => setEditReward((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="edit-reward-cost">Custo de pontos</Label>
              <Input
                id="edit-reward-cost"
                type="text"
                maxLength={6}
                placeholder="ex: 100"
                value={editReward.points_cost ? editReward.points_cost.toString() : ""}
                onChange={(e) => {
                  const sanitized = e.target.value.replace(/[^\d]/g, "").slice(0, 6);
                  const val = sanitized ? Number(sanitized) : 0;
                  setEditReward((prev) => ({ ...prev, points_cost: val }));
                }}
              />
            </div>
            <div>
              <Label htmlFor="edit-reward-quantity">Quantidade</Label>
              <Input
                id="edit-reward-quantity"
                type="text"
                maxLength={4}
                placeholder="ex: 5"
                value={editReward.quantity ? editReward.quantity.toString() : ""}
                onChange={(e) => {
                  const sanitized = e.target.value.replace(/[^\d]/g, "").slice(0, 4);
                  const val = sanitized ? Number(sanitized) : 0;
                  setEditReward((prev) => ({ ...prev, quantity: val }));
                }}
              />
            </div>
            <div>
              <Label>Emoji da Recompensa</Label>
              <div className="flex items-center gap-2 relative">
                <button
                  type="button"
                  onClick={() => setShowEmojiPickerEdit(!showEmojiPickerEdit)}
                  className="w-12 h-10 rounded-lg bg-secondary border border-border flex items-center justify-center text-2xl hover:bg-secondary/80 transition-colors"
                >
                  {selectedEmojiEdit}
                </button>
                <span className="text-sm text-muted-foreground">Clique para escolher um emoji</span>
              </div>
              {showEmojiPickerEdit && (
                <div
                  ref={pickerRefEdit}
                  className="absolute mt-2 bg-card border border-border rounded-lg p-3 w-80 z-50 shadow-lg"
                >
                  <div className="grid grid-cols-6 gap-2 max-h-40 overflow-y-auto">
                    {AVAILABLE_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => {
                          setSelectedEmojiEdit(emoji);
                          setShowEmojiPickerEdit(false);
                        }}
                        className="text-2xl hover:bg-secondary rounded-lg p-2 transition-colors"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setIsEditModalOpen(false)} variant="outline">
              Cancelar
            </Button>
            <Button onClick={handleUpdateReward} disabled={editing}>
              {editing ? "Salvando..." : "Salvar alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="catalog" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="catalog">Catálogo</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="catalog" className="space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Carregando recompensas...</p>
              </div>
            </div>
          ) : rewards.length === 0 ? (
            <div className="text-center py-12">
              <Gift className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Nenhuma recompensa disponível no momento.</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {rewards.map((reward, i) => (
                <motion.div
                  key={reward.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                >
                  <Card className="overflow-hidden hover:shadow-lg transition-all group">
                    <div className="h-32 bg-gradient-card flex items-center justify-center text-6xl">
                      {reward.emoji || "🎁"}
                    </div>
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-heading font-semibold text-foreground">{reward.name || reward.title}</h3>
                        <Badge variant="secondary" className="text-xs">
                          {(reward.stock ?? reward.quantity) || 0} restantes
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-4">{reward.description}</p>
                      {currentUser.nivel === 3 && (
                        <div className="flex items-center justify-start gap-3 mb-4">
                          <Button
                            size="xs"
                            className="px-2 py-1 bg-gradient-primary text-primary-foreground hover:brightness-110"
                            onClick={() => openEditModal(reward)}
                          >
                            <Pencil className="w-3.5 h-3.5 mr-1" />
                            Editar
                          </Button>
                          <Button
                            size="xs"
                            className="px-2 py-1 bg-destructive text-destructive-foreground hover:brightness-110"
                            onClick={() => handleDeleteReward(reward.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-1" />
                            Excluir
                          </Button>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 text-warning" />
                          <span className="font-heading font-bold text-foreground">{reward.cost ?? reward.points_cost}</span>
                        </div>
                        <Button
                          size="sm"
                          disabled={
                            points < (reward.cost ?? reward.points_cost ?? 0) ||
                            (reward.stock ?? reward.quantity ?? 0) === 0 ||
                            redeeming === reward.id
                          }
                          onClick={() => handleRedeem(reward)}
                          className="bg-gradient-primary text-primary-foreground"
                        >
                          {redeeming === reward.id ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          ) : (
                            <>
                              <ShoppingCart className="w-4 h-4 mr-1" />
                              Resgatar
                            </>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Carregando histórico...</p>
              </div>
            </div>
          ) : redemptions.length === 0 ? (
            <div className="text-center py-12">
              <History className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Você ainda não resgatou nenhuma recompensa.</p>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {redemptions.map((redemption) => (
                  <Card key={redemption.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-card rounded-lg flex items-center justify-center text-2xl">
                          🎁
                        </div>
                        <div>
                          <h3 className="font-heading font-semibold text-foreground">{redemption.reward_name}</h3>
                          <p className="text-sm text-muted-foreground">{redemption.reward_description}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Resgatado em {new Date(redemption.created_at).toLocaleDateString("pt-BR")}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1 mb-1">
                          <Star className="w-4 h-4 text-warning" />
                          <span className="font-heading font-bold text-foreground">{redemption.cost}</span>
                        </div>
                        <Badge variant={redemption.status === "completed" ? "default" : "secondary"} className="text-xs">
                          {redemption.status === "completed" ? "Concluído" : redemption.status}
                        </Badge>
                        {redemption.voucher_code && (
                          <p className="text-xs text-muted-foreground mt-1 font-mono">
                            Voucher: {redemption.voucher_code}
                          </p>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>

      {showChest && (
        <ConfettiOverlay
          onEnd={() => {
            setShowChest(false);
            if (pendingRedeemToast) {
              toast.success(pendingRedeemToast.title);
              setPendingRedeemToast(null);
            }
          }}
        />
      )}
    </div>
  );
}
