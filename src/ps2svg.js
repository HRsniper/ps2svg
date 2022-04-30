import fs from "node:fs";
import process from "node:process";

if (process.argv.length < 3 || process.argv.length > 4) {
  console.log(`Usage:
  ps2svg myps        => myps.svg
  ps2svg myps newsvg => newsvg.svg
`);
  process.exit(1);
}

const inputNameProcess = /\w+/gm.exec(process.argv[2]).toString();
const outputNameProcess = /\w+/gm.exec(process.argv[3]).toString();
let inputName;
let outputName;

if (process.argv.length === 3) {
  inputName = inputNameProcess;
  outputName = "";
}

if (process.argv.length === 4) {
  inputName = inputNameProcess;
  outputName = outputNameProcess;
}

fs.readFile(`${inputName}.ps`, "utf8", (err, data) => {
  if (err) throw err;

  const findFontRegex = /findfont [0-9]+/gm;
  const moveToRegex = /([0-9]+\.[0-9]+ [0-9]+\.[0-9]+ moveto)/gm;
  const lineToRegex = /([0-9]+\.[0-9]+ [0-9]+\.[0-9]+ lineto)/gm;
  // const showRegex = /\([\x{0020}-\x{007f}]+\) show/gm;
  const showRegex = /\([\u0020-\u007f]+\) show/gm;
  const boundingBoxRegex = /%%BoundingBox: [0-9]+ [0-9]+ [0-9]+ [0-9]+/gm;

  const findFontMatches = data.match(findFontRegex);
  const moveToMatches = data.match(moveToRegex);
  const lineToMatches = data.match(lineToRegex);
  const showMatches = data.match(showRegex);
  const boundingBoxMatches = data.match(boundingBoxRegex);

  const fontsize = findFontMatches[0].split(" ")[1].trim();
  const boundingBoxFull = boundingBoxMatches[0].replace("%%BoundingBox: ", "").trim();
  const boundingBoxWidth = boundingBoxFull.split(" ")[2].trim();
  const boundingBoxHeight = boundingBoxFull.split(" ")[3].trim();

  const lineCoordinates = [];
  const identifierTexts = [];
  const identifierCoordinates = [];
  const tagText = [];
  const tagPath = [];

  for (let i = 0; i < moveToMatches.length; i++) {
    lineCoordinates.push([moveToMatches[i], lineToMatches[i]]);
  }

  for (let j = 0; j < showMatches.length; j++) {
    const txt = showMatches[j].replace("(", "").replace(") show", "").trim();
    const textRemovedEscapes = txt.replace("\\", "").trim();
    identifierTexts.push(textRemovedEscapes);
  }

  for (let i = 0; i < moveToMatches.length; i++) {
    if (lineCoordinates[i][1] === undefined) {
      const txt = lineCoordinates[i][0].replace("moveto", "").trim().split(" ");
      identifierCoordinates.push([txt[0], txt[1]]);
    }
  }

  for (let i = 0; i < showMatches.length; i++) {
    tagText.push(
      `<text fill="#000000" font-size="${fontsize}" x="${identifierCoordinates[i][0]}" y="-${identifierCoordinates[i][1]}">${identifierTexts[i]}</text>`
    );
  }

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
<g id="tree" transform="translate(0 ${boundingBoxHeight})" font-family="Roboto">
${tagPath.join("\n")}
${tagText.join("\n")}
</g>
</svg>
`;

  fs.writeFile(`${outputName === "" ? inputName : outputName}.svg`, SVG, (err) => {
    if (err) throw err;
    console.log("💱 The file has been converted! 💱");
  });
});
