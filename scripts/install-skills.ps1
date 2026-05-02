# install-skills.ps1
# Windows wrapper for Codex / Claude Code / Cursor skill installation.

param([string]$Platform = "all")

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
node (Join-Path $ScriptDir "install-skills.mjs") $Platform
