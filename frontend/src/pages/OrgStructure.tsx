import { useEffect, useState } from "react";
import { getActiveUsers, getCurrentUser, getManagerName, saveActiveUsers, type User } from "@/data/mock";
import { getApiUrl, getAuthHeaders } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface TreeNodeProps {
  user: User;
  level: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  allUsers: User[];
}

const sortUsers = (a: User, b: User) => {
  if (a.nivel !== b.nivel) return (b.nivel ?? 0) - (a.nivel ?? 0)
  return a.name.localeCompare(b.name)
}

function TreeNode({ user, level, selectedId, onSelect, allUsers }: TreeNodeProps) {
  const children = allUsers
    .filter((u) => u.gestorId === user.id)
    .sort(sortUsers)
  const isSelected = selectedId === user.id

  return (
    <div className={cn("ml-0", level > 0 && "ml-6")}>
      <button
        onClick={() => onSelect(user.id)}
        className={cn(
          "flex flex-col items-start px-4 py-3 rounded-md border text-left w-full max-w-xs mb-1 transition-colors",
          isSelected
            ? "border-primary bg-primary/5"
            : "border-border hover:border-muted-foreground/30"
        )}
      >
        <span className="text-sm font-medium text-foreground">{user.name}</span>
        <span className="text-xs text-muted-foreground">{user.position}</span>
      </button>

      {children.length > 0 && (
        <div className="border-l border-border ml-4 space-y-1 mt-1 mb-2">
          {children.map((child) => (
            <TreeNode
              key={child.id}
              user={child}
              level={level + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              allUsers={allUsers}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function OrgStructure() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newGestorId, setNewGestorId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const currentUser = getCurrentUser();
  const [users, setUsers] = useState<User[]>(getActiveUsers());
  const visibleUsers = [...users].sort(sortUsers);

  // Filter users based on role
  const getVisibleUsersForUser = (user: User, allUsers: User[]): User[] => {
    if (user.role === "admin") return allUsers;
    if (user.role === "gestor") return allUsers; // Gestores podem ver toda a hierarquia, mas não editar
    return [user]; // funcionario sees only themselves, but since route is blocked, not used
  };

  const filteredUsers = getVisibleUsersForUser(currentUser, visibleUsers);

  // Fetch users from backend to ensure IDs match the database
  useEffect(() => {
    const apiUrl = getApiUrl("/api/users");

    fetch(apiUrl, { headers: getAuthHeaders(), credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const normalized = data.map((u) => ({
            ...u,
            id: u.id?.toString(),
            gestorId:
              u.gestorId != null
                ? u.gestorId.toString()
                : (u as any).gestor_id != null
                ? (u as any).gestor_id.toString()
                : null,
          }))
          setUsers(normalized)
          saveActiveUsers(normalized)
        }
      })
      .catch(() => {
        // Fallback to local storage if backend unavailable
        setUsers(getActiveUsers());
      })
      .finally(() => setLoading(false));
  }, []);

  const rootUsers = filteredUsers.filter((u) => u.gestorId === null).sort(sortUsers)
  const selectedUser = selectedId ? filteredUsers.find((u) => u.id === selectedId) ?? null : null;

  if (loading) {
    return (
      <div className="p-6 lg:p-8">
        <p>Carregando usuários...</p>
      </div>
    );
  }

 const validManagers = filteredUsers
  .filter((u) => u.id !== selectedId && u.nivel >= 2)
  .sort(sortUsers);

  const handleSave = async () => {
    if (!selectedUser) return;

    // Não permitir mudanças sem permissão
    if (currentUser.nivel < 3) {
      toast({
        title: "Acesso negado",
        description: "Você não tem permissão para alterar a hierarquia.",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch(getApiUrl(`/api/users/${selectedUser.id}`), {
        method: "PUT",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ gestorId: newGestorId || null }),
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.error ?? response.statusText);
      }

      const updated = await response.json();
      const nextUsers = users.map((u) => (u.id === updated.id ? { ...u, ...updated } : u));
      setUsers(nextUsers);
      saveActiveUsers(nextUsers);

      toast({
        title: "Hierarquia atualizada",
        description: `${selectedUser.name} agora reporta para ${getManagerName(newGestorId)}.`,
      });

      setSelectedId(null);
      setNewGestorId("");
    } catch (err) {
      toast({
        title: "Erro ao salvar",
        description: err instanceof Error ? err.message : "Falha ao atualizar usuário",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!selectedUser) return;

    const confirmed = window.confirm(
      `Tem certeza que deseja excluir ${selectedUser.name}? Essa ação não pode ser desfeita.`
    );
    if (!confirmed) return;

    const apiUrl =
      (import.meta.env.VITE_API_URL as string) ||
      `${window.location.protocol}//${window.location.hostname}:3000`;

    const response = await fetch(getApiUrl(`/api/users/${selectedUser.id}`), {
      method: "DELETE",
      headers: getAuthHeaders(),
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => null);
      toast({
        title: "Erro ao excluir usuário",
        description: error?.error ?? response.statusText,
        variant: "destructive",
      });
      return;
    }

    // Refresh from backend to ensure IDs and list are consistent
    const refreshed = await fetch(getApiUrl("/api/users"), { headers: getAuthHeaders(), credentials: 'include' })
      .then((r) => r.json())
      .catch(() => users);
    const nextUsers = Array.isArray(refreshed) ? refreshed : users;

    setUsers(nextUsers);
    saveActiveUsers(nextUsers);
    setSelectedId(null);

    toast({
      title: "Usuário excluído",
      description: `${selectedUser.name} foi removido com sucesso.`,
    });
  };

  return (
    <div className="p-6 lg:p-8">
      {/* HEADER PADRONIZADO */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">
            Estrutura Organizacional
          </h1>
          <p className="text-muted-foreground mt-1">
            Visualize a hierarquia da equipe e gerencie relações de liderança
          </p>
        </div>
        {currentUser.nivel < 3 && (
          <div className="text-sm text-muted-foreground">
            Você precisa ser Admin (nível 3) para gerenciar a hierarquia.
          </div>
        )}
      </div>

      <div className="flex gap-8">
        {/* ÁRVORE ORGANIZACIONAL */}
        <div className="flex-1">
          <Card className="p-6">
            <div className="space-y-1">
              {rootUsers.map((user) => (
                <TreeNode
                  key={user.id}
                  user={user}
                  level={0}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  allUsers={filteredUsers}
                />
              ))}
            </div>
          </Card>
        </div>

        {/* SIDEBAR DE DETALHES */}
        {selectedUser && (
          <aside className="w-80 shrink-0">
            <Card className="p-6 sticky top-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">
                Employee Details
              </h2>

              <div className="space-y-3 text-sm mb-6">
                <div>
                  <p className="text-muted-foreground">Name</p>
                  <p className="font-medium text-foreground">
                    {selectedUser.name}
                  </p>
                </div>

                <div>
                  <p className="text-muted-foreground">Position</p>
                  <p className="text-foreground">{selectedUser.position}</p>
                </div>

                <div>
                  <p className="text-muted-foreground">Role</p>
                  <p className="text-foreground">{selectedUser.role}</p>
                </div>

                <div>
                  <p className="text-muted-foreground">Current Manager</p>
                  <p className="text-foreground">
                    {getManagerName(selectedUser.gestorId)}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium text-foreground">
                  Assign Manager
                </label>

                <Select value={newGestorId} onValueChange={setNewGestorId} disabled={currentUser.nivel < 3}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a manager" />
                  </SelectTrigger>

                  <SelectContent>
                    {validManagers.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name} — {m.position}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  className="w-full"
                  onClick={handleSave}
                  disabled={currentUser.nivel < 3 || !newGestorId}
                >
                  Save Changes
                </Button>
                {currentUser.nivel >= 3 && selectedUser && selectedUser.nivel !== 3 && (
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={handleDelete}
                  >
                    Delete User
                  </Button>
                )}
              </div>
            </Card>
          </aside>
        )}
      </div>
    </div>
  );
}