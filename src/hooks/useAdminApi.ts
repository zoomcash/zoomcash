import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const BASE_URL = `${SUPABASE_URL}/functions/v1/admin-api`;

export function useAdminApi() {
  const { session } = useAuth();
  const [loading, setLoading] = useState(false);

  const call = useCallback(async (path: string, method = "GET", body?: unknown) => {
    if (!session?.access_token) throw new Error("Not authenticated");
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      return data;
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  return { call, loading };
}
