// "Baixar PDF" do Report Operacional: monta a página A4 (versão clara, boa para imprimir)
// fora da tela, desenha com html2canvas e salva com jsPDF. As bibliotecas só são baixadas
// quando alguém clica no botão (não pesam na abertura do site).
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import logoH2 from "./assets/h2-kapital.svg";
import { brl, diaMes, diaSemana, ano } from "./formato.js";

const VOX = "M2.10 2.00 L10.60 2.00 L22.50 28.40 L35.20 2.00 L43.60 2.00 L25.40 38.10 L19.60 38.10 Z M44.20 19.90 a21.6 18.0 0 1 0 43.2 0 a21.6 18.0 0 1 0 -43.2 0 Z M52.00 19.90 a13.9 10.9 0 1 0 27.8 0 a13.9 10.9 0 1 0 -27.8 0 Z M88.50 2.00 L97.50 2.00 L107.00 14.20 L116.50 2.00 L125.50 2.00 L111.50 19.95 L125.70 38.10 L116.70 38.10 L107.00 25.80 L97.30 38.10 L88.30 38.10 L102.50 19.95 Z";

const COR = { ok: "#3d7a32", parcial: "#4a6a8c", nao_realizado: "#b0473a", aguardando: "#9a6f12", sem_movimento: "#6f6656" };
const COR_SITUACAO = { concluido: COR.ok, andamento: COR.aguardando, encerrado: COR.nao_realizado };

