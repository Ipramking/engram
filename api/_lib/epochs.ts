// Walrus On-Chain Epoch Expiration & Staking Indicator Utilities
// Models Walrus decentralized storage epochs, retention lifecycle, and WAL staking metrics.

export interface WalrusEpochMetadata {
  currentEpoch: number
  storageEpochs: number
  expiresAtEpoch: number
  daysRemaining: number
  isPermanentStake: boolean
  allocatedBytes: number
  storageCostWal: number
  storageNodeQuorum: number
  network: 'testnet' | 'mainnet'
  explorerUrl: string
}

const CURRENT_WALRUS_EPOCH = 24
const EPOCH_DURATION_DAYS = 14

export function calculateWalrusEpochMetadata({
  blobId,
  planTier = 'free_personal',
  createdAt = new Date(),
}: {
  blobId?: string | null
  planTier?: string
  createdAt?: Date | string
}): WalrusEpochMetadata {
  const isPermanent = planTier === 'pro' || planTier === 'team' || planTier === 'pro_team'
  const createdDate = new Date(createdAt)
  const now = new Date()
  const daysPassed = Math.max(0, Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24)))

  const storageEpochs = isPermanent ? 9999 : 1
  const daysRemaining = isPermanent ? 9999 : Math.max(1, EPOCH_DURATION_DAYS - daysPassed)
  const expiresAtEpoch = CURRENT_WALRUS_EPOCH + (isPermanent ? 9999 : 1)

  const id = blobId || 'mock-blob-000001'
  const explorerUrl = `https://walruscan.com/testnet/blob/${id}`

  return {
    currentEpoch: CURRENT_WALRUS_EPOCH,
    storageEpochs,
    expiresAtEpoch,
    daysRemaining,
    isPermanentStake: isPermanent,
    allocatedBytes: 131072, // 128 KiB minimum Walrus blob allocation
    storageCostWal: 0.002, // 0.002 WAL per blob
    storageNodeQuorum: 5, // RedStuff 2D erasure coding (5 node committee)
    network: 'testnet',
    explorerUrl,
  }
}
