# Invitación Fiesta de Fin de Año DGTIC 2026

Invitación web responsiva con fondo animado en canvas, programa del evento y encuestas
para votar el menú y la música. Cada celular solo puede participar una vez.

## Requisitos

- Node.js 22.13 o superior
- PostgreSQL en producción. En desarrollo no hace falta: sin `DATABASE_URL` se usa PGlite (PostgreSQL embebido, datos en `data/pgdata`)

## Uso

```bash
npm start
```

Abre `http://localhost:3000`. Para verlo desde otro celular en la misma red usa la IP de tu equipo.

### Variables de entorno

| Variable | Por defecto | Descripción |
| --- | --- | --- |
| `PORT` | `3000` | Puerto del servidor |
| `DATABASE_URL` | _(vacía)_ | Conexión a PostgreSQL, p. ej. `postgres://usuario:clave@127.0.0.1:5432/invitaciondgtic` |
| `ADMIN_USER` / `ADMIN_PASS` | _(vacías)_ | Credenciales del panel (alternativa a `npm run admin:crear`, útil en hosting) |
| `MAX_VOTOS_POR_IP` | `15` | Tope de participaciones desde una misma red |
| `MODO_ESTRICTO` | `1` | `0` desactiva el bloqueo por huella + IP |
| `MIN_SEGUNDOS` | `6` | Tiempo mínimo entre abrir la página y votar |
| `TRUST_PROXY` | `0` | `1` si corre detrás de un proxy (usa `X-Forwarded-For`) |
| `SECRETO` | _(se genera)_ | Secreto para firmar cookies; si no se define se guarda en `data/secreto.key` |

## Panel de administración

Disponible en `/admin` (por ejemplo `http://localhost:3000/admin`). Muestra en tiempo real:
participantes, favoritos del menú, géneros más votados, canciones pedidas y la participación en
el tiempo, con porcentajes. Se puede filtrar por periodo, por sección, buscar opciones y tocar
cualquier opción para ver solo a quienes la eligieron (filtros cruzados). Incluye exportar a CSV.

Crear o cambiar el usuario (la contraseña se guarda con hash en `data/admin.json`, que no se sube a git):

```bash
npm run admin:crear -- usuario contraseña
```

En un servidor de producción ejecuta ese comando allí mismo, o define `ADMIN_USER` y `ADMIN_PASS`.
El acceso está limitado a 8 intentos cada 15 minutos por red y la sesión dura 8 horas.

## Despliegue en el VPS

Producción: `https://fiestatic.minvitacion.cloud` (Nginx + HTTPS, servicio systemd, base `invitaciondgtic` en PostgreSQL).
Primera instalación, como root en el VPS (pide las contraseñas por teclado, no se guardan en git):

```bash
git clone https://github.com/jessfn/invitacion.git /opt/invitacion
bash /opt/invitacion/deploy/instalar.sh
```

Después de cada `git push`, en el VPS:

```bash
bash /opt/invitacion/deploy/actualizar.sh
```

Los datos (votos) viven en PostgreSQL y los secretos en `/etc/invitacion.env` y `/opt/invitacion/data`; ninguno se toca al actualizar.

## Música de fondo

La invitación reproduce en bucle `public/assets/musica/mix-navideno.mp3` cuando el invitado toca
«Abrir invitación». Para cambiarla basta reemplazar ese archivo (y subir el número `?v=` en
`public/js/musica.js` para que los navegadores no usen la copia anterior).

## Personalizar

Fecha, lugar, programa, menú y preguntas están en [`server/datos.js`](server/datos.js).
Para activar la cuenta regresiva define `fecha` con formato ISO, por ejemplo
`2026-12-12T15:00:00-06:00`.

## Cómo se evita el voto duplicado

Ningún método es infalible sin una cuenta de usuario, por eso se combinan varios:

1. **Cookie firmada** (HMAC, `HttpOnly`, `SameSite=Strict`) que identifica al dispositivo.
2. **Huella del dispositivo** (canvas, WebGL, pantalla, zona horaria…) combinada con la **IP**.
   Si alguien borra las cookies o abre una pestaña privada, la huella + IP lo delata.
3. **Tope por IP** para frenar scripts desde una misma red.
4. La IP se guarda solo como hash irreversible.
5. Validación estricta en el servidor, transacción en PostgreSQL con candado, límite de peticiones,
   tiempo mínimo, campo trampa para bots y cabeceras de seguridad (CSP, etc.).

Limitaciones conocidas: dos celulares idénticos (mismo modelo y versión) en la misma red Wi-Fi
pueden compartir huella; si ocurre, usa `MODO_ESTRICTO=0`. Y en una red de oficina todos
comparten IP, por eso el tope por IP es alto.

## Estructura

```
server/     API, base de datos PostgreSQL y seguridad
public/     Invitación (HTML, CSS, JS y canvas)
data/       Base de datos y secreto (se crea sola, no se sube a git)
```
