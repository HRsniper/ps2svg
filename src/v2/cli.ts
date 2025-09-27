import * as child_process from "node:child_process";
import * as path from "node:path";
import * as process from "node:process";
import * as fs from "node:fs";

interface CliResult {
  fileInputName: string;
  fileOutputName: string;
}

function printUsageAndExit() {
  console.log(`
  - <> indicates a required argument. The ".ps" extension is optional.
  - [] indicates an optional argument. The ".svg" extension is optional.
Usage:
  ps2svg [options] <input.ps> [output.svg]

Examples:
  ps2svg findAll (Accepts any variation of findAll, findall, FINDALL, FindAll, FiNdAlL)
      → Lists all .ps files found recursively

  ps2svg path/to/my_ps.ps
      → Generates "path/to/my_ps.svg"

  ps2svg my_ps
      → Generates "my_ps.svg"

  ps2svg my_ps.ps new_svg.svg
      → Generates "new_svg.svg"
`);
  process.exit(1);
}

function normalizeInput(input: string): string {
  const inputWithoutExt = input.replace(/\.ps$/i, "");
  // console.log("withoutExt", inputWithoutExt);
  const inputFilePathAbsolute = path.resolve(inputWithoutExt);
  // console.log("inputFilePathAbsolute", inputFilePathAbsolute);
  return inputFilePathAbsolute;
}

function normalizeOutput(input: string, output?: string): string {
  const inputName = path.basename(input);
  // console.log("inputName", inputName);
  if (!output) output = inputName;

  const outputWithoutExt = output.replace(/\.svg$/i, "");
  // console.log("withoutExt", outputWithoutExt);
  const inputDirectory = path.dirname(input);
  // console.log("inputDirectory", inputDirectory);
  const outputFilePathRelative = path.join(inputDirectory, outputWithoutExt);
  // console.log("outputFilePathRelative", outputFilePathRelative);
  const outputFilePathAbsolute = path.resolve(outputFilePathRelative);
  // console.log("outputFilePathAbsolute", outputFilePathAbsolute);
  return outputFilePathAbsolute;
}

function findAllPostscriptFiles(): string[] {
  if (process.platform === "win32") {
    const shellResultWin = child_process.spawnSync("powershell.exe", [
      "-NoProfile",
      "-Command",
      "Get-ChildItem -Recurse -Filter *.ps | Select-Object -ExpandProperty FullName"
    ]);
    const filePathsWin = shellResultWin.stdout.toString().trim().split(/\r?\n/).filter(Boolean);
    return filePathsWin;
  } else {
    const shellResultUnix = child_process.spawnSync("find", [".", "-name", "*.ps"]);
    const filePathsUnix = shellResultUnix.stdout.toString().trim().split("\n").filter(Boolean);
    return filePathsUnix;
  }
}

function cli(argv: string[]): CliResult {
  if (argv.length < 1 || argv.length > 2) {
    printUsageAndExit();
  }

  if (argv.length === 1 && argv[0].toLowerCase() === "findall") {
    console.log(findAllPostscriptFiles());
    process.exit(0);
  }

  const input = normalizeInput(argv[0]);

  if (!fs.existsSync(`${input}.ps`)) {
    console.error(`File not found: ${input}.ps`);
    process.exit(1);
  }

  const output = normalizeOutput(input, argv[1]);

  return { fileInputName: input, fileOutputName: output };
}

const argv = process.argv.slice(2);
// console.log("argv", argv);

const { fileInputName, fileOutputName } = cli(argv);

export { cli, fileInputName, fileOutputName };
