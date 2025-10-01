import * as fs from "node:fs";
import { cmyk2rgb, color2rgb, gray2rgb } from "../color2rgb.js";
import { fileInputName, fileOutputName } from "./cli.js";

console.time("Execution time");

class Matrix {
  a = 1;
  b = 0;
  c = 0;
  d = 1;
  e = 0;
  f = 0;

  multiply(m: Matrix): Matrix {
    const r = new Matrix();
    r.a = this.a * m.a + this.c * m.b;
    r.b = this.b * m.a + this.d * m.b;
    r.c = this.a * m.c + this.c * m.d;
    r.d = this.b * m.c + this.d * m.d;
    r.e = this.a * m.e + this.c * m.f + this.e;
    r.f = this.b * m.e + this.d * m.f + this.f;
    return r;
  }

  translate(tx: number, ty: number): Matrix {
    return this.multiply(Object.assign(new Matrix(), { e: tx, f: ty }));
  }

  scale(sx: number, sy: number): Matrix {
    return this.multiply(Object.assign(new Matrix(), { a: sx, d: sy }));
  }

  rotate(deg: number): Matrix {
    const r = (deg * Math.PI) / 180;
    const m = new Matrix();
    m.a = Math.cos(r);
    m.b = Math.sin(r);
    m.c = -Math.sin(r);
    m.d = Math.cos(r);
    return this.multiply(m);
  }

  skewX(angle: number): Matrix {
    const rad = (angle * Math.PI) / 180;
    return this.multiply(Object.assign(new Matrix(), { c: Math.tan(rad) }));
  }

  skewY(angle: number): Matrix {
    const rad = (angle * Math.PI) / 180;
    return this.multiply(Object.assign(new Matrix(), { b: Math.tan(rad) }));
  }

  toTransformString() {
    return `matrix(${this.a} ${this.b} ${this.c} ${this.d} ${this.e} ${this.f})`;
  }

  applyPoint(x: number, y: number) {
    return { x: x * this.a + y * this.c + this.e, y: x * this.b + y * this.d + this.f };
  }

  decompose(): {
    translate: { x: number; y: number };
    scale: { x: number; y: number };
    rotate: number;
    skew: { x: number; y: number };
  } {
    const { a, b, c, d, e, f } = this;

    const translate = { x: e, y: f };

    const scaleX = Math.hypot(a, b);
    const scaleY = (a * d - b * c) / scaleX; // preserve aspect

    const rotation = Math.atan2(b, a) * (180 / Math.PI); // in degrees (0-360)°

    const skewX = Math.atan2(a * c + b * d, scaleX * scaleX);
    const skewY = Math.atan2(a * b + c * d, scaleY * scaleY);

    return {
      translate,
      scale: { x: scaleX, y: scaleY },
      rotate: rotation,
      skew: {
        x: skewX * (180 / Math.PI), // in degrees (0-360)°
        y: skewY * (180 / Math.PI) // in degrees (0-360)°
      }
    };
  }

  invert(): Matrix {
    const det = this.a * this.d - this.b * this.c;
    if (Math.abs(det) < 1e-10) return new Matrix();
    const inv = new Matrix();
    inv.a = this.d / det;
    inv.b = -this.b / det;
    inv.c = -this.c / det;
    inv.d = this.a / det;
    inv.e = (this.c * this.f - this.d * this.e) / det;
    inv.f = (this.b * this.e - this.a * this.f) / det;
    return inv;
  }
}

class PathBuilder {
  parts: string[] = [];
  private useLocalCoords = false;
  private ctm: Matrix | undefined = undefined;

  setTransformMode(useLocal: boolean, transform?: Matrix) {
    this.useLocalCoords = useLocal;
    this.ctm = transform;
  }

  private transformPoint(x: number, y: number): { x: number; y: number } {
    if (!this.useLocalCoords && this.ctm) {
      return this.ctm.applyPoint(x, y);
    }
    return { x, y };
  }

  moveTo(x: number, y: number) {
    const p = this.transformPoint(x, y);
    this.parts.push(`M ${numFmt(p.x)} ${numFmt(p.y)}`);
  }
  moveToRel(dx: number, dy: number) {
    const p = this.transformPoint(dx, dy);
    this.parts.push(`m ${numFmt(p.x)} ${numFmt(p.y)}`);
  }

  lineTo(x: number, y: number) {
    const p = this.transformPoint(x, y);
    this.parts.push(`L ${numFmt(p.x)} ${numFmt(p.y)}`);
  }
  lineToRel(dx: number, dy: number) {
    const p = this.transformPoint(dx, dy);
    this.parts.push(`l ${numFmt(p.x)} ${numFmt(p.y)}`);
  }

  horizontalLineTo(x: number) {
    const p = this.transformPoint(x, 0);
    this.parts.push(`H ${numFmt(p.x)}`);
  }
  horizontalLineToRel(dx: number) {
    const p = this.transformPoint(dx, 0);
    this.parts.push(`h ${numFmt(p.x)}`);
  }

  verticalLineTo(y: number) {
    const p = this.transformPoint(0, y);
    this.parts.push(`V ${numFmt(p.y)}`);
  }
  verticalLineToRel(dy: number) {
    const p = this.transformPoint(0, dy);
    this.parts.push(`v ${numFmt(p.y)}`);
  }

