import * as fs from "node:fs";
import { cmyk2rgb, color2rgb } from "../color2rgb.js";
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

function tokenize(ps: string): Token[] {
  ps = ps.replace(/%[^\n\r]*/g, " ");
  const numRe = /-?(?:\d+\.\d+|\d+\.|\.\d+|\d+)(?:[eE][+-]?\d+)?/y;
  const stringRe = /\((?:\\.|[^\\\)])*\)/y;
  const nameRe = /\/?[A-Za-z_\-\.\?\*][A-Za-z0-9_\-\.\?\*]*/y;
  const braceRe = /[\{\}]/y;
  const whitespaceRe = /\s*/y;

  const tokens: Token[] = [];
  let i = 0;
  while (i < ps.length) {
    whitespaceRe.lastIndex = i;
    const ws = whitespaceRe.exec(ps);
    if (ws) i = whitespaceRe.lastIndex;
    if (i >= ps.length) break;

    stringRe.lastIndex = i;
    let m = stringRe.exec(ps);
    if (m) {
      const raw = m[0].slice(1, -1).replace(/\\([()\\nrt])/g, (s, g) => {
        if (g === "n") return "\n";
        if (g === "r") return "\r";
        if (g === "t") return "\t";
        return g;
      });
      tokens.push({ type: "string", value: raw });
      i = stringRe.lastIndex;
      continue;
    }

    numRe.lastIndex = i;
    m = numRe.exec(ps);
    if (m) {
      tokens.push({ type: "number", value: m[0] });
      i = numRe.lastIndex;
      continue;
    }

    braceRe.lastIndex = i;
    m = braceRe.exec(ps);
    if (m) {
      tokens.push({ type: "brace", value: m[0] });
      i = braceRe.lastIndex;
      continue;
    }

    nameRe.lastIndex = i;
    m = nameRe.exec(ps);
    if (m) {
      const v = m[0];
      if (v.startsWith("/")) tokens.push({ type: "name", value: v.slice(1) });
      else tokens.push({ type: "operator", value: v });
      i = nameRe.lastIndex;
      continue;
    }

    i += 1;
  }
  return tokens;
}

function parseProcedure(tokens: Token[], startIndex: number): { proc: Token[]; nextIndex: number } {
  const proc: Token[] = [];
  let depth = 1;
  let i = startIndex;
  while (i < tokens.length && depth > 0) {
    const t = tokens[i];
    if (t.type === "brace" && t.value === "{") {
      depth++;
    } else if (t.type === "brace" && t.value === "}") {
      depth--;
      if (depth === 0) {
        return { proc, nextIndex: i + 1 };
      }
    }
    if (depth > 0) proc.push(t);
    i++;
  }
  return { proc, nextIndex: i };
}

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

function numFmt(n: number) {
  return Math.round(n * 1000) / 1000;
}

const globalDict: Record<string, any> = {};
const dictStack: Record<string, any>[] = [globalDict];

function lookupName(name: string) {
  for (let i = dictStack.length - 1; i >= 0; --i) {
    if (name in dictStack[i]) return dictStack[i][name];
  }
  return undefined;
}

function emitSVGPath(d: string, g: GraphicState, fill = false, addDash = false) {
  const needG = g.ctm.a !== 1 || g.ctm.b !== 0 || g.ctm.c !== 0 || g.ctm.d !== 1 || g.ctm.e !== 0 || g.ctm.f !== 0;
  const dashAttr = addDash && g.dash ? ` stroke-dasharray="${g.dash}"` : "";
  const fillAttr = fill ? (g.fill ?? "black") : "none";
  const strokeAttr = fill ? "none" : (g.stroke ?? "black");
  if (needG || g.dash) {
    const m = g.ctm;
    return `<g transform="matrix(${numFmt(m.a)} ${numFmt(m.b)} ${numFmt(m.c)} ${numFmt(m.d)} ${numFmt(m.e)} ${numFmt(m.f)})"><path d="${d}" fill="${fillAttr}" stroke="${strokeAttr}" stroke-width="${g.strokeWidth}" stroke-linecap="${g.lineCap}" stroke-linejoin="${g.lineJoin}"${dashAttr}/></g>`;
  } else {
    return `<path d="${d}" fill="${fillAttr}" stroke="${strokeAttr}" stroke-width="${g.strokeWidth}" stroke-linecap="${g.lineCap}" stroke-linejoin="${g.lineJoin}"${dashAttr}/>`;
  }
}

