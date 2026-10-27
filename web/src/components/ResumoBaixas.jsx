import { useCallback, useMemo, useState } from "react";
import { apiRelatorios } from "../api.js";
import { BarraTopo } from "./Cabecalho.jsx";
import { useAutoAtualizacao } from "../hooks/useAutoAtualizacao.js";
import { ano, brl, diaMes, diaSemana, num } from "../formato.js";

// Relatório restrito "Resumo de Baixas": o que foi IMPORTADO no dia (arquivos da pasta
// "com financeiro"), separado pelo tipo de baixa (nome do arquivo). Não é o valor conciliado.
// A automação do PC (C:\Automacao\Vox\resumo_baixas.py) gera um resumo e um Excel por dia; o
// publicador manda os resumos na chave "restrito:baixas" e o Excel para restrito/baixas/AAAA-MM-DD.xlsx.
// Só o admin e os e-mails liberados em relatorio_acesso ("baixas") recebem.

const hhmm = (iso) => (iso ? iso.slice(11, 16) : "");
const plural = (n, um, varios) => `${num(n)} ${n === 1 ? um : varios}`;

export default function ResumoBaixas({ aba, onAba, onVoltar }) {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(null);
  const [sel, setSel] = useState(null);
  const [meta, setMeta] = useState(null);
  const [baixando, setBaixando] = useState(false);
  const [erroBaixar, setErroBaixar] = useState(null);

  const buscar = useCallback(async () => {
    try {
      const r = await apiRelatorios.baixas();
      setDados(r);
      setMeta(r.meta);
      setErro(null);
      // padrão: hoje, se já tiver baixas; senão, o último dia com baixas
      setSel((s) => s ?? (r.dias.some((d) => d.data === r.hoje) ? r.hoje : r.dias.at(-1)?.data ?? r.hoje));
    } catch (e) {
      setErro(e.message);
      throw e;
    }
  }, []);
  const intervaloMs = (meta?.intervaloAtualizacaoMin || 10) * 60 * 1000;
  useAutoAtualizacao(buscar, { chave: "baixas", intervaloMs, temDados: Boolean(dados) });

  const dias = useMemo(() => [...(dados?.dias || [])].sort((a, b) => a.data.localeCompare(b.data)), [dados]);
  const dia = dias.find((d) => d.data === sel) || null;
  const anterior = sel ? dias.filter((d) => d.data < sel).at(-1)?.data : null;
  const proximo = sel ? dias.find((d) => d.data > sel)?.data : null;

  const escolher = (iso) => { setSel(iso); setErroBaixar(null); };
  const baixar = async () => {
    setBaixando(true);
    setErroBaixar(null);
    try { await apiRelatorios.baixarBaixas(dia); } catch (e) { setErroBaixar(e.message); }
    finally { setBaixando(false); }
  };

  return (
    <>
      <BarraTopo aba={aba} onAba={onAba} />
      <div className="pagina">
        <div className="cabeca-pagina">
          <div>
            <button type="button" className="botao-texto relatorio__voltar" onClick={onVoltar}>← Relatórios</button>
            <h1 className="page-title">Resumo de Baixas</h1>
            <p className="page-sub">
              {sel ? `${diaSemana(sel)}, ${diaMes(sel)} de ${ano(sel)}` : ""}
            </p>
          </div>
          <div className="cabeca-pagina__direita filtro-relatorio">
            <nav className="navegacao" aria-label="Escolher o dia">
              <button type="button" className="btn-icone" onClick={() => escolher(anterior)} disabled={!anterior} aria-label="Dia anterior">‹</button>
              <input type="date" value={sel || ""} aria-label="Dia"
                min={dias[0]?.data} max={dados?.hoje}
                onChange={(e) => e.target.value && escolher(e.target.value)} />
              <button type="button" className="btn-icone" onClick={() => escolher(proximo)} disabled={!proximo} aria-label="Próximo dia">›</button>
            </nav>
            <button type="button" className="button button--pequeno publicacao__baixar"
              disabled={!dia?.excel || baixando} onClick={baixar}
              title={dia && !dia.excel ? "O Excel deste dia ainda não foi enviado." : undefined}>
              <span aria-hidden="true">↓</span> {baixando ? "Baixando…" : "Baixar Excel do dia"}
            </button>
            {erroBaixar && <span className="resumo-baixas__erro" role="alert">{erroBaixar}</span>}
          </div>
        </div>

        {erro && !dados ? (
          <p className="vazio" role="status">{erro}</p>
        ) : !dados ? (
          <p className="vazio" role="status">Carregando…</p>
        ) : !dia ? (
          <p className="vazio">Nenhuma baixa importada neste dia.</p>
        ) : (
          <section className="card resumo-baixas" aria-label="Baixas importadas no dia">
            <div className="resumo-baixas__topo">
              <dl className="resumo-baixas__total">
                <dt>Baixas importadas no dia</dt>
                <dd>{brl(dia.valor)}</dd>
              </dl>
              <dl className="resumo-baixas__qtd">
                <dt>Arquivos importados</dt>
                <dd>{num(dia.arquivos)}</dd>
              </dl>
            </div>
            <dl className="resumo-baixas__lista">
              {dia.tipos.map((t) => (
                <div key={t.tipo} className={`resumo-baixas__linha${t.tipo === "Não reconhecido" ? " resumo-baixas__linha--alerta" : ""}`}>
                  <dt>{t.tipo}<small>{plural(t.arquivos, "arquivo", "arquivos")}</small></dt>
                  <dd>{brl(t.valor)}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}
        {dia?.gerado && <p className="resumo-baixas__hora">Atualizado às {hhmm(dia.gerado)} · valores importados, não conciliados.</p>}
      </div>
    </>
  );
}
