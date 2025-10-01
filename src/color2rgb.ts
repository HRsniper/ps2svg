type RYBColor = [number, number, number];
type RGBColor = [number, number, number];
type CMYKColor = [number, number, number, number];

const COLOR_CONSTANTS = {
  RGB_MAX: 255,
  RGB_MIN: 0,
  RGB_MAX_PS: 1.0,
  RGB_MIN_PS: 0.0,
  RYB_MAX_PS: 1.0,
  RYB_MIN_PS: 0.0,
  CMYK_MAX_PS: 1.0,
  CMYK_MIN_PS: 0.0
};

// Vértices do cubo RGB → RGB
const RGB_CUBE: RGBColor[] = [
  [0, 0, 0], // (0,0,0) preto
  [255, 0, 0], // (1,0,0) vermelho
  [0, 255, 0], // (0,1,0) verde
  [0, 0, 255], // (0,0,1) azul
  [255, 255, 0], // (1,1,0) amarelo
  [255, 0, 255], // (1,0,1) magenta
  [0, 255, 255], // (0,1,1) ciano
  [255, 255, 255] // (1,1,1) branco
];

// Vértices do cubo RYB → RGB
const RYB_CUBE: RYBColor[] = [
  [0, 0, 0], // (0,0,0) preto
  [255, 0, 0], // (1,0,0) vermelho
  [255, 255, 0], // (0,1,0) amarelo
  [0, 0, 255], // (0,0,1) azul
  [255, 128, 0], // (1,1,0) laranja
  [128, 0, 128], // (1,0,1) violeta
  [0, 255, 0], // (0,1,1) verde
  [255, 255, 255] // (1,1,1) branco
];

