import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { User, Lock, ArrowRight, Mail, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import logoDreampay from "@/assets/logo-dreampay.png";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const refCode = searchParams.get("ref") || "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Login realizado com sucesso!");
        const redirect = searchParams.get("redirect") || "/dashboard";
        navigate(redirect);
      } else {
        if (password.length < 6) {
          toast.error("A senha deve ter pelo menos 6 caracteres");
          setLoading(false);
          return;
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: displayName || "Usuário" },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        toast.success("Cadastro realizado com sucesso!");
        navigate("/dashboard");

        if (refCode) {
          localStorage.setItem("pending_referral_code", refCode);
        }
      }
    } catch (error: any) {
      toast.error(error.message || "Erro ao autenticar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background relative overflow-hidden">
      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage: `
              radial-gradient(circle at 25% 20%, hsl(155 72% 46% / 0.08) 0%, transparent 50%),
              radial-gradient(circle at 75% 80%, hsl(155 72% 46% / 0.05) 0%, transparent 45%)
            `,
          }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,hsl(220_20%_4%/0.7)_100%)]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-[420px] relative z-10 px-4"
      >
        {/* Logo */}
        <div className="mb-10 text-center">
          <div className="inline-flex items-center gap-2.5 mb-2">
            <img src={logoDreampay} alt="DreamPay" className="h-9 w-9 rounded-lg" />
            <h1 className="text-2xl font-extrabold tracking-tight">
              <span className="text-primary">Dream</span>
              <span className="text-foreground">Pay</span>
            </h1>
          </div>
        </div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-xl p-7 shadow-2xl shadow-black/20"
        >
          {/* Title */}
          <div className="mb-6">
            <h2 className="text-xl font-extrabold text-foreground">
              {isLogin ? "Bem-vindo de volta" : "Crie sua conta"}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {isLogin
                ? "Entre com suas credenciais para acessar sua conta"
                : "Preencha os dados abaixo para começar"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="text-sm font-semibold text-foreground mb-1.5 block">Nome</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
                  <Input
                    type="text"
                    placeholder="Seu nome"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="bg-secondary/60 border-border/50 pl-10 h-11 rounded-xl text-sm focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="text-sm font-semibold text-foreground mb-1.5 block">Email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
                <Input
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-secondary/60 border-border/50 pl-10 h-11 rounded-xl text-sm focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-foreground mb-1.5 block">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="bg-secondary/60 border-border/50 pl-10 pr-11 h-11 rounded-xl text-sm focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {isLogin && (
              <div className="text-right">
                <button type="button" className="text-sm text-primary hover:underline font-medium">
                  Esqueceu a senha?
                </button>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90 font-bold gap-2 rounded-xl text-sm mt-2 transition-all"
            >
              {loading ? "Carregando..." : isLogin ? "Entrar" : "Criar conta"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              {isLogin ? "Não tem uma conta? " : "Já tem uma conta? "}
              <button
                onClick={() => setIsLogin(!isLogin)}
                className="text-primary hover:underline font-semibold"
              >
                {isLogin ? "Criar conta" : "Entrar"}
              </button>
            </p>
          </div>
        </motion.div>

        {/* Back link */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-6 text-center"
        >
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar para a página inicial
          </Link>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default Auth;
