import * as child_process from "node:child_process";
import * as path from "node:path";
import * as process from "node:process";
import * as fs from "node:fs";

type CLI_RESULT = {
  fileInputName: string;
  fileOutputName: string;
};

type FILE_PATH = {
  input: string;
  output: string;
};

function printUsageAndExit() {
  console.log(`
  - <> indicates a required argument. The ".ps" extension is optional.
  - [] indicates an optional argument. The ".svg" extension is optional.
  (Accepts any variation of -findAll, -findall, -FINDALL, -FindAll, -FiNdAlL, same for -batch)
Usage:
  ps2svg <input.ps> [output.svg]
  ps2svg -f | -findall [directory]
  ps2svg -b | -batch <folder> [outputFolder]

Examples:
  ps2svg -findAll
      → Lists all .ps files found recursively

  ps2svg path/to/my_ps.ps
      → Generates "path/to/my_ps.svg"

  ps2svg my_ps
      → Generates "my_ps.svg"

  ps2svg my_ps.ps new_svg.svg
      → Generates "new_svg.svg"

  ps2svg --batch docs --out svgs
      → Convert all .ps in ./docs to ./svgs
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

function normalizeOutput(input: string, output?: string, outputFolder?: string): string {
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

function findAllPostscriptFiles(folder?: string): string[] {
  if (process.platform === "win32") {
    const shellResultWin = child_process.spawnSync("powershell.exe", [
      "-NoProfile",
      "-Command",
      `Get-ChildItem -Recurse -Filter *.ps -Path "${folder ? folder : "."}" | Select-Object -ExpandProperty FullName`
    ]);
    const filePathsWin = shellResultWin.stdout.toString().trim().split(/\r?\n/).filter(Boolean);
    return filePathsWin;
  } else {
    const shellResultUnix = child_process.spawnSync("find", [folder ? folder : ".", "-name", "*.ps"]);
    const filePathsUnix = shellResultUnix.stdout.toString().trim().split("\n").filter(Boolean);
    return filePathsUnix;
  }
}

function isFindAllFlag(arg: string): boolean {
  const normalized = arg.toLowerCase();
  // console.log("flag", normalized);
  return normalized === "-f" || normalized === "-findall";
}

function isBatchFlag(arg: string): boolean {
  const normalized = arg.toLowerCase();
  // console.log("flag", normalized);
  return normalized === "-b" || normalized === "-batch";
}

function convertFile(input: string, output?: string): FILE_PATH {
  const inputNorm = normalizeInput(input);

  if (!fs.existsSync(`${inputNorm}.ps`)) {
    console.error(`File not found: ${inputNorm}.ps`);
    process.exit(1);
  }

  const outputNorm = normalizeOutput(inputNorm, output);

  console.log(`Converting ${inputNorm}.ps to ${outputNorm}.svg`);
  return { input: inputNorm, output: outputNorm };
}

function convertBatch(folder: string, outputFolder?: string) {
  const files = findAllPostscriptFiles(folder);
  if (files.length === 0) {
    console.log("No .ps files found.");
    process.exit(1);
  }
  console.log(`Converting ${files.length} .ps files...`);
  files.forEach((file) => convertFile(file));
}

function cli(argv: string[]): CLI_RESULT {
  console.log("argv", argv);

  if (argv.length < 1 || argv.length > 3) {
    printUsageAndExit();
  }

  if (argv.length === 1 && isFindAllFlag(argv[0])) {
    console.log(findAllPostscriptFiles());
    process.exit(0);
  }

  if (argv.length === 2 && isFindAllFlag(argv[0])) {
    console.log(findAllPostscriptFiles(argv[1]));
    process.exit(0);
  }

  if (argv.length === 1 && isBatchFlag(argv[0])) {
    printUsageAndExit();
  }

  if (argv.length === 2 && isBatchFlag(argv[0])) {
    convertBatch(argv[1]);
    process.exit(0);
  }

  if (argv.length === 3 && isBatchFlag(argv[0])) {
    convertBatch(argv[1], argv[2]);
    process.exit(0);
  }

  const { input, output } = convertFile(argv[0], argv[1]);

  return { fileInputName: input, fileOutputName: output };
}

const argv = process.argv.slice(2);
// console.log("argv", argv);

const { fileInputName, fileOutputName } = cli(argv);

export { cli, fileInputName, fileOutputName };
