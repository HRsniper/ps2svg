import * as child_process from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as process from "node:process";
import { ryb2rgb, type RYBColor } from "../color2rgb.js";

const argv = process.argv.slice(2);
// console.log("argv", argv);
export function cli(argv: string[]) {
  if (argv.length < 1 || argv.length > 2) {
    console.log(`Usage: (.ps | .svg)? is optional
    ps2svg find-all                   => ["path/to/my_ps.ps"]
    ps2svg path/to/my_ps(.ps)?        => my_ps.svg
    ps2svg my_ps(.ps)?                => my_ps.svg
    ps2svg my_ps(.ps)? new_svg(.svg)? => new_svg.svg
    `);
    process.exit(1);
  }

  const inputRegex = /[.:\w\d\\/]+(\.ps)?/g;
  const outputRegex = /\w+(\.svg)?$/g;

  const inputMatches = argv[0].match(inputRegex) as string[];
  // console.log("inputMatches", inputMatches);
  const input = inputMatches[0].replace(/\.ps/g, "").trim(); // my_ps

  const outputMatches = argv[1]?.match(outputRegex) as string[];
  // console.log("outputMatches", outputMatches);
  let output: string;
  if (outputMatches === undefined) {
    output = "";
  } else {
    output = outputMatches[0].replace(/\.svg/g, "").trim(); // new_svg
  }

  const folderPsFile = path.dirname(inputMatches[0]);
  let inputName = "";
  let outputName = "";

  if (argv.length === 1 && argv[0].match(/^find-all$/)) {
    if (process.platform === "win32") {
      const getItem = child_process.spawn("Get-ChildItem", ["-Recurse", "-Filter", "*.ps"]);
      const select = child_process.spawn("Select-Object", ["-Property", "FullName"]);
      getItem.stdout.pipe(select.stdin);

      select.stdout.on("data", (data) => {
        const files = data.toString().trim().split("\r\n");
        console.log(files);
      });
    }
    if (process.platform === "linux") {
      const find = child_process.spawnSync("find", ["-name", "*.ps"]).stdout.toString().trim().split("\n");
      console.log(find);
    }

    process.exit(1);
  }

  if (argv.length === 1) {
    inputName = input;
  }
  if (argv.length === 2) {
    inputName = input;
    outputName = path.join(folderPsFile, output);
  }
  if (outputName === "") {
    outputName = inputName;
  }
  // console.log("(1)", inputName);
  // console.log("(2)", outputName);
  return { inputName, outputName };
}
const { inputName, outputName } = cli(argv);

// const file = await fsp.readFile(`${inputName}.ps`, "utf-8");
const file = fs.readFileSync(`${inputName}.ps`, "utf-8");

// OK
export function getBoundingBox(file: string) {
  const boundingBoxRegex = /%%BoundingBox: (\d+\u0020?)+/g;
  const boundingBoxMatches = file.match(boundingBoxRegex) as string[]; // [ '%%BoundingBox: 0 0 563 314' ]
  // console.log("boundingBoxMatches", boundingBoxMatches);

  if (boundingBoxMatches === null) {
    return { boundingBoxFull: "0 0 2480 3508", boundingBoxHeight: "3508", boundingBoxWidth: "2480" };
  }

  const boundingBoxFull = boundingBoxMatches[0].replace("%%BoundingBox: ", "").trim(); // "0 0 563 314"
  const boundingBoxWidth = boundingBoxFull.split(" ")[2].trim(); // "563"
  const boundingBoxHeight = boundingBoxFull.split(" ")[3].trim(); // "314"
  return { boundingBoxWidth, boundingBoxHeight, boundingBoxFull };
}
const { boundingBoxFull, boundingBoxHeight, boundingBoxWidth } = getBoundingBox(file);

