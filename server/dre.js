// DRE por Produto: o site lê só a pasta "DRE por Produto - Publicado", com UM arquivo .xlsx que
// tem todos os meses (vale o mais recente da pasta, como nas Despesas).
// Layout esperado (planilha "Resultados por Produto - VOX FIDC"): blocos mensais empilhados.
//   linha do mês: data na coluna B, nomes dos produtos nas colunas seguintes e "CONSOLIDADO" na última;
//   linhas abaixo: Reversão Baixas, Transição, Resultado Aquisição, Juros, Net Acordos e Resultado.
// O mês vem da data (só ano e mês: tanto faz dia 1º ou último dia útil). Os nomes dos produtos são
// lidos em cada bloco (ex.: "PRODUTO INATIVO" virou "ROTATIVO" em dez/25). Mês repetido: vale o último.
import ExcelJS from "exceljs";

export const LINHAS_DRE = [
  { id: "reversao", nome: "Reversão Baixas" },
  { id: "transicao", nome: "Transição" },
  { id: "aquisicao", nome: "Resultado Aquisição" },
  { id: "juros", nome: "Juros" },
  { id: "acordos", nome: "Net Acordos" },
  { id: "resultado", nome: "Resultado" },
];

const normalizar = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const ID_DA_LINHA = Object.fromEntries(LINHAS_DRE.map((l) => [normalizar(l.nome), l.id]));

function valor(cell) {
  let v = cell?.value;
  if (v && typeof v === "object" && !(v instanceof Date)) {
    if ("result" in v) v = v.result;
    else if ("richText" in v) v = v.richText.map((t) => t.text).join("");
    else if ("text" in v) v = v.text;
    else if ("error" in v) v = null;
  }
  if (v && typeof v === "object" && "error" in v) v = null;
  return v ?? null;
}

// Data do bloco → "AAAA-MM" (data do Excel ou número de série)
function mesDe(v) {
  if (v instanceof Date) return v.toISOString().slice(0, 7);
  if (typeof v === "number" && v > 20000 && v < 80000) {
    return new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000).toISOString().slice(0, 7);
  }
  return null;
}

const numero = (v) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim()
  ? Number(v.replace(/[R$\s.]/g, "").replace(",", ".")) || 0 : 0);
const centavos = (v) => Math.round(v * 100) / 100;

export async function lerDre(caminho) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(caminho);
  const ws = wb.worksheets.find((w) => w.state !== "hidden" && w.rowCount > 0) || wb.worksheets[0];
  if (!ws) throw new Error("planilha sem abas");

  const porMes = new Map();
  for (let r = 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    // a coluna da data é a primeira preenchida da linha (hoje, a B)
    let cData = null;
    for (let c = 1; c <= Math.min(5, row.cellCount); c++) if (valor(row.getCell(c)) != null) { cData = c; break; }
    if (!cData) continue;
    const mes = mesDe(valor(row.getCell(cData)));
    if (!mes) continue;

    // produtos até a coluna "CONSOLIDADO" (a consolidada é recalculada pela soma dos produtos)
    const colunas = [];
    for (let c = cData + 1; c <= row.cellCount; c++) {
      const nome = String(valor(row.getCell(c)) ?? "").trim();
      if (!nome) continue;
      if (normalizar(nome) === "consolidado") break;
      colunas.push({ c, nome });
    }
    if (!colunas.length) continue;

    const produtos = colunas.map(({ nome }) => ({ nome, valores: {} }));
    for (let r2 = r + 1; r2 <= Math.min(r + 10, ws.rowCount); r2++) {
      const linha = ws.getRow(r2);
      const rotulo = valor(linha.getCell(cData));
      if (mesDe(rotulo)) break;                    // começou o próximo mês
      const id = ID_DA_LINHA[normalizar(rotulo)];
      if (!id) continue;
      colunas.forEach(({ c }, k) => { produtos[k].valores[id] = centavos(numero(valor(linha.getCell(c)))); });
    }
    // Resultado sem valor (fórmula não calculada): soma das 5 linhas
    for (const p of produtos) {
      const soma = centavos(LINHAS_DRE.slice(0, 5).reduce((t, l) => t + (p.valores[l.id] || 0), 0));
      if (!p.valores.resultado && soma) p.valores.resultado = soma;
      for (const l of LINHAS_DRE) p.valores[l.id] ??= 0;
    }
    const total = Object.fromEntries(LINHAS_DRE.map((l) => [l.id, centavos(produtos.reduce((t, p) => t + p.valores[l.id], 0))]));
    porMes.set(mes, { mes, produtos, total });
  }
  if (!porMes.size) throw new Error('não achei nenhum mês (data na coluna B e produtos até "CONSOLIDADO")');
  const meses = [...porMes.values()].sort((a, b) => a.mes.localeCompare(b.mes));
  return { linhas: LINHAS_DRE, meses };
}
