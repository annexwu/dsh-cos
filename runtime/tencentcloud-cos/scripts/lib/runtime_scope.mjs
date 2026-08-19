function nonEmptyString(value) {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized === '' ? undefined : normalized;
}

function appIdFromBucket(bucket) {
  const normalized = nonEmptyString(bucket);
  if (!normalized) return undefined;
  const separator = normalized.lastIndexOf('-');
  if (separator < 0) return undefined;
  const candidate = normalized.slice(separator + 1);
  return /^\d{5,20}$/.test(candidate) ? candidate : undefined;
}

export function resolveRuntimeScope(options = {}, env = {}) {
  const bucket = nonEmptyString(options.bucket) || nonEmptyString(env.TENCENT_COS_BUCKET);
  const region = nonEmptyString(options.region) || nonEmptyString(env.TENCENT_COS_REGION);
  const datasetName = nonEmptyString(options['dataset-name'])
    || nonEmptyString(options.dataset)
    || nonEmptyString(env.TENCENT_COS_DATASET_NAME);
  const appId = nonEmptyString(options.appid) || appIdFromBucket(bucket);

  return { bucket, region, datasetName, appId };
}

export function requireRuntimeAppId(scope) {
  if (!scope.appId || !/^\d{5,20}$/.test(scope.appId)) {
    throw new Error('缺少有效的 --appid 参数，且无法从 --bucket <name-appid> 推导 AppId。');
  }
  return scope.appId;
}

export function requireRuntimeRegion(scope) {
  if (!scope.region) {
    throw new Error('缺少 --region 参数，且插件设置中没有默认 Region。');
  }
  return scope.region;
}

export function resolveMetaInsightHost(scope) {
  return `${requireRuntimeAppId(scope)}.ci.${requireRuntimeRegion(scope)}.myqcloud.com`;
}

export function resolveDatasetName(options = {}, fallback, { allowName = true } = {}) {
  return nonEmptyString(options['dataset-name'])
    || nonEmptyString(options.dataset)
    || (allowName ? nonEmptyString(options.name) : undefined)
    || nonEmptyString(fallback);
}