function interpret(
  tokens: Token[],
  svgOut: { defs: string[]; elementShapes: string[]; elementTexts: string[] },
  boundingBox?: { llx: number; lly: number; urx: number; ury: number }
) {
  const stack: (number | string | any)[] = [];
  const gStack: GraphicState[] = [];
  let gState: GraphicState = {
    ctm: new Matrix(),
    fill: null,
    stroke: "black",
    strokeWidth: 1,
    lineCap: "butt",
    lineJoin: "miter",
    font: "Helvetica",
    fontSize: 12,
    clipStack: [],
    dash: null,
    lastTextPos: null
  };
  let path = new PathBuilder();
  let currentX = 0,
    currentY = 0;

  function safePopNumber(def = 0) {
    const v = stack.pop();
    if (typeof v === "number") return v;
    if (typeof v === "string") {
      const n = Number(v);
      return isFinite(n) ? n : def;
    }
    return def;
  }

  function flushPathAsStroke(path: PathBuilder, g: GraphicState, svgOut: { elementShapes: string[] }) {
    if (path.length() === 0) return;
    const d = path.toPath();
    svgOut.elementShapes.push(emitSVGPath(d, g, false, true));
  }

  function flushPathAsFill(path: PathBuilder, g: GraphicState, svgOut: { elementShapes: string[] }) {
    if (path.length() === 0) return;
    const d = path.toPath();
    svgOut.elementShapes.push(emitSVGPath(d, g, true));
  }

  // Função para executar um procedimento (insere tokens no fluxo atual)
  function executeProcedure(procTokens: Token[], currentIndex: number) {
    // Insere os tokens do procedimento na posição atual
    tokens.splice(currentIndex + 1, 0, ...procTokens);
  }

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.type === "number") stack.push(Number(t.value));
    else if (t.type === "string" || t.type === "name") stack.push(t.value);
    else if (t.type === "brace" && t.value === "{") {
      const { proc, nextIndex } = parseProcedure(tokens, i + 1);
      stack.push({ type: "procedure", body: proc });
      i = nextIndex - 1;
    } else if (t.type === "operator") {
      const op = t.value;

      // Verifica se é um procedimento definido pelo usuário
      const dictVal = lookupName(op);
      if (dictVal !== undefined) {
        if (dictVal && typeof dictVal === "object" && dictVal.type === "procedure") {
          // Executa o procedimento
          executeProcedure(dictVal.body, i);
        } else {
          stack.push(dictVal);
        }
        continue;
      }
      if (op === "neg") {
        const v = stack.pop();
        if (typeof v === "number") stack.push(-v);
        else if (typeof v === "string" && !isNaN(Number(v))) stack.push(-Number(v));
        else stack.push(0);
        continue;
      }
      if (op === "add") {
        const b = safePopNumber(0);
        const a = safePopNumber(0);
        stack.push(a + b);
        continue;
      }
      if (op === "sub") {
        const b = safePopNumber(0);
        const a = safePopNumber(0);
        stack.push(a - b);
        continue;
      }
      if (op === "mul") {
        const b = safePopNumber(1);
        const a = safePopNumber(1);
        stack.push(a * b);
        continue;
      }
      if (op === "div") {
        const b = safePopNumber(1);
        const a = safePopNumber(0);
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
        const size = safePopNumber(0);
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
        if (typeof key === "string") {
          dictStack[dictStack.length - 1][key] = value;
        }
        continue;
      }
      if (op === "setdash") {
        const phase = safePopNumber(0);
        const arr = stack.pop();
        if (Array.isArray(arr)) {
          gState.dash = arr.map(Number).join(",");
        } else if (typeof arr === "number") {
          gState.dash = `${arr}`;
        } else {
          gState.dash = null;
        }
        continue;
      }
      if (op === "newpath") {
        path = new PathBuilder();
        continue;
      }
      if (op === "moveto") {
        const y = safePopNumber(0);
        const x = safePopNumber(0);
        currentX = x;
        currentY = y;
        const p = gState.ctm.applyPoint(x, y);
        path.moveTo(p.x, p.y);
        gState.lastTextPos = { x, y };
        continue;
      }
      if (op === "rmoveto") {
        const dy = safePopNumber(0);
        const dx = safePopNumber(0);
        currentX += dx;
        currentY += dy;
        const p = gState.ctm.applyPoint(currentX, currentY);
        path.moveTo(p.x, p.y);
        gState.lastTextPos = { x: currentX, y: currentY };
        continue;
      }
      if (op === "lineto") {
        const y = safePopNumber(0);
        const x = safePopNumber(0);
        currentX = x;
        currentY = y;
        const p = gState.ctm.applyPoint(x, y);
        path.lineTo(p.x, p.y);

        // Verifica se é uma linha simples (moveto + lineto seguido de moveto ou texto)
        // Olha alguns tokens à frente para decidir
        let isSimpleLine = false;
        if (path.parts.length === 2 && path.parts[0].startsWith("M ") && path.parts[1].startsWith("L ")) {
          // Verifica os próximos tokens para ver se é uma linha isolada
          for (let j = i + 1; j < Math.min(i + 5, tokens.length); j++) {
            const nextToken = tokens[j];
            if (nextToken.type === "operator") {
              if (nextToken.value === "moveto" || nextToken.value === "show") {
                isSimpleLine = true;
                break;
              }
              if (
                nextToken.value === "lineto" ||
                nextToken.value === "closepath" ||
                nextToken.value === "stroke" ||
                nextToken.value === "fill" ||
                nextToken.value === "eofill" ||
                nextToken.value === "evenodd"
              ) {
                isSimpleLine = false;
                break;
              }
            }
          }
        }

        if (isSimpleLine) {
          flushPathAsStroke(path, gState, svgOut);
          path = new PathBuilder();
        }
        continue;
      }
      if (op === "rlineto") {
        const dy = safePopNumber(0);
        const dx = safePopNumber(0);
        currentX += dx;
        currentY += dy;
        const p = gState.ctm.applyPoint(currentX, currentY);
        path.lineTo(p.x, p.y);
        continue;
      }
      if (op === "curveto") {
        const y3 = safePopNumber(0),
          x3 = safePopNumber(0);
        const y2 = safePopNumber(0),
          x2 = safePopNumber(0);
        const y1 = safePopNumber(0),
          x1 = safePopNumber(0);
        currentX = x3;
        currentY = y3;
        const p1 = gState.ctm.applyPoint(x1, y1);
        const p2 = gState.ctm.applyPoint(x2, y2);
        const p3 = gState.ctm.applyPoint(x3, y3);
        path.curveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
        continue;
      }
      if (op === "rcurveto") {
        const dy3 = safePopNumber(0),
          dx3 = safePopNumber(0);
        const dy2 = safePopNumber(0),
          dx2 = safePopNumber(0);
        const dy1 = safePopNumber(0),
          dx1 = safePopNumber(0);
        const x1 = currentX + dx1,
          y1 = currentY + dy1;
        const x2 = currentX + dx2,
          y2 = currentY + dy2;
        currentX += dx3;
        currentY += dy3;
        const x3 = currentX,
          y3 = currentY;
        const p1 = gState.ctm.applyPoint(x1, y1);
        const p2 = gState.ctm.applyPoint(x2, y2);
        const p3 = gState.ctm.applyPoint(x3, y3);
        path.curveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
        continue;
      }
      if (op === "closepath") {
        path.close();
        continue;
      }
      if (op === "stroke") {
        flushPathAsStroke(path, gState, svgOut);
        path = new PathBuilder();
        continue;
      }
      if (op === "fill" || op === "eofill" || op === "evenodd") {
        // Verifica se o path é um retângulo simples para otimização
        if (isRectanglePath(path)) {
          const rect = extractRectangle(path, gState);
          if (rect) {
            svgOut.elementShapes.push(rect);
            path.parts = [];
            continue;
          }
        }
        flushPathAsFill(path, gState, svgOut);
        path = new PathBuilder();
        continue;
      }
      if (op === "setrgbcolor") {
        const b = safePopNumber(0);
        const g = safePopNumber(0);
        const r = safePopNumber(0);
        const rgb = color2rgb([r, g, b]).toString();
        gState.fill = rgb;
        gState.stroke = rgb;
        continue;
      }
      if (op === "setgray") {
        const v = safePopNumber(0);
        const gray = Math.round(v * 255);
        const s = `rgb(${gray},${gray},${gray})`;
        gState.fill = s;
        gState.stroke = s;
        continue;
      }
      if (op === "setcmykcolor") {
        const k = safePopNumber(0);
        const y = safePopNumber(0);
        const m = safePopNumber(0);
        const c = safePopNumber(0);
        const rgb = cmyk2rgb([c, m, y, k]).toString();
        gState.fill = rgb;
        gState.stroke = rgb;
        continue;
      }
      if (op === "setlinewidth") {
        gState.strokeWidth = safePopNumber(1);
        continue;
      }
      if (op === "setlinecap") {
        const v = stack.pop();
        if (typeof v === "number") gState.lineCap = v === 0 ? "butt" : v === 1 ? "round" : "square";
        else if (typeof v === "string") gState.lineCap = v;
        continue;
      }
      if (op === "setlinejoin") {
        const v = stack.pop();
        if (typeof v === "number") gState.lineJoin = v === 0 ? "miter" : v === 1 ? "round" : "bevel";
        else if (typeof v === "string") gState.lineJoin = v;
        continue;
      }
      if (op === "translate") {
        const ty = safePopNumber(0);
        const tx = safePopNumber(0);
        gState.ctm = gState.ctm.translate(tx, ty);
        continue;
      }
      if (op === "scale") {
        const sy = safePopNumber(1);
        const sx = safePopNumber(1);
        gState.ctm = gState.ctm.scale(sx, sy);
        continue;
      }
      if (op === "rotate") {
        const ang = safePopNumber(0);
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
        const ang2 = safePopNumber(0);
        const ang1 = safePopNumber(0);
        const r = safePopNumber(0);
        const y = safePopNumber(0);
        const x = safePopNumber(0);
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
        const size = safePopNumber(0);
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
        path = new PathBuilder(); // Limpa path após show
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
    flushPathAsStroke(path, gState, svgOut);
  }
}

