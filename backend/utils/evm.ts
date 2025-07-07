// backend/utils/evm.ts
import {
  keccak256,
  zeroPadValue,
  toBeHex,
  getAddress
} from "ethers";

export function pseudoAddress(userId: number): string {
  // pad the hex-string out to 32-bytes (0x + 64 hex chars)
  const padded32 = zeroPadValue(toBeHex(userId), 32);

  // keccak hash → take last 20 bytes → checksummed address
  const hashTail = keccak256(padded32).slice(-40);
  return getAddress("0x" + hashTail);
}
