"use client";

import { useEffect, useState } from "react";

/** Client-side auth gate: sends unauthenticated users to /login. */
export function useRequireAuth(isLoading: boolean, isAuthenticated: boolean): boolean {
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      if (typeof window !== "undefined") {
        window.location.replace("/login");
      }
      return;
    }
    setAllowed(true);
  }, [isLoading, isAuthenticated]);

  return allowed;
}
