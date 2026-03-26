import { Wallet, PlusCircle, ChevronDown, LogOut, User, Gift, Banknote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useWallet } from "@/hooks/useWallet";
import { Link, useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const Navbar = () => {
  const { user, signOut } = useAuth();
  const { wallet } = useWallet();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const getInitials = () => {
    const name = user?.user_metadata?.display_name || user?.email || "";
    if (!name) return "??";
    const parts = name.split(/[\s@]+/);
    return parts.slice(0, 2).map((p: string) => p[0]?.toUpperCase()).join("");
  };

  const displayName = user?.user_metadata?.display_name || user?.email?.split("@")[0] || "Jogador";

  return (
    <nav className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b border-border">
      <div className="container flex h-14 items-center justify-between gap-3">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xs font-bold">
            R$
          </div>
          <span className="text-lg font-extrabold tracking-tight">
            <span className="text-primary">Pix</span>
            <span className="text-foreground">Raspa</span>
          </span>
        </Link>

        {user ? (
          <div className="flex items-center gap-2">
            {/* Balance */}
            <Link
              to="/wallet"
              className="flex items-center gap-1.5 rounded-lg bg-primary/10 border border-primary/30 px-3 py-1.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/15"
            >
              <Wallet className="h-3.5 w-3.5 hidden sm:block" />
              <span className="font-mono text-sm">R$ {wallet?.balance?.toFixed(2) ?? "0.00"}</span>
            </Link>

            {/* Deposit */}
            <Link
              to="/deposit"
              className="flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-sm font-semibold transition-colors hover:bg-primary/90"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Depositar</span>
            </Link>

            {/* Withdraw - desktop only */}
            <Link
              to="/withdraw"
              className="hidden md:flex items-center gap-1.5 rounded-lg border border-border text-muted-foreground px-3 py-1.5 text-sm font-medium transition-colors hover:text-foreground hover:border-primary/40"
            >
              <Banknote className="h-3.5 w-3.5" />
              Sacar
            </Link>

            {/* Profile dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-lg border border-border px-2 py-1.5 transition-colors hover:border-primary/30 hover:bg-secondary">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-bold">
                    {getInitials()}
                  </div>
                  <div className="hidden lg:flex flex-col items-start leading-tight">
                    <span className="text-sm font-medium text-foreground">{displayName}</span>
                  </div>
                  <ChevronDown className="h-3 w-3 text-muted-foreground hidden sm:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 border border-border bg-card">
                <div className="px-3 py-2 border-b border-border">
                  <p className="text-sm font-semibold text-foreground truncate">{displayName}</p>
                  <p className="text-xs text-muted-foreground font-mono">R$ {wallet?.balance?.toFixed(2) ?? "0.00"}</p>
                </div>
                <DropdownMenuItem onClick={() => navigate("/wallet")}>
                  <User className="h-4 w-4 mr-2" />
                  Meu Perfil
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/deposit")}>
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Depositar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/withdraw")} className="md:hidden">
                  <Banknote className="h-4 w-4 mr-2" />
                  Sacar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/referral")}>
                  <Gift className="h-4 w-4 mr-2" />
                  Indicar Amigos
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
                  <LogOut className="h-4 w-4 mr-2" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground text-sm"
              onClick={() => navigate("/auth")}
            >
              Entrar
            </Button>
            <Button
              size="sm"
              className="rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 px-4 h-9 text-sm font-semibold"
              onClick={() => navigate("/auth")}
            >
              Criar conta
            </Button>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