  curveTo(x1: number, y1: number, x2: number, y2: number, x: number, y: number) {
    const p1 = this.transformPoint(x1, y1);
    const p2 = this.transformPoint(x2, y2);
    const p = this.transformPoint(x, y);
    this.parts.push(`C ${numFmt(p1.x)} ${numFmt(p1.y)} ${numFmt(p2.x)} ${numFmt(p2.y)} ${numFmt(p.x)} ${numFmt(p.y)}`);
  }
  curveToRel(dx1: number, dy1: number, dx2: number, dy2: number, dx: number, dy: number) {
    const p1 = this.transformPoint(dx1, dy1);
    const p2 = this.transformPoint(dx2, dy2);
    const p = this.transformPoint(dx, dy);
    this.parts.push(`c ${numFmt(p1.x)} ${numFmt(p1.y)} ${numFmt(p2.x)} ${numFmt(p2.y)} ${numFmt(p.x)} ${numFmt(p.y)}`);
  }

  smoothCurveTo(x2: number, y2: number, x: number, y: number) {
    const p2 = this.transformPoint(x2, y2);
    const p = this.transformPoint(x, y);
    this.parts.push(`S ${numFmt(p2.x)} ${numFmt(p2.y)} ${numFmt(p.x)} ${numFmt(p.y)}`);
  }
  smoothCurveToRel(dx2: number, dy2: number, dx: number, dy: number) {
    const p2 = this.transformPoint(dx2, dy2);
    const p = this.transformPoint(dx, dy);
    this.parts.push(`s ${numFmt(p2.x)} ${numFmt(p2.y)} ${numFmt(p.x)} ${numFmt(p.y)}`);
  }

  quadraticCurveTo(x1: number, y1: number, x: number, y: number) {
    const p1 = this.transformPoint(x1, y1);
    const p = this.transformPoint(x, y);
    this.parts.push(`Q ${numFmt(p1.x)} ${numFmt(p1.y)} ${numFmt(p.x)} ${numFmt(p.y)}`);
  }
  quadraticCurveToRel(dx1: number, dy1: number, dx: number, dy: number) {
    const p1 = this.transformPoint(dx1, dy1);
    const p = this.transformPoint(dx, dy);
    this.parts.push(`q ${numFmt(p1.x)} ${numFmt(p1.y)} ${numFmt(p.x)} ${numFmt(p.y)}`);
  }

  smoothQuadraticCurveTo(x: number, y: number) {
    const p = this.transformPoint(x, y);
    this.parts.push(`T ${numFmt(p.x)} ${numFmt(p.y)}`);
  }
  smoothQuadraticCurveToRel(dx: number, dy: number) {
    const p = this.transformPoint(dx, dy);
    this.parts.push(`t ${numFmt(p.x)} ${numFmt(p.y)}`);
  }

  ellipseTo(rx: number, ry: number, rotation: number, largeArc: number, sweep: number, x: number, y: number) {
    // Para arcos, rx/ry/rotation não são transformados como pontos
    const p = this.transformPoint(x, y);
    this.parts.push(
      `A ${numFmt(rx)} ${numFmt(ry)} ${numFmt(rotation)} ${numFmt(largeArc)} ${numFmt(sweep)} ${numFmt(p.x)} ${numFmt(p.y)}`
    );
  }
  ellipseToRel(rx: number, ry: number, rotation: number, largeArc: number, sweep: number, dx: number, dy: number) {
    const p = this.transformPoint(dx, dy);
    this.parts.push(
      `a ${numFmt(rx)} ${numFmt(ry)} ${numFmt(rotation)} ${numFmt(largeArc)} ${numFmt(sweep)} ${numFmt(p.x)} ${numFmt(p.y)}`
    );
  }

  close() {
    this.parts.push("Z");
  }

  toPath(): string {
    return this.parts.join(" ");
  }
  length(): number {
    return this.parts.length;
  }
  clear() {
    this.parts = [];
  }

  reset(): PathBuilder {
    const newPath = new PathBuilder();
    // Propaga o modo de transformação
    newPath.setTransformMode(this.useLocalCoords, this.ctm);
    return newPath;
  }
}

type Token = { type: "number" | "name" | "string" | "operator" | "brace" | "bracket"; value: string };

interface GraphicState {
  ctm: Matrix;
  fill: string | null;
  stroke: string | null;
  strokeWidth?: number;
  lineCap?: string | null;
  lineJoin?: string | null;
  font: string;
  fontSize: number;
  clipStack: string[];
  dash?: string | null;
  lastTextPos: { x: number; y: number } | null;
}

type PostscriptValue = any;

interface PostscriptDict {
  [key: string]: PostscriptValue;
}

const FillOnly = { stroke: false, fill: true };
const StrokeOnly = { stroke: true, fill: false };
const FillAndStroke = { stroke: true, fill: true };

const DEFAULT_IMAGE =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1MTIiIGhlaWdodD0iNTEyIj4KICA8dGV4dCB4PSIyNCIgeT0iMTk4IiBmaWxsPSJ3aGl0ZSIgZm9udC1zaXplPSIxMjgiPkltYWdlbTwvdGV4dD4KICA8dGV4dCB4PSIyNCIgeT0iMjk4IiBmaWxsPSJ3aGl0ZSIgZm9udC1zaXplPSIxMjgiPk5vdDwvdGV4dD4KICA8dGV4dCB4PSIyNCIgeT0iMzk4IiBmaWxsPSJ3aGl0ZSIgZm9udC1zaXplPSIxMjgiPkZvdW5kPC90ZXh0Pgo8L3N2Zz4K";

