// Despesas do fundo: o site lê só a pasta "Publicado" das despesas (publicada uma vez por mês).
// Vale o arquivo .xlsx mais recente da pasta. Layout esperado (o da planilha "Despesas Vox"):
//   linha 1: "Fornecedor", "Serviço", [opcional "Categoria"], e um mês por coluna (data ou "mm/aaaa");
//   linhas seguintes: uma despesa por linha. Linhas sem fornecedor (ex.: a de total) são ignoradas.
// A coluna "Categoria" é opcional; sem ela, a tela deduz a categoria pelo nome do serviço.
import fs from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";

const normalizar = (s) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

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

// Cabeçalho de mês → "AAAA-MM" (data do Excel, "09/2026", "set/26", "Setembro 2026"...)
const ABREV = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
function mesDoCabecalho(v) {
  if (v instanceof Date) return v.toISOString().slice(0, 7);
  if (typeof v === "number" && v > 20000 && v < 80000) {
    return new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000).toISOString().slice(0, 7);
  }
  const s = normalizar(v);
  let m = s.match(/^(\d{1,2})[/.-](\d{4})$/);
  if (m) return `${m[2]}-${m[1].padStart(2, "0")}`;
  m = s.match(/^([a-z]{3})[a-z]*[\s/.-]*(\d{2}|\d{4})$/);
  if (m && ABREV.includes(m[1])) {
    const ano = m[2].length === 2 ? `20${m[2]}` : m[2];
    return `${ano}-${String(ABREV.indexOf(m[1]) + 1).padStart(2, "0")}`;
  }
  return null;
}

const numero = (v) => (typeof v === "number" ? v : typeof v === "string" && v.trim()
  ? Number(v.replace(/[R$\s.]/g, "").replace(",", ".")) || 0 : 0);

// O arquivo publicado mais recente da pasta (cria a pasta se ainda não existir).
export async function arquivoPublicado(pasta) {
  await fs.mkdir(pasta, { recursive: true });
  let maisRecente = null;
  for (const nome of await fs.readdir(pasta)) {
    if (nome.startsWith("~$") || !/\.xlsx$/i.test(nome)) continue;
    const caminho = path.join(pasta, nome);
    const { mtimeMs } = await fs.stat(caminho);
    if (!maisRecente || mtimeMs > maisRecente.mtimeMs) maisRecente = { nome, caminho, mtimeMs };
  }
  return maisRecente;
}

export async function lerDespesas(caminho) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(caminho);
  const ws = wb.worksheets.find((w) => /despesa/i.test(w.name)) || wb.worksheets[0];
  if (!ws) throw new Error("planilha sem abas");

  // linha do cabeçalho: a primeira (até a 10ª) que tem "Fornecedor"
  let linhaCab = null;
  for (let r = 1; r <= Math.min(10, ws.rowCount); r++) {
    const row = ws.getRow(r);
    for (let c = 1; c <= row.cellCount; c++) if (normalizar(valor(row.getCell(c))) === "fornecedor") { linhaCab = r; break; }
    if (linhaCab) break;
  }
  if (!linhaCab) throw new Error('não achei a coluna "Fornecedor" no cabeçalho');

  const cab = ws.getRow(linhaCab);
  const col = { fornecedor: null, servico: null, categoria: null };
  const colMeses = [];
  for (let c = 1; c <= cab.cellCount; c++) {
    const v = valor(cab.getCell(c));
    const n = normalizar(v);
    if (n === "fornecedor") col.fornecedor = c;
    else if (n === "servico") col.servico = c;
    else if (n === "categoria") col.categoria = c;
    else {
      const mes = mesDoCabecalho(v);
      if (mes) colMeses.push({ c, mes });
    }
  }
  if (!colMeses.length) throw new Error("não achei as colunas de mês no cabeçalho");

  const linhas = [];
  for (let r = linhaCab + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const fornecedor = String(valor(row.getCell(col.fornecedor)) ?? "").trim();
    if (!fornecedor || /^total/i.test(fornecedor)) continue;
    const valores = {};
    for (const { c, mes } of colMeses) {
      const v = numero(valor(row.getCell(c)));
      if (v) valores[mes] = Math.round(v * 100) / 100;
    }
    linhas.push({
      fornecedor,
      servico: col.servico ? String(valor(row.getCell(col.servico)) ?? "").trim() : "",
      categoria: col.categoria ? String(valor(row.getCell(col.categoria)) ?? "").trim() : "",
      valores,
    });
  }
  // meses com algum valor, em ordem
  const meses = [...new Set(colMeses.map((m) => m.mes))].sort()
    .filter((m) => linhas.some((l) => l.valores[m]));
  return { meses, linhas };
}

