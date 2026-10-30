// E-mail "Nova solicitação de devolução" (BK004, BK007...): quando o admin cria uma solicitação na aba
// Devoluções do Argos, o publicador percebe (confere a cada minuto) e avisa pelo Outlook deste PC,
// no mesmo visual do e-mail de acesso liberado: qual BK, período, valor e um botão para acompanhar.
// Quem já recebeu fica marcado na própria solicitação (coluna aviso_em; supabase/devolucoes-aviso.sql).
// Ligar/desligar: EMAIL_DEVOLUCOES=true|false no .env. Destinatários: DEVOLUCOES_AVISO_PARA / _CC.
// Prévia sem enviar (grava publicador/email/previa-devolucao.html): node publicador/emails-devolucoes.js --previa
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { IMAGENS, SITE, esc, enviarPeloOutlook } from "./emails.js";

const PASTA = path.dirname(fileURLToPath(import.meta.url));
const PARA_PADRAO = "fabiana.jesus@voxcred.com.br; denise.nunes@tendaatacado.com.br; lucas.ramao@voxcred.com.br";
const CC_PADRAO = "vp@h2kapital.com.br; vm@h2kapital.com.br; ae@h2kapital.com.br";
const MAX_TENTATIVAS = 5;
const falhas = {};

export const avisoDevolucaoLigado = () => (process.env.EMAIL_DEVOLUCOES || "true").toLowerCase() !== "false";
const cids = Object.fromEntries(IMAGENS.map((i) => [i.cid, `cid:${i.cid}`]));
const br = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const brl = (v) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function htmlDevolucao({ bk, inicio, fim, valor, site = SITE(), img = cids }) {
  const fonte = "'Segoe UI', Arial, sans-serif";
  const link = `${site.replace(/\/?$/, "/")}#/relatorios/${bk.toLowerCase()}`;
  const periodo = inicio === fim ? br(inicio) : `${br(inicio)} a ${br(fim)}`;
  const linha = (rotulo, valorHtml, ultima = false) => `<tr>
        <td style="padding:12px 0;${ultima ? "" : "border-bottom:1px solid #eee6d6;"}font-family:${fonte};font-size:14px;color:#6f6656;">${rotulo}</td>
        <td align="right" style="padding:12px 0;${ultima ? "" : "border-bottom:1px solid #eee6d6;"}font-family:${fonte};font-size:15px;color:#1f1b14;">${valorHtml}</td></tr>`;
  return `<!doctype html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f5f2ec;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f2ec;">
<tr><td align="center" style="padding:32px 12px;">
  <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px;max-width:560px;background:#ffffff;border:1px solid #e3dccd;">
    <tr><td bgcolor="#15130f" style="background:#15130f;padding:20px 30px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="vertical-align:middle;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
            <td style="vertical-align:middle;"><img src="${img["logo-h2"]}" width="41" height="44" alt="H2 Kapital" style="display:block;border:0;"></td>
            <td style="vertical-align:middle;padding:0 14px;"><div style="width:1px;height:32px;background:#3a3326;"></div></td>
            <td style="vertical-align:middle;"><img src="${img["argos-olho"]}" width="26" height="26" alt="" style="display:block;border:0;"></td>
            <td style="vertical-align:middle;padding-left:10px;font-family:${fonte};font-size:18px;font-weight:600;letter-spacing:6px;color:#c9a35c;">ARGOS</td>
          </tr></table>
        </td>
        <td align="right" style="vertical-align:middle;"><img src="${img["vox-fidc"]}" width="80" height="36" alt="Vox FIDC" style="display:block;border:0;"></td>
      </tr></table>
    </td></tr>
    <tr><td style="padding:32px 36px 8px 36px;font-family:${fonte};">
      <p style="margin:0 0 6px 0;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#a8812f;">Devoluções · ${esc(bk)}</p>
      <h1 style="margin:0 0 18px 0;font-size:22px;line-height:29px;font-weight:600;color:#1f1b14;">Nova solicitação de devolução do ${esc(bk)}.</h1>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 26px 0;border-top:1px solid #eee6d6;">
        ${linha("Relatório", `<b>${esc(bk)}</b>`)}
        ${linha("Período", esc(periodo))}
        ${linha("Valor", `<b style="color:#7d5f1f;">${esc(brl(valor))}</b>`)}
        ${linha("Situação", "Aguardando aprovação Qi Tech", true)}
      </table>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td bgcolor="#a8812f" style="background:#a8812f;">
          <a href="${esc(link)}" style="display:inline-block;padding:13px 30px;font-family:${fonte};font-size:13px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#ffffff;text-decoration:none;">Acompanhar no Argos</a>
        </td>
      </tr></table>
    </td></tr>
    <tr><td style="padding:24px 36px 30px 36px;font-family:${fonte};">
      <p style="margin:0;padding-top:18px;border-top:1px solid #e3dccd;font-size:12px;line-height:18px;color:#6f6656;">No Argos, em Relatórios › Devoluções, você acompanha cada etapa até a liquidação.</p>
    </td></tr>
  </table>
  <p style="margin:16px 0 0 0;font-family:${fonte};font-size:11px;color:#9a917f;">H2 Kapital · Plataforma Argos · Vox FIDC · Aviso automático</p>
</td></tr></table></body></html>`;
}