function tokenize(ps: string): Token[] {
  ps = ps.replace(/%[^\n\r]*/g, " "); // Remove comments
  const numRe = /-?(?:\d+\.\d+|\d+\.|\.\d+|\d+)(?:[eE][+-]?\d+)?/y; // 12 .2 3e4
  const stringRe = /\((?:\\.|[^\\\)])*\)/y; // (foo) (a\)b)
  const nameRe = /\/?[A-Za-z_\-\.\?\*][A-Za-z0-9_\-\.\?\*]*/y; //  name /foo /foo-bar
  const braceRe = /[\{\}]/y;
  const bracketRe = /[\[\]]/y;
  const whitespaceRe = /\s*/y;

  const tokens: Token[] = [];
  let index = 0;

  while (index < ps.length) {
    whitespaceRe.lastIndex = index;
    const ws = whitespaceRe.exec(ps);
    if (ws) index = whitespaceRe.lastIndex;
    if (index >= ps.length) break;

    // Strings first (highest priority)
    stringRe.lastIndex = index;
    let match = stringRe.exec(ps);
    if (match) {
      const raw = unescapePostscriptString(match[0].slice(1, -1));
      tokens.push({ type: "string", value: raw });
      index = stringRe.lastIndex;
      continue;
    }

    // Numbers
    numRe.lastIndex = index;
    match = numRe.exec(ps);
    if (match) {
      tokens.push({ type: "number", value: match[0] });
      index = numRe.lastIndex;
      continue;
    }

    // Braces
    braceRe.lastIndex = index;
    match = braceRe.exec(ps);
    if (match) {
      tokens.push({ type: "brace", value: match[0] });
      index = braceRe.lastIndex;
      continue;
    }

    // Brackets (arrays)
    bracketRe.lastIndex = index;
    match = bracketRe.exec(ps);
    if (match) {
      tokens.push({ type: "bracket", value: match[0] });
      index = bracketRe.lastIndex;
      continue;
    }

    // Names/Operators
    nameRe.lastIndex = index;
    match = nameRe.exec(ps);
    if (match) {
      const value = match[0];
      if (value.startsWith("/")) tokens.push({ type: "name", value: value.slice(1) });
      else tokens.push({ type: "operator", value: value });
      index = nameRe.lastIndex;
      continue;
    }

    // Skip invalid char
    index += 1;
  }
  return tokens;
}

function unescapePostscriptString(str: string): string {
  let result = "";
  let index = 0;

  while (index < str.length) {
    if (str[index] !== "\\") {
      result += str[index];
      index++;
      continue;
    }

    index++; // Skip the \
    if (index >= str.length) {
      result += "\\";
      break;
    }
    const nextChar = str[index];
    switch (nextChar) {
      case "n":
        result += "\n";
        break;
      case "r":
        result += "\r";
        break;
      case "t":
        result += "\t";
        break;
      case "b":
        result += "\b";
        break;
      case "f":
        result += "\f";
        break;
      case "(":
        result += "(";
        break;
      case ")":
        result += ")";
        break;
      case "\\":
        result += "\\";
        break;
      case " ":
        result += " ";
        break;
      default:
        // Octal: \ddd (1-3 digits 0-7)
        if (nextChar >= "0" && nextChar <= "7") {
          let octal = nextChar;
          index++;
          if (index < str.length && str[index] >= "0" && str[index] <= "7") {
            octal += str[index];
            index++;
            if (index < str.length && str[index] >= "0" && str[index] <= "7") {
              octal += str[index];
              index++;
            }
          }
          const code = parseInt(octal, 8);
          result += String.fromCharCode(code > 255 ? 255 : code);
          index--;
        } else {
          result += nextChar;
        }
        break;
    }
    index++;
  }
  return result;
}

function parseProcedure(tokens: Token[], startIndex: number): { procedure: Token[]; nextIndex: number } {
  const procedure: Token[] = [];
  let depth = 1;
  let index = startIndex;

  while (index < tokens.length && depth > 0) {
    const token = tokens[index];
    if (token.type === "brace" && token.value === "{") depth++;
    else if (token.type === "brace" && token.value === "}") {
      depth--;
      if (depth === 0) return { procedure, nextIndex: index + 1 };
    }
    if (depth > 0) procedure.push(token);
    index++;
  }
  return { procedure, nextIndex: index };
}

function parseArray(tokens: Token[], startIndex: number): { array: (number | string)[]; nextIndex: number } {
  const array: (number | string)[] = [];
  let index = startIndex;

  while (index < tokens.length) {
    const token = tokens[index];
    if (token.type === "bracket" && token.value === "]") {
      return { array, nextIndex: index + 1 };
    }
    if (token.type === "number") {
      array.push(Number(token.value));
    } else if (token.type === "string" || token.type === "name") {
      array.push(token.value);
    }
    index++;
  }
  return { array, nextIndex: index };
}

