# Saves a print-ready PDF of a Word file, through Word itself (Windows with Microsoft Word).
# Opens the document read-only and never changes it. Saves "<name>.pdf" next to it, or "<name> v2.pdf" if that exists.
param([Parameter(Mandatory = $true)][string]$Docx)
$full = (Resolve-Path -LiteralPath $Docx).Path
$pdf = [IO.Path]::ChangeExtension($full, '.pdf')
$i = 2
while (Test-Path -LiteralPath $pdf) { $pdf = Join-Path (Split-Path $full) ("{0} v{1}.pdf" -f [IO.Path]::GetFileNameWithoutExtension($full), $i); $i++ }
$word = New-Object -ComObject Word.Application
$word.Visible = $false
try { $doc = $word.Documents.Open($full, $false, $true); $doc.ExportAsFixedFormat($pdf, 17); $doc.Close($false) }
finally { $word.Quit() }
"Saved $pdf"
