const sharp = require("sharp");
const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");
const crypto = require("crypto");

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY,
    secretAccessKey: process.env.R2_SECRET_KEY,
  },
});
async function uploadToR2(file, folder = "misc") {
  const avifBuffer = await sharp(file.buffer)
    .avif({
      quality: 55,
      effort: 4,
    })
    .toBuffer();
  const ext = file.originalname.split(".").pop();
  const key = `${folder}/${crypto.randomUUID()}.avif`;

  await r2.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      Body: avifBuffer,
      ContentType: file.mimetype,
    })
  );

  return key;
}
async function deleteFromR2(key) {
  if (!key) return;

  await r2.send(
    new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
    })
  );
}

function extractR2KeyFromUrl(url) {
  if (!url) return null;

  const baseUrl = process.env.R2_PUBLIC_URL;
  return url.replace(`${baseUrl}/`, "");
}

module.exports = { uploadToR2, deleteFromR2, extractR2KeyFromUrl };
