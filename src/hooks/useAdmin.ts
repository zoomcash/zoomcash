import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const useAdmin = () => {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Wait for auth to finish loading first
    if (authLoading) {
      setLoading(true);
      return;
    }

    if (!user) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    const check = async () => {
      try {
        const { data, error } = await (supabase.rpc as any)("has_role", {
          _user_id: user.id,
          _role: "admin",
        });
        if (error) {
          console.error("Error checking admin role:", error);
          setIsAdmin(false);
        } else {
          setIsAdmin(!!data);
        }
      } catch (e) {
        console.error("Failed to check admin:", e);
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    };
    check();
  }, [user, authLoading]);

  return { isAdmin, loading };
};
