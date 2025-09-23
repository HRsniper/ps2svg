/** Cor RYB: [Red, Yellow, Blue] em range [0-1] */
export type RYBColor = [red: number, yellow: number, blue: number];

/** Cor RGB: [Red, Green, Blue] em range [0-255] */
export type RGBColor = [red: number, green: number, blue: number];

const COLOR_CONSTANTS = {
  RGB_MAX: 255,
  RGB_MIN: 0,
  RYB_MAX: 1.0,
  RYB_MIN: 0.0
};

/**
 * Normaliza um valor para estar dentro do range especificado
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Converte RYB para RGB baseado no sistema tradicional de cores artísticas
 */
function ryb2rgb([r, y, b]: RYBColor): RGBColor {
  const r_normalized = clamp(r, COLOR_CONSTANTS.RYB_MIN, COLOR_CONSTANTS.RYB_MAX);
  const y_normalized = clamp(y, COLOR_CONSTANTS.RYB_MIN, COLOR_CONSTANTS.RYB_MAX);
  const b_normalized = clamp(b, COLOR_CONSTANTS.RYB_MIN, COLOR_CONSTANTS.RYB_MAX);

  // Conversão RYB para RGB com melhoria na mistura de cores
  // Esta implementação considera as características subtrativas do RYB
  const R = Math.round(r_normalized * COLOR_CONSTANTS.RGB_MAX);
  const G = Math.round(((y_normalized + b_normalized) / 2) * COLOR_CONSTANTS.RGB_MAX);
  const B = Math.round(b_normalized * COLOR_CONSTANTS.RGB_MAX);

  const R_normalized = clamp(R, COLOR_CONSTANTS.RGB_MIN, COLOR_CONSTANTS.RGB_MAX);
  const G_normalized = clamp(G, COLOR_CONSTANTS.RGB_MIN, COLOR_CONSTANTS.RGB_MAX);
  const B_normalized = clamp(B, COLOR_CONSTANTS.RGB_MIN, COLOR_CONSTANTS.RGB_MAX);

  console.log(`rgb(${R_normalized}, ${G_normalized}, ${B_normalized})`);
  return [R_normalized, G_normalized, B_normalized];
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
