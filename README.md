# Invitación Fiesta de Fin de Año DGTIC 2026

Invitación web responsiva con fondo animado en canvas, programa del evento y encuestas
para votar el menú y la música. Cada celular solo puede participar una vez.

## Requisitos

- Node.js 22.13 o superior (usa `node:sqlite`, no hay dependencias que instalar)

## Uso

```bash
npm start
```

Abre `http://localhost:3000`. Para verlo desde otro celular en la misma red usa la IP de tu equipo.

### Variables de entorno

| Variable | Por defecto | Descripción |
| --- | --- | --- |
| `PORT` | `3000` | Puerto del servidor |
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
5. Validación estricta en el servidor, transacción en SQLite, límite de peticiones,
   tiempo mínimo, campo trampa para bots y cabeceras de seguridad (CSP, etc.).

Limitaciones conocidas: dos celulares idénticos (mismo modelo y versión) en la misma red Wi-Fi
pueden compartir huella; si ocurre, usa `MODO_ESTRICTO=0`. Y en una red de oficina todos
comparten IP, por eso el tope por IP es alto.

## Estructura

```
server/     API, base de datos SQLite y seguridad
public/     Invitación (HTML, CSS, JS y canvas)
data/       Base de datos y secreto (se crea sola, no se sube a git)
```
