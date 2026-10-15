# Envia um e-mail pelo Outlook instalado neste PC (sai da sua conta e fica nos Itens Enviados).
# Usado pelo publicador (publicador/emails.js). Recebe um arquivo JSON com to, cc, subject, html e imagens.
param([Parameter(Mandatory = $true)][string]$Arquivo)
$ErrorActionPreference = 'Stop'
$d = Get-Content -Raw -Encoding UTF8 -LiteralPath $Arquivo | ConvertFrom-Json
$ol = New-Object -ComObject Outlook.Application
$m = $ol.CreateItem(0)
$m.To = $d.to
if ($d.cc) { $m.CC = $d.cc }
$m.Subject = $d.subject
# imagens embutidas no corpo do e-mail (cid:...), não aparecem como anexo
foreach ($img in @($d.imagens)) {
  if ($img -and $img.caminho -and (Test-Path -LiteralPath $img.caminho)) {
    $a = $m.Attachments.Add($img.caminho, 1, 0)
    $a.PropertyAccessor.SetProperty('http://schemas.microsoft.com/mapi/proptag/0x3712001F', $img.cid)
    $a.PropertyAccessor.SetProperty('http://schemas.microsoft.com/mapi/proptag/0x7FFE000B', $true)
  }
}
$m.HTMLBody = $d.html
$m.Send()
Write-Output 'enviado'
