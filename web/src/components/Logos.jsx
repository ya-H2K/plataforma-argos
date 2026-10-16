import { useEffect } from "react";
import logoH2 from "../assets/h2-kapital.svg";

// Logo da H2 Kapital: arte original (dourado e branco), vetorizada para ficar nítida em qualquer tela.
export function LogoH2({ className = "" }) {
  return <img className={`logo-h2 ${className}`} src={logoH2} alt="H2 Kapital" width="135" height="146" />;
}

// Desenho das letras VOX (só o contorno), na cor do texto do portal.
export const VOX_PATH = "M2.10 2.00 L10.60 2.00 L22.50 28.40 L35.20 2.00 L43.60 2.00 L25.40 38.10 L19.60 38.10 Z M44.20 19.90 a21.6 18.0 0 1 0 43.2 0 a21.6 18.0 0 1 0 -43.2 0 Z M52.00 19.90 a13.9 10.9 0 1 0 27.8 0 a13.9 10.9 0 1 0 -27.8 0 Z M88.50 2.00 L97.50 2.00 L107.00 14.20 L116.50 2.00 L125.50 2.00 L111.50 19.95 L125.70 38.10 L116.70 38.10 L107.00 25.80 L97.30 38.10 L88.30 38.10 L102.50 19.95 Z";

export function LogoVox({ className = "" }) {
  return (
    <svg className={`logo-vox ${className}`} viewBox="1.2 1.2 125.2 37.6" role="img" aria-label="Vox">
      <path d={VOX_PATH} fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="miter" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// Marca do fundo (Plataforma Argos, 15/10/2026, "variação C"): VOX em contorno e, embaixo,
// FIDC em dourado entre dois fios que fecham a largura do VOX. O tamanho vem da altura (CSS).
export function LogoVoxFidc({ className = "" }) {
  return (
    <svg className={`logo-vox-fidc ${className}`} viewBox="1.2 1.2 125.2 56" role="img" aria-label="Vox FIDC">
      <path d={VOX_PATH} fill="none" stroke="currentColor" strokeWidth="1.3" vectorEffect="non-scaling-stroke" />
      <g className="logo-vox-fidc__fidc">
        <line x1="2" y1="51.4" x2="37" y2="51.4" stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        <line x1="90.6" y1="51.4" x2="125.6" y2="51.4" stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        <text x="65.8" y="56" textAnchor="middle" fill="currentColor" fontFamily="'Segoe UI', system-ui, sans-serif"
          fontWeight="600" fontSize="13" letterSpacing="4">FIDC</text>
      </g>
    </svg>
  );
}

// Símbolo do Argos: o olho (o vigia de cem olhos) com um anel de pontos em volta.
// Peças separadas para as animações (styles.css, "animações do logo"): o anel de pontos gira
// (.olho-argos__pontos), o olho pisca (.olho-argos__olho), e na abertura o contorno e a íris se
// desenham (pathLength=1) e cada ponto acende na sua vez (--i).
const PONTOS = Array.from({ length: 12 }, (_, i) => [24 + 21 * Math.cos((i * Math.PI) / 6), 24 + 21 * Math.sin((i * Math.PI) / 6)]);
export function OlhoArgos({ className = "", pontos = true }) {
  return (
    <svg className={`olho-argos ${className}`} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      {pontos && (
        <g className="olho-argos__pontos">
          {PONTOS.map(([x, y], i) => <circle key={i} style={{ "--i": i }} cx={x.toFixed(2)} cy={y.toFixed(2)} r="1.1" fill="currentColor" opacity=".55" />)}
        </g>
      )}
      <g className="olho-argos__olho">
        <path className="olho-argos__contorno" pathLength="1" d="M7 24 C13 15 19 12 24 12 C29 12 35 15 41 24 C35 33 29 36 24 36 C19 36 13 33 7 24 Z" stroke="currentColor" strokeWidth="1.8" />
        <circle className="olho-argos__iris" pathLength="1" cx="24" cy="24" r="6.5" stroke="currentColor" strokeWidth="1.8" />
        <circle className="olho-argos__pupila" cx="24" cy="24" r="2.6" fill="currentColor" />
      </g>
    </svg>
  );
}

// Abertura depois do login: tela cheia só com o olho, como um carregamento rápido (≈1,9 s).
// Chama onFim quando termina (na hora, para quem pediu "reduzir movimento" no computador).
export function AberturaArgos({ onFim }) {
  useEffect(() => {
    const semMovimento = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const t = setTimeout(onFim, semMovimento ? 0 : 2100);
    return () => clearTimeout(t);
  }, [onFim]);
  return <div className="abertura-argos" aria-hidden="true"><OlhoArgos /></div>;
}

// Marca da plataforma: olho + ARGOS em dourado, espaçado.
export function MarcaArgos({ className = "" }) {
  return (
    <span className={`marca-argos ${className}`}>
      <OlhoArgos />
      <span className="marca-argos__nome">Argos</span>
    </span>
  );
}
