const encoder = new TextEncoder()
const decoder = new TextDecoder()

const IP = [
  58, 50, 42, 34, 26, 18, 10, 2, 60, 52, 44, 36, 28, 20, 12, 4, 62, 54, 46, 38, 30, 22, 14, 6, 64,
  56, 48, 40, 32, 24, 16, 8, 57, 49, 41, 33, 25, 17, 9, 1, 59, 51, 43, 35, 27, 19, 11, 3, 61, 53,
  45, 37, 29, 21, 13, 5, 63, 55, 47, 39, 31, 23, 15, 7,
]
const FP = [
  40, 8, 48, 16, 56, 24, 64, 32, 39, 7, 47, 15, 55, 23, 63, 31, 38, 6, 46, 14, 54, 22, 62, 30, 37,
  5, 45, 13, 53, 21, 61, 29, 36, 4, 44, 12, 52, 20, 60, 28, 35, 3, 43, 11, 51, 19, 59, 27, 34, 2,
  42, 10, 50, 18, 58, 26, 33, 1, 41, 9, 49, 17, 57, 25,
]
const E = [
  32, 1, 2, 3, 4, 5, 4, 5, 6, 7, 8, 9, 8, 9, 10, 11, 12, 13, 12, 13, 14, 15, 16, 17, 16, 17, 18, 19,
  20, 21, 20, 21, 22, 23, 24, 25, 24, 25, 26, 27, 28, 29, 28, 29, 30, 31, 32, 1,
]
const P = [
  16, 7, 20, 21, 29, 12, 28, 17, 1, 15, 23, 26, 5, 18, 31, 10, 2, 8, 24, 14, 32, 27, 3, 9, 19, 13,
  30, 6, 22, 11, 4, 25,
]
const PC1 = [
  57, 49, 41, 33, 25, 17, 9, 1, 58, 50, 42, 34, 26, 18, 10, 2, 59, 51, 43, 35, 27, 19, 11, 3, 60,
  52, 44, 36, 63, 55, 47, 39, 31, 23, 15, 7, 62, 54, 46, 38, 30, 22, 14, 6, 61, 53, 45, 37, 29, 21,
  13, 5, 28, 20, 12, 4,
]
const PC2 = [
  14, 17, 11, 24, 1, 5, 3, 28, 15, 6, 21, 10, 23, 19, 12, 4, 26, 8, 16, 7, 27, 20, 13, 2, 41, 52,
  31, 37, 47, 55, 30, 40, 51, 45, 33, 48, 44, 49, 39, 56, 34, 53, 46, 42, 50, 36, 29, 32,
]
const SHIFTS = [1, 1, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 1]
const S = [
  [
    14, 4, 13, 1, 2, 15, 11, 8, 3, 10, 6, 12, 5, 9, 0, 7, 0, 15, 7, 4, 14, 2, 13, 1, 10, 6, 12, 11,
    9, 5, 3, 8, 4, 1, 14, 8, 13, 6, 2, 11, 15, 12, 9, 7, 3, 10, 5, 0, 15, 12, 8, 2, 4, 9, 1, 7, 5,
    11, 3, 14, 10, 0, 6, 13,
  ],
  [
    15, 1, 8, 14, 6, 11, 3, 4, 9, 7, 2, 13, 12, 0, 5, 10, 3, 13, 4, 7, 15, 2, 8, 14, 12, 0, 1, 10,
    6, 9, 11, 5, 0, 14, 7, 11, 10, 4, 13, 1, 5, 8, 12, 6, 9, 3, 2, 15, 13, 8, 10, 1, 3, 15, 4, 2,
    11, 6, 7, 12, 0, 5, 14, 9,
  ],
  [
    10, 0, 9, 14, 6, 3, 15, 5, 1, 13, 12, 7, 11, 4, 2, 8, 13, 7, 0, 9, 3, 4, 6, 10, 2, 8, 5, 14, 12,
    11, 15, 1, 13, 6, 4, 9, 8, 15, 3, 0, 11, 1, 2, 12, 5, 10, 14, 7, 1, 10, 13, 0, 6, 9, 8, 7, 4,
    15, 14, 3, 11, 5, 2, 12,
  ],
  [
    7, 13, 14, 3, 0, 6, 9, 10, 1, 2, 8, 5, 11, 12, 4, 15, 13, 8, 11, 5, 6, 15, 0, 3, 4, 7, 2, 12, 1,
    10, 14, 9, 10, 6, 9, 0, 12, 11, 7, 13, 15, 1, 3, 14, 5, 2, 8, 4, 3, 15, 0, 6, 10, 1, 13, 8, 9,
    4, 5, 11, 12, 7, 2, 14,
  ],
  [
    2, 12, 4, 1, 7, 10, 11, 6, 8, 5, 3, 15, 13, 0, 14, 9, 14, 11, 2, 12, 4, 7, 13, 1, 5, 0, 15, 10,
    3, 9, 8, 6, 4, 2, 1, 11, 10, 13, 7, 8, 15, 9, 12, 5, 6, 3, 0, 14, 11, 8, 12, 7, 1, 14, 2, 13, 6,
    15, 0, 9, 10, 4, 5, 3,
  ],
  [
    12, 1, 10, 15, 9, 2, 6, 8, 0, 13, 3, 4, 14, 7, 5, 11, 10, 15, 4, 2, 7, 12, 9, 5, 6, 1, 13, 14,
    0, 11, 3, 8, 9, 14, 15, 5, 2, 8, 12, 3, 7, 0, 4, 10, 1, 13, 11, 6, 4, 3, 2, 12, 9, 5, 15, 10,
    11, 14, 1, 7, 6, 0, 8, 13,
  ],
  [
    4, 11, 2, 14, 15, 0, 8, 13, 3, 12, 9, 7, 5, 10, 6, 1, 13, 0, 11, 7, 4, 9, 1, 10, 14, 3, 5, 12,
    2, 15, 8, 6, 1, 4, 11, 13, 12, 3, 7, 14, 10, 15, 6, 8, 0, 5, 9, 2, 6, 11, 13, 8, 1, 4, 10, 7, 9,
    5, 0, 15, 14, 2, 3, 12,
  ],
  [
    13, 2, 8, 4, 6, 15, 11, 1, 10, 9, 3, 14, 5, 0, 12, 7, 1, 15, 13, 8, 10, 3, 7, 4, 12, 5, 6, 11,
    0, 14, 9, 2, 7, 11, 4, 1, 9, 12, 14, 2, 0, 6, 10, 13, 15, 3, 5, 8, 2, 1, 14, 7, 4, 10, 8, 13,
    15, 12, 9, 0, 3, 5, 6, 11,
  ],
]

