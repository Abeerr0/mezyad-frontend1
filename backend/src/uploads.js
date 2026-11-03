import multer from "multer";
import sharp from "sharp";
import {
  randomUUID,
  randomBytes,
  createHmac,
  timingSafeEqual,
} from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

export const uploadDirectory = resolve(process.env.UPLOAD_DIR || fileURLToPath(new URL("../uploads/",import.meta.url)));
const signingKey = randomBytes(32);
const imagePath = /^\/uploads\/([a-f0-9-]{36}\.jpg)$/;
const types = {
  "image/jpeg": /\.jpe?g$/i,
  "image/png": /\.png$/i,
  "image/webp": /\.webp$/i,
};
const invalidImage = () =>
  Object.assign(new Error("Use a valid JPG, PNG or WebP image"), {
    status: 400,
    apiCode: "INVALID_IMAGE",
  });

// نحدد عدد الصور وحجمها قبل ما نعالجها.
export const uploadImages = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 6,
    fields: 10,
    fieldSize: 50000,
    parts: 16,
  },
  fileFilter(_req, file, callback) {
    callback(
      types[file.mimetype]?.test(file.originalname) ? null : invalidImage(),
      true,
    );
  },
}).array("images", 6);

export async function saveImages(files = []) {
  const saved = [];
  try {
    await mkdir(uploadDirectory, { recursive: true });
    for (const file of files) {
      if (!file.buffer || file.buffer.length === 0) {
  throw invalidImage();
}
      const image = sharp(file.buffer, {
        limitInputPixels: 20000000,
        animated: false,
      });
      let buffer;
      try {
        const metadata = await image.metadata();
        const expected = {
          "image/jpeg": "jpeg",
          "image/png": "png",
          "image/webp": "webp",
        }[file.mimetype];
        if (metadata.format !== expected || (metadata.pages || 1) > 1)
          throw invalidImage();
        // نعيد حفظها باسم عشوائي ونشيل بيانات التصوير من الملف.
        buffer = await image
          .rotate()
          .resize({
            width: 2400,
            height: 2400,
            fit: "inside",
            withoutEnlargement: true,
          })
          .jpeg({ quality: 85 })
          .toBuffer();
      } catch {
        throw invalidImage();
      }
      const path = "/uploads/" + randomUUID() + ".jpg";
      await writeFile(join(uploadDirectory, path.split("/").at(-1)), buffer, {
        flag: "wx",
      });
      saved.push(path);
    }
    return saved;
  } catch (error) {
    await removeImages(saved);
    throw error;
  }
}

export async function removeImages(paths) {
  for (const path of paths) {
    const match = imagePath.exec(path);
    if (match)
      await unlink(join(uploadDirectory, match[1])).catch((error) => {
        if (error.code !== "ENOENT")
          console.error("Image cleanup failed", error.code);
      });
  }
}

const signature = (path, expires) =>
  createHmac("sha256", signingKey)
    .update(path + ":" + expires)
    .digest("hex");
export function imageLink(path) {
  if (!imagePath.test(path)) return path;
  // نرجع رابط مؤقت للصورة بعد التحقق من صلاحية عرض الإعلان.
  const expires = String(Math.floor(Date.now() / 1000) + 600);
  return (
    "/api/v1/images/" +
    path.split("/").at(-1) +
    "?expires=" +
    expires +
    "&signature=" +
    signature(path, expires)
  );
}

export function serveImage(req, res) {
  const path = "/uploads/" + req.params.filename;
  const { expires, signature: supplied } = req.query;
  if (
    !imagePath.test(path) ||
    typeof expires !== "string" ||
    !/^\d{10}$/.test(expires) ||
    Number(expires) < Date.now() / 1000 ||
    Number(expires) > Date.now() / 1000 + 601 ||
    typeof supplied !== "string" ||
    !/^[a-f0-9]{64}$/.test(supplied) ||
    !timingSafeEqual(
      Buffer.from(signature(path, expires), "hex"),
      Buffer.from(supplied, "hex"),
    )
  ) {
    return res
      .status(404)
      .json({ error: { code: "NOT_FOUND", message: "Image not found" } });
  }
  res.set({
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.sendFile(join(uploadDirectory, req.params.filename), (error) => {
    if (error && !res.headersSent)
      res
        .status(404)
        .json({ error: { code: "NOT_FOUND", message: "Image not found" } });
  });
}

