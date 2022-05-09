export declare function cli(argv: string[]): {
  inputName: string;
  outputName: string | undefined;
};
export declare function getBoundingBox(file: string): {
  boundingBoxWidth: string;
  boundingBoxHeight: string;
  boundingBoxFull: string;
};
export declare function getHighlightDef(file: string): {
  highlight: string;
  highlightFull: string[];
};
export declare function getHighlightColor(
  highlight: string,
  file: string
): {
  rgb: number[];
};
export declare function getHighlightCoordinates(
  file: string,
  highlight: string,
  highlightFull: string[]
): {
  highlightCoordinatesFull: string[];
};
export declare function getFontSize(file: string): {
  fontSize: string;
};
export declare function getMoveTo(file: string): {
  moveToCoordinates: string[][];
};
export declare function getLineTo(file: string): {
  lineToCoordinates: string[][];
};
export declare function getIdentifierTexts(file: string): {
  identifierTexts: string[];
};
export declare function getLineCoordinates(
  moveToCoordinates: string[][],
  lineToCoordinates: string[][]
): {
  lineCoordinates: string[][][];
};
export declare function getIdentifierCoordinates(lineCoordinates: string[][][]): {
  identifierCoordinates: string[][];
};
export declare function getTagText(
  identifierCoordinates: string[][],
  identifierTexts: string[]
): {
  tagText: string[];
};
export declare function getTagPath(lineCoordinates: string[][][]): {
  tagPath: string[];
};
export declare function getTagHighlight(
  highlightCoordinatesFull: string[],
  RGBColor: number[]
): {
  tagHighlight: string[];
};
export declare function svgBuilder(
  boundingBoxWidth: string,
  boundingBoxHeight: string,
  boundingBoxFull: string,
  tagText: string[],
  tagPath: string[],
  tagHighlight: string[]
): {
  SVG: string;
};
