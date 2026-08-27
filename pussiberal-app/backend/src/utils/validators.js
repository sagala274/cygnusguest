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

function isValidPhotoDataUrl(value) {
  if (value === undefined || value === null || value === '') return true;
  if (typeof value !== 'string') return false;
  if (!/^data:image\/(png|jpe?g|webp);base64,/.test(value)) return false;
  const approxBytes = (value.length * 3) / 4;
  return approxBytes <= MAX_PHOTO_BYTES;
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
