import { createHash } from "node:crypto";

import { PUBLISH_MEDIA_TYPE } from "../publish/types";
import { type ArtifactDescriptorResponse } from "./types";

function sha256Digest(value: Buffer): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

export function verifyDescriptorMediaType(descriptor: ArtifactDescriptorResponse): void {
  if (descriptor.mediaType !== PUBLISH_MEDIA_TYPE) {
    throw new Error(`unsupported artifact media type '${descriptor.mediaType}'`);
  }
}

export function verifyDownloadedArtifact(
  descriptor: ArtifactDescriptorResponse,
  bytes: Buffer,
  contentType?: string,
): void {
  verifyDescriptorMediaType(descriptor);

  if (bytes.length !== descriptor.sizeBytes) {
    throw new Error(
      `artifact size mismatch: expected ${descriptor.sizeBytes} bytes, got ${bytes.length}`,
    );
  }

  const actualDigest = sha256Digest(bytes);
  if (actualDigest !== descriptor.digest) {
    throw new Error(`artifact digest mismatch: expected ${descriptor.digest}, got ${actualDigest}`);
  }

  if (contentType && !contentType.includes(descriptor.mediaType)) {
    throw new Error(
      `artifact content-type mismatch: expected ${descriptor.mediaType}, got ${contentType}`,
    );
  }
}
