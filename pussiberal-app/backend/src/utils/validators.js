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
const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024; // dokumen SC (scan PDF) boleh lebih besar dari foto
const MIN_UPLOAD_BYTES = 5; // cukup untuk memuat magic bytes terpendek (PDF: 5 byte "%PDF-")

// Memverifikasi byte awal file sesuai format yang diklaim di prefix data URL --
// mencegah file lain (mis. skrip PHP/HTML yang disamarkan, atau tipe file apa
// pun di luar whitelist) lolos hanya karena menempelkan prefix
// "data:image/...;base64," atau "data:application/pdf;base64," di depannya.
// Semua unggahan di aplikasi ini TIDAK PERNAH disimpan sebagai file terpisah
// di server (hanya sebagai teks base64 di kolom database, dikembalikan lagi
// sebagai data URI di respons JSON) -- jadi secara arsitektur tidak mungkin
// dieksekusi sebagai PHP atau skrip apa pun oleh web server/PHP-FPM (tidak
// ada PHP sama sekali di stack ini). Pengecekan magic bytes di bawah ini
// murni lapis tambahan (defense-in-depth) supaya isi file benar-benar sesuai
// tipe yang diklaim, bukan karena ada risiko eksekusi langsung.
function hasValidFileSignature(buffer, mimeSubtype) {
  if (mimeSubtype === 'png') {
    return (
      buffer.length >= 8 &&
      buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 &&
      buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a
    );
  }
  if (mimeSubtype === 'jpg' || mimeSubtype === 'jpeg') {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimeSubtype === 'pdf') {
    // "%PDF-"
    return (
      buffer.length >= 5 &&
      buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46 && buffer[4] === 0x2d
    );
  }
  return false;
}

// Dipakai untuk field foto murni (Foto Tamu, Foto KTP, Foto Kegiatan) --
// hanya JPEG/JPG/PNG, tidak ada alasan field ini perlu menerima PDF.
function isValidPhotoDataUrl(value) {
  if (value === undefined || value === null || value === '') return true;
  if (typeof value !== 'string') return false;

  // Prefix diperiksa dan payload base64 diwajibkan hanya berisi karakter
  // base64 valid sampai akhir string -- tidak boleh ada data tambahan
  // setelahnya (celah yang bisa dipakai untuk menyisipkan payload lain).
  const match = /^data:image\/(png|jpe?g);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) return false;

  const subtype = match[1].toLowerCase();
  const base64Payload = match[2];
  const approxBytes = (base64Payload.length * 3) / 4;
  if (approxBytes > MAX_PHOTO_BYTES || approxBytes < MIN_UPLOAD_BYTES) return false;

  const buffer = Buffer.from(base64Payload, 'base64');
  return hasValidFileSignature(buffer, subtype);
}

// Dipakai untuk dokumen Security Clearance (SC) -- boleh JPEG/JPG/PNG (foto
// hasil kamera/scan) ATAU PDF (dokumen asli), tapi tidak ada tipe lain.
function isValidDocumentDataUrl(value) {
  if (value === undefined || value === null || value === '') return true;
  if (typeof value !== 'string') return false;

  const match = /^data:(image\/(?:png|jpe?g)|application\/pdf);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) return false;

  const mimeType = match[1].toLowerCase();
  const subtype = mimeType === 'application/pdf' ? 'pdf' : mimeType.split('/')[1];
  const base64Payload = match[2];
  const approxBytes = (base64Payload.length * 3) / 4;
  if (approxBytes > MAX_DOCUMENT_BYTES || approxBytes < MIN_UPLOAD_BYTES) return false;

  const buffer = Buffer.from(base64Payload, 'base64');
  return hasValidFileSignature(buffer, subtype);
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
  isValidDocumentDataUrl,
  VALID_DEVICE_STATUSES,
  isValidDeviceReason,
  VALID_SECURITY_CATEGORIES,
  isIndependentCompany,
};