// OK
export function getHighlightDef(file: string) {
  const highlightRegex = /\/\w+\u0020?{/g; // /highlight {
  const highlightMatches = file.match(highlightRegex) as string[]; // ["/highlight {"]
  // console.log("highlightMatches", highlightMatches);

  if (highlightMatches === null) {
    return { highlight: "" };
  }

  const highlight = highlightMatches[0].replace("/", "").replace(" {", "").trim(); // highlight
  return { highlight };
}
const { highlight } = getHighlightDef(file);

export function getHighlightColor(highlight: string, file: string) {
  const highlightColor: number[] = [];
  if (highlight) {
    const highlightColorRegex = /(\d?\.\d+\u0020){3}setrgbcolor/g;
    const highlightColorMatches = file.match(highlightColorRegex) as string[]; // [".95 .83 .82 setrgbcolor"]
    // console.log("highlightColorMatches", highlightColorMatches);

    if (highlightColorMatches === null) {
      return { rgb: [0, 0, 0] };
    }

    const highlightColorFull = highlightColorMatches[0].replace(" setrgbcolor", "").trim().split(" "); // [".95", ".83", ".82"]
    for (const i of highlightColorFull) {
      highlightColor.push(Number(i)); // [.95, .83, .82]
    }
  }
  const rgb = ryb2rgb(highlightColor as RYBColor).toArray();
  return { rgb };
}
const { rgb } = getHighlightColor(highlight, file);

// OK
export function getHighlightCoordinates(file: string, highlight: string) {
  const highlightCoordinatesRegex = /((\d+\.)?\d+\u0020)+\w+/g;
  const highlightCoordinatesMatches = file.match(highlightCoordinatesRegex) as string[]; // [ "59.784 66.176 76.525 16.088 highlight" ]
  // console.log("highlightCoordinatesMatches", highlightCoordinatesMatches);

  if (highlightCoordinatesMatches === null) {
    return { highlightCoordinatesFull: [""] };
  }

  const highlightCoordinates: string[] = [];
  for (const i of highlightCoordinatesMatches) {
    if (i.includes(highlight)) {
      highlightCoordinates.push(i);
    }
  }
  // console.log(highlightCoordinates);

  if (highlightCoordinates.length === 0) {
    return { highlightCoordinatesFull: [] };
  }
  const highlightCoordinatesFull = highlightCoordinates[0].split(" "); // ["59.784", "66.176", "76.525", "16.088", "highlight"]

  return { highlightCoordinatesFull };
}
const { highlightCoordinatesFull } = getHighlightCoordinates(file, highlight);

// OK
export function getFontSize(file: string) {
  const findFontRegex = /findfont\u0020\d+/g;
  const findFontMatches = file.match(findFontRegex) as string[]; // [ "findfont 11" ]
  // console.log("findFontMatches", findFontMatches);

  if (findFontMatches === null) {
    return { fontSize: "11" };
  }

  const fontSize = findFontMatches[0].replace("findfont ", "").trim(); // "11"
  return { fontSize };
}
const { fontSize } = getFontSize(file);

// OK
export function getMoveTo(file: string) {
  const moveToRegex = /((\d+\.)?\d+\u0020){2}moveto/g;
  const moveToMatches = file.match(moveToRegex) as string[]; // ["162.092 297.792 moveto"]
  // console.log("moveToMatches", moveToMatches);

  if (moveToMatches === null) {
    return { moveToCoordinates: [[""]] };
  }

  const moveToCoordinates: string[][] = [];
  for (const moveTo of moveToMatches) {
    const moveToCoordinate = moveTo.replace(" moveto", "").trim().split(" "); // ["162.092", "297.792"]
    moveToCoordinates.push(moveToCoordinate); // [["162.092", "297.792"]]
  }
  return { moveToCoordinates };
}
const { moveToCoordinates } = getMoveTo(file);

// OK
export function getLineTo(file: string) {
  const lineToRegex = /((\d+\.)?\d+\u0020){2}lineto/g;
  const lineToMatches = file.match(lineToRegex) as string[]; // ["58.850 280.792 lineto"]
  // console.log("lineToMatches", lineToMatches);

  if (lineToMatches === null) {
    return { lineToCoordinates: [[""]] };
  }

  const lineToCoordinates: string[][] = [];
  for (const lineTo of lineToMatches) {
    const lineToCoordinate = lineTo.replace(" lineto", "").trim().split(" "); // ["58.850", "280.792"]
    lineToCoordinates.push(lineToCoordinate); // [["58.850", "280.792"]]
  }
  return { lineToCoordinates };
}
const { lineToCoordinates } = getLineTo(file);

// OK
export function getIdentifierTexts(file: string) {
  const showRegex = /[\u0020-\u007e]+show/g;
  const showMatches = file.match(showRegex) as string[]; // ["(a) show"]
  // console.log("showMatches", showMatches);
  const identifierTexts: string[] = [];

  if (showMatches === null) {
    return { identifierTexts };
  }

  for (const show of showMatches) {
    const texts = show.replace("(", "").replace(")", "").replace(" show", ""); // "a"
    const textRemovedEscapes = texts
      .replace(/^\\/g, "") // \\n => \n
      .replace(/'\\'>\)/g, "')'>")
      .trim();
    const text = textRemovedEscapes.replace(/</g, "&#60;").replace(/>/g, "&#62;").trim();
    // console.log("text", text);
    identifierTexts.push(text); // ["a"]
  }
  return { identifierTexts };
}
const { identifierTexts } = getIdentifierTexts(file);

