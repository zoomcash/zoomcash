import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Key, Copy, Trash2, AlertCircle, Plus, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const Credentials = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // Store newly created key to show once (like GitHub PATs)
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<{ id: string; key: string } | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  const { data: apiKeys } = useQuery({
    queryKey: ["api-keys", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("api_keys")
        .select("id, key_prefix, name, created_at, last_used_at, user_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const createKey = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const key = "sk_live_" + crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 10);
      const prefix = key.slice(0, 10) + "...";

      // Hash the key with SHA-256 before storing
      const encoder = new TextEncoder();
      const hash = await crypto.subtle.digest("SHA-256", encoder.encode(key));
      const keyHash = Array.from(new Uint8Array(hash))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      const { data, error } = await supabase.from("api_keys").insert({
        user_id: user.id,
        key_prefix: prefix,
        key_hash: keyHash,
        name: "API Key",
      }).select("id").single();
      if (error) throw error;
      return { key, id: data.id };
    },
    onSuccess: ({ key, id }) => {
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
      setNewlyCreatedKey({ id, key });
      navigator.clipboard.writeText(key);
      toast.success("API Key criada e copiada! Salve-a agora — ela não será exibida novamente.");
    },
    onError: () => {
      toast.error("Erro ao criar API Key");
    },
  });

  const deleteKey = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("api_keys").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
      toast.success("API Key removida");
    },
  });

  return (
    <AppLayout>
      <div className="p-5 md:p-8 pt-16 md:pt-8 max-w-3xl mx-auto space-y-5">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">
            Credenciais API
          </h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            Gerencie suas chaves de acesso à API
          </p>
        </div>

        {/* Warning */}
        <div className="flex items-start gap-2.5 rounded-lg border border-primary/15 bg-primary/5 p-3.5">
          <AlertCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <p className="text-[12px] text-muted-foreground leading-relaxed">
            Suas credenciais são confidenciais. Não compartilhe com terceiros e armazene de forma segura.
          </p>
        </div>

        {/* API Keys */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-semibold">
              Suas Chaves
            </p>
            <Button
              onClick={() => createKey.mutate()}
              disabled={createKey.isPending}
              size="sm"
              className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 h-8 text-[12px]"
            >
              <Plus className="h-3 w-3" />
              Nova Key
            </Button>
          </div>

          <div className="space-y-2">
            {apiKeys?.map((key) => (
              <div
                key={key.id}
                className="rounded-xl border border-border bg-card p-4 flex items-center gap-3"
              >
                <div className="rounded-md bg-secondary p-2">
                  <Key className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-foreground">{key.name}</p>
                  {newlyCreatedKey?.id === key.id ? (
                    <div className="flex items-center gap-1.5">
                      <code className="text-[11px] text-primary font-mono-value break-all">
                        {newlyCreatedKey.key}
                      </code>
                      <span className="text-[9px] text-destructive font-medium uppercase">Salve agora!</span>
                    </div>
                  ) : (
                    <code className="text-[11px] text-muted-foreground font-mono-value">
                      {key.key_prefix}
                    </code>
                  )}
                  <div className="flex gap-3 mt-1 text-[10px] text-muted-foreground">
                    <span>Criada: {key.created_at ? new Date(key.created_at).toLocaleDateString("pt-BR") : "-"}</span>
                    <span>Último uso: {key.last_used_at ? new Date(key.last_used_at).toLocaleDateString("pt-BR") : "-"}</span>
                  </div>
                </div>
                <div className="flex gap-1">
                  {newlyCreatedKey?.id === key.id && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        navigator.clipboard.writeText(newlyCreatedKey.key);
                        toast.success("Copiado!");
                      }}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      deleteKey.mutate(key.id);
                      if (newlyCreatedKey?.id === key.id) setNewlyCreatedKey(null);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}

            {(!apiKeys || apiKeys.length === 0) && (
              <div className="rounded-xl border border-border bg-card py-10 text-center">
                <Key className="h-6 w-6 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-[13px] text-muted-foreground">
                  Nenhuma API Key criada
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Credentials;
