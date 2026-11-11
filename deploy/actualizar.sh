#!/usr/bin/env bash
# Actualiza el VPS con lo último de git. Ejecutar como root:  bash /opt/invitacion/deploy/actualizar.sh
set -euo pipefail
APP_DIR="${APP_DIR:-/opt/invitacion}"
APP_USER="invitacion"

[ "$(id -u)" -eq 0 ] || { echo "Ejecuta este script como root."; exit 1; }

git -c safe.directory="$APP_DIR" -C "$APP_DIR" fetch --all --quiet
git -c safe.directory="$APP_DIR" -C "$APP_DIR" reset --hard origin/main
chown -R "$APP_USER":"$APP_USER" "$APP_DIR"
sudo -u "$APP_USER" bash -c "cd '$APP_DIR' && npm ci --omit=dev"
systemctl restart invitacion
sleep 2
systemctl --no-pager --lines=3 status invitacion || true
curl -fsS "http://127.0.0.1:$(grep -E '^PORT=' /etc/invitacion.env | cut -d= -f2)/api/salud" && echo " <- actualizado y respondiendo"
