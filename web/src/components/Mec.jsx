import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { apiMec } from "../api.js";
import { BarraTopo } from "./Cabecalho.jsx";
import VisorPdf from "./VisorPdf.jsx";
import SeletorMes from "./SeletorMes.jsx";
import { useAutoAtualizacao } from "../hooks/useAutoAtualizacao.js";

// Relatórios > Mapa de Evolução de Cotas (todos os usuários).
//   #/relatorios/mec                        lista (cards por ano)
//   #/relatorios/mec/AAAA-MM[/mezanino]     o mês: abas Sub | Mezanino, relatório na tela (PDF ou HTML),
//                                           "Baixar PDF" e "Baixar Excel" da cota aberta
// Pasta de publicados: AAAA\MM\{Sub|Mezanino} (server/mec.js). Se a cota só tem HTML, o
// "Baixar PDF" abre a impressão da página ("Salvar como PDF").

const LONGOS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const CURTOS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const longo = (id) => `${LONGOS[Number(id.slice(5, 7)) - 1]} ${id.slice(0, 4)}`;
const curto = (id) => `${CURTOS[Number(id.slice(5, 7)) - 1]}/${id.slice(0, 4)}`;
const DOCS = [{ id: "sub", nome: "Sub" }, { id: "mezanino", nome: "Mezanino" }];
const qtdArquivos = (m) => DOCS.reduce((t, d) => t + (m.docs[d.id]?.pdf || m.docs[d.id]?.html ? 1 : 0) + (m.docs[d.id]?.excel ? 1 : 0), 0);