const DEFAULT_GRAPHIC_STATE: GraphicState = {
  ctm: new Matrix(),
  fill: "black",
  stroke: null,
  strokeWidth: 1,
  lineCap: "butt",
  lineJoin: "miter",
  font: "Arial, sans-serif",
  fontSize: 12,
  clipStack: [],
  dash: null,
  lastTextPos: null
};

function cloneGraphic(s: GraphicState): GraphicState {
  return {
    ctm: Object.assign(new Matrix(), s.ctm),
    fill: s.fill,
    stroke: s.stroke,
    strokeWidth: s.strokeWidth ?? 1,
    lineCap: s.lineCap ?? null,
    lineJoin: s.lineJoin ?? null,
    font: s.font,
    fontSize: s.fontSize ?? 12,
    clipStack: [...s.clipStack],
    dash: s.dash ?? null,
    lastTextPos: s.lastTextPos ? { ...s.lastTextPos } : null
  };
}

function numFmt(n: number): string {
  return n.toFixed(3).replace(/\.?0+$/, "");
}

const globalDict: PostscriptDict = {};
const dictStack: PostscriptDict[] = [globalDict];

function lookupName(name: string): PostscriptValue | undefined {
  for (let i = dictStack.length - 1; i >= 0; --i) {
    if (name in dictStack[i]) return dictStack[i][name];
  }
  return undefined;
}

function isIdentityMatrix(m: Matrix): boolean {
  return m.a === 1 && m.b === 0 && m.c === 0 && m.d === 1 && m.e === 0 && m.f === 0;
}

function emitSVGPath(d: string, g: GraphicState, mode: { stroke: boolean; fill: boolean }): string {
  const needGroup = !isIdentityMatrix(g.ctm) || g.clipStack.length > 0;

  // Use Matrix.decompose pra transform legível
  const decomp = g.ctm.decompose();
  let transformStr = "";
  if (!isIdentityMatrix(g.ctm)) {
    const parts = [];
    if (Math.abs(decomp.translate.x) > 1e-6 || Math.abs(decomp.translate.y) > 1e-6)
      parts.push(`translate(${numFmt(decomp.translate.x)} ${numFmt(decomp.translate.y)})`);
    if (Math.abs(decomp.scale.x - 1) > 1e-6 || Math.abs(decomp.scale.y - 1) > 1e-6)
      parts.push(`scale(${numFmt(decomp.scale.x)} ${numFmt(decomp.scale.y)})`);
    if (Math.abs(decomp.rotate) > 1e-6) parts.push(`rotate(${numFmt(decomp.rotate)})`);
    if (Math.abs(decomp.skew.x) > 1e-6) parts.push(`skewX(${numFmt(decomp.skew.x)})`);
    if (Math.abs(decomp.skew.y) > 1e-6) parts.push(`skewY(${numFmt(decomp.skew.y)})`);
    transformStr = parts.join(" ");
  }

  const fillColor = mode.fill ? (g.fill ?? "black") : "none";
  const strokeColor = mode.stroke ? (g.stroke ?? "black") : "none";

  const pathAttrs = [`d="${d}"`];

  // Fill sempre explícito
  pathAttrs.push(`fill="${fillColor}"`);

  // Stroke: só adiciona atributos se stroke tem cor (não é "none")
  if (mode.stroke && strokeColor !== "none") {
    pathAttrs.push(`stroke="${strokeColor}"`);

    // Atributos de stroke apenas quando há stroke ativo
    if (g.strokeWidth && g.strokeWidth !== 1) {
      pathAttrs.push(`stroke-width="${g.strokeWidth}"`);
    }
    if (g.lineCap && g.lineCap !== "butt") {
      pathAttrs.push(`stroke-linecap="${g.lineCap}"`);
    }
    if (g.lineJoin && g.lineJoin !== "miter") {
      pathAttrs.push(`stroke-linejoin="${g.lineJoin}"`);
    }
    if (g.dash) {
      pathAttrs.push(`stroke-dasharray="${g.dash}"`);
    }
  } else if (mode.fill && fillColor !== "none") {
    // Se fill tem cor, stroke é explicitamente none
    pathAttrs.push(`stroke="none"`);
  }

  const pathAttrsStr = pathAttrs.join(" ");
  const clipId = g.clipStack.length > 0 ? ` clip-path="url(#clip${g.clipStack.length - 1})"` : "";

  if (needGroup) {
    return `<g transform="${transformStr}"${clipId}><path ${pathAttrsStr}/></g>`;
  } else {
    return `<path ${pathAttrsStr}${clipId}/>`;
  }
}

function escapeXML(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function anglePoint(cx: number, cy: number, r: number, deg: number): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function safePopNumber(stack: any[], def = 0): number {
  const v = stack.pop();
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return isFinite(n) ? n : def;
  }
  return def;
}

// Constantes para detecção de linha simples
const PATH_TERMINATORS = ["stroke", "fill", "show", "moveto", "newpath"];
const PATH_CONTINUATORS = ["lineto", "curveto", "rlineto", "rcurveto"];
const STATE_MODIFIERS = [
  "setrgbcolor",
  "setgray",
  "setcmykcolor",
  "setlinewidth",
  "setlinecap",
  "setlinejoin",
  "setdash",
  "translate",
  "scale",
  "rotate"
];