const plural = (n, um, varios) => (n === 1 ? um : varios);
const pad = (n) => String(n).padStart(2, "0");
const dataHora = (d) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} às ${pad(d.getHours())}:${pad(d.getMinutes())}`;

// Mesmo texto que aparece ao abrir cada card do Report.
function textoDetalhe(id, d) {
  if (!d) return "";
  if (id === "rpe") return `${d.recebidos} de ${d.total} arquivos recebidos` + (d.faltando?.length ? ` · faltam: ${d.faltando.join(", ")}` : "");
  if (id === "bauk") return `${d.arquivos} ${plural(d.arquivos, "arquivo gerado", "arquivos gerados")}`;
  if (id === "urfa" || id === "endosso") {
    if (!d.total) return id === "urfa" ? "Nenhuma cessão de URFA no dia" : "Nenhum endosso no dia";
    const nome = id === "urfa" ? plural(d.total, "URFA", "URFAs") : plural(d.total, "endosso", "endossos");
    const liq = id === "urfa" ? plural(d.total, "liquidada", "liquidadas") : plural(d.total, "liquidado", "liquidados");
    return `${d.liquidadas} de ${d.total} ${nome} ${liq}`;
  }
  if (id === "baixas") return `${d.principais} de ${d.esperadas} baixas principais · ${d.arquivos} ${plural(d.arquivos, "arquivo", "arquivos")}`;
  return "";
}

function Selo({ status, children }) {
  return <span className="pdf-selo" style={{ color: COR[status] || COR.sem_movimento, borderStyle: status === "aguardando" ? "dashed" : "solid" }}>{children}</span>;
}

// Mesmas linhas do quadro da tela: só processos com apontamento, e Baixas Represadas sempre.
function linhasObservacoes(todas = []) {
  const represadas = todas.find((l) => l.processo === "Baixas Represadas");
  const apontamentos = todas.filter((l) => l.processo !== "Baixas Represadas" && l.observacao);
  return [...apontamentos, ...(represadas ? [{ ...represadas,
    observacao: represadas.observacao || (represadas.rotulo === "Não" ? "Nenhuma baixa represada" : "") }] : [])];
}

function PaginaPdf({ dia, mostrarResponsavel, geradoEm, logo }) {
  const v = dia.valores;
  const obs = linhasObservacoes(dia.observacoes || []);
  const situ = dia.situacao;
  return (
    <div className="pdf">
      <div className="pdf-topo">
        <div className="pdf-marca"><img src={logo} alt="" /><span>Vox FIDC</span></div>
        <svg viewBox="1.2 1.2 125.2 37.6" className="pdf-vox"><path d={VOX} fill="none" stroke="#ece5d8" strokeWidth="1.3" vectorEffect="non-scaling-stroke" /></svg>
      </div>
      <div className="pdf-corpo">
        <div className="pdf-cab">
          <div><h1>Report Operacional</h1><p>{diaSemana(dia.data)}, {diaMes(dia.data)} de {ano(dia.data)}</p></div>
          <div className="pdf-situ">
            {situ && <b style={{ color: COR_SITUACAO[situ.estado] || COR.ok }}><i />{situ.rotulo}</b>}
            <small>{dia.aberto ? `Posição de ${dataHora(geradoEm)}` : "Posição final do dia"}</small>
          </div>
        </div>

        <section>
          <h2>Processos do dia</h2>
          <table>
            <thead><tr><th>Etapa</th><th>Status</th><th>Detalhe</th><th className="pdf-hora">Concluído às</th></tr></thead>
            <tbody>
              {dia.processos.map((p) => (
                <tr key={p.id}>
                  <td className="pdf-nome">{p.nome}</td>
                  <td><Selo status={p.status}>{p.rotulo}</Selo></td>
                  <td className="pdf-dim">{textoDetalhe(p.id, p.detalhe)}</td>
                  <td className="pdf-hora pdf-ouro">{p.detalhe?.concluidoAs || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section>
          <h2>Arquivos e Valores processados</h2>
          <div className="pdf-g5">
            {dia.arquivos.map((a) => (
              <div className="pdf-card" key={a.id}><span className="pdf-rot">{a.nome}</span><Selo status={a.status}>{a.rotulo}</Selo></div>
            ))}
            <div className="pdf-card"><span className="pdf-rot">Cessão de URFA</span><span className="pdf-val">{brl(v.cessaoUrfa)}</span></div>
            <div className="pdf-card"><span className="pdf-rot">Endosso</span><span className="pdf-val">{brl(v.endosso)}</span></div>
            <div className="pdf-card"><span className="pdf-rot">Baixas Processadas</span><span className="pdf-val">{brl(v.baixasProcessadas)}</span></div>
          </div>
        </section>

        <section>
          <h2>Liquidações e Conciliações</h2>
          <div className="pdf-g2">
            <div className="pdf-card pdf-res">
              <span className="pdf-rot">Liquidação Total</span>
              <span className="pdf-val">{brl(v.liquidacaoTotal)}</span>
              <dl><div><dt>Liquidação Pendente Dia</dt><dd>{brl(v.liquidacaoPendenteDia)}</dd></div>
                <div><dt>Liquidação Pendente Acumulado</dt><dd>{brl(v.liquidacaoPendenteAcumulado)}</dd></div></dl>
            </div>
            <div className="pdf-card pdf-res">
              <span className="pdf-rot">Baixas Conciliadas</span>
              <span className="pdf-val">{v.baixasConciliadas === null ? "Aguardando..." : brl(v.baixasConciliadas)}</span>
              <dl><div><dt>Baixas Represadas Dia</dt><dd>{brl(v.baixasRepresadasDia)}</dd></div>
                <div><dt>Baixas Represadas Acumulado</dt><dd>{brl(v.baixasRepresadasAcumulado)}</dd></div></dl>
            </div>
          </div>
        </section>

        {dia.observacoes && (
          <section>
            <h2>Observações</h2>
            <table>
              <thead><tr><th>Processo</th><th>Status</th><th>Observação</th>{mostrarResponsavel && <th>Responsável</th>}</tr></thead>
              <tbody>
                {obs.length === 0 && <tr><td colSpan={mostrarResponsavel ? 4 : 3} className="pdf-dim">Nenhum apontamento nos processos do dia.</td></tr>}
                {obs.map((l) => (
                  <tr key={l.processo}>
                    <td className="pdf-nome">{l.processo}</td>
                    <td><Selo status={l.status}>{l.rotulo}</Selo></td>
                    <td>{l.observacao || "—"}</td>
                    {mostrarResponsavel && <td className="pdf-dim">{l.responsavel || "—"}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </div>
      <div className="pdf-rodape">
        <span>H2 Kapital · Vox FIDC · Report Operacional · uso interno</span>
        <span>Gerado em {dataHora(geradoEm)}</span>
      </div>
    </div>
  );
}

const CSS = `
.pdf{width:794px;min-height:1123px;display:flex;flex-direction:column;background:#fff;color:#1f1b14;
  font:400 14px/1.45 "Segoe UI",system-ui,-apple-system,sans-serif;text-align:left}
