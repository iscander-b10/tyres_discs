import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} не задан`);
  return value;
}

let client;

export function getBucket() {
  return requireEnv('CATALOG_BUCKET');
}

export function getStoreId() {
  return process.env.STORE_ID?.trim() || 'ElistaIvanor';
}

function getClient() {
  if (client) return client;

  const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();

  if (!accessKeyId || !secretAccessKey) {
    throw new Error('AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY не заданы (статический ключ SA для Object Storage)');
  }

  client = new S3Client({
    region: process.env.AWS_REGION?.trim() || 'ru-central1',
    endpoint: process.env.S3_ENDPOINT?.trim() || 'https://storage.yandexcloud.net',
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });

  return client;
}

export function metaObjectKey(storeId) {
  return `stores/${storeId}/meta.json`;
}

export function snapshotObjectKey(storeId) {
  return `stores/${storeId}/snapshot.json`;
}

async function streamToString(body) {
  if (!body) return '';
  if (typeof body.transformToString === 'function') {
    return body.transformToString();
  }
  const chunks = [];
  for await (const chunk of body) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

/**
 * @returns {Promise<object|null>}
 */
export async function getJsonObject(key) {
  try {
    const out = await getClient().send(
      new GetObjectCommand({
        Bucket: getBucket(),
        Key: key,
      })
    );
    const text = await streamToString(out.Body);
    if (!text) return null;
    return JSON.parse(text);
  } catch (err) {
    const code = err?.name || err?.Code || err?.code;
    if (code === 'NoSuchKey' || code === 'NotFound' || err?.$metadata?.httpStatusCode === 404) {
      return null;
    }
    throw err;
  }
}

export async function putJsonObject(key, data) {
  const body = JSON.stringify(data);
  await getClient().send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: key,
      Body: body,
      ContentType: 'application/json; charset=utf-8',
    })
  );
  return body.length;
}

export async function readMeta(storeId) {
  return getJsonObject(metaObjectKey(storeId));
}

export async function readSnapshot(storeId) {
  return getJsonObject(snapshotObjectKey(storeId));
}

export async function writeMeta(storeId, meta) {
  return putJsonObject(metaObjectKey(storeId), meta);
}

export async function writeSnapshot(storeId, snapshot) {
  return putJsonObject(snapshotObjectKey(storeId), snapshot);
}
