import Navbar from "@/components/Navbar";
import HeroBanner from "@/components/HeroBanner";
import LiveWins from "@/components/LiveWins";
import ScratchCardGrid from "@/components/ScratchCardGrid";
import PromoBanner from "@/components/PromoBanner";
import Footer from "@/components/Footer";
import BottomNav from "@/components/BottomNav";

const Index = () => {
  return (
    <div className="min-h-screen bg-background pb-16 md:pb-0">
      <Navbar />
      <HeroBanner />
      <LiveWins />
      <ScratchCardGrid />
      <PromoBanner />
      <Footer />
      <BottomNav />
    </div>
  );
};

export default Index;