function isSimpleLineAhead(tokens: Token[], startIdx: number): boolean {
  // Procura até encontrar stroke/fill/moveto ou fim do arquivo
  for (let j = startIdx; j < tokens.length; j++) {
    const token = tokens[j];

    // Ignora números e nomes (são argumentos)
    if (token.type === "number" || token.type === "name") continue;

    if (token.type === "operator") {
      const value = token.value;
      // Se encontrar modificador de estado, NÃO é linha simples
      if (STATE_MODIFIERS.includes(value)) return false;
      // Se encontrar finalizador/início de novo path, É linha simples
      if (PATH_TERMINATORS.includes(value)) return true;
      // Se for um operador vetorial, não é linha simples
      if (PATH_CONTINUATORS.includes(value)) return false;

      // Operador desconhecido: assume seguro (é simples)
      return true;
    }
  }
  return true; // EOF: flush seguro
}

// Função para executar um procedimento (insere tokens no fluxo atual)
function executeProcedure(tokens: Token[], procTokens: Token[], currentIndex: number) {
  // Insere os tokens do procedimento na posição atual
  tokens.splice(currentIndex + 1, 0, ...procTokens);
}

function flushPath(
  path: PathBuilder,
  g: GraphicState,
  svgOut: { elementShapes: string[] },
  mode: { stroke: boolean; fill: boolean }
) {
  if (path.length() === 0) return;
  const d = path.toPath();
  const pathStr = emitSVGPath(d, g, mode);
  svgOut.elementShapes.push(pathStr);
  path = path.reset();
}

