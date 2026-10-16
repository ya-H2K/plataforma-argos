import { useEffect, useRef, useState } from "react";
import { useSublinhado } from "./Animado.jsx";
import { ano, diaMes, diaSemana } from "../formato.js";
import { apiAdmin } from "../api.js";
import Ajustes from "./Ajustes.jsx";
import { useSessao } from "../sessao.js";
import { LogoH2, LogoVoxFidc, MarcaArgos } from "./Logos.jsx";

const hhmm = (d) => (d ? new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(d) : "");

const ABAS = [
  { id: "operacional", nome: "Report Operacional", href: "#/report" },
  { id: "caixa", nome: "Fluxo de Caixa", href: "#/caixa" },
  { id: "relatorios", nome: "Relatórios", href: "#/relatorios" },
  { id: "usuarios", nome: "Usuários", href: "#/usuarios", soAdmin: true },
];

// Admin: quantas solicitações de acesso/nova senha estão esperando (confere a cada minuto).
function usePendentes(ativo) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!ativo) return;
    const conferir = () => apiAdmin.pendentes().then((r) => setN(r.pendentes)).catch(() => {});
    conferir();
    const t = setInterval(conferir, 60 * 1000);
    window.addEventListener("vox:pendentes", conferir);
    return () => { clearInterval(t); window.removeEventListener("vox:pendentes", conferir); };
  }, [ativo]);
  return n;
}

// Animações do logo (styles.css, "animações do logo"):
// - entrada: só na primeira barra desde que a página abriu (F5, novo acesso ou logo depois do login);
//   a barra remonta a cada tela, por isso o aviso fica no módulo;
// - mouse em cima (ou foco): o olho cresce, pisca e o anel de pontos dá uma volta, sempre até o fim.
let entradaFeita = false;
function useAnimacaoMarca() {
  const [entrada, setEntrada] = useState(() => !entradaFeita);
  const [giro, setGiro] = useState(false);
  useEffect(() => {
    entradaFeita = true;
    if (!entrada) return;
    const t = setTimeout(() => setEntrada(false), 1600);
    return () => clearTimeout(t);
  }, [entrada]);
  const girar = () => { if (!entrada) setGiro(true); };
  const fim = (e) => { if (e.animationName === "ar-giro") setGiro(false); };
  const classe = `marca${entrada ? " marca--entrada" : ""}${giro ? " marca--giro" : ""}`;
  return { classe, girar, fim };
}

// Barra superior (Plataforma Argos): H2 Kapital + Argos, abas do site e, à direita, a navegação
// da aba aberta e a marca do Vox FIDC. No início (home) as abas e a marca do fundo não aparecem
// no topo: a marca do Vox FIDC fica em destaque no meio da página.
export function BarraTopo({ aba, onAba, children, semAbas = false }) {
  const { usuario } = useSessao();
  const abas = ABAS.filter((a) => !a.soAdmin || usuario?.admin);
  const pendentes = usePendentes(usuario?.admin);
  const navRef = useRef(null);
  const sublinhado = useSublinhado(navRef, semAbas ? null : aba);
  const animacao = useAnimacaoMarca();
  return (
    <header className="topbar">
      <div className="topbar__esquerda">
        <a className={animacao.classe} href="#/" title="Ir para o início"
          onMouseEnter={animacao.girar} onFocus={animacao.girar} onAnimationEnd={animacao.fim}
          onClick={(e) => { e.preventDefault(); onAba("home"); }}>
          <LogoH2 />
          <span className="marca__saida">
            <span className="marca__divisor" aria-hidden="true" />
            <MarcaArgos />
          </span>
        </a>
        {!semAbas && <nav className="abas" aria-label="Telas do site" ref={navRef}>
          {abas.map((a) => (
            <a key={a.id} href={a.href}
              className={`aba${aba === a.id ? " aba--ativa" : ""}`}
              aria-current={aba === a.id ? "page" : undefined}
              onClick={(e) => { e.preventDefault(); onAba(a.id); }}>
              {a.nome}
              {a.id === "usuarios" && pendentes > 0 && <span className="aba__contador" title="Solicitações pendentes">{pendentes}</span>}
            </a>
          ))}
          <span className="abas__sublinhado" style={sublinhado} aria-hidden="true" />
        </nav>}
      </div>
      <div className="topbar__direita">
        {children}
        <Ajustes />
        {!semAbas && <span className="topbar__fundo" title="Vox FIDC"><LogoVoxFidc /></span>}
      </div>
    </header>
  );
}

// Texto discreto de atualização + botão "Atualizar agora" (usado nas duas abas).
export function Sincronia({ ultima, proxima, atualizando, falhou, onAtualizar }) {
  if (!ultima && !atualizando && !falhou) return null;
  let info = null;
  if (atualizando) info = "Atualizando…";
  else if (falhou) info = "Não foi possível atualizar. Tentando de novo em instantes.";
  else info = <>Atualizado às {hhmm(ultima)}.<span className="sync__proxima"> Próxima às {hhmm(proxima)}.</span></>;
  return (
    <div className="sync" aria-live="polite">
      <span className={`sync__info${falhou ? " sync__info--falha" : ""}`}>{info}</span>
      <button type="button" className="sync__botao" onClick={onAtualizar} disabled={atualizando}>
        <span className={`sync__icone${atualizando ? " sync__icone--girando" : ""}`} aria-hidden="true">↻</span>
        Atualizar agora
      </button>
    </div>
  );
}

// Título, data e, à direita, o estado do dia com a atualização discreta embaixo.
export function CabecaPagina({ dia, selecionada, ultima, proxima, atualizando, falhou, onAtualizar }) {
  if (!selecionada) return null;
  return (
    <div className="cabeca-pagina">
      <div>
        <h1 className="page-title">Report Operacional</h1>
        <p className="page-sub">{diaSemana(selecionada)}, {diaMes(selecionada)} de {ano(selecionada)}</p>
      </div>
      <div className="cabeca-pagina__direita">
        {dia?.situacao && (
          <span className={`estado estado--${dia.situacao.estado}`}
            title={dia.situacao.pendencias.length ? `Pendente: ${dia.situacao.pendencias.join(", ")}` : "Liquidações e baixas conciliadas concluídas"}>
            <span className="ponto" aria-hidden="true" />
            {dia.situacao.rotulo}
          </span>
        )}
        {dia?.situacao?.estado === "encerrado" && (
          <span className="estado__pendencias">Pendente: {dia.situacao.pendencias.join(", ")}</span>
        )}
        <Sincronia ultima={ultima} proxima={proxima} atualizando={atualizando} falhou={falhou} onAtualizar={onAtualizar} />
      </div>
    </div>
  );
}
