import { createContext, useContext, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getQueryFn } from "./queryClient";
import type { PublicUser } from "@shared/schema";

export interface RegisterInput {
  email: string;
  password: string;
  displayName: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

const ME_QUERY_KEY = ["/api/auth/me"];

/**
 * Текущий пользователь: null, если не выполнен вход (401 от /api/auth/me —
 * ожидаемое обычное состояние гостя, не ошибка) — see getQueryFn on401: "returnNull".
 */
function useCurrentUserQuery() {
  return useQuery<PublicUser | null>({
    queryKey: ME_QUERY_KEY,
    queryFn: getQueryFn<PublicUser | null>({ on401: "returnNull" }),
  });
}

interface AuthContextValue {
  user: PublicUser | null | undefined;
  isLoading: boolean;
  register: (input: RegisterInput) => Promise<PublicUser>;
  login: (input: LoginInput) => Promise<PublicUser>;
  logout: () => Promise<void>;
  isRegistering: boolean;
  isLoggingIn: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useCurrentUserQuery();

  const registerMutation = useMutation({
    mutationFn: async (input: RegisterInput) => {
      const res = await apiRequest("POST", "/api/auth/register", input);
      return (await res.json()) as PublicUser;
    },
    onSuccess: (registeredUser) => queryClient.setQueryData(ME_QUERY_KEY, registeredUser),
  });

  const loginMutation = useMutation({
    mutationFn: async (input: LoginInput) => {
      const res = await apiRequest("POST", "/api/auth/login", input);
      return (await res.json()) as PublicUser;
    },
    onSuccess: (loggedInUser) => queryClient.setQueryData(ME_QUERY_KEY, loggedInUser),
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => queryClient.setQueryData(ME_QUERY_KEY, null),
  });

  const value: AuthContextValue = {
    user,
    isLoading,
    register: (input) => registerMutation.mutateAsync(input),
    login: (input) => loginMutation.mutateAsync(input),
    logout: () => logoutMutation.mutateAsync(),
    isRegistering: registerMutation.isPending,
    isLoggingIn: loginMutation.isPending,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/**
 * apiRequest() бросает Error("<status>: <тело ответа>"), а тело для наших
 * /api/auth/* роутов — JSON {message}. Разбирает его обратно в читаемое
 * сообщение для тоста; если тело не JSON (сеть недоступна и т.п.) — fallback.
 */
export function getAuthErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  const match = /^\d+:\s*([\s\S]*)$/.exec(error.message);
  const body = match ? match[1] : error.message;
  try {
    const parsed = JSON.parse(body) as { message?: string };
    if (parsed?.message) return parsed.message;
  } catch {
    // тело не JSON — используем как есть ниже
  }
  return body || fallback;
}
