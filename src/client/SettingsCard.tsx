import React, { useEffect, useMemo, useState } from 'react'
import type { CosStorageConfigView, SaveCosStorageConfigRequest } from '../protocol.ts'
import { CosStorageApiError, loadConfig, saveConfig, testConnection } from './api.ts'
import { getCopy } from './copy.ts'

interface FormState {
  secretId: string
  secretKey: string
  bucket: string
  region: string
  prefix: string
  customDomain: string
}

type Feedback = { kind: 'success' | 'error'; text: string } | undefined

const EMPTY_FORM: FormState = {
  secretId: '',
  secretKey: '',
  bucket: '',
  region: '',
  prefix: '',
  customDomain: '',
}

function toForm(config: CosStorageConfigView): FormState {
  return {
    ...EMPTY_FORM,
    bucket: config.bucket,
    region: config.region,
    prefix: config.prefix,
    customDomain: config.customDomain,
  }
}

function requestOf(form: FormState): SaveCosStorageConfigRequest {
  return {
    bucket: form.bucket,
    region: form.region,
    prefix: form.prefix,
    customDomain: form.customDomain,
    ...(form.secretId.trim() === '' ? {} : { secretId: form.secretId }),
    ...(form.secretKey.trim() === '' ? {} : { secretKey: form.secretKey }),
  }
}

function messageOf(error: unknown): string {
  return error instanceof CosStorageApiError ? error.message : '操作失败，请稍后重试。'
}

export interface SettingsCardProps {
  onSaved?: (config: CosStorageConfigView) => void
}

