import { useCallback, useMemo, useState } from "react";
import { apiRelatorios } from "../api.js";
import { BarraTopo } from "./Cabecalho.jsx";
import { useAutoAtualizacao } from "../hooks/useAutoAtualizacao.js";
import { brl, diaSemana, valorNum } from "../formato.js";
import SeletorMes from "./SeletorMes.jsx";

// Relatório "Carteira em Dia": valor presente dos recebíveis "A Vencer" do estoque, um valor por
// dia útil. A automação do PC (C:\Automacao\Vox\carteira_em_dia.py) calcula o dia a partir das
// 08:30 e o publicador envia o histórico na chave "restrito:carteira". Só o admin e os e-mails
// liberados na tabela relatorio_acesso recebem (função vox_painel).

const NOMES_MES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const rotuloMes = (id) => `${NOMES_MES[Number(id.slice(5, 7)) - 1]} ${id.slice(0, 4)}`;
const dataBr = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const ultimoDia = (mes) => {
  const [a, m] = mes.split("-").map(Number);
  return `${mes}-${String(new Date(Date.UTC(a, m, 0)).getUTCDate()).padStart(2, "0")}`;
};

// CSV igual à planilha do script: DATA;VALOR_PRESENTE_A_VENCER (padrão do Excel em português).
function baixarCsv(linhas, nomeArquivo) {
  const corpo = linhas.map((l) => `${dataBr(l.data)};${l.valor.toFixed(2).replace(".", ",")}`);
  const blob = new Blob(["\uFEFF" + ["DATA;VALOR_PRESENTE_A_VENCER", ...corpo].join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function Carteira({ aba, onAba, onVoltar }) {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(null);
  const [modo, setModo] = useState("mes");            // "mes" | "periodo"
  const [mes, setMes] = useState(null);
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [meta, setMeta] = useState(null);

  const buscar = useCallback(async () => {
    try {
      const r = await apiRelatorios.carteira();
      setDados(r);
      setMeta(r.meta);
      setErro(null);
      setMes((m) => m ?? r.hoje.slice(0, 7));          // padrão: mês vigente
    } catch (e) {
      setErro(e.message);
      throw e;
    }
  }, []);
  const intervaloMs = (meta?.intervaloAtualizacaoMin || 10) * 60 * 1000;
  useAutoAtualizacao(buscar, { chave: "carteira", intervaloMs, temDados: Boolean(dados) });

  // todas as linhas em ordem de data
  const todas = useMemo(() => [...(dados?.linhas || [])].sort((a, b) => a.data.localeCompare(b.data)), [dados]);

  const meses = useMemo(() => {
    if (!dados) return [];
    return [...new Set([...todas.map((l) => l.data.slice(0, 7)), dados.hoje.slice(0, 7)])].sort();
  }, [dados, todas]);
  const i = meses.indexOf(mes);
  const anterior = i > 0 ? meses[i - 1] : null;
  const proximo = i >= 0 && i < meses.length - 1 ? meses[i + 1] : null;

  const [ini, fim] = modo === "mes"
    ? (mes ? [`${mes}-01`, ultimoDia(mes)] : ["", ""])
    : [de || "0000-01-01", ate || "9999-12-31"];
  const periodoInvalido = modo === "periodo" && de && ate && de > ate;
  const linhas = useMemo(() => todas.filter((l) => l.data >= ini && l.data <= fim), [todas, ini, fim]);

  const descricao = modo === "mes"
    ? (mes ? rotuloMes(mes) : "")
    : de && ate ? `De ${dataBr(de)} a ${dataBr(ate)}` : de ? `A partir de ${dataBr(de)}` : ate ? `Até ${dataBr(ate)}` : "Todo o histórico";
  const nomeCsv = modo === "mes" ? `carteira_em_dia_${mes}.csv` : `carteira_em_dia_${de || "inicio"}_a_${ate || "hoje"}.csv`;

  const irParaPeriodo = () => {
    if (modo === "periodo") return;
    if (!de && !ate && mes) { setDe(`${mes}-01`); setAte(ultimoDia(mes)); }
    setModo("periodo");
  };

  return (
    <>
      <BarraTopo aba={aba} onAba={onAba} />
      <div className="pagina pagina--carteira">
        <div className="cabeca-pagina">
          <div>
            <button type="button" className="botao-texto relatorio__voltar" onClick={onVoltar}>← Relatórios</button>
            <h1 className="page-title">Carteira em Dia</h1>
            <p className="page-sub">Valor presente a vencer · {descricao}</p>
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
          <Quadro linhas={linhas} hoje={dados.hoje} />
        )}
      </div>
    </>
  );
}

// Resumo (dias registrados e posição do último dia) e a lista dos dias, do mais novo ao mais antigo.
function Quadro({ linhas, hoje }) {
  const ultima = linhas.at(-1);
  const lista = [...linhas].reverse();

  return (
    <section className="card extrato carteira" aria-label="Carteira em dia">
      <dl className="extrato__topo">
        <Numero rotulo={linhas.length === 1 ? "Dia registrado" : "Dias registrados"} valor={linhas.length} />
        <Numero rotulo={ultima ? `Posição em ${dataBr(ultima.data).slice(0, 5)}` : "Posição"} valor={ultima ? brl(ultima.valor) : "—"} destaque />
      </dl>
      {!linhas.length && <p className="vazio extrato__vazio">Nenhum dia registrado neste período.</p>}

      {linhas.length > 0 && (
        <div className="tabela-rolagem" tabIndex={0} role="region" aria-label="Valor presente a vencer por dia">
          <table className="caixa-tabela tabela-carteira">
            <thead>
              <tr>
                <th scope="col">Data</th>
                <th scope="col" className="num">Valor presente a vencer</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((l) => (
                <tr key={l.data} className={l.data === hoje ? "recente" : undefined}>
                  <th scope="row">{dataBr(l.data)} <span className="tabela-carteira__dia">{diaSemana(l.data).replace("-feira", "")}</span></th>
                  <td className="num tabela-carteira__valor">{valorNum(l.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Numero({ rotulo, valor, destaque = false }) {
  return (
    <div className={`extrato__num${destaque ? " extrato__num--destaque" : ""}`}>
      <dd>{valor}</dd>
      <dt>{rotulo}</dt>
    </div>
  );
}
