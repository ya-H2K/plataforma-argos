import { useCallback, useState } from "react";
import { apiRelatorios } from "../api.js";
import SeletorMes from "./SeletorMes.jsx";
import { BarraTopo } from "./Cabecalho.jsx";
import { useAutoAtualizacao } from "../hooks/useAutoAtualizacao.js";
import { brl, valorNum } from "../formato.js";
import { Valor } from "./Animado.jsx";
import { Cartao, Dica, limitar, milhoes, useLargura } from "./Graficos.jsx";

// DRE por Produto (Relatórios > DRE por Produto). Um arquivo publicado com todos os meses:
// { linhas: [{ id, nome }], meses: [{ mes, produtos: [{ nome, valores }], total }], arquivo }.
// A tela mostra só um mês (as 5 linhas + Resultado, a tabela por produto e a composição do
// resultado). O histórico completo é a própria planilha, no botão "Baixar planilha".

const NOMES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const LONGOS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const curto = (m) => `${NOMES[Number(m.slice(5)) - 1]}/${m.slice(2, 4)}`;
const longo = (m) => `${LONGOS[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}`;
const dataHora = (iso) => new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso));
const pct1 = (v) => `${(Math.abs(v) * 100).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
const inteiro = (v) => `${v < 0 ? "−" : ""}${Math.abs(Math.round(v)).toLocaleString("pt-BR")}`;
const zero = (v) => Math.abs(v || 0) < 0.5;           // resíduos de centavos da planilha contam como zero

// "CARTAO TENDA PF ELO" → "Cartão Tenda PF Elo"
const SIGLAS = new Set(["PF", "PJ", "URFA", "CCB", "FIDC"]);
const CORRECOES = { cartao: "Cartão", refinancimento: "Refinanciamento", funcionario: "Funcionário", funcionarios: "Funcionários" };
function nomeProduto(s) {
  return String(s).trim().split(/\s+/).map((p) => {
    const m = p.toUpperCase();
    if (SIGLAS.has(m)) return m;
    const l = p.toLowerCase();
    return CORRECOES[l] || l.charAt(0).toUpperCase() + l.slice(1);
  }).join(" ");
}

export default function Dre({ aba, onAba, onVoltar }) {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(null);
  const [mes, setMes] = useState(null);
  const [meta, setMeta] = useState(null);
  const [baixando, setBaixando] = useState(false);
  const [falhaBaixar, setFalhaBaixar] = useState(false);

  const buscar = useCallback(async () => {
    try {
      const r = await apiRelatorios.dre();
      setDados(r.dre);
      setMeta(r.meta);
      setErro(null);
      const ids = r.dre.meses.map((m) => m.mes);
      setMes((m) => (m && ids.includes(m) ? m : ids.at(-1) ?? null));   // padrão: último mês publicado
    } catch (e) {
      setErro(e.message);
      throw e;
    }
  }, []);
  const intervaloMs = (meta?.intervaloAtualizacaoMin || 10) * 60 * 1000;
  useAutoAtualizacao(buscar, { chave: "dre", intervaloMs, temDados: Boolean(dados) });

  const meses = dados?.meses.map((m) => m.mes) || [];
  const i = meses.indexOf(mes);
  const ant = i > 0 ? meses[i - 1] : null;
  const prox = i >= 0 && i < meses.length - 1 ? meses[i + 1] : null;
  const atual = i >= 0 ? dados.meses[i] : null;
  const anterior = i > 0 ? dados.meses[i - 1] : null;

  const baixar = async () => {
    if (baixando || !dados?.arquivo) return;
    setBaixando(true);
    setFalhaBaixar(false);
    try { await apiRelatorios.baixarDre(dados.arquivo); } catch { setFalhaBaixar(true); } finally { setBaixando(false); }
  };

  return (
    <>
      <BarraTopo aba={aba} onAba={onAba} />
      <div className="pagina">
        <div className="cabeca-pagina">
          <div>
            <button type="button" className="botao-texto relatorio__voltar" onClick={onVoltar}>← Relatórios</button>
            <h1 className="page-title">DRE por Produto</h1>
          </div>
          <div className="cabeca-pagina__direita">
            <div className="filtro-relatorio">
              {meses.length > 0 && (
                <nav className="navegacao" aria-label="Escolher mês">
                  <button type="button" className="btn-icone" onClick={() => setMes(ant)} disabled={!ant} aria-label="Mês anterior">‹</button>
                  <SeletorMes meses={meses} valor={mes} onChange={setMes} rotulo={longo} />
                  <button type="button" className="btn-icone" onClick={() => setMes(prox)} disabled={!prox} aria-label="Próximo mês">›</button>
                </nav>
              )}
              {dados?.arquivo && (
                <button type="button" className="button button--pequeno publicacao__baixar" onClick={baixar} disabled={baixando}
                  title={`${dados.arquivo.nome} · publicada em ${dataHora(dados.arquivo.publicadoEm)}`}>
                  <span aria-hidden="true">↓</span> {baixando ? "Baixando…" : falhaBaixar ? "Falhou, tente de novo" : "Baixar planilha"}
                </button>
              )}
            </div>
            {meses.length > 0 && (
              <span className="publicacao__info">Planilha completa · {curto(meses[0])} a {curto(meses.at(-1))}</span>
            )}
          </div>
        </div>

        {erro && !dados ? (
          <p className="vazio" role="status">{erro}</p>
        ) : !dados ? (
          <p className="vazio" role="status">Carregando…</p>
        ) : !atual ? (
          <p className="vazio">A planilha publicada não tem meses.</p>
        ) : (
          <main className="report">
            <Indicadores linhas={dados.linhas} atual={atual} anterior={anterior} />
            <TabelaProdutos linhas={dados.linhas} atual={atual} />
            <Composicao linhas={dados.linhas} atual={atual} />
          </main>
        )}
      </div>
    </>
  );
}

// As 5 linhas do mês e o Resultado em destaque, com a comparação ao mês anterior.
function Indicadores({ linhas, atual, anterior }) {
  const res = atual.total.resultado;
  const resAnt = anterior?.total.resultado;
  const varia = resAnt ? res / Math.abs(resAnt) - Math.sign(resAnt) : null;
  return (
    <div className="dre-indicadores">
      {linhas.slice(0, 5).map((l) => (
        <div key={l.id} className="card card--indicador">
          <span className="card__rotulo">{l.nome}</span>
          <Valor className={`card__valor${atual.total[l.id] < 0 ? " card__valor--negativo" : ""}`} valor={atual.total[l.id]} />
        </div>
      ))}
      <div className="card card--indicador card--fechamento">
        <span className="card__rotulo">Resultado do mês</span>
        <Valor className={`card__valor${res < 0 ? " card__valor--negativo" : ""}`} valor={res} />
        {anterior && (
          <span className="card__legenda">
            {LONGOS[Number(anterior.mes.slice(5)) - 1]}: {brl(resAnt)}
            {varia != null && Number.isFinite(varia) && (
              <> <span className={varia < 0 ? "negativo" : "positivo"}>{varia < 0 ? "▼" : "▲"} {pct1(varia)}</span></>
            )}
          </span>
        )}
      </div>
    </div>
  );
}

// Um produto por linha; produtos sem nenhum valor no mês ficam de fora.
function TabelaProdutos({ linhas, atual }) {
  const produtos = atual.produtos.filter((p) => linhas.some((l) => !zero(p.valores[l.id])));
  const ocultos = atual.produtos.length - produtos.length;
  const cel = (v, k, forte) => (
    <td key={k} className={`num${zero(v) ? " zero" : v < 0 ? " negativo" : ""}${forte ? " dre-tabela__res" : ""}`}>
      {zero(v) ? "–" : valorNum(v)}
    </td>
  );
  return (
    <section className="card card--tabela" aria-labelledby="titulo-dre">
      <div className="card--tabela__topo">
        <h2 id="titulo-dre" className="card__rotulo">Resultado por produto</h2>
        <span className="card--tabela__nota">Valores em R$</span>
      </div>
      <div className="tabela-rolagem" tabIndex={0} role="region" aria-label="Resultado por produto, role para o lado">
        <table className="caixa-tabela dre-tabela">
          <thead>
            <tr>
              <th scope="col">Produto</th>
              {linhas.map((l) => <th key={l.id} scope="col" className="num">{l.nome}</th>)}
            </tr>
          </thead>
          <tbody>
            {produtos.map((p) => (
              <tr key={p.nome}>
                <th scope="row">{nomeProduto(p.nome)}</th>
                {linhas.map((l) => cel(p.valores[l.id], l.id, l.id === "resultado"))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Total do mês</th>
              {linhas.map((l) => cel(atual.total[l.id], l.id, l.id === "resultado"))}
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="dre-rodape">
        <span>{ocultos > 0 ? `${ocultos} produto${ocultos > 1 ? "s" : ""} sem movimento no mês não aparece${ocultos > 1 ? "m" : ""}.` : ""}</span>
        <span>Resultado = Reversão Baixas + Transição + Resultado Aquisição + Juros + Net Acordos</span>
      </div>
    </section>
  );
}

// Cascata: das 5 linhas do topo até o Resultado do mês. Dourado soma, vermelho subtrai.
const ALTURA = 300;
const MG = { top: 30, right: 8, bottom: 56, left: 8 };
const MH = { top: 6, linha: 46, rotulo: 132 };          // versão deitada (celular)
function Composicao({ linhas, atual }) {
  const [ref, largura] = useLargura();
  const [ativo, setAtivo] = useState(null);
  const w = largura || 900;

  let acc = 0;
  const passos = linhas.slice(0, 5).map((l) => {
    const v = atual.total[l.id] || 0;
    const p = { id: l.id, nome: l.nome, v, de: acc, ate: acc + v };
    acc += v;
    return p;
  });
  passos.push({ id: "fim", nome: "Resultado do mês", v: atual.total.resultado, de: 0, ate: atual.total.resultado, fim: true });

  const vals = passos.flatMap((p) => [p.de, p.ate]);
  const max = Math.max(0, ...vals), min = Math.min(0, ...vals);
  const amp = max - min || 1;
  const y = (v) => MG.top + ((max - v) / amp) * (ALTURA - MG.top - MG.bottom);
  const faixa = (w - MG.left - MG.right) / passos.length;
  const barra = Math.min(120, faixa * 0.46);
  const cx = (k) => MG.left + faixa * (k + 0.5);
  const cheio = faixa >= 118;          // cabe o número inteiro; senão, "R$ 33,2 mi"
  const rot = (p) => (cheio ? `${!p.fim && p.v > 0 ? "+" : ""}${inteiro(p.v)}` : `${!p.fim && p.v > 0 ? "+" : ""}${milhoes(p.v, 1)}`);
  const a = ativo != null ? passos[ativo] : null;
  const deitado = largura > 0 && largura < 640;        // celular: uma linha por passo

  const dica = (
    <Dica estilo={a ? (deitado
      ? { top: MH.top + ativo * MH.linha + MH.linha, left: "50%", transform: "translateX(-50%)" }
      : { top: 0, left: limitar(cx(ativo), 90, w - 90), transform: "translateX(-50%)" }) : null}>
      {a && (
        <>
          <strong>{a.nome}</strong>
          <span className={a.v < 0 ? "negativo" : undefined}>{brl(a.v)}</span>
          {!a.fim && <span>Acumulado: {brl(a.ate)}</span>}
        </>
      )}
    </Dica>
  );

  if (deitado) {
    const alt = MH.top + passos.length * MH.linha + 4;
    const x0 = MH.rotulo, x1 = w - 4;
    const x = (v) => x0 + ((v - min) / amp) * (x1 - x0);
    return (
      <Cartao titulo="Composição de resultado" lateral={<span className="card--tabela__nota">Valores em R$</span>}>
        <div className="graf" ref={ref}>
          <svg width={w} height={alt} role="img" className="dre-cascata"
            aria-label={passos.map((p) => `${p.nome} ${brl(p.v)}`).join(", ")}
            onPointerMove={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              const k = Math.floor((e.clientY - r.top - MH.top) / MH.linha);
              setAtivo(k >= 0 && k < passos.length ? k : null);
            }}
            onPointerLeave={() => setAtivo(null)}>
            <line x1={x(0)} x2={x(0)} y1={MH.top - 4} y2={alt - 4} className="graf__base" />
            {passos.map((p, k) => {
              const y0 = MH.top + k * MH.linha;
              const e = x(Math.min(p.de, p.ate)), d = x(Math.max(p.de, p.ate));
              return (
                <g key={p.id} opacity={ativo != null && ativo !== k ? 0.5 : 1}>
                  <text x={0} y={y0 + 15} className={`graf__eixo${p.fim ? " graf__eixo--sel" : ""}`}>{p.nome}</text>
                  <text x={0} y={y0 + 31} className={`graf__valor${p.fim ? " dre-cascata__valor-fim" : " dre-cascata__valor"}`}>
                    {`${!p.fim && p.v > 0 ? "+" : ""}${milhoes(p.v, 1)}`}
                  </text>
                  <rect x={e} y={y0 + 8} width={Math.max(d - e, 2)} height={MH.linha - 18}
                    className={p.fim ? "dre-cascata__fim" : p.v >= 0 ? "dre-cascata__soma" : "dre-cascata__sub"} />
                  {k < passos.length - 1 && (
                    <line x1={x(p.ate)} x2={x(p.ate)} y1={y0 + MH.linha - 10} y2={y0 + MH.linha + 8} className="dre-cascata__ponte" />
                  )}
                </g>
              );
            })}
          </svg>
          {dica}
        </div>
      </Cartao>
    );
  }

  return (
    <Cartao titulo="Composição de resultado" lateral={<span className="card--tabela__nota">Valores em R$</span>}>
      <div className="graf" ref={ref}>
        {largura > 0 && (
          <svg width={w} height={ALTURA} role="img" className="dre-cascata"
            aria-label={passos.map((p) => `${p.nome} ${brl(p.v)}`).join(", ")}
            onPointerMove={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              const k = Math.floor((e.clientX - r.left - MG.left) / faixa);
              setAtivo(k >= 0 && k < passos.length ? k : null);
            }}
            onPointerLeave={() => setAtivo(null)}>
            {ativo != null && <rect x={cx(ativo) - faixa / 2} y={MG.top - 22} width={faixa} height={ALTURA - MG.top - MG.bottom + 44} className="graf__foco" />}
            <line x1={MG.left} x2={w - MG.right} y1={y(0)} y2={y(0)} className="graf__base" />
            {passos.map((p, k) => {
              const topo = y(Math.max(p.de, p.ate)), base = y(Math.min(p.de, p.ate));
              const sobe = p.v >= 0;
              const ly = sobe ? topo - 9 : base + 17;
              return (
                <g key={p.id} opacity={ativo != null && ativo !== k ? 0.5 : 1}>
                  <rect x={cx(k) - barra / 2} y={topo} width={barra} height={Math.max(base - topo, 2)}
                    className={p.fim ? "dre-cascata__fim" : sobe ? "dre-cascata__soma" : "dre-cascata__sub"} />
                  {k < passos.length - 1 && (
                    <line x1={cx(k) + barra / 2} x2={cx(k + 1) - barra / 2} y1={y(p.ate)} y2={y(p.ate)} className="dre-cascata__ponte" />
                  )}
                  <text x={cx(k)} y={ly} textAnchor="middle" className={`graf__valor${p.fim ? " dre-cascata__valor-fim" : " dre-cascata__valor"}`}>{rot(p)}</text>
                  <text x={cx(k)} y={ALTURA - 16} textAnchor="middle" className={`graf__eixo${p.fim ? " graf__eixo--sel" : ""}`}>{p.nome}</text>
                </g>
              );
            })}
          </svg>
        )}
        {dica}
      </div>
    </Cartao>
  );
}