// Normaliza um valor para estar dentro do range especificado
function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
// Função de interpolação linear
function linearInterpolate(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

// Interpolação trilinear
function trilinearInterpolate(cube: RGBColor[], x: number, y: number, z: number): RGBColor {
  const c000 = cube[0];
  const c100 = cube[1];
  const c010 = cube[2];
  const c001 = cube[3];
  const c110 = cube[4];
  const c101 = cube[5];
  const c011 = cube[6];
  const c111 = cube[7];

  const out: RGBColor = [0, 0, 0];

  for (let i = 0; i < 3; i++) {
    const c00 = linearInterpolate(c000[i], c100[i], x);
    const c01 = linearInterpolate(c001[i], c101[i], x);
    const c10 = linearInterpolate(c010[i], c110[i], x);
    const c11 = linearInterpolate(c011[i], c111[i], x);

    const c0 = linearInterpolate(c00, c10, y);
    const c1 = linearInterpolate(c01, c11, y);

    out[i] = Math.round(linearInterpolate(c0, c1, z));
  }

  return out;
}

// Conversão RYB → RGB com interpolação trilinear
function ryb2rgb([r, y, b]: RYBColor) {
  const r_norm = clamp(r, COLOR_CONSTANTS.RYB_MIN_PS, COLOR_CONSTANTS.RYB_MAX_PS);
  const y_norm = clamp(y, COLOR_CONSTANTS.RYB_MIN_PS, COLOR_CONSTANTS.RYB_MAX_PS);
  const b_norm = clamp(b, COLOR_CONSTANTS.RYB_MIN_PS, COLOR_CONSTANTS.RYB_MAX_PS);
  // console.log(`ryb(${r_norm}, ${y_norm}, ${b_norm})`);

  const [rr, gg, bb] = trilinearInterpolate(RGB_CUBE, r_norm, y_norm, b_norm);
  // console.log(`rgb(${rr}, ${gg}, ${bb})`);
  return returnObject(rr, gg, bb);
}

// Conversão CMYK → RGB
function cmyk2rgb([c, m, y, k]: CMYKColor) {
  const c_norm = clamp(c, COLOR_CONSTANTS.CMYK_MIN_PS, COLOR_CONSTANTS.CMYK_MAX_PS);
  const m_norm = clamp(m, COLOR_CONSTANTS.CMYK_MIN_PS, COLOR_CONSTANTS.CMYK_MAX_PS);
  const y_norm = clamp(y, COLOR_CONSTANTS.CMYK_MIN_PS, COLOR_CONSTANTS.CMYK_MAX_PS);
  const k_norm = clamp(k, COLOR_CONSTANTS.CMYK_MIN_PS, COLOR_CONSTANTS.CMYK_MAX_PS);
  // console.log(`cmyk(${c_norm}, ${m_norm}, ${y_norm}, ${k_norm})`);

  const r_norm = (1 - c_norm) * (1 - k_norm);
  const g_norm = (1 - m_norm) * (1 - k_norm);
  const b_norm = (1 - y_norm) * (1 - k_norm);

  const r = Math.round(r_norm * COLOR_CONSTANTS.RGB_MAX);
  const g = Math.round(g_norm * COLOR_CONSTANTS.RGB_MAX);
  const b = Math.round(b_norm * COLOR_CONSTANTS.RGB_MAX);
  // console.log(`rgb(${r}, ${g}, ${b})`);
  return returnObject(r, g, b);
}

function color2rgb([r, g, b]: RGBColor) {
  const r_norm = clamp(r, COLOR_CONSTANTS.RGB_MIN_PS, COLOR_CONSTANTS.RGB_MAX_PS);
  const g_norm = clamp(g, COLOR_CONSTANTS.RGB_MIN_PS, COLOR_CONSTANTS.RGB_MAX_PS);
  const b_norm = clamp(b, COLOR_CONSTANTS.RGB_MIN_PS, COLOR_CONSTANTS.RGB_MAX_PS);
  // console.log(`rgb(${r_norm}, ${g_norm}, ${b_norm})`);

  const rr = Math.round(r_norm * COLOR_CONSTANTS.RGB_MAX);
  const gg = Math.round(g_norm * COLOR_CONSTANTS.RGB_MAX);
  const bb = Math.round(b_norm * COLOR_CONSTANTS.RGB_MAX);
  // console.log(`rgb(${rr}, ${gg}, ${bb})`);
  return returnObject(rr, gg, bb);
}

function gray2rgb(gray: number) {
  const g_norm = clamp(gray, COLOR_CONSTANTS.RGB_MIN_PS, COLOR_CONSTANTS.RGB_MAX_PS);
  const gg = Math.round(g_norm * COLOR_CONSTANTS.RGB_MAX);
  return returnObject(gg, gg, gg);
}

function returnObject(r: number, g: number, b: number) {
  return {
    toString: () => `rgb(${r}, ${g}, ${b})`,
    toArray: (): RGBColor => [r, g, b],
    toHex: () =>
      `#${[r, g, b].map((color) => clamp(color, COLOR_CONSTANTS.RGB_MIN, COLOR_CONSTANTS.RGB_MAX).toString(16).padStart(2, "0")).join("")}`
  };
}

export { color2rgb, ryb2rgb, cmyk2rgb, gray2rgb };
export type { RGBColor, RYBColor, CMYKColor };

// console.log(color2rgb([0.95, 0.83, 0.82]).toString());

// rgb(242, 212, 209)

// console.log(ryb2rgb([0.95, 0.83, 0.82]).toString());
// console.log(ryb2rgb([0.95, 0.82, 0.83]).toString());
// console.log(ryb2rgb([1.0, 0.9, 0.8]).toString());
// console.log(ryb2rgb([1.1, 0.9, 0.8]).toString());
// console.log(ryb2rgb([1.0, 1.0, 1.0]).toString());
// console.log(ryb2rgb([1.0, 0, 0]).toString());
// console.log(ryb2rgb([0, 1.0, 0]).toString());
// console.log(ryb2rgb([0, 0, 1.0]).toString());
// console.log(ryb2rgb([1.0, 1.0, 0]).toString());
// console.log(ryb2rgb([1.0, 0, 1.0]).toString());
// console.log(ryb2rgb([0, 1.0, 1.0]).toString());

// rgb(242, 212, 209)
// rgb(242, 209, 212)
// rgb(255, 230, 204)
// rgb(255, 230, 204)
// rgb(255, 255, 255)
// rgb(255, 0, 0)
// rgb(0, 255, 0)
// rgb(0, 0, 255)
// rgb(255, 255, 0)
// rgb(255, 0, 255)
// rgb(0, 255, 255)

// console.log("---");

// console.log(cmyk2rgb([0, 0, 0, 0]).toString());
// console.log(cmyk2rgb([1, 0, 0, 0]).toString());
// console.log(cmyk2rgb([0, 1, 0, 0]).toString());
// console.log(cmyk2rgb([1, 1, 0, 0]).toString());
// console.log(cmyk2rgb([0, 0, 1, 0]).toString());
// console.log(cmyk2rgb([1, 0, 1, 0]).toString());
// console.log(cmyk2rgb([0, 1, 1, 0]).toString());
// console.log(cmyk2rgb([1, 1, 1, 0]).toString());
// console.log(cmyk2rgb([0, 0, 0, 1]).toString());
// console.log(cmyk2rgb([0, 0, 0, 0.5]).toString());
// console.log(cmyk2rgb([1, 0, 0, 0.5]).toString());
// console.log(cmyk2rgb([0, 1, 0, 0.5]).toString());
// console.log(cmyk2rgb([1, 1, 0, 0.5]).toString());
// console.log(cmyk2rgb([0, 0, 1, 0.5]).toString());
// console.log(cmyk2rgb([1, 0, 1, 0.5]).toString());
// console.log(cmyk2rgb([0, 1, 1, 0.5]).toString());
// console.log(cmyk2rgb([1, 1, 1, 0.5]).toString());

// rgb(255, 255, 255)
// rgb(0, 255, 255)
// rgb(255, 0, 255)
// rgb(0, 0, 255)
// rgb(255, 255, 0)
// rgb(0, 255, 0)
// rgb(255, 0, 0)
// rgb(0, 0, 0)
// rgb(0, 0, 0)
// rgb(128, 128, 128)
// rgb(0, 128, 128)
// rgb(128, 0, 128)
// rgb(0, 0, 128)
// rgb(128, 128, 0)
// rgb(0, 128, 0)
// rgb(128, 0, 0)
// rgb(0, 0, 0)