// OK
export function getLineCoordinates(moveToCoordinates: string[][], lineToCoordinates: string[][]) {
  // console.log("moveToCoordinates", moveToCoordinates[0]);
  // console.log("lineToCoordinates", lineToCoordinates[0]);
  const lineCoordinates: string[][][] = [];
  for (const i in moveToCoordinates) {
    lineCoordinates.push([moveToCoordinates[i], lineToCoordinates[i]]);
  }
  // console.log("lineCoordinates", lineCoordinates);
  return { lineCoordinates };
}
const { lineCoordinates } = getLineCoordinates(moveToCoordinates, lineToCoordinates);

export function getIdentifierCoordinates(lineCoordinates: string[][][]) {
  const identifierCoordinates: string[][] = [];
  // console.log("lineCoordinates", lineCoordinates[0]);
  // console.log("lineCoordinates", lineCoordinates[lineCoordinates.length - 1]);
  for (const i in lineCoordinates) {
    // console.log("m", lineCoordinates[i][0]);
    // console.log("l", lineCoordinates[i][1]);
    if (lineCoordinates[i][1] === undefined) {
      identifierCoordinates.push(lineCoordinates[i][0]);
    }
    // console.log(identifierCoordinates);
  }
  return { identifierCoordinates };
}
const { identifierCoordinates } = getIdentifierCoordinates(lineCoordinates);

// OK
export function getTagText(identifierCoordinates: string[][], identifierTexts: string[]) {
  const tagText: string[] = [];
  for (const i in identifierCoordinates) {
    tagText.push(
      `<text fill="#000000" font-size="${fontSize}" x="${identifierCoordinates[i][0]}" y="-${identifierCoordinates[i][1]}">${identifierTexts[i]}</text>`
    );
  }
  // console.log("tagText", tagText);
  return { tagText };
}
const { tagText } = getTagText(identifierCoordinates, identifierTexts);

// OK
export function getTagPath(lineCoordinates: string[][][]) {
  // console.log("lineCoordinates", lineCoordinates[0]);
  // console.log("lineCoordinates", lineCoordinates[lineCoordinates.length - 1]);
  const tagPath: string[] = [];
  for (const i in lineCoordinates) {
    // console.log("m", lineCoordinates[i][0]);
    // console.log("l", lineCoordinates[i][1]);
    if (lineCoordinates[i][1] !== undefined) {
      const move = lineCoordinates[i][0];
      const line = lineCoordinates[i][1];
      tagPath.push(`<path stroke="#000000" d="M${move[0]},-${move[1]} L${line[0]},-${line[1]}"/>`);
    }
  }
  // console.log("tagPath", tagPath);
  return { tagPath };
}
const { tagPath } = getTagPath(lineCoordinates);

// OK
export function getTagHighlight(highlightCoordinatesFull: string[], RGBColor: number[]) {
  const tagHighlight: string[] = [];
  if (highlightCoordinatesFull.length === 0) {
    return { tagHighlight };
  }
  // 0.95 0.82 0.83 setrgbcolor => #f2d4d1 / rgb(242, 212, 209)
  tagHighlight.push(`<g id="${highlightCoordinatesFull[4]}" transform="translate(0 -${highlightCoordinatesFull[3]})">
<rect x="${highlightCoordinatesFull[0]}" y="-${highlightCoordinatesFull[1]}" width="${highlightCoordinatesFull[2]}" height="${highlightCoordinatesFull[3]}" fill="rgb(${RGBColor[0]}, ${RGBColor[1]}, ${RGBColor[2]})" />
</g>`);
  // console.log("tagHighlight", tagHighlight);
  return { tagHighlight };
}
const { tagHighlight } = getTagHighlight(highlightCoordinatesFull, rgb);

