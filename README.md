# PS2SVG

Convert PostScript to SVG

## Installation

```bash
npm i -g ps2svg
```

## Usage

`ps2svg` _[options]_ <**input**> _[output]_ _[output folder]_

### Info

- `<` `>` indicates a required argument. The `.ps` extension is optional.
- `[` `]` indicates an optional argument. The` .svg` extension is optional.
- Accepts any variation of -findAll, -findall, -FINDALL, -FindAll, -FiNdAlL, same for -batch

<br />

```sh
# -f | -findall
ps2svg -findAll           ps2svg -f ps_files
#      → Lists all .ps           → Lists all .ps in "./ps_files"
```

```sh
ps2svg my_ps                      ps2svg path/to/my_ps.ps
#      → Generates "my_ps.svg"           → Generates "path/to/my_ps.svg"
```

```sh
ps2svg my_ps.ps new_svg.svg         ps2svg my_ps.ps new_svg.svg new_folder
#      → Generates "new_svg.svg"           → Generates "new_svg.svg" to "./new_folder"
```

```sh
# -b | -batch
ps2svg -b ps_files                          ps2svg -batch ps_files svgs
#      → Convert all .ps in "./ps_files"           → Convert all .ps in "./ps_files" to "./svgs"
```

<br />

![ps2svg gif](imgs/ps2svg.gif)
