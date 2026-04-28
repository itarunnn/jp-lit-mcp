# install-skills.ps1
# Windows wrapper for scripts/install-skills.mjs.

param([string]$Platform = "all")

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
node (Join-Path $ScriptDir "install-skills.mjs") $Platform
