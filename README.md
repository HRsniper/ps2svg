# PS2SVG

Convert PostScript to SVG

## Installation

```bash
npm i -g ps2svg
```

## Usage

```bash
# (.ps | .svg)? is optional
$ ps2svg find-all                   # => ["path/to/my_ps.ps"]
$ ps2svg find my_ps(.ps)?           # => path/to/my_ps.ps
$ ps2svg path/to/my_ps(.ps)?        # => my_ps.svg
$ ps2svg my_ps(.ps)?                # => my_ps.svg
$ ps2svg my_ps(.ps)? new_svg(.svg)? # => new_svg.svg
```

![ps2svg gif](imgs/ps2svg.gif)
