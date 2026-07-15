# Diseño: versión móvil / iPhone (responsive completo)

**Fecha:** 2026-07-15

## Objetivo
La web ya tiene un breakpoint parcial (768px) pero el hueco principal es que el menú de navegación desaparece sin sustituto en móvil (`.nav-links { display: none; }`), dejando Colecciones/Tienda/Archivo/Contacto solo accesibles bajando al footer. Este diseño añade una navegación móvil completa y pule el resto del layout responsive en las 8 páginas: `index.html`, `colecciones.html`, `contacto.html`, `login.html`, `register.html`, `product.html`, `product-black-snapback.html`, `product-godmusicera-black-hoodie.html`.

## Menú móvil — overlay pantalla completa
- Nuevo botón hamburguesa (`.nav-hamburger`, icono ☰/✕) en el header, **oculto en escritorio** (≥769px), visible solo en móvil.
- Nuevo panel `.mobile-nav-overlay` (mismo patrón que `.popup-overlay` ya existente): fondo negro, fijo, pantalla completa, oculto por defecto y mostrado con clase `.open` + transición de opacidad.
- Contenido del panel: botón cerrar (✕) arriba a la derecha, links de navegación centrados en Cormorant Garamond (Colecciones, Tienda, Archivo, Contacto), separador, luego Cuenta y Buscar.
- El carrito permanece visible en el header (no se mueve al menú) — acceso directo típico de e-commerce.
- Markup del header + overlay se añade **idéntico** en las 8 páginas (mismo patrón que ya se repite para header/footer).
- Nuevo archivo `js/nav.js` (abrir/cerrar por click en hamburguesa, click en ✕, click en backdrop, tecla Escape — mismo patrón que el popup en `main.js`). Se incluye en las 8 páginas. No toca `js/main.js` (exclusivo del popup de newsletter de `index.html`).

## Header móvil reordenado
- Grid del header en móvil pasa de `1fr 1fr` (logo | vacío) a 3 columnas: hamburguesa (izq) | logo (centro) | carrito (dcha).
- "Cuenta" (texto) y el icono de búsqueda se ocultan del header en móvil y viven solo dentro del menú overlay.

## Fix del hero en móvil
- `.hero` calcula altura con `calc(100vh - 42px - 62px - 55px)` (62px = alto del header de escritorio). En el media query de 768px el header pasa a 54px, así que dentro de ese mismo media query se corrige el cálculo del hero para usar 54px y evitar hueco/overflow.

## Safe-area de iPhone (notch / Dynamic Island / home indicator)
- Se añade `viewport-fit=cover` al meta viewport de las 8 páginas.
- Padding `env(safe-area-inset-top)` añadido al header sticky y al `.mobile-nav-overlay` para que no queden tapados por el notch.

## Breakpoint fino para phones pequeños (≤430px)
Ajustes de tamaño de fuente/padding donde el corte único de 768px se queda corto entre iPhone SE (375px) y iPhone Pro Max (430px):
- `.products-collection` (título de colección)
- `.popup` (padding interno, tamaño de `.popup-script`)
- `.product-info-sticky` (padding)
- `.auth-card` (login/register/contacto), revisando que el media query existente de 540px en `auth.css` ya cubra bien este rango — solo se toca si se detectan problemas visuales.

## Verificación
Tras implementar, se levanta un servidor local y se revisa con viewport de iPhone 14 (390×844) y iPhone SE (375×667) al menos: `index.html`, `colecciones.html`, una página de producto y `login.html`. Se comprueba: menú abre/cierra, header no se solapa con notch, hero sin huecos, textos no se cortan.

## Fuera de alcance
- Rediseño visual del contenido (colores, tipografías, fotos) — solo layout/responsive.
- Menú de escritorio (`.nav-links` en ≥769px) no cambia.
- No se añade PWA / app-like behavior (splash screen, manifest, etc.) — solo CSS/HTML/JS responsive estándar.
