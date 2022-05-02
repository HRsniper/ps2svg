import fs from "node:fs";
import process from "node:process";

const ARGS = process.argv.slice(2);
// console.log("argv", argv);
function cli(argv = ARGS) {
  if (argv.length < 1 || argv.length > 2) {
    console.log(`Usage:
    ps2svg myps        => myps.svg
    ps2svg myps newsvg => newsvg.svg
  `);

    process.exit(1);
  }

  const inputRegex = /\w+/;
  const inputNameProcess = argv[0].match(inputRegex)?.toString().trim() as string;
  const outputNameProcess = argv[1]?.match(inputRegex)?.toString().trim();
  let inputName = "";
  let outputName: string | undefined = "";

  if (argv.length === 1) {
    inputName = inputNameProcess;
    outputName = "";
  }

  if (argv.length === 2) {
    inputName = inputNameProcess;
    outputName = outputNameProcess;
  }

  if (outputName === "") {
    outputName = inputName;
  } else {
    outputName;
  }

  return { inputName, outputName };
}

const { inputName, outputName } = cli();

const file = fs.readFileSync(`${inputName}.ps`, "utf-8");

/* OK */
function getBoundingBox(file: string) {
  const boundingBoxRegex = /%%BoundingBox: [0-9]+ [0-9]+ [0-9]+ [0-9]+/gm;
  const boundingBoxMatches = file.match(boundingBoxRegex) as string[]; // [ '%%BoundingBox: 0 0 563 314' ]
  // console.log("boundingBoxMatches", boundingBoxMatches);
  const boundingBoxFull = boundingBoxMatches[0].replace("%%BoundingBox: ", "").trim(); // "0 0 563 314"
  const boundingBoxWidth = boundingBoxFull.split(" ")[2].trim(); // "563"
  const boundingBoxHeight = boundingBoxFull.split(" ")[3].trim(); // "314"
  return { boundingBoxWidth, boundingBoxHeight, boundingBoxFull };
}
const { boundingBoxFull, boundingBoxHeight, boundingBoxWidth } = getBoundingBox(file);

/* OK */
function getFontSize(file: string) {
  const findFontRegex = /findfont [0-9]+/gm;
  const findFontMatches = file.match(findFontRegex) as string[]; // [ "findfont 11" ]
  // console.log("findFontMatches", findFontMatches);
  const fontSize = findFontMatches[0].replace("findfont ", "").trim(); // "11"
  return { fontSize };
}
const { fontSize } = getFontSize(file);

/* OK */
function getMoveTo(file: string) {
  const moveToRegex = /([0-9]+\.[0-9]+ [0-9]+\.[0-9]+ moveto)/gm;
  const moveToMatches = file.match(moveToRegex) as string[]; // ["162.092 297.792 moveto"]
  // console.log("moveToMatches", moveToMatches);
  const moveToCoordinates: string[][] = [];
  for (const moveTo of moveToMatches) {
    const moveToCoordinate = moveTo.replace(" moveto", "").split(" "); // ["162.092", "297.792"]
    moveToCoordinates.push(moveToCoordinate); // [["162.092", "297.792"]]
  }
  console.log(moveToCoordinates);

  return { moveToMatches, moveToCoordinates };
  // const move = lineCoordinates[i][0].replace("moveto", "").trim().split(" ");
}
const { moveToMatches, moveToCoordinates } = getMoveTo(file);

function getLineTo(file: string) {
  const lineToRegex = /([0-9]+\.[0-9]+ [0-9]+\.[0-9]+ lineto)/gm;
  const lineToMatches = file.match(lineToRegex) as string[];
  // console.log("lineToMatches", lineToMatches);
  const lineToCoordinates: string[][] = [];
  for (const lineTo of lineToMatches) {
    const lineToCoordinate = lineTo.replace(" lineto", "").split(" ");
    lineToCoordinates.push(lineToCoordinate);
  }
  console.log(lineToMatches);

  return { lineToMatches };
}
const { lineToMatches } = getLineTo(file);

/* OK */
function getIdentifierTexts(file: string) {
  const showRegex = /\([\u0020-\u007f]+\) show/gm;
  const showMatches = file.match(showRegex) as string[]; // ["(a) show"]
  // console.log("showMatches", showMatches);
  const identifierTexts: string[] = [];
  for (const show of showMatches) {
    const texts = show.replace("(", "").replace(")", "").replace(" show", ""); // "a"
    const textRemovedEscapes = texts.replace("\\", "").trim();
    identifierTexts.push(textRemovedEscapes); // ["a"]
  }
  return { identifierTexts };
}
const { identifierTexts } = getIdentifierTexts(file);

function getIdentifierCoordinates(file: string) {
  // for (let i = 0; i < moveToMatches.length; i++) {
  //   if (lineCoordinates[i][1] === undefined) {
  //     const txt = lineCoordinates[i][0].replace("moveto", "").trim().split(" ");
  //     identifierCoordinates.push([txt[0], txt[1]]);
  //   }
  // }
}

fs.readFile(`test.ps`, "utf8", (err, data) => {
  // if (err) throw err;

  // const showRegex = /\([\x{0020}-\x{007f}]+\) show/gm;

  const lineCoordinates = [];

  const identifierCoordinates = [];

  const tagPath = [];

  for (let i = 0; i < moveToMatches.length; i++) {
    lineCoordinates.push([moveToMatches[i], lineToMatches[i]]);
  }

  for (let i = 0; i < moveToMatches.length; i++) {
    if (lineCoordinates[i][1] === undefined) {
      const txt = lineCoordinates[i][0].replace("moveto", "").trim().split(" ");
      identifierCoordinates.push([txt[0], txt[1]]);
    }
  }

  // const tagText = [];
  // for (let i = 0; i < showMatches.length; i++) {
  //   tagText.push(
  //     `<text fill="#000000" font-size="${fontSize}" x="${identifierCoordinates[i][0]}" y="-${identifierCoordinates[i][1]}">${identifierTexts[i]}</text>`
  //   );
  // }

  for (let i = 0; i < moveToMatches.length; i++) {
    if (lineCoordinates[i][1] !== undefined) {
      const move = lineCoordinates[i][0].replace("moveto", "").trim().split(" ");
      const line = lineCoordinates[i][1].replace("lineto", "").trim().split(" ");
      tagPath.push(`<path stroke="#000000" d="M${move[0]},-${move[1]} L${line[0]},-${line[1]}"/>`);
    }
  }

  const SVG = `<svg width="${boundingBoxWidth}" height="${boundingBoxHeight}" viewBox="${boundingBoxFull}" fill="none" xmlns="http://www.w3.org/2000/svg">
<style>
@import url('https://fonts.googleapis.com/css2?family=Roboto');
</style>
<rect id="bg" width="${boundingBoxWidth}" height="${boundingBoxHeight}" fill="#ffffff"/>
<g id="tree" transform="translate(0 ${boundingBoxHeight})" font-family="Roboto">
${tagPath.join("\n")}
$ {tagText.join("\n")}
</g>
</svg>
`;

  fs.writeFile(`test.svg`, SVG, (err) => {
    if (err) throw err;
    console.log("💱 The file has been converted! 💱");
  });
});
