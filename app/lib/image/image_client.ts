import OpenAI, { toFile } from "openai";
import { randomUUID } from "crypto";

function getClient() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function getR2Config() {
  return {
    accountId: process.env.CLOUDFLARE_R2_ACCOUNT_ID,
    accessKey: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    secretKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
    publicUrl: process.env.CLOUDFLARE_R2_PUBLIC_URL,
  };
}

async function uploadGeneratedImage(b64Json: string): Promise<string> {
  const { accountId, accessKey, secretKey, bucket, publicUrl } = getR2Config();
  const cleanBase64 = b64Json.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(cleanBase64, "base64");

  if (!accountId || !accessKey || !secretKey || !bucket || !publicUrl) {
    return `data:image/png;base64,${cleanBase64}`;
  }

  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
  const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
  });

  const month = new Date().toISOString().slice(0, 7);
  const key = `images/${month}/${randomUUID()}.png`;
  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: "image/png",
  }));

  return `${publicUrl.replace(/\/$/, "")}/${key}`;
}

export async function generateImage(prompt: string): Promise<string> {
  const res = await getClient().images.generate({
    model: "gpt-image-1",
    prompt,
    size: "1024x1024",
  });

  const item = res.data?.[0];
  if (item?.url) {
    return item.url;
  }
  if (item?.b64_json) {
    return uploadGeneratedImage(item.b64_json);
  }

  throw new Error("image_generation_failed");
}

export async function editImage(_params: {
  imageUrl: string;
  instruction: string;
}): Promise<string> {
  const source = await fetch(_params.imageUrl);
  if (!source.ok) {
    throw new Error("image_fetch_failed");
  }

  const contentType = source.headers.get("content-type") || "image/png";
  const ext = contentType.includes("jpeg") || contentType.includes("jpg")
    ? "jpg"
    : contentType.includes("webp")
      ? "webp"
      : "png";
  const image = await toFile(Buffer.from(await source.arrayBuffer()), `source.${ext}`, {
    type: contentType,
  });

  const res = await getClient().images.edit({
    model: "gpt-image-1",
    image,
    prompt: _params.instruction,
    size: "1024x1024",
  });

  const item = res.data?.[0];
  if (item?.url) {
    return item.url;
  }
  if (item?.b64_json) {
    return uploadGeneratedImage(item.b64_json);
  }

  throw new Error("image_edit_failed");
}
