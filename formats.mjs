const GIF_FMT = 'GIF';
const GIF_SUPPORT = '@GIF_SUPPORT@' === 'true';

const WEBP_FMT = 'WebP';
const WEBP_SUPPORT = '@WEBP_SUPPORT@' === 'true';

export function probe_buffer_format(buffer) {
  // GIF: GIF87a or GIF89a.
  if (GIF_SUPPORT && 
    buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 &&
    buffer[3] === 0x38 && (buffer[4] === 0x37 || buffer[4] == 0x39) &&
    buffer[5] === 0x61) {
    return GIF_FMT;
  }
  // WebP: RIFT....WEBP
  if (WEBP_SUPPORT &&
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 &&
    buffer[3] === 0x46 && buffer[8] === 0x57 && buffer[9] === 0x45 &&
    buffer[10] === 0x42 && buffer[11] === 0x50) {
    return WEBP_FMT;
  }
  return null;
}

export function probe_url_format(url) {
  if (url.protocol === 'data:') {
    const semidx = url.pathname.indexOf(';');
    if (semidx === -1) {
      return null;
    }
    const mime = url.pathname.slice(0, semidx);
    if (GIF_SUPPORT && mime === 'image/gif') {
      return GIF_FMT;
    }
    if (WEBP_SUPPORT && mime === 'image/webp') {
      return WEBP_FMT;
    }
    return null;
  }
  const extidx = url.pathname.lastIndexOf('.');
  if (extidx === -1) {
    return null;
  }
  const ext = url.pathname.slice(extidx + 1).toLowerCase();
  if (GIF_SUPPORT && (ext === 'gif' || ext === 'gifv')) {
    return GIF_FMT;
  }
  if (WEBP_SUPPORT && (ext === 'webp')) {
    return WEBP_FMT;
  }
  return null;
}

export const supported_formats = Array.prototype.concat(
  GIF_SUPPORT ? [GIF_FMT] : [],
  WEBP_SUPPORT ? [WEBP_FMT] : [],
);

// vim: expandtab sw=2
