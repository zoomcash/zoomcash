import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Separator } from "@/components/ui/separator";

const Terms = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="container max-w-3xl py-10 px-4">
        <h1 className="text-3xl font-display font-bold text-primary mb-2">Termos de Uso</h1>
        <p className="text-sm text-muted-foreground mb-6">Última atualização: 20 de fevereiro de 2026</p>
        <Separator className="mb-8" />

        <section className="space-y-6 text-sm leading-relaxed text-foreground/90">
          <div>
            <h2 className="text-lg font-semibold mb-2">1. Aceitação dos Termos</h2>
            <p>
              Ao acessar e utilizar a plataforma PixRaspadinha, você concorda com estes Termos de Uso em sua totalidade.
              Caso não concorde com qualquer disposição, não utilize nossos serviços. O uso continuado da plataforma
              constitui aceitação de quaisquer alterações feitas nestes termos.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-2">2. Elegibilidade</h2>
            <p>
              Para utilizar a PixRaspadinha, você deve ter no mínimo 18 (dezoito) anos de idade. Ao se registrar,
              você declara e garante que possui idade legal para participar de jogos de entretenimento online conforme
              as leis brasileiras vigentes. A plataforma reserva-se o direito de solicitar documentação comprobatória
              de idade a qualquer momento.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-2">3. Cadastro e Conta</h2>
            <p>
              Você é responsável por manter a confidencialidade das credenciais da sua conta. Todas as atividades
              realizadas sob sua conta são de sua responsabilidade. Notifique-nos imediatamente em caso de uso
              não autorizado. É proibido criar múltiplas contas ou utilizar dados falsos no cadastro.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-2">4. Depósitos e Saques</h2>
            <p>
              Os depósitos são realizados exclusivamente via PIX e creditados em sua carteira digital após confirmação
              do pagamento. Os saques estão sujeitos a análise e aprovação, podendo levar até 24 horas úteis para
              processamento. O valor mínimo para saque é de R$ 20,00. A plataforma pode solicitar verificação de
              identidade antes de processar saques.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-2">5. Jogos e Apostas</h2>
            <p>
              Os resultados dos jogos são determinados por algoritmos de geração aleatória certificados. Uma vez
              realizada, a aposta não pode ser cancelada. O valor apostado é imediatamente debitado do saldo
              da carteira. Os prêmios são creditados automaticamente após a conclusão do jogo. A plataforma
              reserva-se o direito de limitar valores de apostas.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-2">6. Condutas Proibidas</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>Utilizar bots, scripts ou qualquer forma de automação</li>
              <li>Explorar bugs ou falhas técnicas da plataforma</li>
              <li>Realizar lavagem de dinheiro ou atividades ilícitas</li>
              <li>Compartilhar ou vender sua conta a terceiros</li>
              <li>Tentar manipular resultados de jogos</li>
              <li>Utilizar VPN ou ferramentas para burlar restrições geográficas</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-2">7. Suspensão e Encerramento</h2>
            <p>
              A PixRaspadinha pode suspender ou encerrar sua conta a qualquer momento, sem aviso prévio, em caso de
              violação destes termos. Em caso de encerramento por violação, o saldo remanescente poderá ser retido
              para investigação.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-2">8. Limitação de Responsabilidade</h2>
            <p>
              A plataforma é fornecida "como está". Não nos responsabilizamos por perdas financeiras decorrentes
              do uso dos jogos, interrupções de serviço, falhas técnicas temporárias ou decisões de apostas
              realizadas pelo usuário.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-2">9. Propriedade Intelectual</h2>
            <p>
              Todo o conteúdo da plataforma, incluindo mas não se limitando a logotipos, design, textos,
              gráficos e software, é propriedade exclusiva da PixRaspadinha e protegido por leis de
              propriedade intelectual.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-2">10. Alterações nos Termos</h2>
            <p>
              Reservamo-nos o direito de alterar estes termos a qualquer momento. As alterações entram em vigor
              imediatamente após sua publicação. É responsabilidade do usuário revisar periodicamente os termos.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-2">11. Foro e Legislação</h2>
            <p>
              Estes termos são regidos pelas leis da República Federativa do Brasil. Para dirimir quaisquer
              controvérsias, fica eleito o foro da comarca do domicílio do usuário.
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Terms;
