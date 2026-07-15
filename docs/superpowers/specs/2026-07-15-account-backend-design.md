# Diseño: backend de cuentas (registro/login real)

**Fecha:** 2026-07-15

## Objetivo
El formulario "Crear cuenta" / "Iniciar sesión" en `login.html` es actualmente falso: guarda un email en `localStorage` sin validar nada contra un servidor. Este diseño lo conecta a un backend real que guarda cuenta (nombre, email, contraseña) en una base de datos, pensado como base para más adelante enviar correos informativos a esa lista — el envío de correos en sí queda fuera de alcance por ahora.

## Arquitectura
- **Backend:** Vercel Serverless Functions (Node.js) en `/api`, desplegadas junto al resto del sitio estático — sin servidor aparte.
- **Base de datos:** Postgres gratuito vía **Vercel Storage → Neon** (integración nativa de Vercel; variables de entorno `POSTGRES_URL` etc. se inyectan automáticamente en el proyecto al provisionarla desde el dashboard).
- **Hash de contraseñas:** `crypto.scrypt` (módulo `crypto` nativo de Node — sin dependencias externas tipo bcrypt, que requieren compilación nativa y a veces fallan en serverless).

## Esquema de base de datos
Tabla `users`:
| columna | tipo | notas |
|---|---|---|
| `id` | `serial primary key` | |
| `name` | `text not null` | |
| `email` | `text not null unique` | |
| `password_hash` | `text not null` | formato `salt:hash` (hex) |
| `created_at` | `timestamptz not null default now()` | |

## Endpoints

### `POST /api/register`
Body: `{ name, email, password }`
- Valida que los 3 campos existan, email tenga formato válido, password ≥ 8 caracteres (mismo mínimo que ya exige el frontend).
- Si el email ya existe → `409 { error: "Ya existe una cuenta con ese email." }`.
- Si no, hashea la contraseña, inserta la fila, responde `200 { ok: true, name }`.

### `POST /api/login`
Body: `{ email, password }`
- Busca el usuario por email. Si no existe o el hash no coincide → `401 { error: "Email o contraseña incorrectos." }`.
- Si coincide → `200 { ok: true, name }`.

Ninguno de los dos endpoints crea sesión/cookie/JWT — la respuesta simplemente confirma éxito o fracaso. El frontend sigue marcando la sesión con `localStorage.setItem('mk2cult_user', ...)` exactamente igual que hace ahora, solo que el email/contraseña ya se validan de verdad contra la base de datos primero.

## Cambios en frontend (`login.html`)
- Se añade un campo **Nombre** al formulario de registro (`reg-name`), antes del campo email.
- `handleRegister(e)` deja de escribir directo a `localStorage`; ahora hace `fetch('/api/register', { method: 'POST', body: JSON.stringify({ name, email, password }) })`. Si `ok`, guarda `localStorage.setItem('mk2cult_user', name)` (usamos el nombre en vez del email, ya que ahora lo tenemos) y redirige a `index.html`, igual que antes. Si falla, muestra el mensaje de error igual que ya hace para "las contraseñas no coinciden".
- `handleLogin(e)` hace lo mismo contra `/api/login`.

## Fuera de alcance
- Sesiones/cookies/JWT — solo se valida una vez en el momento de login/registro.
- Envío real de emails (bienvenida, newsletter, etc.) — la base de datos queda lista para usarse como lista de correo más adelante.
- Recuperación de contraseña, verificación de email, rate limiting.
- Migrar el popup de newsletter de `index.html` (que hoy solo hace `console.log`) a esta misma tabla — no se pidió, se deja igual.
