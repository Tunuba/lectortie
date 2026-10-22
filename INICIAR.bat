@echo off
title LECTORTIE
cd /d "%~dp0"
start "" http://localhost:4322
node servidor\servidor.js
