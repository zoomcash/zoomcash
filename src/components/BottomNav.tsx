import { Gamepad2, Gift, LogIn, UserPlus, Wallet, PlusCircle } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

const BottomNav = () => {
  const { user } = useAuth();
  const location = useLocation();

  const items = user
    ? [
        { icon: Gamepad2, label: "Jogos", href: "/" },
        { icon: Gift, label: "Prêmios", href: "/#raspadinhas" },
        { icon: PlusCircle, label: "Depositar", href: "/deposit", highlight: true },
        { icon: Wallet, label: "Carteira", href: "/wallet" },
      ]
    : [
        { icon: Gamepad2, label: "Jogos", href: "/" },
        { icon: Gift, label: "Prêmios", href: "/#raspadinhas" },
        { icon: LogIn, label: "Entrar", href: "/auth" },
        { icon: UserPlus, label: "Registrar", href: "/auth" },
      ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-md md:hidden">
      <div className="flex items-center justify-around py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {items.map((item) => {
          const active = location.pathname === item.href;
          const highlight = 'highlight' in item && item.highlight;
          return (
            <Link
              key={item.label}
              to={item.href}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] transition-colors ${
                highlight || active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <item.icon className="h-5 w-5" />
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default BottomNav;
