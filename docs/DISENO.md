# LUJITOS — Sistema de diseño

Identidad definida en la Fase 2. Código en `src/theme/`.

## Marca

- **Nombre:** LUJITOS · **Eslogan:** TU DINERO, BAJO CONTROL.
- **Símbolo:** una «L» geométrica que sostiene una moneda dorada en su esquina. Es el
  mismo dibujo en el ícono de la app (`assets/images/icon.png`, 1024 px, sin
  transparencia), en la apertura animada y en la marca de agua de la tarjeta de
  patrimonio. El trazado está en `src/components/brand/LogoMark.tsx`.
- **Apertura:** fondo verde bosque, la «L» aparece, la moneda cae y se asienta, el nombre
  y el eslogan suben suavemente y todo se disuelve hacia la app (1,9 s). Con «Reducir
  movimiento» activado en el iPhone es un fundido de 0,7 s.
- No se usan logotipos de bancos: cada entidad tiene iniciales sobre un tono de la paleta.

## Paleta de marca

| Nombre | Hex | Uso |
| --- | --- | --- |
| Verde bosque | #14251F | Color principal, botones, tarjeta de patrimonio |
| Marfil | #F4F1E8 | Fondo del modo claro, texto sobre verde |
| Verde salvia | #A8C5A0 | Acento del modo oscuro |
| Dorado suave | #C6A66A | Detalles de identidad (moneda, avisos) |
| Carbón | #202522 | Texto principal en modo claro |
| Blanco | #FFFFFF | Tarjetas en modo claro |
| Gris secundario | #858B86 | Marcadores, ejes, datos menores |
| Verde positivo | #299D68 | Solo información financiera (ingresos, mejoras) |
| Rojo de alerta | #D85B5B | Solo información financiera (gastos, excesos) |

### Ajustes de contraste (WCAG AA, 4,5:1 para texto)

- El gris `#858B86` sobre marfil da 3,1:1: no sirve para texto de lectura. El texto
  secundario usa `#5B615D` (5,6:1) y el gris queda para marcadores y ejes.
- Verde y rojo de marca sobre blanco no llegan a 4,5:1 en tamaños pequeños. Para
  **texto** se usan `#1B7349` (verde) y `#B5413D` (rojo); los colores de marca quedan para
  gráficos, barras e íconos.
- En modo oscuro los textos financieros usan `#52C28E` y `#EE8080`.

## Temas

| Token | Claro | Oscuro |
| --- | --- | --- |
| background | Marfil #F4F1E8 | #0E1512 |
| surface (tarjetas) | Blanco | #161F1B |
| surfaceElevated (barra, hojas) | Blanco | #1C2621 |
| text | Carbón | Marfil |
| primary (botones, selección) | Verde bosque | Verde salvia |
| brand (tarjeta de patrimonio) | Verde bosque | #17302A |

Preferencia en Configuración: Automático / Claro / Oscuro. Se guarda en el teléfono y
también se aplica a lo nativo (teclado, alertas).

## Tipografía

Inter (pesos 400, 500, 600 y 700; solo se cargan esos cuatro). Los montos usan cifras
tabulares para que las columnas queden alineadas.

| Estilo | Tamaño | Uso |
| --- | --- | --- |
| display | 36 / semibold | Patrimonio neto |
| amountXL · amountL · amountM · amount | 30 · 24 · 19 · 16 | Montos según jerarquía |
| largeTitle | 30 / bold | Título de pestaña |
| title | 21 / semibold | Títulos de sección |
| headline | 17 / semibold | Títulos de tarjeta |
| body · callout | 16 · 15 | Texto |
| subhead · footnote · label | 14 · 13 · 13 | Datos de apoyo |
| caption | 12 | Mínimo permitido (ejes, notas) |
| tab | 10,5 | Etiquetas de la barra inferior (estándar iOS) |

Formato de dinero: `$ 1.250.000`, sin decimales, con espacio no separable entre `$` y la
cifra. Negativos con signo menos tipográfico: `−$ 186.400`.

## Espaciado, radios y sombras

- Espaciado base 4: 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40. Margen lateral: 20.
- Radios: 6 · 10 · 14 · 20 (tarjetas) · 26 (hojas). Curva continua de iOS.
- Sombras suaves solo en modo claro; en oscuro separan los bordes y las superficies.
- Área táctil mínima: 44 pt.

## Íconos

SF Symbols (nativos de iOS) a través de `components/ui/Icon.tsx`. Todos los nombres
usados existen desde iOS 16. Relleno en la pestaña activa, contorno en las inactivas.

## Movimiento

- Entradas con desvanecimiento y desplazamiento corto (FadeInDown, 420 ms).
- Botones que se encogen levemente al tocarlos (PressableScale).
- Indicador deslizante en los controles segmentados y en la barra inferior.
- Barras y anillos de progreso que se llenan al aparecer.
- Vibraciones sutiles: selección, guardar (éxito) y errores de validación.
- Todo respeta «Reducir movimiento».

## Reglas

1. Ningún color suelto en las pantallas: siempre `useAppTheme().colors`.
2. Verde/rojo solo para información financiera.
3. Ningún texto se corta con «…» en datos importantes: se permite una segunda línea o el
   monto se reduce (`fit`).
4. Datos de demostración siempre identificados (`DemoNotice`).
