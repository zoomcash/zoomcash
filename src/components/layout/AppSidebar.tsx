import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useWallet } from "@/hooks/useWallet";
import { useAdmin } from "@/hooks/useAdmin";
import logoDreampay from "@/assets/logo-dreampay.png";
import {
  LayoutDashboard,
  UserSearch,
  Share2,
  ArrowRightLeft,
  Send,
  ArrowLeftRight,
  FileText as FileTextIcon,
  Download,
  ArrowUpFromLine,
  Receipt,
  Users,
  Link2,
  Key,
  FileText,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Wallet,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
  {
    label: "Transferências",
    icon: ArrowRightLeft,
    children: [
      { label: "Transferir PIX", icon: Send, path: "/transferir" },
      { label: "Transferência Interna", icon: ArrowLeftRight, path: "/transferencia-interna" },
      { label: "Depositar", icon: Download, path: "/depositar" },
      { label: "Sacar", icon: ArrowUpFromLine, path: "/sacar" },
    ],
  },
  { label: "Transações", icon: Receipt, path: "/transacoes" },
  { label: "Extrato", icon: FileTextIcon, path: "/extrato" },
  { label: "Clientes", icon: UserSearch, path: "/clientes" },
  { label: "Afiliados", icon: Share2, path: "/afiliados" },
  {
    label: "Integrações",
    icon: Link2,
    children: [
      { label: "Credenciais API", icon: Key, path: "/credenciais" },
      { label: "Documentação", icon: FileText, path: "/docs" },
    ],
  },
  { label: "Configurações", icon: Settings, path: "/configuracoes" },
];

const adminItems = [
  { label: "Painel Admin", icon: ShieldCheck, path: "/admin" },
];

export const AppSidebar = () => {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { wallet } = useWallet();
  const { isAdmin } = useAdmin();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<string[]>(["Transferências", "Integrações"]);

  const toggleGroup = (label: string) => {
    setExpandedGroups((prev) =>
      prev.includes(label) ? prev.filter((g) => g !== label) : [...prev, label]
    );
  };

  const isActive = (path: string) => location.pathname === path;

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-sidebar-border shrink-0">
        <img src={logoDreampay} alt="DreamPay" className="h-7 w-7 rounded-lg" />
        <span className="text-[15px] font-bold tracking-tight">
          <span className="text-primary">Dream</span>
          <span className="text-foreground">Pay</span>
        </span>
      </div>

      {/* Balance card */}
      <div className="px-4 pt-5 pb-3">
        <div className="rounded-xl bg-secondary/50 border border-border/50 p-3.5">
          <div className="flex items-center gap-2 mb-1.5">
            <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Saldo</span>
          </div>
          <p className="text-lg font-bold text-foreground font-mono-value">
            R$ {(wallet?.balance ?? 0).toFixed(2).replace(".", ",")}
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-semibold px-3 mb-2">
          Menu
        </p>
        {navItems.map((item) => {
          if (item.children) {
            const isExpanded = expandedGroups.includes(item.label);
            const hasActiveChild = item.children.some((c) => "path" in c && isActive(c.path));
            return (
              <div key={item.label} className="mb-0.5">
                <button
                  onClick={() => toggleGroup(item.label)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
                    hasActiveChild
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                  }`}
                >
                  <item.icon className="h-4 w-4 opacity-70" />
                  <span className="flex-1 text-left">{item.label}</span>
                  <ChevronDown className={`h-3 w-3 opacity-40 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                </button>
                <div
                  className={`overflow-hidden transition-all duration-200 ${
                    isExpanded ? "max-h-40 opacity-100" : "max-h-0 opacity-0"
                  }`}
                >
                  <div className="ml-[22px] mt-0.5 space-y-0.5 border-l border-border/40 pl-3">
                    {item.children.map((child) => (
                      <Link
                        key={child.path}
                        to={child.path}
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[12px] transition-colors ${
                          isActive(child.path)
                            ? "bg-primary/10 text-primary font-semibold"
                            : "text-muted-foreground hover:text-foreground hover:bg-secondary/30"
                        }`}
                      >
                        <child.icon className="h-3.5 w-3.5 opacity-60" />
                        {child.label}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            );
          }

          return (
            <Link
              key={item.path}
              to={item.path!}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
                isActive(item.path!)
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
              }`}
            >
              <item.icon className="h-4 w-4 opacity-70" />
              {item.label}
            </Link>
          );
        })}

        {/* Admin section - only visible to admins */}
        {isAdmin && (
          <>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-semibold px-3 mt-4 mb-2">
              Admin
            </p>
            {adminItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
                  isActive(item.path)
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                }`}
              >
                <item.icon className="h-4 w-4 opacity-70" />
                {item.label}
              </Link>
            ))}
          </>
        )}
      </nav>

      {/* User & Sign out */}
      <div className="border-t border-sidebar-border px-4 py-3 space-y-2">
        {user && (
          <div className="flex items-center gap-2.5 px-1">
            <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-[11px] font-bold text-primary">
                {(user.email?.[0] ?? "U").toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-medium text-foreground truncate">{user.email}</p>
            </div>
          </div>
        )}
        <button
          onClick={signOut}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[12px] font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sair da conta
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-4 z-50 rounded-lg bg-card border border-border p-2 md:hidden"
      >
        <Menu className="h-4 w-4 text-foreground" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-[260px] bg-sidebar-background border-r border-sidebar-border shadow-2xl shadow-black/50">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-[240px] md:flex-col md:fixed md:inset-y-0 bg-sidebar-background border-r border-sidebar-border">
        {sidebarContent}
      </aside>
    </>
  );
};
