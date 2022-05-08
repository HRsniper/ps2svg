export function ryb2rgb([R, Y, B]) {
  const REGEX = /(\d+\.\d+)|(\.\d+)|(\d+)/gm;
  const WHITE_RGB = 255;
  const WHITE_RYB = 1.0;
  const R_ryb = Number(R.toString().match(REGEX));
  const Y_ryb = Number(Y.toString().match(REGEX));
  const B_ryb = Number(B.toString().match(REGEX));
  let R_rgb;
  let G_rgb;
  let B_rgb;
  if (R_ryb > WHITE_RYB) {
    R_rgb = WHITE_RGB;
    G_rgb = Math.floor(B_ryb + Y_ryb * WHITE_RGB);
    B_rgb = Math.floor(Y_ryb + B_ryb * WHITE_RGB);
    // console.log("IF r", R_rgb, G_rgb, B_rgb);
    return [R_rgb, G_rgb, B_rgb];
  }
  if (Y_ryb > WHITE_RYB) {
    R_rgb = Math.floor(R_ryb * WHITE_RGB);
    G_rgb = WHITE_RGB;
    B_rgb = Math.floor(Y_ryb + B_ryb * WHITE_RGB);
    // console.log("IF g", R_rgb, G_rgb, B_rgb);
    return [R_rgb, G_rgb, B_rgb];
  }
  if (B_ryb > WHITE_RYB) {
    R_rgb = Math.floor(R_ryb * WHITE_RGB);
    G_rgb = Math.floor(B_ryb + Y_ryb * WHITE_RGB);
    B_rgb = WHITE_RGB;
    // console.log("IF b", R_rgb, G_rgb, B_rgb);
    return [R_rgb, G_rgb, B_rgb];
  }
  R_rgb = Math.floor(R_ryb * WHITE_RGB);
  G_rgb = Math.floor(B_ryb + Y_ryb * WHITE_RGB);
  B_rgb = Math.floor(Y_ryb + B_ryb * WHITE_RGB);
  // console.log("rgb", R_rgb, G_rgb, B_rgb);
  return [R_rgb, G_rgb, B_rgb];
}
// ryb2rgb([0.95, 0.83, 0.82]); // #f2d4d1 / rgb(242, 212, 209)
// ryb2rgb([0.95, 0.82, 0.83]); // #f2d1d4 / rgb(242, 209, 212)
// ryb2rgb([1.0, 0.9, 0.8]); // #ffe6cc / rgb(255, 230, 204)
// ryb2rgb([1.1, 0.9, 0.8]); // #ffe6cc / rgb(255, 230, 204)