// OK
export function svgBuilder(
  boundingBoxWidth: string,
  boundingBoxHeight: string,
  boundingBoxFull: string,
  tagText: string[],
  tagPath: string[],
  tagHighlight: string[]
) {
  const SVG = `<svg width="${boundingBoxWidth}" height="${boundingBoxHeight}" viewBox="${boundingBoxFull}" fill="none" xmlns="http://www.w3.org/2000/svg">
<style>
@import url('https://fonts.googleapis.com/css2?family=Roboto');
</style>
<rect id="background" width="${boundingBoxWidth}" height="${boundingBoxHeight}" fill="#ffffff"/>
<g id="tree" transform="translate(0 ${boundingBoxHeight})" font-family="Roboto">
${tagHighlight.join("\n")}
${tagPath.join("\n")}
${tagText.join("\n")}
</g>
</svg>
`;
  return { SVG };
}
const { SVG } = svgBuilder(boundingBoxWidth, boundingBoxHeight, boundingBoxFull, tagText, tagPath, tagHighlight);

// ellipse do PostScript em um elemento <circle> ou <ellipse> do SVG
export function convertEllipse(postscript: string): string {
  const regex = /(\d+) (\d+) (\d+) (\d+) ellipse/;
  const match = postscript.match(regex);
  if (match) {
    const x = parseInt(match[1]);
    const y = parseInt(match[2]);
    const rx = parseInt(match[3]) / 2;
    const ry = parseInt(match[4]) / 2;
    return `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" stroke="#000000" />`;
  }
  return "";
}
// const tag_test = convertEllipse(file);

// polygon ou polyline. usar os elementos <polygon> ou <polyline>
export function convertPolyline(postscript: string): string {
  const regex = /(\d+)\s+(\d+)\s+(moveto|lineto)/g;
  const points: string[] = [];

  for (const match of postscript.matchAll(regex)) {
    points.push(`${match[1]},${match[2]}`);
  }

  // Verifica se há "closepath" e adiciona o primeiro ponto novamente
  if (/closepath/.test(postscript) && points.length > 0) {
    points.push(points[0]);
  }

  return `<polyline points="${points.join(" ")}" stroke="black" fill="none" />`;
}
// const tag_test = convertPolyline(file);

// line do PostScript em um elemento <line> do SVG
export function convertLine(postscript: string): string {
  const regex = /(\d+)\s+(\d+)\s+moveto\s+(\d+)\s+(\d+)\s+lineto/;
  const match = regex.exec(postscript);

  if (match) {
    const x1 = match[1];
    const y1 = match[2];
    const x2 = match[3];
    const y2 = match[4];
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#000000" />`;
  }

  return "";
}
// const tag_test = convertLine(file);

// show do PostScript em um elemento <text> do SVG
export function convertText(postscript: string): string {
  const regex = /(\w+)\s+findfont\s+(\d+)\s+scalefont\s+setfont\s+(\d+)\s+(\d+)\s+moveto\s+\(([^)]+)\)\s+show/;
  const match = regex.exec(postscript);

  if (match) {
    const fontFamily = match[1];
    const fontSize = match[2];
    const x = match[3];
    const y = match[4];
    const text = match[5];
    return `<text x="${x}" y="${y}" font-family="${fontFamily}" font-size="${fontSize}" stroke="#000000">${text}</text>`;
  }

  return "";
}
// const tag_test = convertText(file);

// image do PostScript em um elemento <image> do SVG
export function convertImage(postscript: string): string {
  const regex = /(\d+)\s+(\d+)\s+imagematrix\s+\/(\w+)\s+(\d+)\s+(\d+)\s+image/;
  const match = regex.exec(postscript);

  if (match) {
    const x = match[1];
    const y = match[2];
    const href = match[3];
    const width = match[4];
    const height = match[5];
    return `<image x="${x}" y="${y}" width="${width}" height="${height}" xlink:href="${href}" />`;
  }

  return "";
}
// const tag_test = convertImage(file);