function interpret(
  tokens: Token[],
  svgOut: { defs: string[]; elementShapes: string[]; elementTexts: string[] },
  boundingBox?: { llx: number; lly: number; urx: number; ury: number }
) {
  const stack: (number | string | any)[] = [];
  const gStack: GraphicState[] = [];
  let gState = { ...DEFAULT_GRAPHIC_STATE };
  let path = new PathBuilder();
  let currentX = 0;
  let currentY = 0;
  let clipIdCounter = 0;

  // Inicializa path com modo correto
  const needGroup = !isIdentityMatrix(gState.ctm) || gState.clipStack.length > 0;
  path.setTransformMode(needGroup, needGroup ? undefined : gState.ctm);

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const tokenType = token.type;
    const tokenValue = token.value;

    if (tokenType === "number") stack.push(Number(tokenValue));
    else if (tokenType === "string" || tokenType === "name") stack.push(tokenValue);
    else if (tokenType === "brace" && tokenValue === "{") {
      const { procedure, nextIndex } = parseProcedure(tokens, i + 1);
      stack.push({ type: "procedure", body: procedure });
      i = nextIndex - 1;
    } else if (tokenType === "bracket" && tokenValue === "[") {
      const { array, nextIndex } = parseArray(tokens, i + 1);
      stack.push(array);
      i = nextIndex - 1;
    } else if (tokenType === "operator") {
      const op = tokenValue;

      const dictVal = lookupName(op);
      if (dictVal !== undefined) {
        if (dictVal && typeof dictVal === "object" && dictVal.type === "procedure") {
          executeProcedure(tokens, dictVal.body as Token[], i);
          continue;
        } else {
          stack.push(dictVal);
          continue;
        }
      }

      if (op === "neg") {
        const v = stack.pop();
        if (typeof v === "number") stack.push(-v);
        else if (typeof v === "string" && !isNaN(Number(v))) stack.push(-Number(v));
        else stack.push(0);
        continue;
      }

      if (op === "add") {
        const b = safePopNumber(stack, 0);
        const a = safePopNumber(stack, 0);
        stack.push(a + b);
        continue;
      }

      if (op === "sub") {
        const b = safePopNumber(stack, 0);
        const a = safePopNumber(stack, 0);
        stack.push(a - b);
        continue;
      }

      if (op === "mul") {
        const b = safePopNumber(stack, 1);
        const a = safePopNumber(stack, 1);
        stack.push(a * b);
        continue;
      }

      if (op === "div") {
        const b = safePopNumber(stack, 1);
        const a = safePopNumber(stack, 0);
        stack.push(b === 0 ? 0 : a / b);
        continue;
      }

      if (op === "exch") {
        const b = stack.pop();
        const a = stack.pop();
        stack.push(b);
        stack.push(a);
        continue;
      }

      if (op === "dict") {
        const size = safePopNumber(stack, 0);
        stack.push({});
        continue;
      }

      if (op === "begin") {
        const d = stack.pop();
        if (d && typeof d === "object") dictStack.push(d);
        else dictStack.push({});
        continue;
      }

      if (op === "end") {
        if (dictStack.length > 1) dictStack.pop();
        continue;
      }

      if (op === "def") {
        const value = stack.pop();
        const key = stack.pop();
        if (typeof key === "string") dictStack[dictStack.length - 1][key] = value;
        continue;
      }

      if (op === "setdash") {
        const phase = safePopNumber(stack, 0);
        const arr = stack.pop();
        if (Array.isArray(arr)) gState.dash = arr.map(Number).join(" ");
        else if (typeof arr === "number") gState.dash = `${arr}`;
        else gState.dash = null;
        continue;
      }

      if (op === "newpath") {
        path = path.reset();
        continue;
      }

      if (op === "moveto") {
        const y = safePopNumber(stack, 0);
        const x = safePopNumber(stack, 0);
        path.moveTo(x, y);
        currentX = x;
        currentY = y;
        gState.lastTextPos = { x, y };
        continue;
      }

      if (op === "rmoveto") {
        const dy = safePopNumber(stack, 0);
        const dx = safePopNumber(stack, 0);
        path.moveToRel(dx, dy);
        currentX += dx;
        currentY += dy;
        gState.lastTextPos = { x: currentX, y: currentY };
        continue;
      }

      if (op === "lineto") {
        const y = safePopNumber(stack, 0);
        const x = safePopNumber(stack, 0);
        path.lineTo(x, y);
        currentX = x;
        currentY = y;

        // Verifica se é uma linha simples (moveto + lineto seguido de moveto ou texto)
        if (
          path.parts.length === 2 &&
          path.parts[0].startsWith("M ") &&
          path.parts[1].startsWith("L ") &&
          isSimpleLineAhead(tokens, i + 1)
        ) {
          // if (path.parts.length === 2 && isSimpleLineAhead(tokens, i + 1)) {
          flushPath(path, gState, svgOut, StrokeOnly);
          path = path.reset();
        }
        continue;
      }

      if (op === "rlineto") {
        const dy = safePopNumber(stack, 0);
        const dx = safePopNumber(stack, 0);
        path.lineToRel(dx, dy);
        currentX += dx;
        currentY += dy;
        continue;
      }

      if (op === "curveto") {
        const y = safePopNumber(stack, 0);
        const x = safePopNumber(stack, 0);
        const y2 = safePopNumber(stack, 0);
        const x2 = safePopNumber(stack, 0);
        const y1 = safePopNumber(stack, 0);
        const x1 = safePopNumber(stack, 0);
        path.curveTo(x1, y1, x2, y2, x, y);
        currentX = x;
        currentY = y;
        continue;
      }

      if (op === "rcurveto") {
        const dy = safePopNumber(stack, 0);
        const dx = safePopNumber(stack, 0);
        const dy2 = safePopNumber(stack, 0);
        const dx2 = safePopNumber(stack, 0);
        const dy1 = safePopNumber(stack, 0);
        const dx1 = safePopNumber(stack, 0);
        path.curveToRel(dx1, dy1, dx2, dy2, dx, dy);
        currentX += dx;
        currentY += dy;
        continue;
      }

      if (op === "closepath") {
        // Só adiciona Z se o último comando não for já um Z
        if (path.length() > 0 && !path.parts[path.parts.length - 1]?.endsWith("Z")) {
          path.close();
        }
        continue;
      }

      if (op === "stroke") {
        flushPath(path, gState, svgOut, StrokeOnly);
        path = path.reset();
        continue;
      }

      if (op === "fill" || op === "eofill" || op === "evenodd") {
        flushPath(path, gState, svgOut, FillOnly);
        path = path.reset();
        continue;
      }

      if (op === "setrgbcolor") {
        const b = safePopNumber(stack, 0);
        const g = safePopNumber(stack, 0);
        const r = safePopNumber(stack, 0);
        const rgb = color2rgb([r, g, b]).toString();
        gState.fill = rgb;
        gState.stroke = rgb;
        continue;
      }

      if (op === "setgray") {
        const v = safePopNumber(stack, 0);
        const rgb = gray2rgb(v).toString();
        gState.fill = rgb;
        gState.stroke = rgb;
        continue;
      }

      if (op === "setcmykcolor") {
        const k = safePopNumber(stack, 0);
        const y = safePopNumber(stack, 0);
        const m = safePopNumber(stack, 0);
        const c = safePopNumber(stack, 0);
        const rgb = cmyk2rgb([c, m, y, k]).toString();
        gState.fill = rgb;
        gState.stroke = rgb;
        continue;
      }

      if (op === "setlinewidth") {
        gState.strokeWidth = safePopNumber(stack, 1);
        continue;
      }

      if (op === "setlinecap") {
        const v = stack.pop();
        if (typeof v === "number")
          gState.lineCap = v === 0 ? "butt" : v === 1 ? "round" : "square"; // fallback
        else if (typeof v === "string") gState.lineCap = v;
        continue;
      }

      if (op === "setlinejoin") {
        const v = stack.pop();
        if (typeof v === "number")
          gState.lineJoin = v === 0 ? "miter" : v === 1 ? "round" : v === 2 ? "bevel" : v === 3 ? "arcs" : "miter"; // fallback
        else if (typeof v === "string") gState.lineJoin = v;
        continue;
      }

      if (op === "translate") {
        const ty = safePopNumber(stack, 0);
        const tx = safePopNumber(stack, 0);
        gState.ctm = gState.ctm.translate(tx, ty);
        const needGroup = !isIdentityMatrix(gState.ctm) || gState.clipStack.length > 0;
        path.setTransformMode(needGroup, needGroup ? undefined : gState.ctm);
        continue;
      }

      if (op === "scale") {
        const sy = safePopNumber(stack, 1);
        const sx = safePopNumber(stack, 1);
        gState.ctm = gState.ctm.scale(sx, sy);
        const needGroup = !isIdentityMatrix(gState.ctm) || gState.clipStack.length > 0;
        path.setTransformMode(needGroup, needGroup ? undefined : gState.ctm);
        continue;
      }

      if (op === "rotate") {
        const angle = safePopNumber(stack, 0);
        gState.ctm = gState.ctm.rotate(angle);
        const needGroup = !isIdentityMatrix(gState.ctm) || gState.clipStack.length > 0;
        path.setTransformMode(needGroup, needGroup ? undefined : gState.ctm);
        continue;
      }

      if (op === "gsave") {
        gStack.push(cloneGraphic(gState));
        // const needGroup = !isIdentityMatrix(gState.ctm) || gState.clipStack.length > 0;
        // path.setTransformMode(needGroup, needGroup ? undefined : gState.ctm);
        continue;
      }

      if (op === "grestore") {
        if (gStack.length === 0) return;
        const st = gStack.pop();
        if (!st) return;

        if (st.clipStack.length > gState.clipStack.length) {
          for (let j = gState.clipStack.length; j < st.clipStack.length; j++) {
            const clipPath = st.clipStack[j];
            svgOut.defs.push(`<clipPath id="clip${clipIdCounter++}"><path d="${clipPath}" /></clipPath>`);
          }
        }

        gState = st;
        const needGroup = !isIdentityMatrix(gState.ctm) || gState.clipStack.length > 0;
        path.setTransformMode(needGroup, needGroup ? undefined : gState.ctm);
        continue;
      }

      if (op === "arc") {
        const ang2 = safePopNumber(stack, 0);
        const ang1 = safePopNumber(stack, 0);
        const r = safePopNumber(stack, 0);
        const y = safePopNumber(stack, 0);
        const x = safePopNumber(stack, 0);

        const { a, b, c, d } = gState.ctm;

        const needGroup = !isIdentityMatrix(gState.ctm) || gState.clipStack.length > 0;
        let rx, ry;
        if (needGroup) {
          rx = Math.abs(r);
          ry = Math.abs(r);
        } else {
          const scaleX = Math.hypot(a, b) || 1;
          const scaleY = Math.hypot(c, d) || 1;
          rx = Math.abs(r * scaleX);
          ry = Math.abs(r * scaleY);
        }

        const startRad = ang1 * (Math.PI / 180);
        const start = { x: x + r * Math.cos(startRad), y: y + r * Math.sin(startRad) };
        const endRad = ang2 * (Math.PI / 180);
        const end = { x: x + r * Math.cos(endRad), y: y + r * Math.sin(endRad) };

        const delta = Math.abs(ang2 - ang1);
        const isFullCircle = Math.abs(delta - 360) < 1e-6 || Math.abs(delta) < 1e-6;

        // Se há um moveTo recente para o centro do arco, substitui pelo ponto inicial correto
        const lastPart = path.parts[path.parts.length - 1];
        if (lastPart && lastPart.startsWith("M ")) {
          // Remove o moveTo anterior e adiciona o correto
          path.parts.pop();
        }

        path.moveTo(start.x, start.y);

        if (isFullCircle) {
          const midRad = (ang1 + 180) % 360;
          const mid = { x: x + r * Math.cos((midRad * Math.PI) / 180), y: y + r * Math.sin((midRad * Math.PI) / 180) };

          path.ellipseTo(rx, ry, 0, 1, 1, mid.x, mid.y); // First 180°
          path.ellipseTo(rx, ry, 0, 1, 1, start.x, start.y); // Second 180° close loop
          path.close(); // Z for fillable circle
          currentX = end.x;
          currentY = end.y;
        } else {
          const normalizedDelta = (((ang2 - ang1) % 360) + 360) % 360;
          const largeArc = normalizedDelta > 180 ? 1 : 0;
          const sweep = normalizedDelta > 0 ? 1 : 0;
          path.ellipseTo(rx, ry, 0, largeArc, sweep, end.x, end.y); // Single A
          currentX = end.x;
          currentY = end.y;
        }

        continue;
      }

      if (op === "clip") {
        if (path.length() > 0) {
          const clipPath = path.toPath();
          const clipId = `clip${clipIdCounter++}`;
          svgOut.defs.push(`<clipPath id="${clipId}"><path d="${clipPath}" /></clipPath>`);
          gState.clipStack.push(clipPath);
          path = path.reset();
        }
        continue;
      }

      if (op === "image" || op === "imagemask") {
        svgOut.elementShapes.push(
          `<!-- image/imagemask not implemented -->\n<image transform="scale(1,-1)" x="50" y="-50" width="50" height="50" href="${DEFAULT_IMAGE}" />`
        );
        continue;
      }

      if (op === "findfont") {
        const fname = stack.pop();
        if (typeof fname === "string") {
          stack.push({ font: fname });
        } else {
          stack.push({ font: String(fname) });
        }
        continue;
      }

      if (op === "scalefont") {
        const size = safePopNumber(stack, 0);
        const fontObj = stack.pop();
        if (fontObj && typeof fontObj === "object") {
          fontObj.size = size;
          stack.push(fontObj);
        } else {
          stack.push({ font: String(fontObj), size });
        }
        continue;
      }

      if (op === "setfont") {
        const sFont = stack.pop();
        if (sFont && typeof sFont === "object") {
          gState.font = sFont.font ?? gState.font;
          gState.fontSize = sFont.size ?? gState.fontSize;
        } else if (typeof sFont === "string") {
          gState.font = sFont;
        }
        continue;
      }

      if (op === "show") {
        const s = String(stack.pop() ?? "");
        const escaped = escapeXML(s);
        if (gState.lastTextPos) {
          const p = gState.ctm.applyPoint(gState.lastTextPos.x, gState.lastTextPos.y);
          svgOut.elementShapes.push(
            `<text transform="scale(1,-1)" x="${numFmt(p.x)}" y="${numFmt(-p.y)}" font-family="${gState.font}" font-size="${gState.fontSize}" fill="${gState.fill ?? "black"}">${escaped}</text>`
          );
        }
        path = path.reset();
        gState.lastTextPos = null;
        continue;
      }

      if (op === "showpage") {
        continue;
      }

      if (op === "shfill") {
        const shading = stack.pop();

        if (shading && typeof shading === "object") {
          if (shading?.ShadingType === 2) {
            const coords = shading?.Coords;
            const c0 = color2rgb(shading?.Function?.C0 || [1, 0, 0]).toString();
            const c1 = color2rgb(shading?.Function?.C1 || [0, 0, 1]).toString();
            const gradId = `grad${clipIdCounter++}`;
            svgOut.defs.push(
              `<linearGradient id="${gradId}" x1="${numFmt(coords[0])}" y1="${numFmt(coords[1])}" x2="${numFmt(coords[2])}" y2="${numFmt(coords[3])}">
            <stop offset="0" stop-color="${c0}" />
            <stop offset="1" stop-color="${c1}" />
          </linearGradient>`
            );
            if (path.length() > 0) {
              const d = path.toPath();
              svgOut.elementShapes.push(`<path d="${d}" fill="url(#${gradId})" />`);
              path = path.reset();
            }
          }
        } else {
          svgOut.elementShapes.push(`<!-- shfill not fully implemented -->`);
        }
        continue;
      }

      if (op === "setcolorspace") {
        continue;
      }

      // default: unhandled operator — comment but avoid corrupting stack
      svgOut.elementShapes.push(`<!-- Unhandled operator: ${op} -->`);
    }
  }
  if (path.length() > 0) {
    flushPath(path, gState, svgOut, StrokeOnly);
  }
}

