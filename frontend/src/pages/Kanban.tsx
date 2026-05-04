import { useEffect, useRef, useState } from "react";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, closestCorners, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Calendar, Star, User, MoreVertical, Eye, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getActiveUsers, getCurrentUser, Task, TaskStatus } from "@/data/mock";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDroppable } from "@dnd-kit/core";
import TaskFormModal from "@/components/TaskFormModal";
import EvidenceModal from "@/components/EvidenceModal";
import ReviewModal from "@/components/ReviewModal";
import { getApiUrl, getAuthHeaders } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import mascotVideo from "@/assets/mascot  new.gif";

const columns: { id: TaskStatus; title: string; color: string }[] = [
  { id: "todo", title: "A Fazer", color: "bg-info" },
  { id: "in_progress", title: "Em Progresso", color: "bg-warning" },
  { id: "done", title: "Concluído", color: "bg-primary" },
  { id: "approved", title: "Aprovado", color: "bg-success" },
  { id: "rejected", title: "Reprovado", color: "bg-destructive" },
];

function parseLocalDate(deadline: string | Date) {
  if (deadline instanceof Date) {
    return deadline;
  }

  const normalized = deadline.trim();

  // ISO date only: YYYY-MM-DD
  const simpleDateMatch = normalized.match(/^([0-9]{4})-([0-9]{2})-([0-9]{2})$/);
  if (simpleDateMatch) {
    const [, year, month, day] = simpleDateMatch;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  // ISO datetime: YYYY-MM-DDTHH:mm:ssZ or with timezone offset
  const isoDatetimeMatch = normalized.match(/^([0-9]{4}-[0-9]{2}-[0-9]{2})T.*$/);
  if (isoDatetimeMatch) {
    return new Date(normalized);
  }

  // Fallback to browser parser for any other string format
  const fallback = new Date(normalized);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function formatKanbanDeadline(deadline?: string | null) {
  if (!deadline) return "Sem data";
  const date = parseLocalDate(deadline);
  if (!date) return "Sem data";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function TaskCard({ task, isDragging, onReviewClick, onDelete }: { task: Task; isDragging?: boolean; onReviewClick?: (task: Task) => void; onDelete?: (task: Task) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const currentUser = getCurrentUser();
  const canReview = currentUser.nivel >= 2 && task.status === "done" && task.gestorId === currentUser.id;
  const canMarkDone = currentUser.nivel === 1 && task.assignee.id === currentUser.id && task.status === "in_progress";
  const canDelete = (currentUser.role === "gestor" || currentUser.role === "admin") && (task.status === "approved" || task.status === "rejected");

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card className="p-4 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow border border-border bg-card relative">
        <div className="flex items-start justify-between mb-2">
          <h4 className="font-medium text-sm text-foreground flex-1 pr-8">{task.title}</h4>
          {(canReview || canMarkDone || canDelete) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 absolute top-2 right-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canMarkDone && (
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onReviewClick?.(task); }}>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Marcar como Concluída
                  </DropdownMenuItem>
                )}
                {canReview && (
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onReviewClick?.(task); }}>
                    <Eye className="w-4 h-4 mr-2" />
                    Revisar Tarefa
                  </DropdownMenuItem>
                )}
                {canDelete && (
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDelete?.(task); }}>
                    <XCircle className="w-4 h-4 mr-2" />
                    {task.status === "approved" ? "Excluir (será removida em 7s)" : "Excluir"}
                    {task.isDeleting ? ` (${task.deleteCountdown ?? 7}s)` : ""}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{task.description}</p>
        {task.isDeleting && (
          <div className="mb-2 text-xs font-medium text-amber-400">
            Excluindo tarefa em {task.deleteCountdown ?? 7} segundos...
          </div>
        )}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <Star className="w-3.5 h-3.5 text-warning" />
              <span className="text-xs font-medium text-foreground">{task.points}</span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                {formatKanbanDeadline(task.deadline)}
              </span>
            </div>
          </div>
          <Badge variant="secondary" className="text-xs py-0">
            <User className="w-3 h-3 mr-1" />
            {task.assignee.name.split(" ")[0]}
          </Badge>
        </div>
      </Card>
    </div>
  );
}

