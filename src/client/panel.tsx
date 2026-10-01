import React from 'react'
import { CosStoragePage } from './CosStoragePage.tsx'
import type { CosStorageItem } from '../protocol.ts'
import type { CosStorageController } from './controller.ts'
import type { UploadCoordinator } from './upload-coordinator.ts'

export function StoragePanel({
  controller,
  uploadCoordinator,
  onStartConversation,
  onRequestDocumentPreview,
}: {
  controller: CosStorageController
  uploadCoordinator?: UploadCoordinator
  onStartConversation: (item: CosStorageItem) => Promise<void>
  onRequestDocumentPreview: (bucket: string) => Promise<void>
}): React.JSX.Element {
  return (
    <div className="dsh-cos-storage-panel" data-dsh-cos-storage-view="">
      <CosStoragePage
        controller={controller}
        uploadCoordinator={uploadCoordinator}
        onStartConversation={onStartConversation}
        onRequestDocumentPreview={onRequestDocumentPreview}
      />
    </div>
  )
}
