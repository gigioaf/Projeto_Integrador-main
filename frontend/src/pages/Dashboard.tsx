import { motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "@/hooks/use-theme";
import { getApiUrl, getAuthHeaders } from "@/lib/api";
import { Chart, CategoryScale, LinearScale, BarElement, BarController, Tooltip, Title } from "chart.js";
import BadgeClaimModal from "@/components/BadgeClaimModal";

Chart.register(CategoryScale, LinearScale, BarElement, BarController, Tooltip, Title);

type BadgeItem = {
  id: string;
  title: string;
  points: number;
  unlocked: boolean;
  claimed: boolean;
  image?: string;
};

type MonthlyStat = {
  month: string;
  value: number;
};

type LeaderboardEntry = {
  id: string;
  name: string;
  role: string;
  points: number;
};

type CurrentUser = {
  id?: string;
  name?: string;
  points?: number;
};

const getInitials = (name: string) =>
  name
    .split(" ")
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

const getPositionStyles = (position: number) => {
  if (position === 1) {
    return {
      bg: "bg-[color:var(--gold-dim)]",
      color: "text-[color:var(--gold)]",
    };
  }

  if (position === 2) {
    return {
      bg: "bg-[color:var(--accent-glow)]",
      color: "text-[color:var(--accent-soft)]",
    };
  }

  if (position === 3) {
    return {
      bg: "bg-[rgba(13,148,136,0.14)]",
      color: "text-[#0d9488]",
    };
  }

  return {
    bg: "bg-[color:var(--surface2)]",
    color: "text-[color:var(--muted)]",
  };
};

export default function Dashboard() {
  const [currentUser, setCurrentUser] = useState<CurrentUser>({});
  const isDark = useTheme();
  const chartCanvas = useRef<HTMLCanvasElement | null>(null);
  const chartInstance = useRef<Chart | null>(null);

  const [userPoints, setUserPoints] = useState<number>(0);
  const [badges, setBadges] = useState<BadgeItem[]>([]);
  const [monthly, setMonthly] = useState<MonthlyStat[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [completedTasks, setCompletedTasks] = useState(0);
  const [pendingBadge, setPendingBadge] = useState<BadgeItem | null>(null);

  useEffect(() => {
    const nextToClaim = badges.find(b => b.unlocked && !b.claimed);
    if (nextToClaim && !pendingBadge) {
      setPendingBadge(nextToClaim);
    }
  }, [badges, pendingBadge]);

  const userName = currentUser.name?.split(" ")[0] ?? "Usuário";

  const handleClaimBadge = async (badgeId: string) => {
    try {
      const response = await fetch(getApiUrl(`/api/badges/${badgeId}/claim`), {
        method: "POST",
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (response.ok) {
        setBadges(prev => prev.map(b => b.id === badgeId ? { ...b, claimed: true } : b));
        setPendingBadge(null);
      }
    } catch (error) {
      console.error("Claim badge error:", error);
    }
  };

  const visibleLeaderboard = useMemo(() => {
    const sorted = [...leaderboard].sort((a, b) => b.points - a.points);
    return sorted.map((entry, index) => ({ ...entry, position: index + 1 }));
  }, [leaderboard]);

  const currentRank = useMemo(() => {
    const found = visibleLeaderboard.find((entry) => entry.id === currentUser.id);
    return found ? found.position : visibleLeaderboard.length + 1;
  }, [visibleLeaderboard, currentUser.id]);

  const nextBadge = useMemo(() => {
    const next = badges.find((badge) => !badge.unlocked);
    return next ? next.title : "Sem próximos selos";
  }, [badges]);

  const unlockedCount = badges.filter((badge) => badge.unlocked).length;

  const topScore = visibleLeaderboard[0]?.points ?? userPoints;
  const userEntry = visibleLeaderboard.find((entry) => entry.id === currentUser.id);
  const currentPoints = userEntry?.points ?? userPoints;
  const distanceToTop = Math.max(0, topScore - currentPoints);
  const progressToTop = topScore > 0 ? Math.min(1, currentPoints / topScore) : 0;

  const loadDashboardData = async () => {
    try {
      const [badgesResponse, statsResponse, leaderboardResponse, profileResponse] = await Promise.all([
        fetch(getApiUrl("/api/badges"), { headers: getAuthHeaders(), credentials: 'include' }),
        fetch(getApiUrl("/api/stats/monthly"), { headers: getAuthHeaders(), credentials: 'include' }),
        fetch(getApiUrl("/api/rewards/leaderboard"), { headers: getAuthHeaders(), credentials: 'include' }),
        fetch(getApiUrl("/api/users/me"), { headers: getAuthHeaders(), credentials: 'include' }),
      ]);

      if (badgesResponse.ok) {
        const payload = await badgesResponse.json();
        const raw = payload?.badges ?? payload;
        if (Array.isArray(raw)) {
          setBadges(
            raw.map((item: any, index: number) => ({
              id: item.id?.toString() ?? `badge-${index}`,
              title: item.title ?? item.name ?? `Selo ${index + 1}`,
              points: Number(item.points ?? item.cost ?? 0),
              unlocked: Boolean(item.unlocked),
              claimed: Boolean(item.claimed),
              image: item.image ?? item.icon ?? undefined,
            })),
          );
        }
      }

      if (statsResponse.ok) {
        const payload = await statsResponse.json();
        const raw = payload?.monthly ?? payload;
        if (Array.isArray(raw) && raw.length > 0) {
          setMonthly(
            raw.map((item: any, index: number) => ({
              month: String(item.month ?? item.label ?? `Mês ${index + 1}`),
              value: Number(item.value ?? item.points ?? item.total ?? 0),
            })),
          );
        }
      }

      if (leaderboardResponse.ok) {
        const payload = await leaderboardResponse.json();
        const raw = payload?.data ?? payload?.leaderboard ?? payload;
        if (Array.isArray(raw) && raw.length > 0) {
          setLeaderboard(
            [...raw]
              .sort((a: any, b: any) => Number(b.total_points ?? b.points ?? b.score ?? 0) - Number(a.total_points ?? a.points ?? a.score ?? 0))
              .map((item: any, index: number) => ({
                id: String(item.user_id ?? item.id ?? `user-${index}`),
                name: item.name ?? item.fullName ?? "Usuário",
                role: item.role ?? item.position ?? "Funcionário",
                points: Number(item.total_points ?? item.points ?? item.score ?? 0),
              })),
          );
        }
      }

      if (profileResponse.ok) {
        const payload = await profileResponse.json();
        setCompletedTasks(Number(payload.tasks_count ?? 0));

        const stored = localStorage.getItem("azis_user");
        const userData = {
          id: String(payload.id ?? payload.user_id ?? payload.uuid ?? ""),
          name: payload.name ?? payload.fullName ?? payload.username ?? "Usuário",
          points: Number(payload.points ?? payload.total_points ?? payload.score ?? 0),
        };

        setCurrentUser(userData);
        setUserPoints(userData.points);

        if (stored) {
          const parsed = JSON.parse(stored);
          localStorage.setItem("azis_user", JSON.stringify({ ...parsed, ...payload }));
        }
      }
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    }
  };

  const buildChart = () => {
    if (!chartCanvas.current) return;
    const ctx = chartCanvas.current.getContext("2d");
    if (!ctx) return;

    const tickColor = getComputedStyle(document.documentElement).getPropertyValue("--muted") || "#6b7194";
    const gridColor = getComputedStyle(document.documentElement).getPropertyValue("--border2") || "rgba(0,0,0,0.13)";

    chartInstance.current = new Chart(ctx, {
      type: "bar",
      data: {
        labels: monthly.map((item) => item.month),
        datasets: [
          {
            data: monthly.map((item) => item.value),
            backgroundColor: monthly.map((_, index) =>
              index === monthly.length - 1 ? "rgba(124,58,237,0.88)" : "rgba(79,70,229,0.5)",
            ),
            borderRadius: 8,
            borderSkipped: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "rgba(18, 23, 50, 0.94)",
            titleColor: "#fff",
            bodyColor: "#f8fafc",
            borderColor: "rgba(255,255,255,0.08)",
            borderWidth: 1,
          },
        },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: { color: tickColor, font: { size: 12 } },
          },
          y: {
            grid: { color: gridColor },
            border: { display: false },
            ticks: { color: tickColor, font: { size: 12 } },
            min: 0,
          },
        },
      },
    });
  };

  const updateChart = () => {
    if (!chartInstance.current) return;
    const tickColor = getComputedStyle(document.documentElement).getPropertyValue("--muted") || "#6b7194";
    const gridColor = getComputedStyle(document.documentElement).getPropertyValue("--border2") || "rgba(0,0,0,0.13)";

    chartInstance.current.data.labels = monthly.map((item) => item.month);
    chartInstance.current.data.datasets[0].data = monthly.map((item) => item.value);
    chartInstance.current.data.datasets[0].backgroundColor = monthly.map((_, index) =>
      index === monthly.length - 1 ? "rgba(124,58,237,0.88)" : "rgba(79,70,229,0.5)",
    );
    chartInstance.current.options.scales = {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: { color: tickColor, font: { size: 12 } },
      },
      y: {
        grid: { color: gridColor },
        border: { display: false },
        ticks: { color: tickColor, font: { size: 12 } },
        min: 0,
      },
    };

    chartInstance.current.update();
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  useEffect(() => {
    if (!chartInstance.current) {
      buildChart();
      return;
    }
    updateChart();
  }, [monthly, isDark]);

  useEffect(() => {
    return () => {
      chartInstance.current?.destroy();
    };
  }, []);

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[color:var(--bg)] text-[color:var(--text)]">
      <div className="grid gap-5 px-[28px] py-[24px]">
        <header className="flex items-center justify-between h-16 rounded-3xl bg-[color:var(--surface)] border border-[color:var(--border)] px-6">
          <div>
            <p className="text-[20px] font-heading font-bold text-[color:var(--text-strong)]">
              Olá, <span className="text-[color:var(--accent)]">{userName}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-[color:var(--gold-dim)] px-3 py-2 text-[12px] font-medium text-[color:var(--gold)]">
              ⭐ {currentPoints.toLocaleString()} pts
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-[color:var(--accent-glow)] px-3 py-2 text-[12px] font-medium text-[color:var(--accent-soft)]">
              🏅 #{currentRank}
            </span>
          </div>
        </header>

        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-[16px] bg-[color:var(--surface)] border border-[color:var(--border)] p-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-[13px] uppercase tracking-[0.22em] font-heading font-semibold text-[color:var(--muted)]">
              🏅 Seus Selos
            </div>
            <div className="flex gap-4 flex-wrap text-[12px]">
              <span className="text-[color:var(--accent-soft)]">Próximo: {nextBadge}</span>
              <span className="text-[color:var(--muted)]">{unlockedCount} / {badges.length} desbloqueados</span>
            </div>
          </div>
          <div className="mt-5 overflow-x-auto pb-2">
            <div className="flex gap-3 min-w-[max-content]">
              {badges.map((badge) => (
                <div key={badge.id} className="flex-shrink-0 w-[92px]">
                  <div className={`relative flex h-[72px] w-[72px] items-center justify-center rounded-[14px] border border-[color:var(--border)] overflow-hidden ${badge.claimed ? "shadow-[0_0_18px_rgba(124,58,237,0.25)]" : "bg-[color:var(--bar-bg)]"} ${badge.unlocked && !badge.claimed ? "animate-pulse border-accent/50" : ""}`}
                    style={{
                      borderColor: badge.claimed ? "rgba(124,58,237,0.35)" : (badge.unlocked ? "var(--accent)" : "var(--border)"),
                      backgroundColor: badge.claimed ? "var(--accent-glow)" : "var(--bar-bg)",
                    }}
                  >
                    {badge.image ? (
                      <img
                        src={badge.image}
                        alt={badge.title}
                        className={`absolute inset-0 h-full w-full object-cover ${(badge.claimed || badge.unlocked) ? "" : "grayscale opacity-60"}`}
                      />
                    ) : (
                      <span className={`text-[30px] ${(badge.claimed || badge.unlocked) ? "" : "opacity-50"}`}>
                        {(badge.claimed || badge.unlocked) ? badge.title.split(" ")[0] === "🎯" ? "🎯" : badge.title.split(" ")[0] : "🔐"}
                      </span>
                    )}
                    <div className="absolute inset-0 bg-black/10" />
                    {badge.claimed && (
                      <div className="absolute top-1 right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[color:var(--green)] text-[8px] text-white">
                        ✓
                      </div>
                    )}
                  </div>
                  <p className="mt-3 text-[11px] text-[color:var(--muted)] text-center leading-4 break-words max-w-[80px]">
                    {badge.title}
                  </p>
                  <p className={`mt-1 text-[11px] ${badge.claimed ? "text-[color:var(--accent-soft)] font-medium" : "text-[color:var(--muted)]"} text-center`}>
                    {badge.points} pts
                  </p>
                </div>
              ))}
            </div>
          </div>
          <BadgeClaimModal
            badge={pendingBadge}
            onClaim={handleClaimBadge}
            onClose={() => setPendingBadge(null)}
          />
        </motion.section>

        <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
          <div className="space-y-5">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}
              className="grid gap-3 sm:grid-cols-3"
            >
              {[
                {
                  label: "Tarefas Concluídas",
                  value: completedTasks,
                  pill: "hoje · +150",
                  pillClass: "bg-[color:var(--accent-glow)] text-[color:var(--accent-soft)]",
                  icon: "✅",
                },
                {
                  label: "Pontos Totais",
                  value: currentPoints,
                  pill: "total · +420",
                  pillClass: "bg-[color:var(--gold-dim)] text-[color:var(--gold)]",
                  icon: "⭐",
                },
                {
                  label: "Ranking da Equipe",
                  value: `#${currentRank}`,
                  pill: "subiu",
                  pillClass: "bg-[color:var(--green-dim)] text-[color:var(--green)]",
                  icon: "🏆",
                },
              ].map((stat) => (
                <div key={stat.label} className="rounded-[14px] border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <span className="text-lg">{stat.icon}</span>
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${stat.pillClass}`}>
                      {stat.pill}
                    </span>
                  </div>
                  <div className="text-[26px] font-heading font-bold text-[color:var(--text-strong)]">
                    {stat.value}
                  </div>
                  <div className="mt-2 text-[12px] text-[color:var(--muted)]">{stat.label}</div>
                </div>
              ))}
            </motion.div>

            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1], delay: 0.08 }}
              className="rounded-[14px] border border-[color:var(--border)] bg-[color:var(--surface)] p-5"
            >
              <div className="flex items-center justify-between gap-3 text-[13px] uppercase font-heading font-semibold text-[color:var(--muted)]">
                <span>📊 Produtividade Mensal</span>
              </div>
              <div className="mt-6 h-[320px]">
                <canvas ref={chartCanvas} />
              </div>
            </motion.section>
          </div>

          <motion.aside
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
            className="rounded-[16px] border border-[color:var(--border)] bg-[color:var(--surface)] p-5"
          >
            <div className="mb-5 flex items-center justify-between gap-3 text-[13px] uppercase font-heading font-semibold text-[color:var(--muted)]">
              <span>👥 Ranking da Equipe</span>
            </div>
            <div className="space-y-3">
              {visibleLeaderboard.slice(0, 5).map((member) => {
                const positionStyles = getPositionStyles(member.position ?? 0);
                const progressWidth = topScore > 0 ? `${Math.min(100, (member.points / topScore) * 100)}%` : "0%";
                const isCurrent = member.id === currentUser.id;

                return (
                  <div key={member.id} className="flex items-center gap-3 border-b border-[color:var(--border)] pb-3 last:border-b-0 last:pb-0">
                    <div className={`flex h-5 w-5 items-center justify-center rounded-[6px] ${positionStyles.bg} ${positionStyles.color} text-[12px] font-semibold`}>
                      {member.position}
                    </div>
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--surface2)] text-sm font-semibold text-[color:var(--text-strong)]">
                      {getInitials(member.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium text-[color:var(--text-strong)]">{member.name}</div>
                      <div className="text-[11px] text-[color:var(--muted)] flex items-center gap-2">
                        <span>{member.role}</span>
                        {isCurrent && <span className="rounded-full bg-[color:var(--accent-glow)] px-2 py-0.5 text-[10px] font-medium text-[color:var(--accent-soft)]">você</span>}
                      </div>
                    </div>
                    <div className="text-[13px] font-semibold text-[color:var(--text-strong)]">⭐ {member.points}</div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 rounded-[14px] border border-[color:var(--border)] bg-[color:var(--surface2)] p-4">
              <div className="flex items-center justify-between gap-3 text-[12px] text-[color:var(--muted)]">
                <span>Distância para o 1º lugar</span>
                <span className="text-[12px] font-semibold text-[color:var(--accent-soft)]">{distanceToTop.toLocaleString()} pts</span>
              </div>
              <div className="mt-3 h-2.5 rounded-full bg-[color:var(--bar-bg)] overflow-hidden">
                <div className="h-full rounded-full bg-[color:var(--accent)]" style={{ width: `${Math.max(6, progressToTop * 100)}%` }} />
              </div>
            </div>
          </motion.aside>
        </div>
      </div>
    </div>
  );
}
