// Gerador de .xlsx leve, feito para planilhas grandes (centenas de milhares de linhas) no navegador.
// Escreve o XML da planilha em lotes e já compacta em ZIP (fflate), sem montar tudo na memória.
// Uma aba, cabeçalho escuro, sem linhas de grade, 1ª linha congelada e filtro.
//
//   const blob = await gerarXlsx({ aba: "Baixas", colunas, linhas, aoProgresso });
//   colunas: [{ titulo, largura, tipo: "texto" | "data" | "valor" }]
//   linhas:  iterável de arrays (data = "AAAA-MM-DD", valor = número)
import { Zip, ZipDeflate, strToU8 } from "fflate";

export const LIMITE_LINHAS_EXCEL = 1048575;        // 1.048.576 linhas, menos o cabeçalho

const NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const NS_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
// eslint-disable-next-line no-control-regex
const esc = (v) => String(v).replace(/[&<>"]/g, (c) => ESC[c]).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
const letra = (i) => { let s = ""; for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; };
const BASE = Date.UTC(1899, 11, 30);
const serial = (iso) => (Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) - BASE) / 86400000;
const pausa = () => new Promise((r) => setTimeout(r, 0));

const ESTILOS = `${XML}<styleSheet xmlns="${NS}">
<numFmts count="1"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/></numFmts>
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F1B14"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="5">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="right"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

function celula(v, tipo) {
  if (v === null || v === undefined || v === "") return "<c/>";
  if (tipo === "data") return `<c s="2"><v>${serial(v)}</v></c>`;
  if (tipo === "valor") return `<c s="3"><v>${v}</v></c>`;
  return `<c t="inlineStr"><is><t>${esc(v)}</t></is></c>`;
}

export async function gerarXlsx({ aba = "Planilha", colunas, linhas, aoProgresso }) {
  const partes = [];
  let erro = null;
  let fim;
  const pronto = new Promise((r) => { fim = r; });
  const zip = new Zip((e, dados, final) => {
    if (e) { erro = e; fim(); return; }
    partes.push(dados);
    if (final) fim();
  });
  const arquivo = (nome, texto) => {
    const f = new ZipDeflate(nome, { level: 6 });
    zip.add(f);
    f.push(strToU8(texto), true);
  };

  arquivo("[Content_Types].xml", `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`
    + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    + '<Default Extension="xml" ContentType="application/xml"/>'
    + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
    + '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
    + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
    + "</Types>");
  arquivo("_rels/.rels", `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
    + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
    + "</Relationships>");
  arquivo("xl/_rels/workbook.xml.rels", `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
    + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
    + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
    + "</Relationships>");
  arquivo("xl/styles.xml", ESTILOS);

  // planilha: em lotes
  const folha = new ZipDeflate("xl/worksheets/sheet1.xml", { level: 6 });
  zip.add(folha);
  const cols = colunas.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.largura || 12}" customWidth="1"/>`).join("");
  const cab = colunas.map((c) => `<c s="${c.tipo === "valor" ? 4 : 1}" t="inlineStr"><is><t>${esc(c.titulo)}</t></is></c>`).join("");
  folha.push(strToU8(`${XML}<worksheet xmlns="${NS}" xmlns:r="${NS_R}">`
    + '<sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
    + `<sheetFormatPr defaultRowHeight="15"/><cols>${cols}</cols><sheetData><row>${cab}</row>`));
  let n = 0;
  let lote = [];
  for (const l of linhas) {
    lote.push(`<row>${l.map((v, i) => celula(v, colunas[i].tipo)).join("")}</row>`);
    n++;
    if (lote.length === 5000) {
      folha.push(strToU8(lote.join("")));
      lote = [];
      aoProgresso?.(n);
      await pausa();                             // deixa a tela respirar
    }
  }
  const ultimaCol = letra(colunas.length - 1);
  folha.push(strToU8(`${lote.join("")}</sheetData><autoFilter ref="A1:${ultimaCol}${n + 1}"/></worksheet>`), true);

  arquivo("xl/workbook.xml", `${XML}<workbook xmlns="${NS}" xmlns:r="${NS_R}"><sheets>`
    + `<sheet name="${esc(aba)}" sheetId="1" r:id="rId1"/></sheets>`
    + `<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">'${esc(aba)}'!$A$1:$${ultimaCol}$${n + 1}</definedName></definedNames>`
    + "</workbook>");
  zip.end();
  await pronto;
  if (erro) throw erro;
  return new Blob(partes, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
