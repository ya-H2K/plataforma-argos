import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { brl } from "../formato.js";

// Animações sutis do portal (14/10/2026). Quem usa "reduzir movimento" no sistema vê tudo sem animação.
export const semMovimento = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const suave = (p) => 1 - Math.pow(1 - p, 3);

// Valor em reais que conta até o número ao aparecer e, quando muda (atualização automática),
// desliza do valor antigo para o novo com uma piscada dourada discreta.
export function Valor({ valor, formato = brl, className, duracao = 700 }) {
  const numero = typeof valor === "number" && Number.isFinite(valor);
  const [mostrado, setMostrado] = useState(numero && !semMovimento() ? 0 : valor);
  const [piscar, setPiscar] = useState(0);
  const anterior = useRef(numero && !semMovimento() ? 0 : valor);
  const primeira = useRef(true);

  useEffect(() => {
    const de = anterior.current;
    const mudou = !primeira.current && de !== valor;
    primeira.current = false;
    if (!numero || typeof de !== "number" || semMovimento()) {
      anterior.current = valor; setMostrado(valor);
      return;
    }
    if (mudou) setPiscar((n) => n + 1);
    let quadro, t0;
    const passo = (t) => {
      t0 ??= t;
      const p = Math.min(1, (t - t0) / duracao);
      const v = de + (valor - de) * suave(p);
      anterior.current = v;
      setMostrado(p < 1 ? v : valor);
      if (p < 1) quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
  }, [valor, numero, duracao]);

  return (
    <span key={piscar} className={`${className || ""}${piscar ? " valor--atualizado" : ""}`}>
      {formato(numero && typeof mostrado === "number" ? mostrado : valor)}
    </span>
  );
}

// Sublinhado dourado das abas do topo: desliza da aba anterior para a nova.
// A barra do topo é montada de novo a cada tela, então a posição anterior fica guardada aqui.
let ultimaPosicao = null;
export function useSublinhado(navRef, ativa) {
  const [estilo, setEstilo] = useState({ opacity: 0 });
  useLayoutEffect(() => {
    const nav = navRef.current;
    const medir = () => {
      const a = nav?.querySelector(".aba--ativa");
      if (!a) return null;
      return { left: a.offsetLeft, width: a.offsetWidth, top: a.offsetTop + a.offsetHeight - 1 };
    };
    const alvo = medir();
    if (!alvo) { setEstilo({ opacity: 0 }); return; }
    if (ultimaPosicao && !semMovimento()) {
      setEstilo({ ...ultimaPosicao, transition: "none" });
      const q = requestAnimationFrame(() => requestAnimationFrame(() => setEstilo(alvo)));
      ultimaPosicao = alvo;
      return () => cancelAnimationFrame(q);
    }
    setEstilo(alvo);
    ultimaPosicao = alvo;
  }, [navRef, ativa]);
  useEffect(() => {
    const aoRedimensionar = () => {
      const a = navRef.current?.querySelector(".aba--ativa");
      if (!a) return;
      const p = { left: a.offsetLeft, width: a.offsetWidth, top: a.offsetTop + a.offsetHeight - 1, transition: "none" };
      ultimaPosicao = p; setEstilo(p);
    };
    window.addEventListener("resize", aoRedimensionar);
    return () => window.removeEventListener("resize", aoRedimensionar);
  }, [navRef]);
  return estilo;
}
