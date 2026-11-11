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
| `MAX_VOTOS_POR_IP` | `400` | Tope de participaciones desde una misma red (freno contra scripts; una oficina comparte IP) |
| `MODO_ESTRICTO` | `1` | `0` desactiva el bloqueo por huella del dispositivo |
| `HUELLA_SOLA` | `0` | `1` bloquea por huella desde cualquier red (más estricto; ver abajo) |
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

Ningún método es infalible sin una cuenta o un código por persona, por eso se combinan capas.
Cada una se prueba con `pruebas/voto-unico.mjs` (instrucciones en el propio archivo):

1. **Cookie firmada** (HMAC, `HttpOnly`, `SameSite=Strict`, 1 año) que identifica al dispositivo.
2. **Token firmado en `localStorage`**: el servidor lo entrega y el navegador lo manda en cada
   petición (`X-Dispositivo`). Si alguien borra solo las cookies, el servidor lo reconoce igual y
   le restituye la cookie. No se puede falsificar (lleva firma).
3. **Huella del dispositivo** (hardware y navegador: pantalla, GPU, audio, canvas, modelo, idioma,
   zona horaria; solo señales estables) **junto con la misma red**. Atrapa a quien borra todo o abre
   una pestaña privada en el mismo Wi-Fi.
4. Se guarda el voto en PostgreSQL dentro de una transacción con candado, así que varios envíos
   simultáneos del mismo teléfono solo cuentan una vez.
5. Límites contra scripts (por red y por dispositivo), tiempo mínimo, campo trampa y validación
   estricta en el servidor. La IP solo se guarda como hash irreversible.
6. El panel `/admin` cuenta los **votos duplicados bloqueados**, para ver si algo no funciona.

**Limitación conocida:** quien borra *todos* los datos del navegador *y además* cambia de red
(por ejemplo del Wi-Fi a datos móviles) no se distingue de un teléfono nuevo. Con `HUELLA_SOLA=1`
también se bloquea ese caso, pero dos teléfonos idénticos (mismo modelo y versión de sistema, muy
común en iPhone) podrían confundirse y a uno se le negaría el voto por error. Úsalo solo si ves
votos repetidos en el panel.

## Estructura

```
server/     API, base de datos PostgreSQL y seguridad
public/     Invitación (HTML, CSS, JS y canvas)
data/       Base de datos y secreto (se crea sola, no se sube a git)
```
