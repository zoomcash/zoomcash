import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqItems = [
  {
    category: "Conta e Cadastro",
    questions: [
      {
        q: "Como criar uma conta na PixRaspadinha?",
        a: "Clique no botão \"Registro\" no topo da página, preencha seu e-mail, crie uma senha segura e confirme seu cadastro através do link enviado para seu e-mail.",
      },
      {
        q: "Preciso ter 18 anos para jogar?",
        a: "Sim, é obrigatório ter no mínimo 18 anos de idade para se cadastrar e utilizar a plataforma. Podemos solicitar documentação para verificação de idade a qualquer momento.",
      },
      {
        q: "Esqueci minha senha, como recuperar?",
        a: "Na tela de login, clique em \"Esqueci minha senha\". Enviaremos um link de recuperação para o e-mail cadastrado na sua conta.",
      },
      {
        q: "Posso ter mais de uma conta?",
        a: "Não. Cada pessoa pode ter apenas uma conta na plataforma. Contas duplicadas poderão ser suspensas.",
      },
    ],
  },
  {
    category: "Depósitos",
    questions: [
      {
        q: "Quais são os métodos de depósito disponíveis?",
        a: "Atualmente aceitamos depósitos exclusivamente via PIX, o método mais rápido e seguro disponível. O valor mínimo para depósito é de R$ 1,00.",
      },
      {
        q: "Quanto tempo leva para o depósito ser creditado?",
        a: "Os depósitos via PIX são processados em tempo real. Após a confirmação do pagamento pelo seu banco, o saldo é creditado automaticamente na sua carteira em poucos segundos.",
      },
      {
        q: "Meu depósito não foi creditado, o que fazer?",
        a: "Aguarde até 5 minutos para o processamento. Se o valor não for creditado, entre em contato com o suporte informando o comprovante de pagamento para resolvermos o mais rápido possível.",
      },
    ],
  },
  {
    category: "Saques",
    questions: [
      {
        q: "Qual o valor mínimo para saque?",
        a: "O valor mínimo para solicitar um saque é de R$ 20,00.",
      },
      {
        q: "Quanto tempo leva para receber meu saque?",
        a: "Os saques passam por uma análise de segurança e podem levar até 24 horas úteis para serem processados e enviados para sua chave PIX.",
      },
      {
        q: "Quais chaves PIX são aceitas para saque?",
        a: "Aceitamos todas as modalidades de chave PIX: CPF, número de celular, e-mail e chave aleatória (UUID).",
      },
      {
        q: "Por que meu saque foi recusado?",
        a: "Saques podem ser recusados por inconsistência de dados, suspeita de fraude ou chave PIX inválida. Verifique se os dados estão corretos e tente novamente.",
      },
    ],
  },
  {
    category: "Jogos",
    questions: [
      {
        q: "Os jogos são justos?",
        a: "Sim! Todos os resultados são determinados por algoritmos de geração aleatória certificados executados no servidor. Nem a plataforma nem o jogador podem manipular os resultados.",
      },
      {
        q: "Quais jogos estão disponíveis?",
        a: "Oferecemos uma variedade de jogos incluindo Raspadinhas temáticas (PIX, Eletrônicos, Cosméticos, Veículos), Crash, Slots e Fortune Tiger.",
      },
      {
        q: "Posso cancelar uma aposta depois de realizada?",
        a: "Não. Uma vez confirmada, a aposta não pode ser cancelada e o valor é imediatamente debitado do seu saldo.",
      },
      {
        q: "Existe um limite de aposta?",
        a: "Sim, cada jogo possui valores mínimos e máximos de aposta definidos. Os limites são exibidos na tela de cada jogo antes de você confirmar sua aposta.",
      },
    ],
  },
  {
    category: "Segurança",
    questions: [
      {
        q: "Meus dados estão seguros?",
        a: "Sim. Utilizamos criptografia de ponta a ponta, autenticação segura e seguimos as diretrizes da LGPD para proteger todos os seus dados pessoais e financeiros.",
      },
      {
        q: "Como posso proteger minha conta?",
        a: "Recomendamos: usar uma senha forte e única, não compartilhar seus dados de login, verificar se está acessando o site oficial e deslogar ao usar dispositivos compartilhados.",
      },
    ],
  },
  {
    category: "Jogo Responsável",
    questions: [
      {
        q: "O que é jogo responsável?",
        a: "Jogo responsável significa jogar de forma consciente e controlada, estabelecendo limites de tempo e dinheiro, e nunca apostar mais do que você pode perder.",
      },
      {
        q: "Como posso controlar meus gastos?",
        a: "Recomendamos definir um orçamento diário ou mensal antes de jogar. Nunca aposte dinheiro que você precisa para despesas essenciais. Se sentir que está perdendo o controle, procure ajuda.",
      },
      {
        q: "Posso solicitar o bloqueio da minha conta?",
        a: "Sim. Se você sentir necessidade de se afastar dos jogos, entre em contato com nosso suporte para solicitar o bloqueio temporário ou permanente da sua conta.",
      },
    ],
  },
];

const FAQ = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="container max-w-3xl py-10 px-4">
        <h1 className="text-3xl font-display font-bold text-primary mb-2">Perguntas Frequentes (FAQ)</h1>
        <p className="text-sm text-muted-foreground mb-6">Encontre respostas para as dúvidas mais comuns</p>
        <Separator className="mb-8" />

        <div className="space-y-8">
          {faqItems.map((section, idx) => (
            <div key={idx}>
              <h2 className="text-lg font-semibold text-foreground mb-3">{section.category}</h2>
              <Accordion type="single" collapsible className="w-full">
                {section.questions.map((item, qIdx) => (
                  <AccordionItem key={qIdx} value={`${idx}-${qIdx}`} className="border-border/50">
                    <AccordionTrigger className="text-sm text-left hover:no-underline hover:text-primary">
                      {item.q}
                    </AccordionTrigger>
                    <AccordionContent className="text-sm text-muted-foreground">
                      {item.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default FAQ;
