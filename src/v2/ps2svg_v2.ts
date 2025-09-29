import * as fs from "node:fs";
import { cmyk2rgb, color2rgb, gray2rgb } from "../color2rgb.js";
// import { fileInputName, fileOutputName } from "./cli.js";

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
  moveTo(x: number, y: number) {
    this.parts.push(`M ${numFmt(x)} ${numFmt(y)}`);
  }
  moveToRel(dx: number, dy: number) {
    this.parts.push(`m ${numFmt(dx)} ${numFmt(dy)}`);
  }

  lineTo(x: number, y: number) {
    this.parts.push(`L ${numFmt(x)} ${numFmt(y)}`);
  }
  lineToRel(dx: number, dy: number) {
    this.parts.push(`l ${numFmt(dx)} ${numFmt(dy)}`);
  }

  horizontalLineTo(x: number) {
    this.parts.push(`H ${numFmt(x)}`);
  }
  horizontalLineToRel(dx: number) {
    this.parts.push(`h ${numFmt(dx)}`);
  }

  verticalLineTo(y: number) {
    this.parts.push(`V ${numFmt(y)}`);
  }
  verticalLineToRel(dy: number) {
    this.parts.push(`v ${numFmt(dy)}`);
  }

  curveTo(x1: number, y1: number, x2: number, y2: number, x: number, y: number) {
    this.parts.push(`C ${numFmt(x1)} ${numFmt(y1)} ${numFmt(x2)} ${numFmt(y2)} ${numFmt(x)} ${numFmt(y)}`);
  }
  curveToRel(dx1: number, dy1: number, dx2: number, dy2: number, dx: number, dy: number) {
    this.parts.push(`c ${numFmt(dx1)} ${numFmt(dy1)} ${numFmt(dx2)} ${numFmt(dy2)} ${numFmt(dx)} ${numFmt(dy)}`);
  }

  smoothCurveTo(x2: number, y2: number, x: number, y: number) {
    this.parts.push(`S ${numFmt(x2)} ${numFmt(y2)} ${numFmt(x)} ${numFmt(y)}`);
  }
  smoothCurveToRel(dx2: number, dy2: number, dx: number, dy: number) {
    this.parts.push(`s ${numFmt(dx2)} ${numFmt(dy2)} ${numFmt(dx)} ${numFmt(dy)}`);
  }

  quadraticCurveTo(x1: number, y1: number, x: number, y: number) {
    this.parts.push(`Q ${numFmt(x1)} ${numFmt(y1)} ${numFmt(x)} ${numFmt(y)}`);
  }
  quadraticCurveToRel(dx1: number, dy1: number, dx: number, dy: number) {
    this.parts.push(`q ${numFmt(dx1)} ${numFmt(dy1)} ${numFmt(dx)} ${numFmt(dy)}`);
  }

  smoothQuadraticCurveTo(x: number, y: number) {
    this.parts.push(`T ${numFmt(x)} ${numFmt(y)}`);
  }
  smoothQuadraticCurveToRel(dx: number, dy: number) {
    this.parts.push(`t ${numFmt(dx)} ${numFmt(dy)}`);
  }

  ellipseTo(rx: number, ry: number, rotation: number, arc: number, sweep: number, x: number, y: number) {
    this.parts.push(
      `A ${numFmt(rx)} ${numFmt(ry)} ${numFmt(rotation)} ${numFmt(arc)} ${numFmt(sweep)} ${numFmt(x)} ${numFmt(y)}`
    );
  }
  ellipseToRel(rx: number, ry: number, rotation: number, arc: number, sweep: number, dx: number, dy: number) {
    this.parts.push(
      `a ${numFmt(rx)} ${numFmt(ry)} ${numFmt(rotation)} ${numFmt(arc)} ${numFmt(sweep)} ${numFmt(dx)} ${numFmt(dy)}`
    );
  }

  close() {
    this.parts.push("Z");
  }

  // Utilitários
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
    return new PathBuilder();
  }
}

type Token = { type: "number" | "name" | "string" | "operator" | "brace"; value: string };

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

