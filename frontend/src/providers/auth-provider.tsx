"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from "react";

import { api, ApiError, getActiveWorkspaceId, setActiveWorkspaceId } from "@/lib/api";
import type { AuthResponse, User, Workspace, WorkspaceStats } from "@/lib/types";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  workspace: Workspace | null;
  workspaces: Workspace[];
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  selectWorkspace: (id: string) => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const meQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => api.get<User>("/api/v1/auth/me", { noWorkspace: true }),
    staleTime: 5 * 60_000,
    retry: false,
  });

  const workspacesQuery = useQuery({
    queryKey: ["workspaces"],
    queryFn: () => api.get<Workspace[]>("/api/v1/workspaces", { noWorkspace: true }),
    enabled: Boolean(meQuery.data),
  });

  const workspaces = useMemo(() => workspacesQuery.data ?? [], [workspacesQuery.data]);

  const workspace = useMemo(() => {
    if (!workspaces.length) return null;
    const activeId = getActiveWorkspaceId();
    return workspaces.find((w) => w.id === activeId) ?? workspaces[0]!;
  }, [workspaces]);

  // Persist the resolved workspace so the next request carries the header.
  useEffect(() => {
    if (workspace && getActiveWorkspaceId() !== workspace.id) {
      setActiveWorkspaceId(workspace.id);
    }
  }, [workspace]);

  const loginMutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      api.post<AuthResponse>("/api/v1/auth/login", { email, password }, { noWorkspace: true }),
    onSuccess: (data) => {
      queryClient.setQueryData(["auth", "me"], data.user);
      void queryClient.invalidateQueries({ queryKey: ["workspaces"] });
    },
  });

  const registerMutation = useMutation({
    mutationFn: (payload: { name: string; email: string; password: string }) =>
      api.post<AuthResponse>("/api/v1/auth/register", payload, { noWorkspace: true }),
    onSuccess: (data) => {
      queryClient.setQueryData(["auth", "me"], data.user);
      void queryClient.invalidateQueries({ queryKey: ["workspaces"] });
    },
  });

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await loginMutation.mutateAsync({ email, password });
      return data.user;
    },
    [loginMutation],
  );

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      const data = await registerMutation.mutateAsync({ name, email, password });
      return data.user;
    },
    [registerMutation],
  );

  const logout = useCallback(async () => {
    try {
      await api.post("/api/v1/auth/logout", undefined, { noWorkspace: true });
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) throw error;
    } finally {
      setActiveWorkspaceId(null);
      queryClient.setQueryData(["auth", "me"], null);
      queryClient.removeQueries({ queryKey: ["workspaces"] });
    }
  }, [queryClient]);

  const selectWorkspace = useCallback(
    (id: string) => {
      setActiveWorkspaceId(id);
      queryClient.removeQueries({ queryKey: ["documents"] });
      queryClient.removeQueries({ queryKey: ["chat"] });
      queryClient.invalidateQueries({ queryKey: ["workspace-stats"] });
    },
    [queryClient],
  );

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
    await queryClient.invalidateQueries({ queryKey: ["workspaces"] });
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: meQuery.data ?? null,
      isLoading: meQuery.isPending,
      isAuthenticated: Boolean(meQuery.data),
      workspace,
      workspaces,
      login,
      register,
      logout,
      selectWorkspace,
      refresh,
    }),
    [
      meQuery.data,
      meQuery.isPending,
      workspace,
      workspaces,
      login,
      register,
      logout,
      selectWorkspace,
      refresh,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return context;
}

export function useWorkspaceStats() {
  return useQuery({
    queryKey: ["workspace-stats"],
    queryFn: () => api.get<WorkspaceStats>("/api/v1/workspaces/current/stats"),
    enabled: Boolean(getActiveWorkspaceId()),
  });
}
