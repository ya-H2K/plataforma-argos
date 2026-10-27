import { useCallback, useEffect, useMemo, useState } from "react";
import { apiRelatorios } from "../api.js";
import { BarraTopo } from "./Cabecalho.jsx";
import Despesas from "./Despesas.jsx";
import Apresentacoes from "./Apresentacoes.jsx";
import Balancetes from "./Balancetes.jsx";
import Carteira from "./Carteira.jsx";
import ResumoBaixas from "./ResumoBaixas.jsx";
import { useSessao } from "../sessao.js";
import { useAutoAtualizacao } from "../hooks/useAutoAtualizacao.js";
import { brl, curta, valorNum } from "../formato.js";
import SeletorMes from "./SeletorMes.jsx";

// Aba "Relatórios" (só o admin vê, por enquanto): lista de relatórios e cada relatório.
// #/relatorios = lista; #/relatorios/desagio = Deságio das cessões de URFA.

export const RELATORIOS = [
  { id: "desagio", nome: "Deságio", descricao: "Deságio das aquisições." },
  { id: "despesas", nome: "Despesas", descricao: "Detalhamento das despesas mensais." },
  { id: "apresentacoes", nome: "Apresentação de Resultados", descricao: "Apresentações mensais do fundo." },
  { id: "balancetes", nome: "Balancete", descricao: "Balancete e razão de cada mês." },
  { id: "laminas", nome: "Lâmina", descricao: "Lâminas mensais do fundo." },
  { id: "flash", nome: "Flash Report", descricao: "Flash Reports mensais do fundo." },
  // restrito: só o admin e os e-mails abaixo veem o card. Quem garante de verdade é o banco
  // (tabela relatorio_acesso, chave "restrito:carteira"); manter as duas listas iguais.
  { id: "carteira", nome: "Carteira em Dia", descricao: "Valor presente a vencer do estoque, dia a dia.",
    emails: ["lucas.ramao@voxcred.com.br"] },
  // Resumo de Baixas: por enquanto só o admin (tabela relatorio_acesso, relatorio = 'baixas', vazia).
  { id: "baixas", nome: "Resumo de Baixas", descricao: "Baixas importadas no dia, por tipo de baixa.",
    emails: [] },
];
// Relatórios que a pessoa logada pode abrir.
export const relatoriosDe = (usuario) => RELATORIOS.filter((r) =>
  !r.emails || usuario?.admin || r.emails.includes(String(usuario?.email || "").toLowerCase()));
// Na tela, em ordem alfabética (ignorando acentos e maiúsculas).
RELATORIOS.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }));