// Solicitações sem aviso (aviso_em vazio): manda o e-mail e marca. Sem a coluna (SQL não rodado), não faz nada.
export async function avisarDevolucoes(sb, { log = console.log, aviso = console.warn } = {}) {
  if (!avisoDevolucaoLigado()) return;
  const { data, error } = await sb.from("devolucoes").select("id, relatorio, inicio, fim, valor").is("aviso_em", null);
  if (error) {
    if (/aviso_em|devolucoes/i.test(error.message)) return;      // SQL ainda não rodado
    throw new Error(error.message);
  }
  const para = (process.env.DEVOLUCOES_AVISO_PARA || PARA_PADRAO).trim();
  const cc = (process.env.DEVOLUCOES_AVISO_CC ?? CC_PADRAO).trim();
  for (const d of data || []) {
    if ((falhas[d.id] || 0) >= MAX_TENTATIVAS) continue;
    const bk = d.relatorio.toUpperCase();
    try {
      await enviarPeloOutlook({ to: para, cc, subject: `${bk} – Nova solicitação de devolução · Argos`,
        html: htmlDevolucao({ bk, inicio: d.inicio, fim: d.fim, valor: d.valor }) });
      const { error: e2 } = await sb.from("devolucoes").update({ aviso_em: new Date().toISOString() }).eq("id", d.id);
      if (e2) throw new Error(`enviado, mas não marquei no Supabase: ${e2.message}`);
      delete falhas[d.id];
      log(`E-mail de nova solicitação ${bk} enviado.`);
    } catch (e) {
      const n = (falhas[d.id] = (falhas[d.id] || 0) + 1);
      aviso(`Não consegui enviar o aviso da solicitação ${bk} (${e.message}).`
        + (n >= MAX_TENTATIVAS ? " Desisti depois de 5 tentativas." : " Tento de novo em 1 minuto."));
    }
  }
}

const direto = process.argv[1] && path.resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase();
if (direto && process.argv.includes("--previa")) {
  const img = Object.fromEntries(IMAGENS.map((i) => [i.cid,
    "data:image/png;base64," + fs.readFileSync(path.join(PASTA, "email", i.arquivo)).toString("base64")]));
  const saida = path.join(PASTA, "email", "previa-devolucao.html");
  fs.writeFileSync(saida, htmlDevolucao({ bk: "BK007", inicio: "2026-09-24", fim: "2026-09-24", valor: 1336394.96, img }), "utf-8");
  console.log(`Prévia gravada em ${saida}`);
}
