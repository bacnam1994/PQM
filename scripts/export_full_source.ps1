# =============================================================================
# PQM - Export Full Source Code Wrapper
# Gọi script chuẩn: npm run export:source (node scripts/exportAllSource.cjs)
# =============================================================================

Set-Location (Split-Path -Parent $PSScriptRoot)
npm run export:source