const subDaUrl = () => window.location.hash.match(/^#\/relatorios\/([\w-]+)/)?.[1] ?? null;

export default function Relatorios({ aba, onAba }) {
  const { usuario } = useSessao();
  const lista = relatoriosDe(usuario);
  const [sub, setSub] = useState(subDaUrl());
  useEffect(() => {
    const aoMudar = () => setSub(subDaUrl());
    window.addEventListener("hashchange", aoMudar);
    return () => window.removeEventListener("hashchange", aoMudar);
  }, []);
  const abrir = (id) => { window.location.hash = id ? `#/relatorios/${id}` : "#/relatorios"; setSub(id); window.scrollTo(0, 0); };

  const restritos = lista.filter((r) => r.emails);
  const doFundo = lista.filter((r) => !r.emails);
  // relatório restrito volta para a aba "Restritos"; os demais, para a lista do fundo
  const voltar = (id) => () => abrir(RELATORIOS.find((r) => r.id === id)?.emails ? "restritos" : null);

  if (sub === "carteira" && lista.some((r) => r.id === "carteira")) return <Carteira aba={aba} onAba={onAba} onVoltar={voltar("carteira")} />;
  if (sub === "baixas" && lista.some((r) => r.id === "baixas")) return <ResumoBaixas aba={aba} onAba={onAba} onVoltar={voltar("baixas")} />;
  if (sub === "desagio") return <Desagio aba={aba} onAba={onAba} onVoltar={voltar("desagio")} />;
  if (sub === "balancetes") return <Balancetes aba={aba} onAba={onAba} onVoltar={voltar("balancetes")} />;
  if (sub === "laminas") return <Apresentacoes key="laminas" tipo="laminas" aba={aba} onAba={onAba} onVoltar={voltar("laminas")} />;
  if (sub === "flash") return <Apresentacoes key="flash" tipo="flash" aba={aba} onAba={onAba} onVoltar={voltar("flash")} />;
  if (sub === "apresentacoes") return <Apresentacoes aba={aba} onAba={onAba} onVoltar={voltar("apresentacoes")} />;
  if (sub === "despesas") return <Despesas aba={aba} onAba={onAba} onVoltar={voltar("despesas")} />;

  // Duas abas: "Relatórios do fundo" (todos) e "Restritos" (#/relatorios/restritos), que só aparece
  // para quem tem algum relatório restrito liberado. Só o admin vê, em cada card, quem tem acesso.
  const naRestritos = sub === "restritos" && restritos.length > 0;
  const mostrados = naRestritos ? restritos : doFundo;
  return (
    <>
      <BarraTopo aba={aba} onAba={onAba} />
      <div className="pagina">
        <div className="cabeca-pagina">
          <div>
            <h1 className="page-title">Relatórios</h1>
            <p className="page-sub">Relatórios do FIDC Vox.</p>
          </div>
        </div>
        {restritos.length > 0 && (
          <nav className="abas-relatorios" aria-label="Grupos de relatórios">
            <button type="button" className={naRestritos ? undefined : "on"} aria-pressed={!naRestritos} onClick={() => abrir(null)}>
              Relatórios do fundo
            </button>
            <button type="button" className={naRestritos ? "on" : undefined} aria-pressed={naRestritos} onClick={() => abrir("restritos")}>
              <svg className="abas-relatorios__cadeado" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
                <rect x="3" y="7" width="10" height="7" rx="1" /><path d="M5 7V5a3 3 0 0 1 6 0v2" />
              </svg>
              Restritos{usuario?.admin && <span className="abas-relatorios__qtd">{restritos.length}</span>}
            </button>
          </nav>
        )}
        {naRestritos && (
          <p className="restritos-nota">
            {usuario?.admin
              ? "Relatórios liberados só para pessoas específicas. Cada pessoa vê apenas os que foram liberados para ela."
              : "Relatórios liberados para você."}
          </p>
        )}
        <div className="grade grade--3">
          {mostrados.map((r) => (
            <a key={r.id} href={`#/relatorios/${r.id}`} className="card relatorio-item"
              onClick={(e) => { e.preventDefault(); abrir(r.id); }}>
              <span className="relatorio-item__nome">{r.nome}</span>
              <span className="relatorio-item__desc">{r.descricao}</span>
              {r.emails && usuario?.admin && (
                <span className="relatorio-item__acesso">
                  Quem vê: <b>você (admin)</b>{r.emails.map((e) => <b key={e}>{e}</b>)}
                </span>
              )}
              <span className="relatorio-item__abrir" aria-hidden="true">Abrir →</span>
            </a>
          ))}
        </div>
      </div>
    </>
  );
}

// ------------------------------------------------------------------ Deságio

const NOMES_MES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const rotuloMes = (id) => `${NOMES_MES[Number(id.slice(5, 7)) - 1]} ${id.slice(0, 4)}`;
const dataBr = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const ultimoDia = (mes) => {
  const [a, m] = mes.split("-").map(Number);
  return `${mes}-${String(new Date(Date.UTC(a, m, 0)).getUTCDate()).padStart(2, "0")}`;
};
// deságio em % com 4 casas (os valores ficam perto de 0,2%)
const pct4 = new Intl.NumberFormat("pt-BR", { style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pctD = (v) => (v == null || !Number.isFinite(v) ? "—" : pct4.format(v));

function totais(linhas) {
  const nominal = linhas.reduce((t, l) => t + l.nominal, 0);
  const pago = linhas.reduce((t, l) => t + l.pago, 0);
  return { nominal, pago, valor: nominal - pago, taxa: nominal ? (nominal - pago) / nominal : null, qtd: linhas.length };
}

// CSV no padrão do Excel em português: ";" entre colunas, vírgula decimal, com BOM (acentos).
function baixarCsv(linhas, nomeArquivo) {
  const n = (v, casas = 2) => (v == null ? "" : v.toFixed(casas).replace(".", ","));
  const esc = (s) => (/[;"\n]/.test(s) ? `"${String(s).replace(/"/g, '""')}"` : s);
  const cab = ["Data", "Nome Arquivo", "Remessa", "Tipo", "Valor Nominal", "Valor Pago", "Deságio (R$)", "Deságio (%)"];
  const corpo = linhas.map((l) => [dataBr(l.data), esc(l.arquivo), l.remessa, esc(l.tipo), n(l.nominal), n(l.pago),
    n(l.nominal - l.pago), n(l.desagio * 100, 4)].join(";"));
  const blob = new Blob(["﻿" + [cab.join(";"), ...corpo].join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Desagio({ aba, onAba, onVoltar }) {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(null);
  const [modo, setModo] = useState("mes");            // "mes" | "periodo"
  const [mes, setMes] = useState(null);
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [meta, setMeta] = useState(null);

  const buscar = useCallback(async () => {
    try {
      const r = await apiRelatorios.desagio();
      setDados(r);
      setMeta(r.meta);
      setErro(null);
      setMes((m) => m ?? r.hoje.slice(0, 7));          // padrão: mês atual
    } catch (e) {
      setErro(e.message);
      throw e;
    }
  }, []);
  const intervaloMs = (meta?.intervaloAtualizacaoMin || 10) * 60 * 1000;
  useAutoAtualizacao(buscar, { chave: "desagio", intervaloMs, temDados: Boolean(dados) });

  // meses com remessa + o mês atual, em ordem
  const meses = useMemo(() => {
    if (!dados) return [];
    return [...new Set([...dados.linhas.map((l) => l.data.slice(0, 7)), dados.hoje.slice(0, 7)])].sort();
  }, [dados]);
  const i = meses.indexOf(mes);
  const anterior = i > 0 ? meses[i - 1] : null;
  const proximo = i >= 0 && i < meses.length - 1 ? meses[i + 1] : null;

  const [ini, fim] = modo === "mes"
    ? (mes ? [`${mes}-01`, ultimoDia(mes)] : ["", ""])
    : [de || "0000-01-01", ate || "9999-12-31"];
  const periodoInvalido = modo === "periodo" && de && ate && de > ate;
  const linhas = useMemo(() => (dados?.linhas || []).filter((l) => l.data >= ini && l.data <= fim), [dados, ini, fim]);

  const descricao = modo === "mes"
    ? (mes ? rotuloMes(mes) : "")
    : de && ate ? `De ${dataBr(de)} a ${dataBr(ate)}` : de ? `A partir de ${dataBr(de)}` : ate ? `Até ${dataBr(ate)}` : "Todo o histórico";
  const nomeCsv = modo === "mes" ? `desagio_${mes}.csv` : `desagio_${de || "inicio"}_a_${ate || "hoje"}.csv`;

  // ao trocar para "Período", começa com o mês que estava aberto
  const irParaPeriodo = () => {
    if (modo === "periodo") return;
    if (!de && !ate && mes) { setDe(`${mes}-01`); setAte(ultimoDia(mes)); }
    setModo("periodo");
  };

  return (
    <>
      <BarraTopo aba={aba} onAba={onAba} />
      <div className="pagina pagina--larga">
        <div className="cabeca-pagina">
          <div>
            <button type="button" className="botao-texto relatorio__voltar" onClick={onVoltar}>← Relatórios</button>
            <h1 className="page-title">Deságio</h1>
            <p className="page-sub">Cessões de URFA · {descricao}</p>
          </div>
          <div className="cabeca-pagina__direita filtro-relatorio">
            <nav className="navegacao" aria-label="Escolher período">
              <span className="contexto__seg" role="group" aria-label="Tipo de filtro">
                <button type="button" className={modo === "mes" ? "on" : undefined} aria-pressed={modo === "mes"} onClick={() => setModo("mes")}>Mês</button>
                <button type="button" className={modo === "periodo" ? "on" : undefined} aria-pressed={modo === "periodo"} onClick={irParaPeriodo}>Período</button>
              </span>
              {modo === "mes" ? (
                <>
                  <button type="button" className="btn-icone" onClick={() => setMes(anterior)} disabled={!anterior} aria-label="Mês anterior">‹</button>
                  <SeletorMes meses={meses} valor={mes} onChange={setMes} rotulo={rotuloMes} />
                  <button type="button" className="btn-icone" onClick={() => setMes(proximo)} disabled={!proximo} aria-label="Próximo mês">›</button>
                </>
              ) : (
                <>
                  <input type="date" value={de} onChange={(e) => setDe(e.target.value)} aria-label="De" max={ate || undefined} />
                  <span className="periodo__ate">até</span>
                  <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} aria-label="Até" min={de || undefined} />
                </>
              )}
            </nav>
            <button type="button" className="button button--pequeno publicacao__baixar"
              disabled={!linhas.length || periodoInvalido} onClick={() => baixarCsv(linhas, nomeCsv)}>
              <span aria-hidden="true">↓</span> Baixar CSV
            </button>
          </div>
        </div>

        {erro && !dados ? (
          <p className="vazio" role="status">{erro}</p>
        ) : !dados ? (
          <p className="vazio" role="status">Carregando…</p>
        ) : periodoInvalido ? (
          <p className="vazio">A data inicial é depois da data final.</p>
        ) : (
          <Extrato linhas={linhas} />
        )}
      </div>
    </>
  );
}

// ------------------------------------------------------------------ extrato

// Um quadro só: resumo do período em uma linha de texto no topo e a lista das remessas.
// Com mais de um mês no filtro, as remessas vêm agrupadas por mês, com o subtotal na linha do mês.
function Extrato({ linhas }) {
  const t = totais(linhas);
  const grupos = useMemo(() => {
    const m = new Map();
    for (const l of linhas) {
      const k = l.data.slice(0, 7);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(l);
    }
    return [...m.entries()];
  }, [linhas]);
  const agrupar = grupos.length > 1;

  return (
    <section className="card extrato" aria-label="Deságio das remessas">
      <dl className="extrato__topo">
        <Numero rotulo={t.qtd === 1 ? "Aquisição" : "Aquisições"} valor={t.qtd} />
        <Numero rotulo="Valor nominal" valor={brl(t.nominal)} />
        <Numero rotulo="Valor pago" valor={brl(t.pago)} />
        <Numero rotulo="Deságio (R$)" valor={brl(t.valor)} />
        <Numero rotulo="Deságio (%)" valor={pctD(t.taxa)} destaque />
      </dl>
      {!t.qtd && <p className="vazio extrato__vazio">Nenhuma aquisição de URFA neste período.</p>}

      {t.qtd > 0 && (
        <div className="tabela-rolagem" tabIndex={0} role="region" aria-label="Remessas de URFA, role para o lado">
          <table className="caixa-tabela tabela-desagio">
            <thead>
              <tr>
                <th scope="col">Data</th>
                <th scope="col" className="num">Remessa</th>
                <th scope="col">Arquivo</th>
                <th scope="col" className="num">Valor nominal</th>
                <th scope="col" className="num">Valor pago</th>
                <th scope="col" className="num">Deságio (R$)</th>
                <th scope="col" className="num">Deságio (%)</th>
              </tr>
            </thead>
            {grupos.map(([mes, itens]) => {
              const s = totais(itens);
              return (
                <tbody key={mes}>
                  {agrupar && (
                    <tr className="tabela-desagio__mes">
                      <th scope="rowgroup" colSpan={2}>{rotuloMes(mes)} <span>· {s.qtd} {s.qtd === 1 ? "aquisição" : "aquisições"}</span></th>
                      <td className="tabela-desagio__arquivo" />
                      <td className="num">{valorNum(s.nominal)}</td>
                      <td className="num">{valorNum(s.pago)}</td>
                      <td className="num">{valorNum(s.valor)}</td>
                      <td className="num tabela-desagio__pct">{pctD(s.taxa)}</td>
                    </tr>
                  )}
                  {itens.map((l, k) => (
                    <tr key={`${l.remessa}-${k}`}>
                      <th scope="row">{dataBr(l.data)}</th>
                      <td className="num">{l.remessa}</td>
                      <td className="tabela-desagio__arquivo">{l.arquivo}</td>
                      <td className="num">{valorNum(l.nominal)}</td>
                      <td className="num">{valorNum(l.pago)}</td>
                      <td className="num">{valorNum(l.nominal - l.pago)}</td>
                      <td className="num tabela-desagio__pct">{pctD(l.desagio)}</td>
                    </tr>
                  ))}
                </tbody>
              );
            })}
            <tfoot>
              <tr>
                <th scope="row" colSpan={2}>Total do período</th>
                <td className="tabela-desagio__arquivo" />
                <td className="num">{valorNum(t.nominal)}</td>
                <td className="num">{valorNum(t.pago)}</td>
                <td className="num">{valorNum(t.valor)}</td>
                <td className="num tabela-desagio__pct">{pctD(t.taxa)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}

// Um número do resumo: valor em destaque e o rótulo embaixo.
function Numero({ rotulo, valor, destaque = false }) {
  return (
    <div className={`extrato__num${destaque ? " extrato__num--destaque" : ""}`}>
      <dd>{valor}</dd>
      <dt>{rotulo}</dt>
    </div>
  );
}
