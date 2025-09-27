import { readFileSync } from "fs";
import { extname } from "path";

export function convertImageToBase64(filePath) {
  try {
    // Validar extensão
    const ext = extname(filePath).toLowerCase();
    const validExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp"];

    if (!validExtensions.includes(ext)) {
      throw new Error("Formato de imagem não suportado");
    }

    // Ler arquivo
    const imageBuffer = readFileSync(filePath);

    // Validar se é realmente uma imagem (magic numbers)
    if (!isValidImageBuffer(imageBuffer)) {
      throw new Error("Arquivo não é uma imagem válida");
    }

    const base64 = imageBuffer.toString("base64");
    const mimeType = getMimeType(ext);

    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    throw new Error(`Erro ao converter imagem: ${error.message}`);
  }
}

function isValidImageBuffer(buffer) {
  // Verificar magic numbers para diferentes formatos
  const signatures = {
    jpg: [0xff, 0xd8, 0xff],
    png: [0x89, 0x50, 0x4e, 0x47],
    gif: [0x47, 0x49, 0x46, 0x38],
    webp: [0x52, 0x49, 0x46, 0x46]
  };

  return Object.values(signatures).some((signature) => signature.every((byte, index) => buffer[index] === byte));
}

function getMimeType(ext) {
  const mimeTypes = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp"
  };
  return mimeTypes[ext] || "image/jpeg";
}

const imgBase64 = convertImageToBase64(process.argv[2]);
console.log(imgBase64);