// (not implemented) Splits multi-subpath paths into single subpaths
function megaPathSplit(path: PathBuilder, gState: GraphicState, svgOut: { elementShapes: string[] }) {
  // colocado no if (path.length() > 0) { ... }
  // Se for multi-subpath acumulado, split manualmente em paths isolados (fallback)
  const allParts = path.parts;
  if (allParts.length > 2 && allParts.every((p) => p.startsWith("M ") || p.startsWith("L "))) {
    let subPath = new PathBuilder();
    subPath.reset();
    for (const part of allParts) {
      if (part.startsWith("M ")) {
        if (subPath.length() > 0) {
          flushPath(subPath, gState, svgOut, StrokeOnly);
          subPath = subPath.reset();
        }
        subPath.parts.push(part);
      } else if (part.startsWith("L ")) {
        subPath.parts.push(part);
        if (subPath.length() === 2) {
          // Emit simple M L
          flushPath(subPath, gState, svgOut, StrokeOnly);
          subPath = subPath.reset();
        }
      }
    }
    if (subPath.length() > 0) flushPath(subPath, gState, svgOut, StrokeOnly);
  } else {
    // Legacy: Emit como um
    const d = path.toPath();
    svgOut.elementShapes.push(emitSVGPath(d, gState, StrokeOnly));
  }
  path = path.reset();
}

