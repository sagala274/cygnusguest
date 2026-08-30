function isValidNik(nik) {
  return /^\d{16}$/.test(nik || '');
}

function isValidPhone(phone) {
  return /^(\+62|62|0)8[1-9][0-9]{6,10}$/.test(phone || '');
}

function maskNik(nik) {
  if (!nik || nik.length !== 16) return nik;
  return `${nik.slice(0, 6)}${'*'.repeat(6)}${nik.slice(-4)}`;
}

const MAX_PHOTO_BYTES = 3 * 1024 * 1024;
const MIN_PHOTO_BYTES = 12; // cukup untuk memuat magic bytes terpanjang (WebP: 12 byte)

// Memverifikasi byte awal file sesuai format yang diklaim di prefix data URL --
// mencegah file non-gambar (mis. skrip yang disamarkan) lolos hanya karena
// menempelkan prefix "data:image/...;base64," di depannya.
function hasValidImageMagicBytes(buffer, subtype) {
  if (subtype === 'png') {
    return (
      buffer.length >= 8 &&
      buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 &&
      buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a
    );
  }
  if (subtype === 'jpg' || subtype === 'jpeg') {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (subtype === 'webp') {
    return (
      buffer.length >= 12 &&
      buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 && // "RIFF"
      buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50 // "WEBP"
    );
  }
  return false;
}

function isValidPhotoDataUrl(value) {
  if (value === undefined || value === null || value === '') return true;
  if (typeof value !== 'string') return false;

  // Prefix diperiksa dan payload base64 diwajibkan hanya berisi karakter
  // base64 valid sampai akhir string -- tidak boleh ada data tambahan
  // setelahnya (celah yang bisa dipakai untuk menyisipkan payload lain).
  const match = /^data:image\/(png|jpe?g|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) return false;

  const subtype = match[1].toLowerCase();
  const base64Payload = match[2];
  const approxBytes = (base64Payload.length * 3) / 4;
  if (approxBytes > MAX_PHOTO_BYTES || approxBytes < MIN_PHOTO_BYTES) return false;

  const buffer = Buffer.from(base64Payload, 'base64');
  return hasValidImageMagicBytes(buffer, subtype);
}

const VALID_DEVICE_STATUSES = ['tidak_membawa', 'dititipkan', 'dibawa_alasan_khusus'];

function isValidDeviceReason(reason) {
  if (typeof reason !== 'string') return false;
  const trimmed = reason.trim();
  return trimmed.length >= 20 && trimmed.length <= 500;
}

const VALID_SECURITY_CATEGORIES = ['aman', 'perlu_perhatian', 'perlu_penanganan'];

// Perusahaan yang secara umum menandakan tamu tidak berafiliasi dengan
// instansi manapun -- dikelompokkan ke bucket "Lainnya" di Bank Data.
const INDEPENDENT_COMPANY_ALIASES = ['pribadi', 'individu', 'perorangan', 'umum', 'tidak ada', 'independen', 'lainnya', '-'];

function isIndependentCompany(company) {
  const normalized = String(company || '').trim().toLowerCase();
  return normalized === '' || INDEPENDENT_COMPANY_ALIASES.includes(normalized);
}

module.exports = {
  isValidNik,
  isValidPhone,
  maskNik,
  isValidPhotoDataUrl,
  VALID_DEVICE_STATUSES,
  isValidDeviceReason,
  VALID_SECURITY_CATEGORIES,
  isIndependentCompany,
};