const toBigInt = (bytes: Uint8Array) =>
  bytes.reduce((value, byte) => (value << 8n) | BigInt(byte), 0n)
const toBytes = (value: bigint, length: number) =>
  Uint8Array.from({ length }, (_, index) =>
    Number((value >> BigInt((length - index - 1) * 8)) & 255n),
  )
const permute = (value: bigint, table: number[], bits: number) =>
  table.reduce((out, position) => (out << 1n) | ((value >> BigInt(bits - position)) & 1n), 0n)
const rotate28 = (value: bigint, count: number) =>
  ((value << BigInt(count)) | (value >> BigInt(28 - count))) & 0xfffffffn

function keys(key: Uint8Array) {
  let value = permute(toBigInt(key), PC1, 64)
  let left = value >> 28n
  let right = value & 0xfffffffn
  return SHIFTS.map((shift) => {
    left = rotate28(left, shift)
    right = rotate28(right, shift)
    return permute((left << 28n) | right, PC2, 56)
  })
}

function des(block: bigint, key: Uint8Array, encrypt: boolean) {
  const roundKeys = keys(key)
  let state = permute(block, IP, 64)
  let left = state >> 32n
  let right = state & 0xffffffffn
  for (let round = 0; round < 16; round++) {
    const expanded = permute(right, E, 32) ^ roundKeys[encrypt ? round : 15 - round]
    let substitution = 0n
    for (let index = 0; index < 8; index++) {
      const sixBits = Number((expanded >> BigInt((7 - index) * 6)) & 63n)
      const row = ((sixBits & 32) >> 4) | (sixBits & 1)
      const column = (sixBits >> 1) & 15
      substitution = (substitution << 4n) | BigInt(S[index][row * 16 + column])
    }
    const next = left ^ permute(substitution, P, 32)
    left = right
    right = next
  }
  return permute((right << 32n) | left, FP, 64)
}

function decodeBase64(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0))
}

function encodeBase64Url(value: Uint8Array) {
  let binary = ''
  value.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function deriveKey(order: string, secret: string) {
  const source = decodeBase64(secret)
  if (source.length !== 16 && source.length !== 24)
    throw new Error('La clave de firma Cyberpac debe tener 16 o 24 bytes en Base64.')
  const key = source.length === 16 ? new Uint8Array([...source, ...source.slice(0, 8)]) : source
  const input = encoder.encode(order)
  const padded = new Uint8Array(Math.ceil(input.length / 8) * 8)
  padded.set(input)
  let previous = 0n
  const result = new Uint8Array(padded.length)
  for (let offset = 0; offset < padded.length; offset += 8) {
    const encrypted = des(
      des(
        des(toBigInt(padded.slice(offset, offset + 8)) ^ previous, key.slice(0, 8), true),
        key.slice(8, 16),
        false,
      ),
      key.slice(16, 24),
      true,
    )
    result.set(toBytes(encrypted, 8), offset)
    previous = encrypted
  }
  return result
}

export async function cyberpacSignature(order: string, parameters: string, secret: string) {
  const signingKey = await crypto.subtle.importKey(
    'raw',
    deriveKey(order, secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return encodeBase64Url(
    new Uint8Array(await crypto.subtle.sign('HMAC', signingKey, encoder.encode(parameters))),
  )
}

export function encodeMerchantParameters(parameters: Record<string, string>) {
  return encodeBase64Url(encoder.encode(JSON.stringify(parameters)))
}

export function decodeMerchantParameters(value: string) {
  return JSON.parse(decoder.decode(decodeBase64(value))) as Record<string, string>
}

export function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false
  let result = 0
  for (let index = 0; index < left.length; index++)
    result |= left.charCodeAt(index) ^ right.charCodeAt(index)
  return result === 0
}
