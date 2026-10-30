import { describe, expect, it } from 'vitest'
import { isStorageRejection, storageUploadErrorMessage } from './storageUpload'

describe('isStorageRejection', () => {
  it('reconnaît un type refusé par le bucket (statusCode 415)', () => {
    expect(isStorageRejection({ message: 'mime type image/svg+xml is not supported', status: 400, statusCode: '415' })).toBe(true)
  })

  it('reconnaît une taille refusée par le bucket (statusCode 413)', () => {
    expect(isStorageRejection({ message: 'The object exceeded the maximum allowed size', status: 400, statusCode: '413' })).toBe(true)
  })

  it('reconnaît un status HTTP 413 direct', () => {
    expect(isStorageRejection({ status: 413 })).toBe(true)
  })

  it('ignore les autres erreurs', () => {
    expect(isStorageRejection({ message: 'new row violates row-level security policy', status: 400, statusCode: '403' })).toBe(false)
    expect(isStorageRejection(new Error('Failed to fetch'))).toBe(false)
    expect(isStorageRejection(null)).toBe(false)
  })
})

describe('storageUploadErrorMessage', () => {
  it('message de refus avec les formats acceptés par l’écran', () => {
    expect(storageUploadErrorMessage({ status: 400, statusCode: '415' }, 'PDF')).toBe('Fichier refusé (PDF, 2 Mo max)')
  })

  it('message générique pour une autre erreur', () => {
    expect(storageUploadErrorMessage(new Error('Failed to fetch'), 'PNG ou JPEG')).toBe("Erreur lors de l'envoi du fichier")
  })
})