const daUrl = () => {
  const m = window.location.hash.match(/^#\/relatorios\/mec\/(\d{4}-\d{2})(?:\/(mezanino|sub))?/);
  return { mes: m?.[1] ?? null, doc: m?.[2] ?? "sub" };
};

export default function Mec({ aba, onAba, onVoltar }) {
  const [meses, setMeses] = useState(null);
  const [erro, setErro] = useState(null);
  const [meta, setMeta] = useState(null);
  const [url, setUrl] = useState(daUrl());
  const [ordem, setOrdem] = useState(() => {               // "recentes" | "antigas" (lembrado neste navegador)
    try { return localStorage.getItem("vox:mec-ordem") === "antigas" ? "antigas" : "recentes"; } catch { return "recentes"; }
  });
  const trocarOrdem = (o) => { setOrdem(o); try { localStorage.setItem("vox:mec-ordem", o); } catch { /* sem problema */ } };

  useEffect(() => {
    const aoMudar = () => setUrl(daUrl());
    window.addEventListener("hashchange", aoMudar);
    return () => window.removeEventListener("hashchange", aoMudar);
  }, []);

  const buscar = useCallback(async () => {
    try {
      const r = await apiMec.lista();
      setMeses(r.meses.map((m) => ({ id: m.id, docs: m.cotas })));
      setMeta(r.meta);
      setErro(null);
    } catch (e) {
      setErro(e.message);
      throw e;
    }
  }, []);
  const intervaloMs = (meta?.intervaloAtualizacaoMin || 10) * 60 * 1000;
  useAutoAtualizacao(buscar, { chave: "mec", intervaloMs, temDados: Boolean(meses) });

  const ir = (mes, doc = "sub", { rolar = true } = {}) => {
    window.location.hash = mes ? `#/relatorios/mec/${mes}${doc === "mezanino" ? "/mezanino" : ""}` : "#/relatorios/mec";
    setUrl({ mes, doc });
    if (rolar) window.scrollTo(0, 0);
  };

  if (url.mes) {
    return <Mes aba={aba} onAba={onAba} meses={meses} erro={erro} mes={url.mes} doc={url.doc}
      onIr={ir} onVoltar={() => ir(null)} />;
  }

  const ordenados = ordem === "antigas" ? [...(meses || [])].reverse() : meses || [];
  const anos = [];
  for (const m of ordenados) {
    const a = m.id.slice(0, 4);
    if (!anos.length || anos.at(-1)[0] !== a) anos.push([a, []]);
    anos.at(-1)[1].push(m);
  }

  return (
    <>
      <BarraTopo aba={aba} onAba={onAba} />
      <div className="pagina">
        <div className="cabeca-pagina">
          <div>
            <button type="button" className="botao-texto relatorio__voltar" onClick={onVoltar}>← Relatórios</button>
            <h1 className="page-title">Mapa de Evolução de Cotas</h1>
            <p className="page-sub">
              Evolução das cotas Sub e Mezanino do FIDC Vox
              {meses?.length ? ` — ${meses.length} ${meses.length === 1 ? "mês publicado" : "meses publicados"}` : ""}
            </p>
          </div>
          {meses?.length > 0 && (
            <div className="apr__lado">
              <p className="apr__ultima">Último mês: {curto(meses[0].id)}</p>
              <span className="contexto__seg apr__ordem" role="group" aria-label="Ordem dos meses">
                <button type="button" className={ordem === "recentes" ? "on" : undefined} aria-pressed={ordem === "recentes"}
                  onClick={() => trocarOrdem("recentes")}>Mais recentes</button>
                <button type="button" className={ordem === "antigas" ? "on" : undefined} aria-pressed={ordem === "antigas"}
                  onClick={() => trocarOrdem("antigas")}>Ordem de data</button>
              </span>
            </div>
          )}
        </div>

        {erro && !meses ? (
          <p className="vazio" role="status">{erro}</p>
        ) : !meses ? (
          <p className="vazio" role="status">Carregando…</p>
        ) : !meses.length ? (
          <p className="vazio">Nenhum MEC publicado ainda.</p>
        ) : anos.map(([ano, lista]) => (
          <section key={ano} className="apr__grupo" aria-label={`Meses de ${ano}`}>
            <h2 className="apr__ano">{ano} <span>{lista.length}</span></h2>
            <div className="apr__grade">
              {lista.map((m) => (
                <a key={m.id} href={`#/relatorios/mec/${m.id}`} className="apr__card"
                  onClick={(e) => { e.preventDefault(); ir(m.id); }}>
                  <span className="apr__corpo">
                    <span className="apr__doc" aria-hidden="true"><i /><i /><i /></span>
                    <span className="apr__nome">{longo(m.id)}</span>
                    <span className="apr__mes">{curto(m.id).toUpperCase()}</span>
                    <span className="bal__arqs">
                      {DOCS.map((d) => (
                        <span key={d.id} className="bal__arq">
                          {d.nome}
                          <span>
                            {(m.docs[d.id]?.pdf || m.docs[d.id]?.html) && <span className="bal__tag bal__tag--pdf">PDF</span>}
                            {m.docs[d.id]?.excel && <span className="bal__tag">Excel</span>}
                            {!m.docs[d.id]?.pdf && !m.docs[d.id]?.html && !m.docs[d.id]?.excel && <span className="bal__falta">—</span>}
                          </span>
                        </span>
                      ))}
                    </span>
                  </span>
                  <span className="apr__rodape">
                    <span className="apr__abrir">Abrir →</span>
                    <span>{qtdArquivos(m)} {qtdArquivos(m) === 1 ? "arquivo" : "arquivos"}</span>
                  </span>
                </a>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

// ------------------------------------------------------------------ o mês

function Mes({ aba, onAba, meses, erro, mes, doc, onIr, onVoltar }) {
  const [falha, setFalha] = useState(null);
  const item = meses?.find((m) => m.id === mes) || null;
  const arqs = item?.docs[doc] || {};
  const nomeDoc = DOCS.find((d) => d.id === doc)?.nome || "Sub";
  const visorHtml = useRef(null);
  const temPdf = Boolean(arqs.pdf || arqs.html);

  const baixar = async (formato) => {
    setFalha(null);
    if (formato === "pdf" && !arqs.pdf && arqs.html) {      // só HTML: imprime a página ("Salvar como PDF")
      if (!visorHtml.current?.imprimir()) setFalha("A página ainda está carregando. Tente de novo em instantes.");
      return;
    }
    const arq = arqs[formato];
    if (!arq) return;
    try { await apiMec.baixar(mes, doc, arq); } catch (e) { setFalha(e.message); }
  };

  return (
    <>
      <BarraTopo aba={aba} onAba={onAba} />
      <div className="pagina">
        <div className="cabeca-pagina apr__cabeca">
          <div>
            <button type="button" className="botao-texto relatorio__voltar" onClick={onVoltar}>← MEC</button>
            <h1 className="page-title">Mapa de Evolução de Cotas</h1>
            <p className="page-sub">FIDC Vox — {LONGOS[Number(mes.slice(5, 7)) - 1]} de {mes.slice(0, 4)}</p>
          </div>
          <div className="apr__acoes">
            <div className="apr__campo">
              <span>Mês</span>
              {(() => {
                const ids = (meses || []).map((x) => x.id).sort();
                const i = ids.indexOf(mes);
                const ant = i > 0 ? ids[i - 1] : null, prox = i >= 0 && i < ids.length - 1 ? ids[i + 1] : null;
                return (
                  <nav className="navegacao" aria-label="Escolher mês">
                    <button type="button" className="btn-icone" onClick={() => onIr(ant, doc)} disabled={!ant} aria-label="Mês anterior">‹</button>
                    <SeletorMes meses={ids} valor={mes} onChange={(m) => onIr(m, doc)} rotulo={longo} />
                    <button type="button" className="btn-icone" onClick={() => onIr(prox, doc)} disabled={!prox} aria-label="Próximo mês">›</button>
                  </nav>
                );
              })()}
            </div>
            <button type="button" className="button button--pequeno" onClick={() => baixar("pdf")} disabled={!temPdf}
              title={arqs.pdf ? arqs.pdf.nome : arqs.html ? "Abre a impressão: escolha “Salvar como PDF”" : `${nomeDoc} sem PDF neste mês`}>
              <span aria-hidden="true">↓</span> Baixar PDF
            </button>
            <button type="button" className="button button--pequeno" onClick={() => baixar("excel")} disabled={!arqs.excel}
              title={arqs.excel ? arqs.excel.nome : `${nomeDoc} sem Excel neste mês`}>
              <span aria-hidden="true">↓</span> Baixar Excel
            </button>
          </div>
        </div>

        {falha && <p className="aviso" role="alert">{falha}</p>}
        {erro && !meses ? (
          <p className="vazio" role="status">{erro}</p>
        ) : !meses ? (
          <p className="vazio" role="status">Carregando…</p>
        ) : !item ? (
          <p className="vazio">Não há MEC publicado para {longo(mes)}.</p>
        ) : (
          <>
            <div className="bal__barra">
              <nav className="bal__abas" aria-label="Documento">
                {DOCS.map((d) => (
                  <button key={d.id} type="button" className={`bal__aba${doc === d.id ? " bal__aba--ativa" : ""}`}
                    aria-pressed={doc === d.id} onClick={() => onIr(mes, d.id, { rolar: false })}>
                    {d.nome}
                  </button>
                ))}
              </nav>
            </div>
            {arqs.pdf ? (
              <VisorPdf key={`${mes}-${doc}-${arqs.pdf.publicadoEm}`} titulo={`MEC ${nomeDoc} — ${longo(mes)}`}
                carregar={() => apiMec.arquivo(mes, doc, arqs.pdf)} />
            ) : arqs.html ? (
              <VisorHtml ref={visorHtml} key={`${mes}-${doc}-${arqs.html.publicadoEm}`} titulo={`MEC ${nomeDoc} — ${longo(mes)}`}
                carregar={() => apiMec.arquivo(mes, doc, arqs.html)} />
            ) : arqs.excel ? (
              <p className="vazio bal__aviso">Este mês o MEC {nomeDoc} está só em Excel. Use “Baixar Excel”.</p>
            ) : (
              <p className="vazio bal__aviso">Não há MEC {nomeDoc} publicado para {longo(mes)}.</p>
            )}
          </>
        )}
      </div>
    </>
  );
}

// ------------------------------------------------------------------ relatório em HTML
// A página roda isolada (iframe sandbox, sem acesso ao site nem ao login). Para "Salvar como PDF",
// o site manda uma mensagem e a própria página chama window.print().
const PONTE = `<script>addEventListener("message",function(e){if(e.data==="argos:imprimir")window.print();});<\/script>`;
const VisorHtml = forwardRef(function VisorHtml({ carregar, titulo }, ref) {
  const carregarRef = useRef(carregar);
  const quadro = useRef(null);
  const [estado, setEstado] = useState({ html: null, erro: null });
  useImperativeHandle(ref, () => ({
    imprimir: () => {
      const w = quadro.current?.contentWindow;
      if (!w || !estado.html) return false;
      w.postMessage("argos:imprimir", "*");
      return true;
    },
  }), [estado.html]);
  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const blob = await carregarRef.current();
        let html = await blob.text();
        html = /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${PONTE}</body>`) : html + PONTE;
        if (!cancelado) setEstado({ html, erro: null });
      } catch (e) {
        if (!cancelado) setEstado({ html: null, erro: `Não foi possível carregar o relatório (${e.detalhe || e.message}).` });
      }
    })();
    return () => { cancelado = true; };
  }, []);
  if (estado.erro) return <p className="vazio bal__aviso" role="alert">{estado.erro}</p>;
  if (!estado.html) return <p className="vazio bal__aviso" role="status">Carregando o relatório…</p>;
  return (
    <div className="mec__visor">
      <iframe ref={quadro} title={titulo} className="mec__quadro" srcDoc={estado.html}
        sandbox="allow-scripts allow-modals" />
    </div>
  );
});
