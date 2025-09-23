type RYBColor = [number, number, number];
type RGBColor = [number, number, number];

const COLOR_CONSTANTS = {
  RGB_MAX: 255,
  RGB_MIN: 0,
  RYB_MAX: 1.0,
  RYB_MIN: 0.0
};

// Vértices do cubo RYB → RGB
const RYB_CUBE: RGBColor[] = [
  [0, 0, 0], // (0,0,0)
  [255, 0, 0], // (1,0,0) vermelho
  [255, 255, 0], // (0,1,0) amarelo
  [0, 0, 255], // (0,0,1) azul
  [255, 128, 0], // (1,1,0) laranja
  [128, 0, 128], // (1,0,1) violeta
  [0, 255, 0], // (0,1,1) verde
  [255, 255, 255] // (1,1,1) branco
];

// Normaliza um valor para estar dentro do range especificado
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
// Função de interpolação linear
function lerp(a: number, b: number, t: number): number {
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
    const c00 = lerp(c000[i], c100[i], x);
    const c01 = lerp(c001[i], c101[i], x);
    const c10 = lerp(c010[i], c110[i], x);
    const c11 = lerp(c011[i], c111[i], x);

    const c0 = lerp(c00, c10, y);
    const c1 = lerp(c01, c11, y);

    out[i] = Math.round(lerp(c0, c1, z));
  }

  return out;
}

// Conversão RYB → RGB com interpolação trilinear
function ryb2rgb([r, y, b]: RYBColor): RGBColor {
  const r_norm = clamp(r, COLOR_CONSTANTS.RYB_MIN, COLOR_CONSTANTS.RYB_MAX);
  const y_norm = clamp(y, COLOR_CONSTANTS.RYB_MIN, COLOR_CONSTANTS.RYB_MAX);
  const b_norm = clamp(b, COLOR_CONSTANTS.RYB_MIN, COLOR_CONSTANTS.RYB_MAX);
  // console.log(`ryb(${r_norm}, ${y_norm}, ${b_norm})`);

  const rgb = trilinearInterpolate(RYB_CUBE, r_norm, y_norm, b_norm);
  console.log(`rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`);
  return rgb;
}

ryb2rgb([0.95, 0.83, 0.82]); // rgb(242, 210, 209)
ryb2rgb([0.95, 0.82, 0.83]); // rgb(242, 210, 212)
ryb2rgb([1.0, 0.9, 0.8]); // rgb(255, 217, 204)
ryb2rgb([1.1, 0.9, 0.8]); // rgb(255, 217, 204)
ryb2rgb([1.0, 1.0, 1.0]); // rgb(255, 255, 255)
ryb2rgb([1.0, 0, 0]); // rgb(255, 0, 0)
ryb2rgb([0, 1.0, 0]); // rgb(0, 128, 0)
ryb2rgb([0, 0, 1.0]); // rgb(0, 128, 255)
ryb2rgb([1.0, 1.0, 0]); // rgb(255, 128, 0)
ryb2rgb([1.0, 0, 1.0]); // rgb(255, 128, 255)
ryb2rgb([0, 1.0, 1.0]); // rgb(0, 255, 255);

// rgb(227, 194, 184)
// rgb(226, 192, 185)
// rgb(245, 207, 194)
// rgb(245, 207, 194)
// rgb(255, 255, 255)
// rgb(255, 0, 0)
// rgb(255, 255, 0)
// rgb(0, 0, 255)
// rgb(255, 128, 0)
// rgb(128, 0, 128)
// rgb(0, 255, 0)