function anglePoint(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function escapeXML(s: string) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
  // .replace(/\\/g, ""); // Remove backslashes for PostScript escape sequences
}

// Verifica se o path representa um retângulo simples (moveto + 4 rlineto + closepath)
function isRectanglePath(path: PathBuilder): boolean {
  const parts = path.parts;
  if (parts.length !== 6) return false; // M + 4L + Z
  if (!parts[0].startsWith("M ")) return false;
  if (!parts[5].startsWith("Z")) return false;
  for (let i = 1; i <= 4; i++) {
    if (!parts[i].startsWith("L ")) return false;
  }
  return true;
}

// Extrai coordenadas de retângulo e gera SVG <rect>
function extractRectangle(path: PathBuilder, gState: GraphicState): string | null {
  const parts = path.parts;
  if (!isRectanglePath(path)) return null;

  try {
    // Parse das coordenadas
    const mCoords = parts[0].substring(2).split(" ").map(Number);
    const l1Coords = parts[1].substring(2).split(" ").map(Number);
    const l2Coords = parts[2].substring(2).split(" ").map(Number);
    const l3Coords = parts[3].substring(2).split(" ").map(Number);
    const l4Coords = parts[4].substring(2).split(" ").map(Number);

    const x = mCoords[0];
    const y = mCoords[1];
    const width = Math.abs(l2Coords[0] - mCoords[0]);
    const height = Math.abs(l1Coords[1] - mCoords[1]);

    // Verifica se é realmente um retângulo
    if (Math.abs(l1Coords[0] - x) > 1e-6) return null; // primeira linha deve ser vertical
    if (Math.abs(l2Coords[1] - l1Coords[1]) > 1e-6) return null; // segunda linha deve ser horizontal
    if (Math.abs(l3Coords[0] - l2Coords[0]) > 1e-6) return null; // terceira linha deve ser vertical
    if (Math.abs(l4Coords[1] - y) > 1e-6) return null; // quarta linha deve voltar à altura original

    const fillColor = gState.fill || "black";

    // Aplica transformação se necessária
    const needG =
      gState.ctm.a !== 1 ||
      gState.ctm.b !== 0 ||
      gState.ctm.c !== 0 ||
      gState.ctm.d !== 1 ||
      gState.ctm.e !== 0 ||
      gState.ctm.f !== 0;

    if (needG) {
      const m = gState.ctm;
      return `<g transform="matrix(${numFmt(m.a)} ${numFmt(m.b)} ${numFmt(m.c)} ${numFmt(m.d)} ${numFmt(m.e)} ${numFmt(m.f)})"><rect x="${numFmt(x)}" y="${numFmt(y)}" width="${numFmt(width)}" height="${numFmt(height)}" fill="${fillColor}" /></g>`;
    } else {
      return `<rect x="${numFmt(x)}" y="${numFmt(y)}" width="${numFmt(width)}" height="${numFmt(height)}" fill="${fillColor}" />`;
    }
  } catch (e) {
    return null;
  }
}

function extractBoundingBox(ps: string) {
  const m = /%%BoundingBox:\s*([-+0-9.eE]+)\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)/.exec(ps);
  if (m) return { llx: Number(m[1]), lly: Number(m[2]), urx: Number(m[3]), ury: Number(m[4]) };
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
  }
  if (bBox === null) {
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
