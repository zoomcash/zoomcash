import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <footer className="border-t border-border bg-card py-6 mb-14 md:mb-0">
      <div className="container">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground text-[10px] font-bold">
              R$
            </div>
            <span className="text-sm font-bold">
              <span className="text-primary">Pix</span>
              <span className="text-foreground">Raspa</span>
            </span>
          </div>
          <div className="flex flex-wrap justify-center gap-4 text-xs text-muted-foreground">
            <Link to="/termos" className="hover:text-foreground transition-colors">Termos de Uso</Link>
            <Link to="/privacidade" className="hover:text-foreground transition-colors">Privacidade</Link>
            <Link to="/faq" className="hover:text-foreground transition-colors">Jogo Responsável</Link>
            <Link to="/faq" className="hover:text-foreground transition-colors">FAQ</Link>
          </div>
          <p className="text-[11px] text-muted-foreground/50">© 2024 PixRaspa</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
