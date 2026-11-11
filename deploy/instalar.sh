#!/usr/bin/env bash
# Instalación completa en el VPS (Debian/Ubuntu). Ejecutar como root:
#   curl -fsSL https://raw.githubusercontent.com/jessfn/invitacion/main/deploy/instalar.sh -o instalar.sh
#   bash instalar.sh
# Es repetible: si ya está instalado, actualiza y reinicia.
set -euo pipefail

DOMINIO="${DOMINIO:-fiestatic.minvitacion.cloud}"
REPO="${REPO:-https://github.com/jessfn/invitacion.git}"
APP_DIR="${APP_DIR:-/opt/invitacion}"
PUERTO="${PUERTO:-3100}"
APP_USER="invitacion"
ENV_FILE="/etc/invitacion.env"
BASE_DATOS="invitaciondgtic"
DB_USER="jesus"

[ "$(id -u)" -eq 0 ] || { echo "Ejecuta este script como root."; exit 1; }
command -v apt-get >/dev/null || { echo "Este script usa apt (Debian/Ubuntu)."; exit 1; }

paso() { printf '\n\033[1;33m==> %s\033[0m\n' "$*"; }

paso "Paquetes del sistema"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y git curl ca-certificates nginx certbot python3-certbot-nginx python3

paso "Node.js 22"
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
node -v

paso "Usuario del servicio y código"
id "$APP_USER" >/dev/null 2>&1 || useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin "$APP_USER"
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" fetch --all --quiet
  git -C "$APP_DIR" reset --hard origin/main
else
  git clone "$REPO" "$APP_DIR"
fi
mkdir -p "$APP_DIR/data"
chown -R "$APP_USER":"$APP_USER" "$APP_DIR"
sudo -u "$APP_USER" bash -c "cd '$APP_DIR' && npm ci --omit=dev"

paso "Base de datos PostgreSQL ($BASE_DATOS)"
if ! command -v psql >/dev/null; then echo "No encuentro PostgreSQL (psql) en este servidor."; exit 1; fi
sudo -u postgres psql -v ON_ERROR_STOP=1 -f "$APP_DIR/deploy/crear-base.sql"

paso "Configuración privada ($ENV_FILE)"
if [ ! -f "$ENV_FILE" ]; then
  read -r -s -p "Contraseña del usuario '$DB_USER' de PostgreSQL: " DB_PASS; echo
  [ -n "$DB_PASS" ] || { echo "La contraseña no puede estar vacía."; exit 1; }
  DB_PASS_URL="$(DB_PASS="$DB_PASS" python3 -c 'import os,urllib.parse;print(urllib.parse.quote(os.environ["DB_PASS"],safe=""))')"
  umask 077
  cat >"$ENV_FILE" <<EOF
PORT=$PUERTO
TRUST_PROXY=1
DATABASE_URL=postgres://$DB_USER:$DB_PASS_URL@127.0.0.1:5432/$BASE_DATOS
EOF
  chown root:"$APP_USER" "$ENV_FILE"
  chmod 640 "$ENV_FILE"
else
  echo "Ya existe $ENV_FILE; se conserva."
fi

paso "Probar conexión a la base"
cd "$APP_DIR"
set -a; . "$ENV_FILE"; set +a
sudo -u "$APP_USER" env DATABASE_URL="$DATABASE_URL" node -e "
import('pg').then(async ({default: pg}) => {
  const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await c.connect(); const r = await c.query('select current_database() as bd'); console.log('Conectado a', r.rows[0].bd); await c.end();
}).catch((e) => { console.error('No se pudo conectar:', e.message); process.exit(1); });
" || exit 1

paso "Administrador del panel (/admin)"
if [ ! -f "$APP_DIR/data/admin.json" ]; then
  read -r -p "Usuario administrador [admin]: " ADM_USER; ADM_USER="${ADM_USER:-admin}"
  read -r -s -p "Contraseña del administrador: " ADM_PASS; echo
  [ -n "$ADM_PASS" ] || { echo "La contraseña no puede estar vacía."; exit 1; }
  sudo -u "$APP_USER" bash -c "cd '$APP_DIR' && node server/crear-admin.js \"\$0\" \"\$1\"" "$ADM_USER" "$ADM_PASS"
else
  echo "Ya existe data/admin.json; se conserva."
fi

paso "Servicio systemd"
cat >/etc/systemd/system/invitacion.service <<EOF
[Unit]
Description=Invitación DGTIC 2026
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=$APP_USER
Group=$APP_USER
WorkingDirectory=$APP_DIR
EnvironmentFile=$ENV_FILE
ExecStart=/usr/bin/node server/index.js
Restart=always
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$APP_DIR/data

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable invitacion >/dev/null
systemctl restart invitacion
sleep 3
systemctl --no-pager --lines=5 status invitacion || true
curl -fsS "http://127.0.0.1:$PUERTO/api/salud" && echo " <- la aplicación responde"

paso "Nginx para $DOMINIO"
cat >"/etc/nginx/sites-available/$DOMINIO" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMINIO;

    client_max_body_size 16k;

    location / {
        proxy_pass http://127.0.0.1:$PUERTO;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        # Se reemplaza (no se acumula) para que nadie pueda falsear su IP.
        proxy_set_header X-Forwarded-For \$remote_addr;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Connection "";
        proxy_read_timeout 1h;
    }

    # Panel en tiempo real (Server-Sent Events): sin buffer.
    location /api/admin/stream {
        proxy_pass http://127.0.0.1:$PUERTO;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-For \$remote_addr;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Connection "";
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 1h;
    }
}
EOF
ln -sf "/etc/nginx/sites-available/$DOMINIO" "/etc/nginx/sites-enabled/$DOMINIO"
nginx -t
systemctl reload nginx

paso "Certificado HTTPS (Let's Encrypt)"
IP_PUBLICA="$(curl -fsS https://api.ipify.org || true)"
IP_DNS="$(getent hosts "$DOMINIO" | awk '{print $1}' | head -n1 || true)"
echo "IP del servidor: ${IP_PUBLICA:-?}  ·  IP del DNS de $DOMINIO: ${IP_DNS:-sin resolver}"
if [ -n "$IP_PUBLICA" ] && [ "$IP_PUBLICA" != "$IP_DNS" ]; then
  echo "AVISO: el DNS aún no apunta a este servidor; el certificado puede fallar."
fi
certbot --nginx -d "$DOMINIO" --non-interactive --agree-tos --register-unsafely-without-email --redirect

paso "Listo"
echo "Invitación: https://$DOMINIO"
echo "Panel:      https://$DOMINIO/admin"
echo "Para actualizar después de un git push:  bash $APP_DIR/deploy/actualizar.sh"
