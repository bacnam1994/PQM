# =============================================================================
# PQM - Export Full Source Code Script
# Xuất toàn bộ mã nguồn ra FULL_SOURCE_CODE.md
# Chạy từ thư mục gốc dự án: .\scripts\export_full_source.ps1
# =============================================================================

param(
    [string]$OutputFile = "FULL_SOURCE_CODE.md",
    [string]$ProjectRoot = $PSScriptRoot + "\.."
)

$ProjectRoot = Resolve-Path $ProjectRoot
$OutputPath = Join-Path $ProjectRoot $OutputFile

Write-Host "🔄 Bắt đầu xuất FULL_SOURCE_CODE.md..." -ForegroundColor Cyan
Write-Host "   Thư mục dự án: $ProjectRoot" -ForegroundColor Gray

# Danh sách extension được phép xuất
$AllowedExtensions = @(
    ".ts", ".tsx", ".js", ".jsx", ".json", ".md", ".css",
    ".html", ".cjs", ".mjs", ".env.example", ".yaml", ".yml",
    ".rules", ".sql"
)

# Thư mục / file loại trừ
$ExcludeDirs = @("node_modules", ".git", "dist", ".firebase", "coverage", ".cache", "scripts")
$ExcludeFiles = @("FULL_SOURCE_CODE.md", "package-lock.json", "pnpm-lock.yaml")

# Map extension -> ngôn ngữ markdown
$LangMap = @{
    ".ts"   = "typescript"
    ".tsx"  = "tsx"
    ".js"   = "javascript"
    ".jsx"  = "jsx"
    ".json" = "json"
    ".md"   = "markdown"
    ".css"  = "css"
    ".html" = "html"
    ".cjs"  = "javascript"
    ".mjs"  = "javascript"
    ".yaml" = "yaml"
    ".yml"  = "yaml"
    ".rules"= "json"
    ".sql"  = "sql"
}

