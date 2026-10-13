import { useEffect, useRef, useState } from "react";

// Abre/fecha um painel flutuante; fecha ao clicar fora ou com Esc.
export function usePopover() {
  const [aberto, setAberto] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e) => { if (ref.current && !ref.current.contains(e.target)) setAberto(false); };
    const esc = (e) => { if (e.key === "Escape") setAberto(false); };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", fora); document.removeEventListener("keydown", esc); };
  }, [aberto]);
  return { aberto, setAberto, ref };
}

const CURTOS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

// Seleção de mês compacta: um botão com o mês escolhido que abre um quadro pequeno com
// o ano (‹ 2026 ›) e os 12 meses. Meses sem dados ficam apagados.
export default function SeletorMes({ meses, valor, onChange, rotulo }) {
  const { aberto, setAberto, ref } = usePopover();
  const anos = [...new Set(meses.map((m) => m.slice(0, 4)))].sort();
  const [ano, setAno] = useState(valor?.slice(0, 4) || anos.at(-1));
  useEffect(() => { if (aberto && valor) setAno(valor.slice(0, 4)); }, [aberto, valor]);
  const iAno = anos.indexOf(ano);
  const disponiveis = new Set(meses);

  return (
    <div className="seletor-mes" ref={ref}>
      <button type="button" className="seletor-mes__botao" aria-haspopup="dialog" aria-expanded={aberto}
        onClick={() => setAberto((a) => !a)}>
        {valor ? rotulo(valor) : "Escolher mês"}<span className="seletor-mes__seta" aria-hidden="true" />
      </button>
      {aberto && (
        <div className="seletor-mes__painel" role="dialog" aria-label="Escolher mês">
          <div className="seletor-mes__ano">
            <button type="button" className="btn-icone" onClick={() => setAno(anos[iAno - 1])} disabled={iAno <= 0} aria-label="Ano anterior">‹</button>
            <span>{ano}</span>
            <button type="button" className="btn-icone" onClick={() => setAno(anos[iAno + 1])} disabled={iAno >= anos.length - 1} aria-label="Próximo ano">›</button>
          </div>
          <div className="seletor-mes__grade">
            {CURTOS.map((nome, i) => {
              const m = `${ano}-${String(i + 1).padStart(2, "0")}`;
              const tem = disponiveis.has(m);
              return (
                <button key={m} type="button" disabled={!tem}
                  className={m === valor ? "on" : undefined} aria-pressed={m === valor}
                  onClick={() => { onChange(m); setAberto(false); }}>{nome}</button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