// ---------- planilha de um mês só (botão "Baixar planilha" > "Só <mês>") ----------
// Parte da planilha publicada (histórico) e mantém o layout dela: mesma aba, estilos, larguras e
// cabeçalho. Ficam as colunas de identificação (as que vêm antes do 1º mês) e a coluna do mês
// escolhido; somem as dos outros meses e o que vier depois delas (ex.: total do período), e as
// linhas de fornecedor sem valor no mês. Fórmulas viram o valor que o Excel já tinha calculado
// (assim nenhuma soma quebra ao tirar colunas/linhas). As outras abas não vão.
function colunaLetra(n) { let s = ""; while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); } return s; }
function colunaNumero(l) { return [...l].reduce((t, ch) => t * 26 + ch.charCodeAt(0) - 64, 0); }

export async function planilhaDoMes(caminho, mesEscolhido) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(caminho);
  const ws = wb.worksheets.find((w) => /despesa/i.test(w.name)) || wb.worksheets[0];
  for (const outra of [...wb.worksheets]) if (outra.id !== ws.id) wb.removeWorksheet(outra.id);

  // cabeçalho e colunas de mês (mesma leitura de lerDespesas)
  let linhaCab = null;
  for (let r = 1; r <= Math.min(10, ws.rowCount) && !linhaCab; r++) {
    const row = ws.getRow(r);
    for (let c = 1; c <= row.cellCount; c++) if (normalizar(valor(row.getCell(c))) === "fornecedor") { linhaCab = r; break; }
  }
  if (!linhaCab) throw new Error('não achei a coluna "Fornecedor" no cabeçalho');
  const cab = ws.getRow(linhaCab);
  let colFornecedor = null;
  const colMeses = [];
  for (let c = 1; c <= cab.cellCount; c++) {
    const v = valor(cab.getCell(c));
    if (normalizar(v) === "fornecedor") colFornecedor = c;
    const mes = mesDoCabecalho(v);
    if (mes) colMeses.push({ c, mes });
  }
  const alvo = colMeses.find((m) => m.mes === mesEscolhido);
  if (!alvo) throw new Error(`mês ${mesEscolhido} não está na planilha`);
  const primeiroMes = Math.min(...colMeses.map((m) => m.c));
  const ultimaCol = Math.max(ws.columnCount, ...colMeses.map((m) => m.c));

  // 1) fórmulas -> valores (com o estilo de sempre)
  ws.eachRow({ includeEmpty: false }, (row) => row.eachCell({ includeEmpty: false }, (cell) => {
    const v = cell.value;
    if (v && typeof v === "object" && ("formula" in v || "sharedFormula" in v)) cell.value = v.result ?? null;
  }));

  // 2) mesclagens: desfaz agora e refaz no fim, com as colunas ajustadas
  const mescladas = Object.keys(ws._merges || {}).map((k) => ws._merges[k].range || ws._merges[k].shortRange || k)
    .map((r) => String(r)).filter((r) => r.includes(":"));
  for (const r of mescladas) { try { ws.unMergeCells(r); } catch { /* já desfeita */ } }

  // 3) colunas que saem (da direita para a esquerda) e larguras das que ficam
  const sai = [];
  for (let c = primeiroMes; c <= ultimaCol; c++) if (c !== alvo.c) sai.push(c);
  const ficam = [];
  for (let c = 1; c <= ultimaCol; c++) if (!sai.includes(c)) ficam.push(c);
  const larguras = ficam.map((c) => ws.getColumn(c).width);
  const ocultas = ficam.map((c) => ws.getColumn(c).hidden);
  const novaPos = (c) => c - sai.filter((x) => x < c).length;     // posição depois de tirar as colunas
  for (const c of [...sai].sort((a, b) => b - a)) ws.spliceColumns(c, 1);
  ficam.forEach((c, i) => { const col = ws.getColumn(i + 1); col.width = larguras[i]; col.hidden = ocultas[i]; });

  // 4) linhas de fornecedor sem valor no mês (de baixo para cima)
  const colValor = novaPos(alvo.c);
  for (let r = ws.rowCount; r > linhaCab; r--) {
    const row = ws.getRow(r);
    const fornecedor = String(valor(row.getCell(colFornecedor)) ?? "").trim();
    if (!fornecedor || /^total/i.test(fornecedor)) continue;
    const v = valor(row.getCell(colValor));
    if (v === null || v === "" || v === 0) ws.spliceRows(r, 1);
  }

  // 5) refaz as mesclagens que ainda fazem sentido (só linhas acima do cabeçalho e o próprio cabeçalho)
  for (const r of mescladas) {
    const m = r.replace(/\$/g, "").match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
    if (!m) continue;
    const [l1, l2] = [Number(m[2]), Number(m[4])];
    if (l2 > linhaCab) continue;
    const c1 = colunaNumero(m[1]);
    const c2 = colunaNumero(m[3]);
    const cols = ficam.filter((c) => c >= c1 && c <= c2).map(novaPos);
    if (!cols.length) continue;
    const a = Math.min(...cols), b = Math.max(...cols);
    if (a === b && l1 === l2) continue;
    try { ws.mergeCells(`${colunaLetra(a)}${l1}:${colunaLetra(b)}${l2}`); } catch { /* sobreposição: deixa sem mesclar */ }
  }
  ws.autoFilter = undefined;
  return Buffer.from(await wb.xlsx.writeBuffer());
}
