export function ryb2rgb([R, Y, B]: number[]): [number, number, number] {
  // Expressão regular para capturar números decimais: 0.8, .5, 1.0, 1
  const REGEX = /\d*\.?\d+/g;
  const WHITE_RGB = 255;
  const WHITE_RYB = 1.0;
  // Converte os valores RYB de entrada para números válidos, garantindo que, mesmo se vierem como string, serão tratados.
  const R_ryb = Number(R.toString().match(REGEX));
  const Y_ryb = Number(Y.toString().match(REGEX));
  const B_ryb = Number(B.toString().match(REGEX));
  // console.log("ryb:", `ryb(${R_ryb}, ${Y_ryb}, ${B_ryb})`);

  let R_rgb: number;
  let G_rgb: number;
  let B_rgb: number;

  R_rgb = Math.floor(R_ryb * WHITE_RGB);
  G_rgb = Math.floor(B_ryb + Y_ryb * WHITE_RGB);
  B_rgb = Math.floor(B_ryb * WHITE_RGB);

  if (R_ryb > WHITE_RYB || R_rgb > WHITE_RGB) {
    R_rgb = WHITE_RGB;
    // console.log("IF_R:", `rgb(${R_rgb}, ${G_rgb}, ${B_rgb})`);
  }
  if (Y_ryb > WHITE_RYB || G_rgb > WHITE_RGB) {
    G_rgb = WHITE_RGB;
    // console.log("IF_G:", `rgb(${R_rgb}, ${G_rgb}, ${B_rgb})`);
  }
  if (B_ryb > WHITE_RYB || B_rgb > WHITE_RGB) {
    B_rgb = WHITE_RGB;
    // console.log("IF_B:", `rgb(${R_rgb}, ${G_rgb}, ${B_rgb})`);
  }
  console.log(`rgb(${R_rgb}, ${G_rgb}, ${B_rgb})`);
  return [R_rgb, G_rgb, B_rgb];
}

ryb2rgb([0.95, 0.83, 0.82]); // rgb: rgb(242, 212, 209)
ryb2rgb([0.95, 0.82, 0.83]); // rgb: rgb(242, 209, 211)
ryb2rgb([1.0, 0.9, 0.8]); // rgb: rgb(255, 230, 204)
ryb2rgb([1.1, 0.9, 0.8]); // IF_R: rgb(255, 230, 204)
ryb2rgb([1.0, 1.0, 1.0]); // rgb: rgb(255, 256, 255)
ryb2rgb([1.0, 0, 0]); // rgb: rgb(255, 0, 0)
ryb2rgb([0, 1.0, 0]); // rgb: rgb(0, 255, 0)
ryb2rgb([0, 0, 1.0]); // rgb: rgb(0, 1, 255)
ryb2rgb([1.0, 1.0, 0]); // laranja? // rgb: rgb(255, 255, 0)
ryb2rgb([1.0, 0, 1.0]); // roxo? // rgb: rgb(255, 1, 255)
ryb2rgb([0, 1.0, 1.0]); // verde? // rgb: rgb(0, 256, 255)
