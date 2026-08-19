import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  requireRuntimeAppId,
  requireRuntimeRegion,
  resolveDatasetName,
  resolveMetaInsightHost,
  resolveRuntimeScope,
} from '../runtime/tencentcloud-cos/scripts/lib/runtime_scope.mjs'

describe('Tencent Cloud runtime scope', () => {
  it('uses explicit action parameters before plugin defaults', () => {
    const scope = resolveRuntimeScope(
      {
        bucket: 'explicit-1299999999',
        region: 'ap-shanghai',
        appid: '1288888888',
        'dataset-name': 'explicit-dataset',
      },
      {
        TENCENT_COS_BUCKET: 'default-1250000000',
        TENCENT_COS_REGION: 'ap-chengdu',
        TENCENT_COS_DATASET_NAME: 'default-dataset',
      },
    )

    expect(scope).toEqual({
      bucket: 'explicit-1299999999',
      region: 'ap-shanghai',
      appId: '1288888888',
      datasetName: 'explicit-dataset',
    })
    expect(resolveMetaInsightHost(scope)).toBe('1288888888.ci.ap-shanghai.myqcloud.com')
  })

  it('uses plugin defaults and derives AppId from the configured bucket', () => {
    const scope = resolveRuntimeScope({}, {
      TENCENT_COS_BUCKET: 'default-1250000000',
      TENCENT_COS_REGION: 'ap-guangzhou',
      TENCENT_COS_DATASET_NAME: 'default-dataset',
    })

    expect(scope).toEqual({
      bucket: 'default-1250000000',
      region: 'ap-guangzhou',
      appId: '1250000000',
      datasetName: 'default-dataset',
    })
    expect(resolveMetaInsightHost(scope)).toBe('1250000000.ci.ap-guangzhou.myqcloud.com')
  })

  it('requires a valid AppId and Region instead of silently selecting a hardcoded scope', () => {
    expect(() => requireRuntimeAppId(resolveRuntimeScope({ bucket: 'invalid-bucket' }, {}))).toThrow('appid')
    expect(() => requireRuntimeRegion(resolveRuntimeScope({ appid: '1250000000' }, {}))).toThrow('region')
  })

  it('normalizes dataset-name aliases with the documented name taking precedence', () => {
    expect(resolveDatasetName({ name: 'legacy-name', dataset: 'legacy-dataset', 'dataset-name': 'documented-name' }, 'fallback')).toBe('documented-name')
    expect(resolveDatasetName({ dataset: 'legacy-dataset' }, 'fallback')).toBe('legacy-dataset')
    expect(resolveDatasetName({ name: 'knowledge-base' }, 'generated-dataset', { allowName: false })).toBe('generated-dataset')
  })

  it('keeps the MetaInsight runtime on the standard parameter path', () => {
    const source = readFileSync(resolve(process.cwd(), 'runtime/tencentcloud-cos/scripts/cos_node.mjs'), 'utf8')
    expect(source).toContain('resolveRuntimeScope(opts, process.env)')
    expect(source).toContain('resolveMetaInsightHost(runtimeScope)')
    expect(source).not.toContain('TENCENT_COS_METAINSIGHT_REGION')
    expect(source).not.toContain('TENCENT_COS_DATASET_IMAGE_SEARCH')
    expect(source).not.toContain('TENCENT_COS_DATASET_FACE_SEARCH')
    expect(source).not.toContain('TENCENT_COS_DATASET_META')
    expect(source).not.toContain("METAINSIGHT_REGIONS[0]")
  })
})