.pdf *{box-sizing:border-box}
.pdf-topo{background:#0b0a08;display:flex;align-items:center;justify-content:space-between;padding:26px 53px;border-bottom:2px solid #a8812f}
.pdf-marca{display:flex;align-items:center;gap:13px}.pdf-marca img{height:42px;width:auto;display:block}
.pdf-marca span{color:#c9a35c;font-size:22px;font-weight:600;letter-spacing:.14em}
.pdf-vox{height:16px;width:54px;display:block}
.pdf-corpo{padding:30px 53px 0;display:flex;flex-direction:column;gap:22px}
.pdf-cab{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:1px solid #e3dccd;padding-bottom:15px}
.pdf-cab h1{margin:0;font-size:28px;font-weight:600;line-height:1.2}.pdf-cab p{margin:4px 0 0;color:#6f6656;font-size:16px}
.pdf-situ{text-align:right}.pdf-situ b{font-size:17px;font-weight:600;display:inline-flex;align-items:center;gap:8px}
.pdf-situ b i{width:8px;height:8px;border-radius:50%;background:currentColor;display:inline-block}
.pdf-situ small{display:block;color:#6f6656;font-size:12.5px;margin-top:3px}
.pdf h2{margin:0 0 10px;color:#a8812f;font-size:12px;font-weight:600;letter-spacing:.16em;text-transform:uppercase}
.pdf table{width:100%;border-collapse:collapse}
.pdf th{text-align:left;color:#6f6656;font-weight:400;font-size:11px;letter-spacing:.12em;text-transform:uppercase;padding:0 12px 8px 0;border-bottom:1px solid #a8812f}
.pdf td{padding:9px 12px 9px 0;border-bottom:1px solid #e3dccd;vertical-align:middle}
.pdf .pdf-nome{font-weight:600;width:30%}.pdf .pdf-dim{color:#6f6656}
.pdf .pdf-hora{text-align:right;width:15%;padding-right:0;white-space:nowrap}.pdf .pdf-ouro{color:#7d5f1f}
.pdf-selo{display:inline-block;padding:2px 9px;border:1px solid;font-size:11px;letter-spacing:.1em;text-transform:uppercase;white-space:nowrap}
.pdf-g5{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:11px}.pdf-g2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px}
.pdf-card{background:#faf8f3;border:1px solid #e3dccd;border-top:2px solid #a8812f;padding:11px 11px;display:grid;gap:8px;align-content:start;justify-items:start}
.pdf-rot{color:#6f6656;font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;line-height:1.3;min-height:2.6em}
.pdf-val{color:#7d5f1f;font-weight:600;font-size:14px;white-space:nowrap}
.pdf-res{padding:15px 19px;justify-items:stretch}.pdf-res .pdf-rot{min-height:0}.pdf-res .pdf-val{font-size:25px}
.pdf-res dl{margin:0}.pdf-res dl div{display:flex;justify-content:space-between;padding:7px 0;border-top:1px solid #e3dccd}
.pdf-res dt{color:#6f6656}.pdf-res dd{margin:0}
.pdf-rodape{margin-top:auto;display:flex;justify-content:space-between;color:#6f6656;font-size:11px;padding:15px 53px 22px;border-top:1px solid #e3dccd}
`;

// O SVG da H2 não tem tamanho próprio e o html2canvas o desenharia cortado: vira PNG antes.
function logoPng() {
  return new Promise((ok) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = 270; c.height = 292;                     // mesma proporção do viewBox (1080 x 1168)
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      ok(c.toDataURL("image/png"));
    };
    img.onerror = () => ok(logoH2);
    img.src = logoH2;
  });
}

const esperarImagens = (el) => Promise.all([...el.querySelectorAll("img")].map((img) =>
  img.complete ? null : new Promise((ok) => { img.onload = ok; img.onerror = ok; })));

function salvar(pdf, dia) {
  pdf.setProperties({ title: `Report Operacional Vox - ${dia.data}`, author: "H2 Kapital" });
  pdf.save(`Report Operacional Vox - ${dia.data.split("-").reverse().join("-")}.pdf`);
}

export async function baixarPdfReport(dia, { mostrarResponsavel = true } = {}) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
  const caixa = document.createElement("div");
  caixa.style.cssText = "position:fixed;left:-10000px;top:0;z-index:-1;pointer-events:none";
  const estilo = document.createElement("style");
  estilo.textContent = CSS;
  caixa.appendChild(estilo);
  const alvo = document.createElement("div");
  caixa.appendChild(alvo);
  document.body.appendChild(caixa);
  const root = createRoot(alvo);
  try {
    const logo = await logoPng();
    flushSync(() => root.render(<PaginaPdf dia={dia} mostrarResponsavel={mostrarResponsavel} geradoEm={new Date()} logo={logo} />));
    await esperarImagens(alvo);
    if (document.fonts?.ready) await document.fonts.ready;
    const pagina = alvo.firstElementChild;
    const canvas = await html2canvas(pagina, { scale: 2, backgroundColor: "#ffffff", useCORS: true, logging: false });

    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
    const larguraMm = 210;
    const alturaPagMm = 297;
    const pxPorMm = canvas.width / larguraMm;
    const alturaPagPx = Math.floor(alturaPagMm * pxPorMm);
    // Passou só um pouco de uma página: reduz para caber inteiro numa folha.
    if (canvas.height > alturaPagPx && canvas.height <= alturaPagPx * 1.2) {
      const larg = (alturaPagPx / canvas.height) * larguraMm;
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", (larguraMm - larg) / 2, 0, larg, alturaPagMm);
      return salvar(pdf, dia);
    }
    // Normalmente cabe em uma página; com muitas observações, continua nas seguintes.
    for (let y = 0, n = 0; y < canvas.height - 2; y += alturaPagPx, n++) {
      const fatia = document.createElement("canvas");
      fatia.width = canvas.width;
      fatia.height = Math.min(alturaPagPx, canvas.height - y);
      const ctx = fatia.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, fatia.width, fatia.height);
      ctx.drawImage(canvas, 0, y, canvas.width, fatia.height, 0, 0, canvas.width, fatia.height);
      if (n > 0) pdf.addPage();
      pdf.addImage(fatia.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, larguraMm, fatia.height / pxPorMm);
    }
    salvar(pdf, dia);
  } finally {
    root.unmount();
    caixa.remove();
  }
}
