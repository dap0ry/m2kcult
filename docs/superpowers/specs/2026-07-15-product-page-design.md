# Diseño: página de producto (`product.html`)

**Fecha:** 2026-07-15

## Objetivo
Plantilla de detalle de producto reutilizable para todo el catálogo. Solo cambian fotos, nombre y precio entre productos; el resto (layout, estilos, comportamiento) es idéntico. Primera implementación: **"Blessed Enough" White Snapback** (45,00 EUR, Talla única).

## Layout
- **Arriba:** announcement bar + navbar, igual que `index.html` / `login.html`.
- **Cuerpo:** grid 2 columnas, proporción **2/3 galería (izq) | 1/3 info producto (dcha)**.
- **Abajo:** footer completo, igual que `index.html`.

## Columna galería (2/3)
- Columna vertical con scroll, imágenes a tamaños alternados (ancho completo / más pequeñas y desplazadas) para efecto editorial, no grid uniforme.
- 4 fotos en orden alternando horizontal/vertical:
  1. `assets/images/_A743133.jpg.jpeg` (horizontal)
  2. `assets/images/WhatsApp Image 2026-06-24 at 18.43.47.jpeg` (vertical)
  3. `assets/images/_A743153.jpg.jpeg` (vertical)
  4. `assets/images/WhatsApp Image 2026-06-24 at 18.43.47 (2).jpeg` (vertical)

## Columna info (1/3, sticky)
- Nombre: `"Blessed Enough" White Snapback`
- Precio: `45,00 EUR`
- Talla: `Talla única` (sin selector — es gorra, no aplican XS–XXL)
- Botón `Añadir a la cesta` (negro, full width, mismo estilo de botones existentes)
- Bloque Klarna decorativo (no funcional): "3 plazos sin intereses (0% TAE) o desde 15 €/mes (21.9% TAE) con Klarna · Más información"
- Bloque desplegable simple: "Envío · Cambios y Devoluciones"

## Enlace desde index.html
La tarjeta de la gorra blanca (líneas ~80-91 de `index.html`) se envuelve con `<a href="product.html">`.

## CSS
Nuevas clases en `css/style.css`: `.product-page`, `.product-gallery`, `.product-gallery-img`, `.product-info`, `.product-info-sticky`, `.product-klarna`, `.product-shipping`, etc. Paleta y tipografía existentes (negro/crema/dorado, Cormorant Garamond + Inter).

## Fuera de alcance
- Selector de tallas genérico (se añadirá cuando se cree una página de producto con tallas reales, ej. hoodie).
- Funcionalidad real de carrito/Klarna — solo visual, sin backend.