function DroppableColumn({ column, tasks, onReviewClick, onDelete }: { column: typeof columns[0]; tasks: Task[]; onReviewClick?: (task: Task) => void; onDelete?: (task: Task) => void }) {
  const { setNodeRef } = useDroppable({ id: column.id });

  return (
    <div className="flex-1 min-w-[300px]">
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-3 h-3 rounded-full ${column.color}`} />
        <h3 className="font-heading font-semibold text-foreground">{column.title}</h3>
        <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
          {tasks.length}
        </span>
      </div>
      <div ref={setNodeRef} className="space-y-3 min-h-[200px] p-2 rounded-xl bg-secondary/30">
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <AnimatePresence>
            {tasks.map((task) => (
              <motion.div key={task.id} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
                <TaskCard task={task} onReviewClick={onReviewClick} onDelete={onDelete} />
              </motion.div>
            ))}
          </AnimatePresence>
        </SortableContext>
      </div>
    </div>
  );
}


export default function Kanban() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [evidenceModalOpen, setEvidenceModalOpen] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showMascot, setShowMascot] = useState(false);
  const [pendingDoneToast, setPendingDoneToast] = useState<{ title: string; description: string } | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const activeUsers = getActiveUsers();
  const currentUser = getCurrentUser();

  // Filter tasks based on role
  const filteredTasks = currentUser.role === "funcionario" 
    ? tasks.filter(task => task.assignee.id === currentUser.id)
    : tasks;

  const mapApiTaskToTask = (task: any): Task => {
    let deadlineValue: string = "";

    if (task.deadline instanceof Date) {
      deadlineValue = task.deadline.toISOString().split("T")[0];
    } else if (typeof task.deadline === "string") {
      const normalized = task.deadline.trim();
      if (normalized.length > 0) {
        deadlineValue = normalized.split("T")[0];
      }
    }

    return {
      id: task.id?.toString() ?? "",
      title: task.title,
      description: task.description,
      status: task.status,
      points: task.points,
      deadline: deadlineValue,
      created_at: task.created_at,
      gestorId: task.gestor_id?.toString() ?? null,
      createdBy: task.created_by?.toString() ?? null,
      assignee: {
        id: task.assignee_id?.toString() ?? "",
        name: task.assignee_name ?? "",
        email: task.assignee_email ?? "",
        role: task.assignee_role ?? "funcionario",
        nivel: currentUser?.nivel ?? 1,
        points: 0,
        institution_id: "",
        position: "",
        gestorId: null,
        avatar: "",
      },
    };
  };

  const loadTasks = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(getApiUrl("/api/tasks"), {
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        credentials: 'include',
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Erro ao carregar tarefas");
      }

      setTasks((data.tasks || []).map(mapApiTaskToTask));
    } catch (err: any) {
      console.error("loadTasks error:", err);
      setError(err?.message ?? "Erro ao carregar tarefas");
      toast({ title: "Erro", description: err?.message ?? "Falha ao carregar tarefas" });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async (data: { title: string; description: string; assignedTo: string; points: number; deadline?: string }) => {
    if (data.points < 1 || data.points > 1000) {
      toast({ title: "Erro", description: "Os pontos devem estar entre 1 e 1000." });
      return;
    }

    try {
      const response = await fetch(getApiUrl("/api/tasks"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          title: data.title,
          description: data.description,
          points: data.points,
          deadline: data.deadline || null,
          assignee_id: Number(data.assignedTo),
        }),
        credentials: 'include',
      });

      const responseData = await response.json();
      if (!response.ok) {
        throw new Error(responseData.error ?? "Erro ao criar tarefa");
      }

      setTasks((prev) => [...prev, mapApiTaskToTask(responseData.task)]);
    } catch (err: any) {
      console.error("createTask error:", err);
      toast({ title: "Erro", description: err?.message ?? "Falha ao criar tarefa" });
    }
  };

  const updateTaskStatus = async (taskId: string, status: TaskStatus, evidence?: string) => {
    try {
      const body: any = { status };
      if (evidence) body.evidence = evidence;

      const response = await fetch(getApiUrl(`/api/tasks/${taskId}/status`), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify(body),
        credentials: 'include',
      });

      const responseData = await response.json();
      if (!response.ok) {
        throw new Error(responseData.error ?? "Erro ao atualizar status");
      }

      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: responseData.task.status, evidence: responseData.task.evidence } : t)),
      );

      // Adia a mensagem até a conclusão do vídeo quando a tarefa for marcada como concluída.
      if (status === 'done') {
        setPendingDoneToast({
          title: "🎉 Tarefa Enviada",
          description: responseData.message,
        });
      }
    } catch (err: any) {
      console.error("updateTaskStatus error:", err);
      toast({ title: "Erro", description: err?.message ?? "Falha ao atualizar status" });
      throw err;
    }
  };

  const handleTaskAction = (task: Task) => {
    const currentUser = getCurrentUser();
    if (currentUser.nivel === 1 && task.status === "in_progress") {
      // Funcionário marcando como concluída
      setSelectedTask(task);
      setEvidenceModalOpen(true);
    } else if (currentUser.nivel >= 2 && task.status === "done") {
      // Gestor revisando tarefa
      setSelectedTask(task);
      setReviewModalOpen(true);
    }
  };

  const handleEvidenceSubmit = async (evidence: string) => {
    if (!selectedTask) return;

    setShowMascot(true);
    setActionLoading(true);
    try {
      await updateTaskStatus(selectedTask.id, "done", evidence);
      setEvidenceModalOpen(false);
      setSelectedTask(null);
    } catch (error) {
      console.error("Error submitting evidence:", error);
      setShowMascot(false);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReview = async (action: "approve" | "reject", feedback?: string) => {
    if (!selectedTask) return;

    setActionLoading(true);
    try {
      const response = await fetch(getApiUrl(`/api/tasks/${selectedTask.id}/review`), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ action, feedback }),
        credentials: 'include',
      });

      const responseData = await response.json();
      if (!response.ok) {
        throw new Error(responseData.error ?? "Erro ao revisar tarefa");
      }

      setTasks((prev) =>
        prev.map((t) =>
          t.id === selectedTask.id
            ? { ...t, status: action === "approve" ? "approved" : "rejected" }
            : t
        )
      );

      // Atualiza pontos do usuário local conforme backend retornou
      if (responseData?.updatedPoints != null && selectedTask?.assignee?.id === currentUser.id) {
        const stored = localStorage.getItem("azis_user");
        if (stored) {
          const parsed = JSON.parse(stored);
          localStorage.setItem(
            "azis_user",
            JSON.stringify({ ...parsed, points: responseData.updatedPoints })
          );
        }
      }

      setReviewModalOpen(false);
      setSelectedTask(null);
      toast({
        title: action === "approve" ? "✅ Tarefa Aprovada" : "❌ Tarefa Reprovada",
        description: action === "approve"
          ? `${responseData.pointsCredited} ponto(s) creditado(s) ao funcionário!`
          : "Nenhum ponto foi atribuído ao funcionário.",
      });
    } catch (err: any) {
      console.error("reviewTask error:", err);
      toast({ title: "Erro", description: err?.message ?? "Falha ao revisar tarefa" });
    } finally {
      setActionLoading(false);
    }
  };

  const deletionIntervalsRef = useRef<Record<string, number>>({});

  const handleDeleteTask = async (task: Task) => {
    if (!(currentUser.role === "gestor" || currentUser.role === "admin")) return;
    if (!["approved", "rejected"].includes(task.status)) return;

    try {
      const response = await fetch(getApiUrl(`/api/tasks/${task.id}`), {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
      });

      const responseData = await response.json();
      if (!response.ok) {
        throw new Error(responseData.error ?? "Erro ao excluir tarefa");
      }

      if (task.status === "approved") {
        toast({ title: "Exclusão agendada", description: "Tarefa aprovada será removida em 7 segundos." });
        setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, isDeleting: true, deleteCountdown: 7 } : t)));

        let countdown = 7;
        const intervalId = window.setInterval(() => {
          countdown -= 1;
          setTasks((prev) =>
            prev.map((t) =>
              t.id === task.id
                ? {
                    ...t,
                    deleteCountdown: countdown > 0 ? countdown : 0,
                  }
                : t,
            ),
          );

          if (countdown <= 0) {
            window.clearInterval(intervalId);
          }
        }, 1000);

        deletionIntervalsRef.current[task.id] = intervalId;

        window.setTimeout(() => {
          setTasks((prev) => prev.filter((t) => t.id !== task.id));
          window.clearInterval(intervalId);
          delete deletionIntervalsRef.current[task.id];
        }, 7000);
      } else {
        // rejected manual delete
        setTasks((prev) => prev.filter((t) => t.id !== task.id));
        toast({ title: "Tarefa excluída", description: "Tarefa reprovada excluída com sucesso." });
      }
    } catch (error: any) {
      console.error("deleteTask error:", error);
      toast({ title: "Erro", description: error?.message ?? "Falha ao excluir tarefa" });

      // rollback visual deletion state
      if (task.status === "approved") {
        setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, isDeleting: false, deleteCountdown: undefined } : t)));
      }
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const overId = over.id as string;
    const activeTask = tasks.find((t) => t.id === active.id);
    if (!activeTask) return;

    // Check if dropped on a column
    const targetColumn = columns.find((c) => c.id === overId);
    if (targetColumn) {
      const targetStatus = targetColumn.id;

      // Permitido via drag somente transições de workflow de funcionário
      const allowedDrag = ['todo', 'in_progress', 'done'];

      if (!allowedDrag.includes(targetStatus)) {
        const currentUser = getCurrentUser();
        const description = currentUser.role === 'funcionario'
          ? 'Aprovação/reprovação só pode ser feita pelo superior'
          : 'Aprovação/reprovação deve ser feita via botão de revisão';

        toast({
          title: 'Atenção',
          description,
        });
        return;
      }

      if (activeTask.status !== targetStatus) {
        setTasks((prev) =>
          prev.map((t) => (t.id === active.id ? { ...t, status: targetStatus } : t)),
        );
        if (targetStatus === 'done') setShowMascot(true);
        updateTaskStatus(active.id as string, targetStatus);
      }
      return;
    }

    // if usuario soltar em cima de outra task, não faz alteração de status (apenas em colunas)
    const targetTask = tasks.find((t) => t.id === overId);
    if (targetTask) {
      toast({
        title: 'Atenção',
        description: 'Arraste para a coluna, não sobre outra tarefa',
      });
      return;
    }
  };

  const activeTask = tasks.find((t) => t.id === activeId);

  useEffect(() => {
    loadTasks();
  }, []);

  useEffect(() => {
    return () => {
      Object.values(deletionIntervalsRef.current).forEach((intervalId) => {
        window.clearInterval(intervalId);
      });
    };
  }, []);

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Quadro Kanban</h1>
          <p className="text-muted-foreground mt-1">Arraste tarefas entre as colunas</p>
        </div>
        {currentUser.role === "gestor" && (
          <TaskFormModal
            trigger={
              <Button className="bg-gradient-primary text-primary-foreground">
                <Plus className="w-4 h-4 mr-2" />
                Nova Tarefa
              </Button>
            }
            onSubmit={handleCreateTask}
          />
        )}
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-6 overflow-x-auto pb-4">
          {columns.map((col) => (
            <DroppableColumn
              key={col.id}
              column={col}
              tasks={filteredTasks.filter((t) => t.status === col.id)}
              onReviewClick={handleTaskAction}
              onDelete={handleDeleteTask}
            />
          ))}
        </div>
        <DragOverlay>
          {activeTask ? (
            <Card className="p-4 shadow-lg border border-primary/30 bg-card rotate-2">
              <h4 className="font-medium text-sm text-foreground">{activeTask.title}</h4>
            </Card>
          ) : null}
        </DragOverlay>
      </DndContext>

      <EvidenceModal
        open={evidenceModalOpen}
        onOpenChange={setEvidenceModalOpen}
        onSubmit={handleEvidenceSubmit}
        loading={actionLoading}
      />

      <ReviewModal
        open={reviewModalOpen}
        onOpenChange={setReviewModalOpen}
        task={selectedTask}
        onReview={handleReview}
        loading={actionLoading}
      />

      {showMascot && (
        <>
          <style>{`
            @keyframes mascotFadeIn {
              from { opacity: 0; transform: translateY(20px) scale(0.95); }
              to { opacity: 1; transform: translateY(0) scale(1); }
            }
          `}</style>
          <div
            style={{
              position: 'fixed',
              right: '1rem',
              bottom: '1rem',
              width: '380px',
              maxWidth: 'calc(100vw - 2rem)',
              borderRadius: '1rem',
              overflow: 'hidden',
              zIndex: 9999,
              animation: 'mascotFadeIn 0.3s ease-out',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.2)',
            }}
          >
            <img
              src={mascotVideo}
              alt="Mascote"
              onLoad={() => {
                setTimeout(() => {
                  setShowMascot(false);
                  if (pendingDoneToast) {
                    toast(pendingDoneToast);
                    setPendingDoneToast(null);
                  }
                }, 8000);
              }}
              style={{
                width: '100%',
                height: 'auto',
                display: 'block',
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}