function extractBoundingBox(ps: string) {
  const match = /%%BoundingBox:\s*([-+0-9.eE]+)\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)/.exec(ps);
  if (match) {
    return { llx: Number(match[1]), lly: Number(match[2]), urx: Number(match[3]), ury: Number(match[4]) };
  }
  return null;
}

function convertPostscriptToSVG(psText: string): string {
  const bBox = extractBoundingBox(psText);
  const tokens = tokenize(psText);
  const svgOut = { defs: [] as string[], elementShapes: [] as string[], elementTexts: [] as string[] };
  let viewBoxAttr = "";
  let height = 0;
  let width = 0;

  if (bBox) {
    width = bBox.urx - bBox.llx;
    height = bBox.ury - bBox.lly;
    viewBoxAttr = `viewBox="${bBox.llx} ${bBox.lly} ${width} ${height}" width="${width}" height="${height}"`;
  } else {
    width = 1920;
    height = 1080;
    viewBoxAttr = `viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"`;
  }

  interpret(tokens, svgOut, bBox ?? undefined);

  const defs = svgOut.defs.join("\n");
  const shapes = svgOut.elementShapes.join("\n");
  const texts = svgOut.elementTexts.join("\n");
  const body = `<g transform="translate(0, ${height}) scale(1,-1)">\n${shapes}\n</g>\n${texts}`;
  const svg = `<?xml version="1.0" encoding="utf-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" ${viewBoxAttr}>\n${defs}\n${body}\n</svg>`;
  return svg;
}

function convertSvgToFile(inPath: string, outPath: string) {
  const file = fs.readFileSync(`${inPath}.ps`, "utf8");
  const svg = convertPostscriptToSVG(file);
  fs.writeFileSync(`${outPath}.svg`, svg, "utf8");
}
convertSvgToFile(fileInputName, fileOutputName);

console.timeEnd("Execution time");

export { convertPostscriptToSVG, convertSvgToFile };
