import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

// Safe merchant type (no sensitive fields)
export interface MerchantSafe {
  id: string;
  name: string;
  user_id: string;
  webhook_url: string | null;
  status: string;
  api_key_prefix: string;
  rate_limit_per_minute: number;
  created_at: string;
  updated_at: string;
}

export function useMerchant() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const merchantQuery = useQuery({
    queryKey: ["merchant", user?.id],
    queryFn: async (): Promise<MerchantSafe | null> => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("merchants")
        .select("id, name, user_id, webhook_url, status, api_key_prefix, rate_limit_per_minute, created_at, updated_at")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data as MerchantSafe | null;
    },
    enabled: !!user,
  });

  const createMerchant = useMutation({
    mutationFn: async (name: string) => {
      if (!user) throw new Error("Not authenticated");

      // Generate API key
      const { data: apiKey, error: keyError } = await supabase.rpc("generate_merchant_api_key");
      if (keyError) throw keyError;

      const prefix = (apiKey as string).substring(0, 12);

      // Hash the key client-side
      const encoder = new TextEncoder();
      const hash = await crypto.subtle.digest("SHA-256", encoder.encode(apiKey as string));
      const keyHash = Array.from(new Uint8Array(hash))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      const { data, error } = await supabase
        .from("merchants")
        .insert({
          user_id: user.id,
          name,
          api_key_hash: keyHash,
          api_key_prefix: prefix,
        })
        .select()
        .single();

      if (error) throw error;
      return { merchant: data, apiKey: apiKey as string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["merchant"] });
    },
  });

  const rotateApiKey = useMutation({
    mutationFn: async () => {
      if (!user || !merchantQuery.data) throw new Error("No merchant");

      const { data: apiKey, error: keyError } = await supabase.rpc("generate_merchant_api_key");
      if (keyError) throw keyError;

      const prefix = (apiKey as string).substring(0, 12);
      const encoder = new TextEncoder();
      const hash = await crypto.subtle.digest("SHA-256", encoder.encode(apiKey as string));
      const keyHash = Array.from(new Uint8Array(hash))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      const { error } = await supabase
        .from("merchants")
        .update({ api_key_hash: keyHash, api_key_prefix: prefix })
        .eq("id", merchantQuery.data.id);

      if (error) throw error;

      // Log security event
      await supabase.from("security_events").insert({
        merchant_id: merchantQuery.data.id,
        event_type: "api_key_rotated" as any,
        metadata: { old_prefix: merchantQuery.data.api_key_prefix, new_prefix: prefix },
      });

      return apiKey as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["merchant"] });
      toast({ title: "Chave rotacionada com sucesso" });
    },
  });

  const updateWebhookUrl = useMutation({
    mutationFn: async (webhookUrl: string) => {
      if (!merchantQuery.data) throw new Error("No merchant");
      const { error } = await supabase
        .from("merchants")
        .update({ webhook_url: webhookUrl })
        .eq("id", merchantQuery.data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["merchant"] });
      toast({ title: "Webhook URL atualizada" });
    },
  });

  return {
    merchant: merchantQuery.data,
    isLoading: merchantQuery.isLoading,
    createMerchant,
    rotateApiKey,
    updateWebhookUrl,
  };
}

export function useMerchantTransactions(merchantId: string | undefined) {
  return useQuery({
    queryKey: ["merchant-transactions", merchantId],
    queryFn: async () => {
      if (!merchantId) return [];
      const { data, error } = await supabase
        .from("gateway_transactions")
        .select("*")
        .eq("merchant_id", merchantId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
    enabled: !!merchantId,
    refetchInterval: 15000,
  });
}

export function useMerchantBalance(merchantId: string | undefined) {
  return useQuery({
    queryKey: ["merchant-balance", merchantId],
    queryFn: async () => {
      if (!merchantId) return 0;
      const { data, error } = await supabase.rpc("get_merchant_balance", {
        _merchant_id: merchantId,
      });
      if (error) throw error;
      return (data as number) || 0;
    },
    enabled: !!merchantId,
    refetchInterval: 30000,
  });
}

export function useMerchantLedger(merchantId: string | undefined) {
  return useQuery({
    queryKey: ["merchant-ledger", merchantId],
    queryFn: async () => {
      if (!merchantId) return [];
      const { data, error } = await supabase
        .from("ledger_entries")
        .select("*")
        .eq("merchant_id", merchantId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!merchantId,
  });
}

export function useMerchantWebhookDeliveries(merchantId: string | undefined) {
  return useQuery({
    queryKey: ["merchant-webhook-deliveries", merchantId],
    queryFn: async () => {
      if (!merchantId) return [];
      const { data, error } = await supabase
        .from("webhook_deliveries")
        .select("*")
        .eq("merchant_id", merchantId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!merchantId,
  });
}