export function SettingsCard({ onSaved }: SettingsCardProps = {}): React.JSX.Element {
  const copy = useMemo(getCopy, [])
  const [expanded, setExpanded] = useState(true)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<'save' | 'test'>()
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [config, setConfig] = useState<CosStorageConfigView>()
  const [feedback, setFeedback] = useState<Feedback>()

  useEffect(() => {
    let active = true
    void loadConfig().then((response) => {
      if (!active) return
      setConfig(response.config)
      setForm(toForm(response.config))
    }).catch((error: unknown) => {
      if (active) setFeedback({ kind: 'error', text: `${copy.loadFailed} ${messageOf(error)}` })
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => {
      active = false
    }
  }, [copy])

  const update = (key: keyof FormState) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setForm(current => ({ ...current, [key]: event.target.value }))
    setFeedback(undefined)
  }

  const handleSave = async () => {
    setBusy('save')
    setFeedback(undefined)
    let savedConfig: CosStorageConfigView | undefined
    try {
      const response = await saveConfig(requestOf(form))
      savedConfig = response.config
      setConfig(response.config)
      setForm(toForm(response.config))
      setFeedback({ kind: 'success', text: copy.saved })
    } catch (error) {
      setFeedback({ kind: 'error', text: messageOf(error) })
    } finally {
      setBusy(undefined)
    }
    if (savedConfig !== undefined) onSaved?.(savedConfig)
  }

  const handleTest = async () => {
    setBusy('test')
    setFeedback(undefined)
    try {
      const response = await testConnection(requestOf(form))
      setFeedback({ kind: 'success', text: response.message })
    } catch (error) {
      setFeedback({ kind: 'error', text: messageOf(error) })
    } finally {
      setBusy(undefined)
    }
  }

  const credentialsConfigured = config?.secretIdConfigured === true && config.secretKeyConfigured === true
  const connectionConfigured = config !== undefined && credentialsConfigured && config.bucket.trim() !== '' && config.region.trim() !== ''
  const credentialsWritable = config?.credentialsWritable !== false
  const secretPlaceholder = credentialsConfigured ? copy.secretPlaceholder : copy.secretNewPlaceholder
  const disabled = loading || busy !== undefined

  return (
    <section className="dsh-cos-settings-card" aria-label={copy.title}>
      <div className="dsh-cos-settings-card__summary">
        <button
          type="button"
          className="dsh-cos-settings-card__summary-trigger"
          aria-expanded={expanded}
          onClick={() => setExpanded(value => !value)}
        >
          <strong>{copy.title}</strong>
          <span className={`dsh-cos-settings-card__chevron${expanded ? ' is-open' : ''}`} aria-hidden="true">⌄</span>
        </button>
        <small>
          {copy.settingsDescription}
          <a href="https://cloud.tencent.com/product/cos" target="_blank" rel="noopener noreferrer">{copy.createBucket}</a>
        </small>
      </div>

      {expanded && (
        <div className="dsh-cos-settings-card__body">
          <div className="dsh-cos-settings-card__section-title">{copy.settingsReadyTitle}</div>

          <div className={`dsh-cos-settings-card__credential-state ${connectionConfigured ? 'is-ready' : 'is-missing'}`}>
            {connectionConfigured ? copy.connectionConfigured : copy.connectionMissing}
            {!credentialsWritable && <div>{copy.credentialsReadOnly}</div>}
          </div>

          <div className="dsh-cos-settings-card__fields">
            <label className="dsh-cos-settings-card__field">
              <span>{copy.secretId}<em>{copy.required}</em></span>
              <input
                type="password"
                value={form.secretId}
                placeholder={secretPlaceholder}
                autoComplete="new-password"
                spellCheck={false}
                disabled={disabled || !credentialsWritable}
                onChange={update('secretId')}
              />
              <small>{copy.secretIdDescription}</small>
            </label>
            <label className="dsh-cos-settings-card__field">
              <span>{copy.secretKey}<em>{copy.required}</em></span>
              <input
                type="password"
                value={form.secretKey}
                placeholder={secretPlaceholder}
                autoComplete="new-password"
                spellCheck={false}
                disabled={disabled || !credentialsWritable}
                onChange={update('secretKey')}
              />
              <small>{copy.secretKeyDescription}</small>
            </label>
            <label className="dsh-cos-settings-card__field">
              <span>{copy.bucket}<em>{copy.required}</em></span>
              <input
                value={form.bucket}
                placeholder={copy.bucketPlaceholder}
                spellCheck={false}
                disabled={disabled}
                onChange={update('bucket')}
              />
              <small>{copy.bucketDescription}</small>
            </label>
            <label className="dsh-cos-settings-card__field">
              <span>{copy.region}<em>{copy.required}</em></span>
              <input
                value={form.region}
                placeholder={copy.regionPlaceholder}
                spellCheck={false}
                disabled={disabled}
                onChange={update('region')}
              />
              <small>{copy.regionDescription}</small>
            </label>
            <label className="dsh-cos-settings-card__field">
              <span>{copy.prefix}<i>{copy.optional}</i></span>
              <input
                value={form.prefix}
                placeholder={copy.prefixPlaceholder}
                spellCheck={false}
                disabled={disabled}
                onChange={update('prefix')}
              />
              <small>{copy.prefixDescription}</small>
            </label>
            <label className="dsh-cos-settings-card__field">
              <span>{copy.customDomain}<i>{copy.optional}</i></span>
              <input
                type="url"
                value={form.customDomain}
                placeholder={copy.domainPlaceholder}
                spellCheck={false}
                disabled={disabled}
                onChange={update('customDomain')}
              />
              <small>{copy.customDomainDescription}</small>
            </label>
          </div>

          {feedback && (
            <div className={`dsh-cos-settings-card__feedback is-${feedback.kind}`} role="status">
              {feedback.text}
            </div>
          )}

          <div className="dsh-cos-settings-card__actions">
            <button type="button" className="is-secondary" disabled={disabled} onClick={() => void handleTest()}>
              {busy === 'test' ? copy.testing : copy.testConnection}
            </button>
            <button type="button" className="is-primary" disabled={disabled} onClick={() => void handleSave()}>
              {busy === 'save' ? copy.saving : copy.save}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
