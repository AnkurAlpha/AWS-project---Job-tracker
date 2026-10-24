import { useRef } from "react";
import { useLocation } from "react-router-dom";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import Navbar from "./Navbar";
import { Toaster } from "sonner";
import ParticlesBackground from "./ParticlesBackground.jsx";

gsap.registerPlugin(useGSAP);

const Layout = ({ children }) => {
  const location = useLocation();
  const scope = useRef(null);

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      const tl = gsap.timeline({ defaults: { ease: "power2.out" } });
      tl.from(".route-anim-root > *", {
        opacity: 0,
        y: 16,
        duration: 0.42,
        stagger: 0.08,
        clearProps: "opacity,transform",
      }).from(
        ".route-anim-root .btn:not(.admin-create-submit-btn), .route-anim-root article",
        {
          opacity: 0,
          y: 10,
          duration: 0.28,
          stagger: 0.04,
          clearProps: "opacity,transform",
        },
        "-=0.2"
      );
    },
    { scope, dependencies: [location.pathname] }
  );

  return (
    <div className="app-shell min-h-screen text-slate-900">
      <ParticlesBackground />
      <div className="relative z-10">
        <Navbar />
      </div>
      <main className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-10 pt-8 sm:px-6 lg:px-8">
        <div ref={scope}>
          <div key={location.pathname} className="route-anim-root">
            {children}
          </div>
        </div>
      </main>
      <footer className="relative z-10 mt-8 border-t border-slate-200/70 bg-white/50 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-sm text-slate-600 sm:px-6 lg:px-8">
          <span>Job Application Tracker</span>
          <span className="text-xs uppercase tracking-[0.16em] text-slate-500">Built by AnkurAlpha</span>
        </div>
      </footer>
      <Toaster richColors position="top-right" offset={20} closeButton theme="light" />
    </div>
  );
};

export default Layout;