# Thu thập tất cả file hợp lệ
function Get-SourceFiles {
    $files = @()
    
    Get-ChildItem -Path $ProjectRoot -Recurse -File | ForEach-Object {
        $file = $_
        $relativePath = $file.FullName.Substring($ProjectRoot.ToString().Length + 1).Replace("\", "/")
        
        # Kiểm tra loại trừ thư mục
        $inExcluded = $false
        foreach ($ex in $ExcludeDirs) {
            if ($relativePath -like "$ex/*" -or $relativePath -eq $ex) {
                $inExcluded = $true
                break
            }
        }
        if ($inExcluded) { return }
        
        # Kiểm tra file loại trừ
        if ($ExcludeFiles -contains $file.Name) { return }
        
        # Kiểm tra extension
        $ext = $file.Extension.ToLower()
        if ($AllowedExtensions -notcontains $ext) { return }
        
        $files += [PSCustomObject]@{
            FullPath     = $file.FullName
            RelativePath = $relativePath
            Extension    = $ext
            SizeBytes    = $file.Length
            SizeKB       = [Math]::Round($file.Length / 1024, 1)
        }
    }
    
    # Sắp xếp: root files trước, sau đó theo đường dẫn
    return $files | Sort-Object { 
        $depth = ($_.RelativePath -split "/").Count
        "$($depth.ToString('D3'))_$($_.RelativePath)"
    }
}

$allFiles = Get-SourceFiles
$totalFiles = $allFiles.Count
$totalLines = 0
$totalSizeKB = 0

# Đếm tổng dòng và kích thước
foreach ($f in $allFiles) {
    try {
        $content = Get-Content $f.FullPath -Raw -Encoding UTF8 -ErrorAction SilentlyContinue
        if ($content) {
            $lineCount = ($content -split "`n").Count
            $totalLines += $lineCount
        }
    } catch {}
    $totalSizeKB += $f.SizeKB
}

$now = Get-Date -Format "HH:mm:ss d/M/yyyy"

Write-Host "   📁 Tổng file: $totalFiles | 📝 Tổng dòng: $($totalLines.ToString('N0')) | 💾 $([Math]::Round($totalSizeKB, 1)) KB" -ForegroundColor Green

# Bắt đầu ghi file output
$sb = [System.Text.StringBuilder]::new()

# === HEADER ===
[void]$sb.AppendLine("# PQM - TỔNG HỢP TOÀN BỘ MÃ NGUỒN HỆ THỐNG")
[void]$sb.AppendLine("")
[void]$sb.AppendLine("> **Phần mềm Quản lý Kiểm nghiệm & Chất lượng Dược phẩm / Biotech**  ")
[void]$sb.AppendLine("> **Thời gian xuất**: $now  ")
[void]$sb.AppendLine("> **Tổng số file**: $totalFiles files  ")
[void]$sb.AppendLine("> **Tổng số dòng code**: $($totalLines.ToString('N0')) dòng  ")
[void]$sb.AppendLine("> **Tổng dung lượng**: $([Math]::Round($totalSizeKB, 1)) KB  ")
[void]$sb.AppendLine("")
[void]$sb.AppendLine("---")
[void]$sb.AppendLine("")

# === MỤC LỤC ===
[void]$sb.AppendLine("## 📑 Mục lục toàn bộ file")
[void]$sb.AppendLine("")
[void]$sb.AppendLine("| STT | File | Số dòng | Kích thước |")
[void]$sb.AppendLine("| :---: | :--- | :---: | :---: |")

$idx = 0
foreach ($f in $allFiles) {
    $idx++
    $stt = $idx.ToString("D3")
    $anchor = "file-$stt-" + ($f.RelativePath -replace "[^a-zA-Z0-9]", "-").ToLower()
    
    try {
        $content = Get-Content $f.FullPath -Raw -Encoding UTF8 -ErrorAction SilentlyContinue
        $lineCount = if ($content) { ($content -split "`n").Count } else { 0 }
    } catch { $lineCount = 0 }
    
    $sizeStr = if ($f.SizeKB -ge 1) { "$($f.SizeKB) KB" } else { "$($f.SizeBytes) B" }
    [void]$sb.AppendLine("| $stt | [$($f.RelativePath)](#$anchor) | $lineCount | $sizeStr |")
}

[void]$sb.AppendLine("")
[void]$sb.AppendLine("---")
[void]$sb.AppendLine("")

# === NỘI DUNG TỪNG FILE ===
[void]$sb.AppendLine("## 📂 Nội dung chi tiết từng file")
[void]$sb.AppendLine("")

$idx = 0
foreach ($f in $allFiles) {
    $idx++
    $stt = $idx.ToString("D3")
    $anchor = "file-$stt-" + ($f.RelativePath -replace "[^a-zA-Z0-9]", "-").ToLower()
    $lang = if ($LangMap.ContainsKey($f.Extension)) { $LangMap[$f.Extension] } else { "" }
    
    try {
        $content = Get-Content $f.FullPath -Raw -Encoding UTF8 -ErrorAction SilentlyContinue
        $lineCount = if ($content) { ($content -split "`n").Count } else { 0 }
    } catch { 
        $content = "// [Không đọc được file]"
        $lineCount = 0
    }
    
    $sizeStr = if ($f.SizeKB -ge 1) { "$($f.SizeKB) KB" } else { "$($f.SizeBytes) B" }
    
    [void]$sb.AppendLine("### <a id=`"$anchor`"></a>File $stt: ``$($f.RelativePath)``")
    [void]$sb.AppendLine("")
    [void]$sb.AppendLine("> **Đường dẫn**: \`$($f.RelativePath)\` | **Dòng**: $lineCount | **Kích thước**: $sizeStr")
    [void]$sb.AppendLine("")
    [void]$sb.AppendLine("``````$lang")
    if ($content) {
        [void]$sb.Append($content.TrimEnd())
    }
    [void]$sb.AppendLine("")
    [void]$sb.AppendLine("``````")
    [void]$sb.AppendLine("")
    [void]$sb.AppendLine("---")
    [void]$sb.AppendLine("")
    
    if ($idx % 20 -eq 0) {
        Write-Host "   ✅ Đã xử lý $idx/$totalFiles files..." -ForegroundColor Gray
    }
}

# Ghi ra file
$sb.ToString() | Set-Content -Path $OutputPath -Encoding UTF8 -NoNewline

$finalSizeKB = [Math]::Round((Get-Item $OutputPath).Length / 1024, 1)
Write-Host ""
Write-Host "✅ Hoàn tất! FULL_SOURCE_CODE.md đã được xuất." -ForegroundColor Green
Write-Host "   📄 File: $OutputPath" -ForegroundColor Cyan
Write-Host "   📊 Kích thước: $finalSizeKB KB | $totalFiles files | $($totalLines.ToString('N0')) dòng" -ForegroundColor Cyan
