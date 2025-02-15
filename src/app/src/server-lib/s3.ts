import fs from "fs";
import { AwsClient } from "aws4fetch";
import { metrics } from "./metrics";
import { getEnv } from "./env";
import { log } from "./logging";
import { uploadContentEncoding, uploadContentType, UploadType } from "./models";

export const BUCKET = getEnv("S3_BUCKET");
const defaultHeaders = { service: "s3", region: getEnv("S3_REGION") };

const s3client = new AwsClient({
  accessKeyId: getEnv("S3_ACCESS_KEY"),
  secretAccessKey: getEnv("S3_SECRET_KEY"),
  region: getEnv("S3_REGION"),
});

export async function s3Fetch(...args: Parameters<(typeof s3client)["fetch"]>) {
  return args[0] instanceof Request
    ? s3client.fetch(...args)
    : s3client.fetch(new URL(args[0], getEnv("S3_ENDPOINT")).toString(), {
        ...args[1],
        aws: { ...defaultHeaders, ...args[1]?.aws },
      });
}

export async function s3FetchOk(
  ...args: Parameters<(typeof s3client)["fetch"]>
) {
  const res = await s3Fetch(...args);
  if (!res.ok) {
    throw new Error(await res.text());
  }

  return res;
}

export async function s3Presigned(saveId: string): Promise<string> {
  const url = new URL(`${BUCKET}/${saveId}`, getEnv("S3_ENDPOINT"));
  url.searchParams.set("X-Amz-Expires", "3600");
  const req = await s3client.sign(url.toString(), {
    aws: { ...defaultHeaders, signQuery: true },
  });
  return req.url;
}

const timeHistogram = new metrics.Histogram({
  name: "s3_upload_seconds",
  help: "s3 upload seconds",
});

const sizeHistogram = new metrics.Histogram({
  name: "s3_upload_bytes",
  help: "s3 upload bytes",
  buckets: [
    1.0, 100_000.0, 2_000_000.0, 4_000_000.0, 6_000_000.0, 8_000_000.0,
    10_000_000.0, 12_000_000.0, 14_000_000.0, 16_000_000.0, 18_000_000.0,
    20_000_000.0,
  ],
});

export async function uploadFileToS3(
  filePath: string,
  filename: string,
  upload: UploadType
): Promise<void> {
  const contentEncoding = uploadContentEncoding(upload);
  const contentType = uploadContentType(upload);

  const end = timeHistogram.startTimer();
  const body = await fs.promises.readFile(filePath);

  await s3FetchOk(`${BUCKET}/${filename}`, {
    method: "PUT",
    body,
    headers: {
      "Content-Type": contentType,
      ...(contentEncoding
        ? {
            "Content-Encoding": contentEncoding,
          }
        : {}),
    },
  });

  const elapse = end();
  log.info({
    msg: "uploaded a new file to s3",
    key: filename,
    bytes: body.length,
    elapsedMs: (elapse * 1000).toFixed(2),
  });
  sizeHistogram.observe(body.length);
}

export async function deleteFile(saveId: string): Promise<void> {
  await s3FetchOk(`${BUCKET}/${saveId}`, {
    method: "DELETE",
  });
  log.info({ msg: "deleted s3 file", saveId });
}
