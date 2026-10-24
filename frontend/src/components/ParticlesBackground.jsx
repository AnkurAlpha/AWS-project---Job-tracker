import { useEffect, useMemo, useState } from "react";
import Particles, { initParticlesEngine } from "@tsparticles/react";
import { loadSlim } from "@tsparticles/slim";
import { useTheme } from "../theme/useTheme.js";

export default function ParticlesBackground() {
  const { isDark } = useTheme();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initParticlesEngine(async (engine) => {
      await loadSlim(engine);
    }).then(() => setReady(true));
  }, []);

  const options = useMemo(
    () => ({
      fullScreen: { enable: false },
      fpsLimit: 60,
      detectRetina: true,
      particles: {
        number: {
          value: isDark ? 72 : 84,
          density: { enable: true, area: 900 },
        },
        color: { value: isDark ? "#5eead4" : "#0d9488" },
        links: {
          enable: true,
          distance: 138,
          color: isDark ? "#475569" : "#94a3b8",
          opacity: isDark ? 0.35 : 0.27,
          width: 1,
        },
        move: {
          enable: true,
          speed: isDark ? 0.55 : 0.5,
          outModes: { default: "out" },
        },
        opacity: {
          value: isDark ? 0.36 : 0.28,
        },
        size: {
          value: { min: 1.1, max: 3.2 },
        },
      },
      interactivity: {
        detectsOn: "window",
        events: {
          onClick: { enable: true, mode: "repulse" },
          onHover: { enable: true, mode: "grab" },
          resize: { enable: true },
        },
        modes: {
          repulse: {
            distance: 165,
            duration: 0.6,
          },
          grab: {
            distance: 162,
            links: { opacity: isDark ? 0.45 : 0.36 },
          },
        },
      },
      pauseOnBlur: true,
      background: {
        opacity: 0,
      },
    }),
    [isDark]
  );

  if (!ready) return null;

  return (
    <div className="particles-layer" aria-hidden="true">
      <Particles id="app-particles" options={options} />
    </div>
  );
}
