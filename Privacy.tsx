import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Separator } from "@/components/ui/separator";

const Privacy = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="container max-w-3xl py-10 px-4">
        <h1 className="text-3xl font-display font-bold text-primary mb-2">Política de Privacidade</h1>
        <p className="text-sm text-muted-foreground mb-6">Última atualização: 20 de fevereiro de 2026</p>
        <Separator className="mb-8" />

        <section className="space-y-6 text-sm leading-relaxed text-foreground/90">
          <div>
            <h2 className="text-lg font-semibold mb-2">1. Dados que Coletamos</h2>
            <p>Coletamos as seguintes categorias de informações:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li><strong>Dados de cadastro:</strong> nome, e-mail, CPF, data de nascimento</li>
              <li><strong>Dados financeiros:</strong> chaves PIX utilizadas para depósitos e saques</li>
              <li><strong>Dados de uso:</strong> histórico de jogos, apostas, transações e acessos</li>
              <li><strong>Dados técnicos:</strong> endereço IP, tipo de dispositivo, navegador e sistema operacional</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-2">2. Como Utilizamos seus Dados</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>Fornecer e manter nossos serviços</li>
              <li>Processar transações financeiras (depósitos e saques)</li>
              <li>Verificar identidade e prevenir fraudes</li>
              <li>Personalizar sua experiência na plataforma</li>
              <li>Enviar comunicações sobre sua conta e promoções (com seu consentimento)</li>
              <li>Cumprir obrigações legais e regulatórias</li>
              <li>Melhorar a segurança e desempenho da plataforma</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-2">3. Base Legal para Tratamento</h2>
            <p>
              O tratamento dos seus dados pessoais é realizado com base na Lei Geral de Proteção de Dados (LGPD – Lei nº 13.709/2018),
              fundamentado nas seguintes bases legais: consentimento do titular, execução de contrato, cumprimento de
              obrigação legal e legítimo interesse.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-2">4. Compartilhamento de Dados</h2>
            <p>Seus dados podem ser compartilhados com:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li><strong>Processadores de pagamento:</strong> para efetuar transações via PIX</li>
              <li><strong>Autoridades competentes:</strong> quando exigido por lei ou ordem judicial</li>
              <li><strong>Prestadores de serviço:</strong> que auxiliam na operação da plataforma (hospedagem, segurança)</li>
            </ul>
            <p className="mt-2">Nunca vendemos seus dados pessoais a terceiros.</p>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-2">5. Segurança dos Dados</h2>
            <p>
              Empregamos medidas técnicas e organizacionais adequadas para proteger seus dados, incluindo:
              criptografia em trânsito e em repouso, controle de acesso baseado em funções, monitoramento
              contínuo de segurança e backups regulares.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-2">6. Retenção de Dados</h2>
            <p>
              Seus dados são mantidos enquanto sua conta estiver ativa e pelo período necessário para cumprir
              obrigações legais, resolver disputas e fazer cumprir nossos acordos. Dados financeiros são
              retidos por no mínimo 5 anos conforme legislação aplicável.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-2">7. Seus Direitos (LGPD)</h2>
            <p>Você tem o direito de:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Confirmar a existência de tratamento de dados</li>
              <li>Acessar seus dados pessoais</li>
              <li>Solicitar correção de dados incompletos ou desatualizados</li>
              <li>Solicitar anonimização, bloqueio ou eliminação de dados desnecessários</li>
              <li>Solicitar portabilidade dos dados</li>
              <li>Revogar consentimento a qualquer momento</li>
              <li>Solicitar informações sobre compartilhamento com terceiros</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-2">8. Cookies</h2>
            <p>
              Utilizamos cookies essenciais para o funcionamento da plataforma e cookies analíticos para
              melhorar nossos serviços. Você pode gerenciar as preferências de cookies através das
              configurações do seu navegador.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-2">9. Menores de Idade</h2>
            <p>
              Nossos serviços não são destinados a menores de 18 anos. Não coletamos intencionalmente dados
              de menores. Se tomarmos conhecimento de que dados de um menor foram coletados, tomaremos
              medidas para excluí-los imediatamente.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-2">10. Contato</h2>
            <p>
              Para exercer seus direitos ou esclarecer dúvidas sobre esta política, entre em contato
              conosco através do e-mail: <span className="text-primary font-medium">privacidade@pixraspadinha.com</span>
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Privacy;
