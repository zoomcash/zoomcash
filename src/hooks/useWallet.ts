import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const useWallet = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: wallet, isLoading } = useQuery({
    queryKey: ["wallet", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const updateBalance = useMutation({
    mutationFn: async ({ amount, type, description }: { amount: number; type: "deposit" | "withdrawal" | "bet" | "win" | "bonus"; description: string }) => {
      if (!user) throw new Error("Not authenticated");

      // Use secure server-side function for all balance updates
      const { data, error } = await (supabase.rpc as any)("update_wallet_balance", {
        _user_id: user.id,
        _amount: amount,
        _type: type,
        _description: description,
      });

      if (error) {
        // Translate common DB errors to user-friendly messages
        if (error.message?.includes("Insufficient balance")) {
          throw new Error("Saldo insuficiente");
        }
        throw error;
      }

      return data as number;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wallet", user?.id] });
    },
  });

  return { wallet, isLoading, updateBalance };
};