// grad podemos usar o elemento <linearGradient> ou <radialGradient>
export function convertGrad(postscript: string): string {
  const regex = /grad\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/;
  const match = regex.exec(postscript);

  if (match) {
    const x1 = match[1];
    const y1 = match[2];
    const x2 = match[3];
    const y2 = match[4];
    return `<defs>
<linearGradient id="grad" x1="${x1}%" y1="${y1}%" x2="${x2}%" y2="${y2}%">
  <stop offset="0" stop-color="#f00" />
  <stop offset="1" stop-color="#0f0" />
</linearGradient>
</defs>

<rect fill="url(#grad)" x="${x1}" y="${y1}" width="${x2}" height="${y2}" />
`;
  }

  return "";
}
// const tag_test = convertGrad(file);

// pattern podemos usar o elemento <pattern>
export function convertPattern(postscript: string): string {
  const regex = /pattern\s+(\d+)\s+(\d+)/;
  const match = regex.exec(postscript);

  if (match) {
    const x = parseInt(match[1], 10);
    const y = parseInt(match[2], 10);

    return `<defs>
<pattern id="pattern" x="${x}" y="${y}" width="100%" height="100%" patternUnits="userSpaceOnUse">
  <rect fill="#f00" x="${x}" y="${y}" width="20" height="20" />
  <rect fill="#0f0" x="${x + 20}" y="${y + 20}" width="20" height="20" />
</pattern>
</defs>

<rect fill="url(#pattern)" x="${x}" y="${y}" width="100" height="100" />
`;
  }

  return "";
}
// const tag_test = convertPattern(file);

// translate, rotate, scale e concat podemos usar o atributo transform
export function convertTransform(postscript: string): string {
  const transforms: string[] = [];

  const regexTranslate = /(\d+)\s+(\d+)\s+translate/;
  const matchTranslate = regexTranslate.exec(postscript);
  if (matchTranslate) {
    const x = matchTranslate[1];
    const y = matchTranslate[2];
    transforms.push(`translate(${x}, ${y})`);
  }

  const regexRotate = /(\d+)\s+rotate/;
  const matchRotate = regexRotate.exec(postscript);
  if (matchRotate) {
    const angle = matchRotate[1];
    transforms.push(`rotate(${angle})`);
  }

  const regexScale = /(\d+)\s+(\d+)\s+scale/;
  const matchScale = regexScale.exec(postscript);
  if (matchScale) {
    const sx = matchScale[1];
    const sy = matchScale[2];
    transforms.push(`scale(${sx}, ${sy})`);
  }

  if (transforms.length > 0) {
    return `transform="${transforms.join(" ")}"`;
  }

  return "";
}
// const tag_test = convertTransform(file);

//  setgray e setcolor podemos usar o atributo opacity
export function convertOpacity(postscript: string): string {
  const regex = /(\d+\.\d+)\s+setgray/;
  const match = regex.exec(postscript);

  if (match) {
    const opacity = match[1];
    return `opacity="${opacity}"`;
  }

  return "";
}
// const tag_test = convertOpacity(file);

// setlinewidth e setlinecap podemos usar os atributos stroke-width e stroke-linecap
export function convertStroke(postscript: string): string {
  const attributes: string[] = [];

  const regexLineWidth = /(\d+)\s+setlinewidth/;
  const matchLineWidth = regexLineWidth.exec(postscript);
  if (matchLineWidth) {
    const width = matchLineWidth[1];
    attributes.push(`stroke-width="${width}"`);
  }

  const regexLineCap = /(butt|round|square)\s+setlinecap/;
  const matchLineCap = regexLineCap.exec(postscript);
  if (matchLineCap) {
    const cap = matchLineCap[1];
    attributes.push(`stroke-linecap="${cap}"`);
  }

  return attributes.join(" ");
}
// const tag_test = convertStroke(file);

export function svgTestBuilder(tag: string) {
  const SVG = `<svg fill="none" xmlns="http://www.w3.org/2000/svg">
${tag}
</svg>
`;
  return { SVG };
}
// const { SVG } = svgTestBuilder(tag_test);

fs.writeFile(`${outputName}.svg`, SVG, "utf-8", (err) => {
  if (err) throw err;
  console.log("💱 The file has been converted! 💱");
});
