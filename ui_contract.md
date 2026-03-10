# UI/UX Contract: BellaPro Luxe Collection

Este contrato define los estándares visuales para la transformación premium de BellaPro. El objetivo es proyectar sofisticación, exclusividad y precisión técnica.

## 🎨 Paleta de Colores (Core Luxe)

| Token | Color | Valor Hex / CSS | Uso |
| :--- | :--- | :--- | :--- |
| **Base** | Slate-950 | `#020617` | Fondo principal de la aplicación. |
| **Surface** | Slate-900 | `#0f172a` | Fondo de contenedores y cards (base). |
| **Accent Gold** | Champagne Gold | `#D4AF37` | Bordes sutiles, iconos destacados y estados activos. |
| **Gold Gradient** | Luxe Glow | `linear-gradient(135deg, #d4af37 0%, #a67c00 100%)` | Botones de acción primaria y elementos destacados. |
| **Glass** | Crystal | `rgba(15, 23, 42, 0.7)` | Modales y superposiciones. |

## ✨ Efectos Visualles & Glassmorphism

- **Backdrop Blur**: Todos los modales y tarjetas flotantes deben usar `backdrop-filter: blur(20px)`.
- **Border**: Bordes ultrafinos de `1px` con opacidad variable (`rgba(212, 175, 55, 0.2)`).
- **Radius**: Implementación de `border-radius: 1.5rem` (32px) para un look moderno y suave.
- **Shadows**: Uso de sombreados profundos pero difusos (`shadow-2xl` equivalents).

## Typography (Refined Hierarchy)

- **Headings**: `Playfair Display` o `Outfit` (weight 600+) con `letter-spacing: -0.02em`.
- **Body**: `Inter` o `Outfit` (weight 400) para máxima legibilidad.
- **Micro-copy**: `Montserrat` (uppercase, letter-spacing 2px) para etiquetas de sección internas.

## 🎢 Micro-interacciones & Animaciones

1. **Entrada de Datos**: Gráficos financieros con animación de "dibujado" suave (`duration-1000`).
2. **Hover States**: Elevación sutil de `4px` con resplandor dorado exterior.
3. **Modales**: Escalamiento desde `0.95` con desvanecimiento (bounce-in-soft).

---

> [!NOTE]
> La interfaz debe priorizar el espacio negativo y la claridad. Menos es más en el segmento del lujo.
