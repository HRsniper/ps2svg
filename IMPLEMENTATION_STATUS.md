# Comparação PostScript → SVG (ps2svg)

| Status | Função / Operador PS                      | Exemplo PostScript                | Equivalente SVG                         |
| ------ | ----------------------------------------- | --------------------------------- | --------------------------------------- |
| ✅     | Moveto (`moveto`)                         | `100 200 moveto`                  | `<path d="M x y">`                      |
| ✅     | Lineto (`lineto`)                         | `300 400 lineto`                  | `<path d="L x y">`                      |
| ✅     | Curveto (`curveto`)                       | `100 200 150 250 200 200 curveto` | `<path d="C ...">`                      |
| ✅     | Closepath (`closepath`)                   | `closepath`                       | `Z` no `<path>`                         |
| ✅     | Retângulo                                 | `200 50 moveto 100 0 rlineto ...` | `<path d="M...Z">`                      |
| ❌     | Retângulo com (`rectfill` / `rectstroke`) | `100 100 200 150 rectfill`        | `<path d="M...Z">`                      |
| ✅     | Círculo (`arc` completo 0–360)            | `0 0 50 0 360 arc`                | `<path d="M...A...Z">`                  |
| ✅     | Arco parcial (`arc`)                      | `0 0 50 0 180 arc`                | `<path d="A ...">`                      |
| ✅     | Elipse (`ellipse`)                        | `ellipse` (via `scale` e `arc`)   | `<path d="M...A...Z">`                  |
| ✅     | Espessura de linha (`setlinewidth`)       | `2 setlinewidth`                  | `stroke-width="2"`                      |
| ✅     | Linecap (`setlinecap`)                    | `butt/round/square setlinecap`    | `stroke-linecap`                        |
| ✅     | Linejoin (`setlinejoin`)                  | `miter/round/bevel setlinejoin`   | `stroke-linejoin`                       |
| ✅     | RGB (`setrgbcolor`)                       | `0.2 0.5 0.8 setrgbcolor`         | `stroke/fill="rgb(...)"`                |
| ✅     | Gray (`setgray`)                          | `0.5 setgray`                     | `stroke/fill="rgb(...)"`                |
| ✅     | CMYK (`setcmykcolor`)                     | `1 0 1 0 setcmykcolor`            | `stroke/fill="rgb(...)"`                |
| ✅     | Translate (`translate`)                   | `100 200 translate`               | `transform="translate(...)"`            |
| ✅     | Rotate (`rotate`)                         | `45 rotate`                       | `transform="rotate(...)"`               |
| ✅     | Scale (`scale`)                           | `2 3 scale`                       | `transform="scale(...)"`                |
| 🟡     | (`concat` / `gsave` / `grestore`)         | estado gráfico                    | `<g>` agrupado com `transform`/estilos  |
| 🟡     | Texto (`show`)                            | `(Hello) show`                    | `<text>`                                |
| ❌     | Imagem (`image` / `imagemask`)            | `image` / `imagemask`             | `<image>` / `<mask>`                    |
| ❌     | Clipping (`clip` / `eoclip`)              | `clip` / `eoclip`                 | `<clipPath>`                            |
| 🟡     | Gradiente (`shfill`)                      | `ShadingType 2/3 shfill`          | `<linearGradient>` / `<radialGradient>` |
| 🟡     | Padrão (`pattern`)                        | `pattern`                         | `<pattern>`                             |
| ❌     | Halftone (`setscreen`/`sethalftone`)      | `setscreen`/`sethalftone`         | não nativo em SVG                       |
| 🟡     | Procedimentos (`def`)                     | `/highlight {...}def`             | —                                       |
