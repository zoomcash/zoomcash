import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";
import TransferPix from "./pages/TransferPix";
import InternalTransfer from "./pages/InternalTransfer";
import GatewayDeposit from "./pages/GatewayDeposit";
import Transactions from "./pages/Transactions";
import Affiliates from "./pages/Affiliates";
import Credentials from "./pages/Credentials";
import GatewaySettings from "./pages/GatewaySettings";
import Withdraw from "./pages/Withdraw";
import MerchantDashboard from "./pages/MerchantDashboard";
import GatewayClients from "./pages/GatewayClients";
import Admin from "./pages/Admin";
import Extrato from "./pages/Extrato";
import Docs from "./pages/Docs";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/transferir" element={<TransferPix />} />
            <Route path="/transferencia-interna" element={<InternalTransfer />} />
            <Route path="/depositar" element={<GatewayDeposit />} />
            <Route path="/transacoes" element={<Transactions />} />
            <Route path="/extrato" element={<Extrato />} />
            <Route path="/afiliados" element={<Affiliates />} />
            <Route path="/credenciais" element={<Credentials />} />
            <Route path="/configuracoes" element={<GatewaySettings />} />
            <Route path="/sacar" element={<Withdraw />} />
            <Route path="/merchant" element={<MerchantDashboard />} />
            <Route path="/clientes" element={<GatewayClients />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/docs" element={<Docs />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