function tokenize(ps: string): Token[] {
  ps = ps.replace(/%[^\n\r]*/g, " "); // Remove comments
  const numRe = /-?(?:\d+\.\d+|\d+\.|\.\d+|\d+)(?:[eE][+-]?\d+)?/y; // 12 .2 3e4
  const stringRe = /\((?:\\.|[^\\\)])*\)/y; // (foo) (a\)b)
  const nameRe = /\/?[A-Za-z_\-\.\?\*][A-Za-z0-9_\-\.\?\*]*/y; //  name /foo /foo-bar
  const braceRe = /[\{\}]/y;
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
      // const raw = match[0].slice(1, -1).replace(/\\([()\\nrt])/g, (s, g) => {
      //   if (g === "n") return "\n";
      //   if (g === "r") return "\r";
      //   if (g === "t") return "\t";
      //   return g;
      // });
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

// PS string unescaping: Char-by-char loop for precise handling (per PLRM)
function unescapePostscriptString(str: string): string {
  let result = "";
  let index = 0;

  while (index < str.length) {
    if (str[index] !== "\\") {
      result += str[index];
      index++;
      continue;
    }
    // Escape sequence: \ followed by...
    index++; // Skip the \
    if (index >= str.length) {
      result += "\\"; // Trailing \ -> literal \
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
        break; // Escaped space
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
          index--; // Adjust for loop increment
        } else {
          // Literal next char (non-special, e.g., \n where n is literal 'n' after escaped \)
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

function emitSVGPath(d: string, g: GraphicState, mode: { stroke: boolean; fill: boolean }, addDash = false): string {
  const needGroup = !isIdentityMatrix(g.ctm) || g.clipStack.length > 0;

  const fillColor = mode.fill ? (g.fill ?? "black") : "none";
  const strokeColor = mode.stroke ? (g.stroke ?? "black") : "none";
  const strokeAttr = mode.stroke ? strokeColor : "none";

  const strokeWidthAttr = g.strokeWidth ? `stroke-width="${g.strokeWidth}"` : "";
  const strokeLineCapAttr = g.lineCap ? `stroke-linecap="${g.lineCap}"` : "";
  const strokeLineJoinAttr = g.lineJoin ? `stroke-linejoin="${g.lineJoin}"` : "";
  const dashAttr = addDash && g.dash ? `stroke-dasharray="${g.dash}"` : "";

  const pathAttrs = [
    `d="${d}"`,
    `fill="${fillColor}"`,
    `stroke="${strokeAttr}"`,
    strokeWidthAttr,
    strokeLineCapAttr,
    strokeLineJoinAttr,
    dashAttr
  ]
    .filter(Boolean)
    .join(" ");

  const clipId = g.clipStack.length > 0 ? ` clip-path="url(#clip${g.clipStack.length - 1})"` : "";

  if (needGroup) {
    const m = g.ctm;
    const transform = `matrix(${numFmt(m.a)} ${numFmt(m.b)} ${numFmt(m.c)} ${numFmt(m.d)} ${numFmt(m.e)} ${numFmt(m.f)})`;
    return `<g transform="${transform}"${clipId}><path ${pathAttrs}/></g>`;
  } else {
    return `<path ${pathAttrs}${clipId}/>`;
  }
}

// Verifica se o path representa um retângulo simples (moveto + 4 rlineto + closepath)
function isRectanglePath(path: PathBuilder): boolean {
  const parts = path.parts;
  if (parts.length < 5) return false; // M + 4L + Z
  if (!parts[0].startsWith("M ")) return false;
  if (!parts[parts.length - 1].endsWith("Z")) return false;
  const lines = parts.slice(1, -1);
  if (lines.length !== 4) return false;
  return lines.every((p) => p.startsWith("L "));
}

function extractRectangle(
  path: PathBuilder,
  gState: GraphicState
): { rect: string; minX: number; minY: number; width: number; height: number } | null {
  if (!isRectanglePath(path)) return null;

  try {
    const parts = path.parts;
    const mMatch = parts[0].match(/M\s+([-.\d]+)\s+([-.\d]+)/);
    const lMatches = parts.slice(1, -1).map((p) => p.match(/L\s+([-.\d]+)\s+([-.\d]+)/));

    if (!mMatch || lMatches.some((m) => !m)) return null;

    const [x1, y1] = mMatch.slice(1).map(Number);
    const coords = lMatches.map((m) => m!.slice(1).map(Number));

    const [x2, y2] = coords[0];
    const [x3, y3] = coords[1];
    const [x4, y4] = coords[2];
    const [x5, y5] = coords[3];

    // Verificações geométricas
    if (Math.abs(x5 - x1) > 1e-6 || Math.abs(y5 - y1) > 1e-6) return null;
    if (Math.abs(x2 - x1) > 1e-6 && Math.abs(y2 - y1) > 1e-6) return null;
    if (Math.abs(x3 - x2) < 1e-6 || Math.abs(y3 - y2) < 1e-6) return null;

    const xs = [x1, x2, x3, x4, x5];
    const ys = [y1, y2, y3, y4, y5];
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const width = Math.max(...xs) - minX;
    const height = Math.max(...ys) - minY;

    const fillColor = gState.fill ?? "black";
    const rectAttrs = `x="${numFmt(minX)}" y="${numFmt(minY)}" width="${numFmt(width)}" height="${numFmt(height)}" fill="${fillColor}"`;

    const m = gState.ctm;
    const needTransform = !isIdentityMatrix(gState.ctm);
    const transform = `matrix(${numFmt(m.a)} ${numFmt(m.b)} ${numFmt(m.c)} ${numFmt(m.d)} ${numFmt(m.e)} ${numFmt(m.f)})`;

    const rect = needTransform ? `<g transform="${transform}"><rect ${rectAttrs}/></g>` : `<rect ${rectAttrs}/>`;

    return { rect, minX, minY, width, height };
  } catch {
    return null;
  }
}

function escapeXML(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
  // .replace(/\\/g, ""); // Remove backslashes for PostScript escape sequences
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

// Helper for simple line flush
function isSimpleLineAhead(tokens: Token[], startIdx: number): boolean {
  // Verifica os próximos tokens para ver se é uma linha isolada
  for (let j = startIdx; j < Math.min(startIdx + 3, tokens.length); j++) {
    const token = tokens[j];
    if (token.type === "operator") {
      const value = token.value;
      // Se for um operador que indica fim ou texto, é linha simples
      if (["stroke", "show", "moveto"].includes(value)) return true;
      // Se for um operador vetorial, não é linha simples
      if (["lineto", "curveto", "rlineto", "rcurveto"].includes(value)) return false;

      // Operador desconhecido: assume seguro
      return true;
    }
  }
  return true; // Near EOF: flush
}

// Função para executar um procedimento (insere tokens no fluxo atual)
function executeProcedure(tokens: Token[], procTokens: Token[], currentIndex: number) {
  // Insere os tokens do procedimento na posição atual
  tokens.splice(currentIndex + 1, 0, ...procTokens);
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
  const clipIdCounter = 0;

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
    } else if (tokenType === "operator") {
      const op = tokenValue;

      // Verifica se é um procedimento definido pelo usuário
      const dictVal = lookupName(op);
      if (dictVal !== undefined) {
        if (dictVal && typeof dictVal === "object" && dictVal.type === "procedure") {
          executeProcedure(tokens, dictVal.body, i);
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
        if (Array.isArray(arr)) gState.dash = arr.map(Number).join(",");
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
        currentX = x;
        currentY = y;
        const pos = gState.ctm.applyPoint(x, y);
        path.moveTo(pos.x, pos.y);
        gState.lastTextPos = { x, y };
        continue;
      }

      if (op === "rmoveto") {
        const dy = safePopNumber(stack, 0);
        const dx = safePopNumber(stack, 0);
        currentX += dx;
        currentY += dy;
        const pos = gState.ctm.applyPoint(currentX, currentY);
        path.moveTo(pos.x, pos.y);
        // path.moveToRel(pos.x, pos.y);
        gState.lastTextPos = { x: currentX, y: currentY };
        continue;
      }

      if (op === "lineto") {
        const y = safePopNumber(stack, 0);
        const x = safePopNumber(stack, 0);
        currentX = x;
        currentY = y;
        const pos = gState.ctm.applyPoint(x, y);
        path.lineTo(pos.x, pos.y);

        // Verifica se é uma linha simples (moveto + lineto seguido de moveto ou texto)
        if (
          path.parts.length === 2 &&
          path.parts[0].startsWith("M ") &&
          path.parts[1].startsWith("L ") &&
          isSimpleLineAhead(tokens, i + 1)
        ) {
          // if (path.parts.length === 2 && isSimpleLineAhead(tokens, i + 1)) {
          flushPath(path, gState, svgOut, StrokeOnly);
          path = path.reset(); // Reset imediato para próximo moveto
        }
        continue;
      }

      if (op === "rlineto") {
        const dy = safePopNumber(stack, 0);
        const dx = safePopNumber(stack, 0);
        currentX += dx;
        currentY += dy;
        const pos = gState.ctm.applyPoint(currentX, currentY);
        path.lineTo(pos.x, pos.y);
        // path.lineToRel(pos.x, pos.y);
        continue;
      }

      if (op === "curveto") {
        const y = safePopNumber(stack, 0),
          x = safePopNumber(stack, 0);
        const y2 = safePopNumber(stack, 0),
          x2 = safePopNumber(stack, 0);
        const y1 = safePopNumber(stack, 0),
          x1 = safePopNumber(stack, 0);
        currentX = x;
        currentY = y;
        const pos1 = gState.ctm.applyPoint(x1, y1);
        const pos2 = gState.ctm.applyPoint(x2, y2);
        const pos3 = gState.ctm.applyPoint(x, y);
        path.curveTo(pos1.x, pos1.y, pos2.x, pos2.y, pos3.x, pos3.y);
        continue;
      }

      if (op === "rcurveto") {
        const dy = safePopNumber(stack, 0),
          dx = safePopNumber(stack, 0);
        const dy2 = safePopNumber(stack, 0),
          dx2 = safePopNumber(stack, 0);
        const dy1 = safePopNumber(stack, 0),
          dx1 = safePopNumber(stack, 0);
        const x1 = currentX + dx1,
          y1 = currentY + dy1;
        const x2 = currentX + dx2,
          y2 = currentY + dy2;
        currentX += dx;
        currentY += dy;
        const x = currentX,
          y = currentY;
        const pos1 = gState.ctm.applyPoint(x1, y1);
        const pos2 = gState.ctm.applyPoint(x2, y2);
        const pos3 = gState.ctm.applyPoint(x, y);
        path.curveTo(pos1.x, pos1.y, pos2.x, pos2.y, pos3.x, pos3.y);
        // path.curveToRel(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
        continue;
      }

      if (op === "closepath") {
        path.close();
        continue;
      }

      if (op === "stroke") {
        flushPath(path, gState, svgOut, StrokeOnly);
        path = path.reset();
        continue;
      }

      if (op === "fill" || op === "eofill" || op === "evenodd") {
        // Verifica se o path é um retângulo simples para otimização
        if (isRectanglePath(path)) {
          const rect = extractRectangle(path, gState);
          if (rect) {
            svgOut.elementShapes.push(rect.rect);
            path.parts = [];
            continue;
          }
        }
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
        continue;
      }
      if (op === "scale") {
        const sy = safePopNumber(stack, 1);
        const sx = safePopNumber(stack, 1);
        gState.ctm = gState.ctm.scale(sx, sy);
        continue;
      }
      if (op === "rotate") {
        const ang = safePopNumber(stack, 0);
        gState.ctm = gState.ctm.rotate(ang);
        continue;
      }
      if (op === "gsave") {
        gStack.push(cloneGraphic(gState));
        continue;
      }
      if (op === "grestore") {
        const st = gStack.pop();
        if (st) gState = st;
        continue;
      }
      if (op === "arc") {
        const ang2 = safePopNumber(stack, 0);
        const ang1 = safePopNumber(stack, 0);
        const r = safePopNumber(stack, 0);
        const y = safePopNumber(stack, 0);
        const x = safePopNumber(stack, 0);
        const start = anglePoint(x, y, r, ang1);
        const end = anglePoint(x, y, r, ang2);
        const a = gState.ctm.a,
          b = gState.ctm.b,
          c = gState.ctm.c,
          d = gState.ctm.d;
        const scaleX = Math.hypot(a, b) || 1;
        const scaleY = Math.hypot(c, d) || 1;
        const rx = Math.abs(r * scaleX);
        const ry = Math.abs(r * scaleY);
        const pStart = gState.ctm.applyPoint(start.x, start.y);
        const pEnd = gState.ctm.applyPoint(end.x, end.y);
        const delta = (((ang2 - ang1) % 360) + 360) % 360;
        if (Math.abs(delta) < 1e-6) {
          const cP = gState.ctm.applyPoint(x, y);
          const avgR = (rx + ry) / 2;
          if (Math.abs(a - d) < 1e-6 && Math.abs(b + c) < 1e-6) {
            svgOut.elementShapes.push(
              `<circle cx="${numFmt(cP.x)}" cy="${numFmt(cP.y)}" r="${numFmt(avgR)}" fill="none" stroke="${gState.stroke ?? "none"}" stroke-width="${gState.strokeWidth}"/>`
            );
          } else {
            const midAng = ang1 + 180;
            const mid = anglePoint(x, y, r, midAng);
            const pMid = gState.ctm.applyPoint(mid.x, mid.y);
            const d1 = `M ${numFmt(pStart.x)} ${numFmt(pStart.y)} A ${numFmt(rx)} ${numFmt(ry)} 0 0 1 ${numFmt(pMid.x)} ${numFmt(pMid.y)}`;
            const d2 = `M ${numFmt(pMid.x)} ${numFmt(pMid.y)} A ${numFmt(rx)} ${numFmt(ry)} 0 0 1 ${numFmt(pEnd.x)} ${numFmt(pEnd.y)}`;
            svgOut.elementShapes.push(
              `<path d="${d1}" fill="none" stroke="${gState.stroke ?? "none"}" stroke-width="${gState.strokeWidth}"/>`
            );
            svgOut.elementShapes.push(
              `<path d="${d2}" fill="none" stroke="${gState.stroke ?? "none"}" stroke-width="${gState.strokeWidth}"/>`
            );
          }
        } else {
          const large = delta > 180 ? 1 : 0;
          const sweep = delta > 0 ? 1 : 0;
          if (!(Math.abs(pStart.x - pEnd.x) < 1e-6 && Math.abs(pStart.y - pEnd.y) < 1e-6)) {
            const d = `M ${numFmt(pStart.x)} ${numFmt(pStart.y)} A ${numFmt(rx)} ${numFmt(ry)} 0 ${large} ${sweep} ${numFmt(pEnd.x)} ${numFmt(pEnd.y)}`;
            const dashAttr = gState.dash ? ` stroke-dasharray="${gState.dash}"` : "";
            svgOut.elementShapes.push(
              `<path d="${d}" fill="none" stroke="${gState.stroke ?? "none"}" stroke-width="${gState.strokeWidth}"${dashAttr}/>`
            );
          }
        }
        continue;
      }
      if (op === "clip") {
        // apenas marca clipStack, não aplica ainda
        gState.clipStack.push(path.toPath());
        path.parts = [];
        continue;
      }
      if (op === "image" || op === "imagemask") {
        svgOut.elementShapes.push(
          `<!-- image/imagemask not implemented --><image x="100" y="100" width="50" height="50" href="placeholder.png" />`
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
        const f = stack.pop();
        if (f && typeof f === "object") {
          gState.font = f.font ?? gState.font;
          gState.fontSize = f.size ?? gState.fontSize;
        } else if (typeof f === "string") {
          gState.font = f;
        }
        continue;
      }
      if (op === "show") {
        const s = String(stack.pop() ?? "");
        const escaped = escapeXML(s);
        if (gState.lastTextPos) {
          const p = gState.ctm.applyPoint(gState.lastTextPos.x, gState.lastTextPos.y);
          svgOut.elementShapes.push(
            `<text transform="scale(1,-1)" x="${numFmt(p.x)}" y="${numFmt(-p.y)}" font-family="${gState.font}" font-size="${gState.fontSize}" fill="${gState.fill ?? "black"}" stroke="none">${escaped}</text>`
          );
        }
        path = path.reset(); // Limpa path após show
        continue;
      }
      if (op === "showpage") {
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
  path.clear();
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
// convertSvgToFile(fileInputName, fileOutputName);

console.timeEnd("Execution time");

export { convertPostscriptToSVG, convertSvgToFile };
