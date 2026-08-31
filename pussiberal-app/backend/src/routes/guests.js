const express = require('express');
const pool = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const {
  isValidNik,
  isValidPhone,
  maskNik,
  isValidPhotoDataUrl,
  VALID_DEVICE_STATUSES,
  isValidDeviceReason,
  VALID_SECURITY_CATEGORIES,
} = require('../utils/validators');
const { logAudit } = require('../utils/audit');
const { notifyNewRegistration } = require('../utils/telegram');
const { notifyVerifiers, notifyGuestCreator } = require('../utils/notifications');
const { PURPOSE_CATEGORIES, isValidTargetOfficials } = require('../utils/guestFields');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();
router.use(authenticate);

function formatMember(row, role) {
  const canSeeFullNik = role === 'admin' || role === 'verifikator';
  return {
    id: row.id,
    full_name: row.full_name,
    other_names: row.other_names,
    nik: canSeeFullNik ? row.nik : maskNik(row.nik),
    phone_number: row.phone_number,
    position: row.position,
    employee_id: row.employee_id,
    device_status: row.device_status,
    device_reason: row.device_reason,
    affiliation: row.affiliation,
    social_media: row.social_media,
    address: row.address,
    analysis_notes: row.analysis_notes,
    security_category: row.security_category,
    photo: row.photo !== undefined ? row.photo : undefined,
    ktp_photo: row.ktp_photo !== undefined ? row.ktp_photo : undefined,
  };
}

// isScheduled: tamu terjadwal -- NIK/Nama/Jabatan/Nomor HP tetap wajib diisi
// di muka, tapi Foto Tamu dan deklarasi Perangkat Elektronik boleh menyusul
// saat tamu benar-benar tiba (lihat POST /:id/complete).
function validateMember(member, index, errors, isScheduled) {
  const prefix = `members[${index}]`;
  if (!member || typeof member !== 'object') {
    errors[prefix] = 'Data tamu tidak valid';
    return;
  }
  if (!member.full_name || !String(member.full_name).trim()) errors[`${prefix}.full_name`] = 'Nama tamu wajib diisi';
  if (!isValidNik(member.nik)) errors[`${prefix}.nik`] = 'NIK harus terdiri dari 16 digit numerik';
  if (!isValidPhone(member.phone_number)) errors[`${prefix}.phone_number`] = 'Format nomor HP tidak valid';
  if (!member.position || !String(member.position).trim()) errors[`${prefix}.position`] = 'Jabatan wajib diisi';
  if (member.employee_id && String(member.employee_id).length > 50) errors[`${prefix}.employee_id`] = 'Nomor ID karyawan maksimal 50 karakter';

  if (!isScheduled && !member.photo) errors[`${prefix}.photo`] = 'Foto tamu wajib diisi';
  else if (member.photo && !isValidPhotoDataUrl(member.photo)) errors[`${prefix}.photo`] = 'Foto tidak valid atau ukurannya terlalu besar (maks 3MB)';
  if (member.ktp_photo && !isValidPhotoDataUrl(member.ktp_photo)) errors[`${prefix}.ktp_photo`] = 'Foto KTP tidak valid atau ukurannya terlalu besar (maks 3MB)';

  if (!isScheduled || member.device_status) {
    if (!VALID_DEVICE_STATUSES.includes(member.device_status)) {
      errors[`${prefix}.device_status`] = 'Pilih status perangkat elektronik';
    } else if (member.device_status === 'dibawa_alasan_khusus' && !isValidDeviceReason(member.device_reason)) {
      errors[`${prefix}.device_reason`] = 'Alasan wajib diisi, minimal 20 dan maksimal 500 karakter';
    }
  }
}

const GUEST_LIST_SELECT = `
  SELECT g.id, g.registration_number, g.company, g.purpose, g.status, g.created_at,
         COUNT(gm.id) AS member_count,
         GROUP_CONCAT(gm.full_name ORDER BY gm.id SEPARATOR ', ') AS member_names,
         MAX(v.vehicle_type) AS vehicle_type, MAX(v.plate_number) AS plate_number,
         MAX(vi.check_in_at) AS check_in_at, MAX(vi.check_out_at) AS check_out_at, MAX(vi.status) AS visit_status
  FROM guests g
  LEFT JOIN guest_members gm ON gm.guest_id = g.id
  LEFT JOIN vehicles v ON v.guest_id = g.id
  LEFT JOIN visits vi ON vi.guest_id = g.id
`;

// GET /api/guests  (list + search via ?q=&status=&page=&pageSize=)
router.get('/', asyncHandler(async (req, res) => {
  const { q, status, page = 1, pageSize = 20 } = req.query;
  const limit = Math.min(parseInt(pageSize, 10) || 20, 100);
  const offset = (Math.max(parseInt(page, 10) || 1, 1) - 1) * limit;

  const where = [];
  const params = {};

  if (q) {
    where.push(`(g.company LIKE :q OR g.registration_number LIKE :q
      OR EXISTS (SELECT 1 FROM guest_members gm2 WHERE gm2.guest_id = g.id AND (gm2.full_name LIKE :q OR gm2.nik LIKE :q)))`);
    params.q = `%${q}%`;
  }
  if (status) {
    where.push('g.status = :status');
    params.status = status;
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [rows] = await pool.query(
    `${GUEST_LIST_SELECT} ${whereSql} GROUP BY g.id ORDER BY g.created_at DESC LIMIT ${limit} OFFSET ${offset}`,
    params
  );

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total FROM guests g ${whereSql}`,
    params
  );

  res.json({
    data: rows.map((r) => ({
      id: r.id,
      registration_number: r.registration_number,
      company: r.company,
      purpose: r.purpose,
      status: r.status,
      member_count: r.member_count,
      member_names: r.member_names,
      vehicle_type: r.vehicle_type,
      plate_number: r.plate_number,
      check_in_at: r.check_in_at,
      check_out_at: r.check_out_at,
      visit_status: r.visit_status,
      created_at: r.created_at,
    })),
    total: countRows[0].total,
    page: Number(page),
    pageSize: limit,
  });
}));

// GET /api/guests/meta/companies -- daftar nama perusahaan yang pernah
// terdaftar (untuk saran/autocomplete di formulir Pendaftaran Tamu)
router.get('/meta/companies', requireRole('admin', 'pos_depan'), asyncHandler(async (req, res) => {
  const [rows] = await pool.query('SELECT DISTINCT company FROM guests ORDER BY company');
  res.json({ data: rows.map((r) => r.company) });
}));

// GET /api/guests/meta/company-members?company=...  -- tamu yang pernah
// terdaftar dari perusahaan yang sama (untuk auto-lengkapi data tamu yang
// sudah pernah datang, dikelompokkan per NIK+nama supaya satu orang tidak
// muncul berkali-kali walau sudah berkunjung berulang)
router.get('/meta/company-members', requireRole('admin', 'pos_depan'), asyncHandler(async (req, res) => {
  const { company } = req.query;
  if (!company || !String(company).trim()) return res.json({ data: [] });

  const [rows] = await pool.query(
    `SELECT gm.full_name, gm.nik, gm.phone_number, gm.position, gm.employee_id, MAX(g.created_at) AS last_created_at
     FROM guest_members gm
     JOIN guests g ON g.id = gm.guest_id
     WHERE g.company = :company
     GROUP BY gm.nik, gm.full_name, gm.phone_number, gm.position, gm.employee_id
     ORDER BY last_created_at DESC`,
    { company: String(company).trim() }
  );

  res.json({
    data: rows.map((r) => ({
      full_name: r.full_name,
      nik: r.nik,
      phone_number: r.phone_number,
      position: r.position,
      employee_id: r.employee_id,
    })),
  });
}));

// GET /api/guests/:id
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const [guestRows] = await pool.execute(
    `SELECT g.*, v.vehicle_type, v.plate_number, vi.check_in_at, vi.check_out_at, vi.status AS visit_status,
            vi.re_entry_reason, vi.re_entry_at
     FROM guests g
     LEFT JOIN vehicles v ON v.guest_id = g.id
     LEFT JOIN visits vi ON vi.guest_id = g.id
     WHERE g.id = :id`,
    { id }
  );
  if (!guestRows[0]) return res.status(404).json({ error: 'Pendaftaran tidak ditemukan' });

  const [memberRows] = await pool.execute('SELECT * FROM guest_members WHERE guest_id = :id ORDER BY id', { id });

  const g = guestRows[0];
  res.json({
    data: {
      id: g.id,
      registration_number: g.registration_number,
      company: g.company,
      target_officials: g.target_officials ? g.target_officials.split(',') : [],
      target_official_other: g.target_official_other,
      purpose: g.purpose,
      purpose_category: g.purpose_category,
      accompanied_by: g.accompanied_by,
      device_status: g.device_status,
      device_reason: g.device_reason,
      status: g.status,
      vehicle_type: g.vehicle_type,
      plate_number: g.plate_number,
      check_in_at: g.check_in_at,
      check_out_at: g.check_out_at,
      visit_status: g.visit_status,
      re_entry_reason: g.re_entry_reason,
      re_entry_at: g.re_entry_at,
      created_at: g.created_at,
      members: memberRows.map((m) => formatMember(m, req.user.role)),
    },
  });
}));

// POST /api/guests  (Pos Depan mendaftarkan 1+ tamu dari perusahaan yang sama -> masuk antrian verifikasi)
router.post('/', requireRole('admin', 'pos_depan'), asyncHandler(async (req, res) => {
  const { company, target_officials, target_official_other, purpose, purpose_category, accompanied_by, vehicle_type, plate_number, members, is_scheduled } = req.body || {};
  const isScheduled = !!is_scheduled;

  const errors = {};
  const hasTargetOfficials = Array.isArray(target_officials) && target_officials.length > 0;

  if (!isScheduled) {
    if (!company || !String(company).trim()) errors.company = 'Perusahaan/instansi wajib diisi';
    if (!hasTargetOfficials) errors.target_officials = 'Pilih minimal satu tujuan menghadap kepada';
    if (!purpose_category || !PURPOSE_CATEGORIES.includes(purpose_category)) errors.purpose_category = 'Pilih kategori keperluan';
    if (!purpose || !String(purpose).trim()) errors.purpose = 'Detail tujuan menghadap wajib diisi';
  } else {
    // Tamu terjadwal: Perusahaan/Tujuan Menghadap/Kategori Keperluan/Detail
    // Tujuan boleh dikosongkan dulu dan dilengkapi belakangan dari halaman
    // Detail Tamu (lihat PUT /:id) -- supaya Pos Depan tidak perlu menahan
    // formulir ini terbuka sampai semua informasi lengkap. Kalau memang
    // sudah diisi sekarang, tetap divalidasi formatnya seperti biasa.
    if (company && !String(company).trim()) errors.company = 'Perusahaan/instansi tidak valid';
    if (purpose_category && !PURPOSE_CATEGORIES.includes(purpose_category)) errors.purpose_category = 'Kategori keperluan tidak valid';
  }
  if (hasTargetOfficials) {
    if (!isValidTargetOfficials(target_officials)) errors.target_officials = 'Pilihan tujuan menghadap kepada tidak valid';
    else if (target_officials.includes('lainnya') && (!target_official_other || !String(target_official_other).trim())) {
      errors.target_official_other = 'Sebutkan tujuan menghadap yang tidak ada dalam pilihan';
    }
  }
  if (accompanied_by && String(accompanied_by).length > 150) errors.accompanied_by = 'Keterangan pendamping maksimal 150 karakter';

  if (!Array.isArray(members) || members.length === 0) {
    errors.members = 'Minimal satu tamu harus diisi';
  } else {
    members.forEach((m, i) => validateMember(m, i, errors, isScheduled));
  }

  if (Object.keys(errors).length) {
    return res.status(400).json({ error: 'Validasi gagal', fields: errors });
  }

  // Cegah duplikat: NIK yang sama tidak boleh punya pendaftaran aktif di hari yang sama
  for (const member of members) {
    const [dupRows] = await pool.execute(
      `SELECT gm.id FROM guest_members gm
       JOIN guests g ON g.id = gm.guest_id
       WHERE gm.nik = :nik AND g.status NOT IN ('Selesai', 'Ditolak') AND DATE(g.created_at) = CURDATE()`,
      { nik: member.nik }
    );
    if (dupRows.length) {
      return res.status(409).json({ error: `Tamu dengan NIK ${member.nik} sudah memiliki pendaftaran aktif hari ini` });
    }
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [result] = await conn.execute(
      `INSERT INTO guests (registration_number, company, target_officials, target_official_other, purpose, purpose_category, accompanied_by, status, created_by)
       VALUES ('', :company, :target_officials, :target_official_other, :purpose, :purpose_category, :accompanied_by, :status, :created_by)`,
      {
        company: company || '',
        target_officials: hasTargetOfficials ? target_officials.join(',') : '',
        target_official_other: hasTargetOfficials && target_officials.includes('lainnya') ? target_official_other.trim() : null,
        purpose: purpose || '',
        purpose_category: purpose_category || null,
        accompanied_by: accompanied_by && String(accompanied_by).trim() ? String(accompanied_by).trim() : null,
        status: isScheduled ? 'Draft' : 'Menunggu Verifikasi',
        created_by: req.user.sub,
      }
    );

    const guestId = result.insertId;
    const regNumber = `REG-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(guestId).padStart(6, '0')}`;

    await conn.execute('UPDATE guests SET registration_number = :reg WHERE id = :id', { reg: regNumber, id: guestId });

    for (const member of members) {
      await conn.execute(
        `INSERT INTO guest_members (guest_id, full_name, nik, phone_number, position, employee_id, device_status, device_reason, photo, ktp_photo)
         VALUES (:guestId, :full_name, :nik, :phone_number, :position, :employee_id, :device_status, :device_reason, :photo, :ktp_photo)`,
        {
          guestId,
          full_name: member.full_name,
          nik: member.nik,
          phone_number: member.phone_number,
          position: member.position,
          employee_id: member.employee_id || null,
          device_status: member.device_status || null,
          device_reason: member.device_status === 'dibawa_alasan_khusus' ? member.device_reason.trim() : null,
          photo: member.photo || null,
          ktp_photo: member.ktp_photo || null,
        }
      );
    }

    if (vehicle_type || plate_number) {
      await conn.execute(
        'INSERT INTO vehicles (guest_id, vehicle_type, plate_number) VALUES (:guestId, :vehicle_type, :plate_number)',
        { guestId, vehicle_type: vehicle_type || null, plate_number: plate_number || null }
      );
    }

    await conn.execute("INSERT INTO visits (guest_id, status) VALUES (:guestId, 'Belum Check-in')", { guestId });

    await conn.commit();

    await logAudit(req.user.sub, isScheduled ? 'schedule_guest' : 'create_guest', 'guest', guestId, {
      registration_number: regNumber,
      company,
      member_count: members.length,
    });

    // Tamu terjadwal belum masuk antrian verifikasi -- notifikasi Telegram &
    // in-app ditunda sampai kedatangannya dilengkapi lewat POST /:id/complete,
    // supaya verifikator tidak diberi tahu untuk sesuatu yang belum siap.
    if (!isScheduled) {
      notifyNewRegistration({
        registrationNumber: regNumber,
        company,
        targetOfficials: target_officials,
        targetOfficialOther: target_official_other,
        purpose,
        memberCount: members.length,
        memberNames: members.map((m) => m.full_name),
        createdByName: req.user.name,
      }).catch(() => {});
      notifyVerifiers({
        guestId,
        message: `Pendaftaran baru dari ${company} (${regNumber}) menunggu verifikasi Anda.`,
      });
    }

    res.status(201).json({ data: { id: guestId, registration_number: regNumber, member_count: members.length, status: isScheduled ? 'Draft' : 'Menunggu Verifikasi' } });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}));

// PUT /api/guests/:id  (edit data pendaftaran -- bukan status verifikasi)
router.put('/:id', requireRole('admin', 'pos_depan'), asyncHandler(async (req, res) => {
  const { company, target_officials, target_official_other, purpose, purpose_category, accompanied_by, vehicle_type, plate_number } = req.body || {};
  const id = req.params.id;

  const fields = [];
  const params = { id };

  if (company !== undefined) {
    if (!String(company).trim()) return res.status(400).json({ error: 'Perusahaan/instansi wajib diisi' });
    fields.push('company = :company'); params.company = company;
  }
  if (target_officials !== undefined) {
    if (!isValidTargetOfficials(target_officials)) return res.status(400).json({ error: 'Pilih minimal satu tujuan menghadap kepada' });
    if (target_officials.includes('lainnya') && (!target_official_other || !String(target_official_other).trim())) {
      return res.status(400).json({ error: 'Sebutkan tujuan menghadap yang tidak ada dalam pilihan' });
    }
    fields.push('target_officials = :target_officials'); params.target_officials = target_officials.join(',');
    fields.push('target_official_other = :target_official_other');
    params.target_official_other = target_officials.includes('lainnya') ? target_official_other.trim() : null;
  }
  if (purpose_category !== undefined) {
    if (!PURPOSE_CATEGORIES.includes(purpose_category)) return res.status(400).json({ error: 'Kategori keperluan tidak valid' });
    fields.push('purpose_category = :purpose_category'); params.purpose_category = purpose_category;
  }
  if (purpose !== undefined) {
    if (!String(purpose).trim()) return res.status(400).json({ error: 'Detail tujuan menghadap wajib diisi' });
    fields.push('purpose = :purpose'); params.purpose = purpose;
  }
  if (accompanied_by !== undefined) {
    if (accompanied_by && String(accompanied_by).length > 150) {
      return res.status(400).json({ error: 'Keterangan pendamping maksimal 150 karakter' });
    }
    fields.push('accompanied_by = :accompanied_by');
    params.accompanied_by = accompanied_by && String(accompanied_by).trim() ? String(accompanied_by).trim() : null;
  }

  if (fields.length) {
    const [result] = await pool.execute(`UPDATE guests SET ${fields.join(', ')} WHERE id = :id`, params);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Pendaftaran tidak ditemukan' });
  }

  if (vehicle_type !== undefined || plate_number !== undefined) {
    const [existing] = await pool.execute('SELECT id FROM vehicles WHERE guest_id = :id', { id });
    if (existing[0]) {
      await pool.execute(
        'UPDATE vehicles SET vehicle_type = :vehicle_type, plate_number = :plate_number WHERE guest_id = :id',
        { vehicle_type: vehicle_type || null, plate_number: plate_number || null, id }
      );
    } else {
      await pool.execute(
        'INSERT INTO vehicles (guest_id, vehicle_type, plate_number) VALUES (:id, :vehicle_type, :plate_number)',
        { id, vehicle_type: vehicle_type || null, plate_number: plate_number || null }
      );
    }
  }

  await logAudit(req.user.sub, 'update_guest', 'guest', id, req.body);
  res.json({ data: { id: Number(id) } });
}));

// PUT /api/guests/:id/members/:memberId  (edit data satu tamu dalam pendaftaran)
router.put('/:id/members/:memberId', requireRole('admin', 'pos_depan', 'verifikator'), asyncHandler(async (req, res) => {
  const { id, memberId } = req.params;
  const {
    full_name, phone_number, position, employee_id, device_status, device_reason, photo, ktp_photo,
    affiliation, social_media, address, other_names, analysis_notes, security_category,
  } = req.body || {};

  const touchesIdentity = [full_name, phone_number, position, employee_id, device_status, device_reason].some((v) => v !== undefined);
  const touchesAnalysis = [affiliation, social_media, address, other_names, analysis_notes, security_category].some((v) => v !== undefined);

  if (touchesIdentity && !['admin', 'pos_depan'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Hanya Administrator atau Pos Depan yang dapat mengubah data identitas tamu' });
  }
  if (touchesAnalysis && !['admin', 'verifikator'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Hanya Administrator atau Verifikator yang dapat mengisi hasil analisa' });
  }

  const [memberRows] = await pool.execute(
    `SELECT gm.id, g.status AS guest_status FROM guest_members gm
     JOIN guests g ON g.id = gm.guest_id
     WHERE gm.id = :memberId AND gm.guest_id = :id`,
    { memberId, id }
  );
  if (!memberRows[0]) return res.status(404).json({ error: 'Tamu tidak ditemukan pada pendaftaran ini' });

  const fields = [];
  const params = { memberId };

  if (full_name !== undefined) { fields.push('full_name = :full_name'); params.full_name = full_name; }
  if (other_names !== undefined) {
    if (String(other_names).length > 255) return res.status(400).json({ error: 'Nama lainnya maksimal 255 karakter' });
    fields.push('other_names = :other_names'); params.other_names = other_names || null;
  }
  if (phone_number !== undefined) {
    if (!isValidPhone(phone_number)) return res.status(400).json({ error: 'Format nomor HP tidak valid' });
    fields.push('phone_number = :phone_number'); params.phone_number = phone_number;
  }
  if (position !== undefined) { fields.push('position = :position'); params.position = position; }
  if (employee_id !== undefined) { fields.push('employee_id = :employee_id'); params.employee_id = employee_id || null; }
  if (affiliation !== undefined) {
    if (String(affiliation).length > 200) return res.status(400).json({ error: 'Afiliasi maksimal 200 karakter' });
    fields.push('affiliation = :affiliation'); params.affiliation = affiliation || null;
  }
  if (social_media !== undefined) {
    if (String(social_media).length > 255) return res.status(400).json({ error: 'Media sosial maksimal 255 karakter' });
    fields.push('social_media = :social_media'); params.social_media = social_media || null;
  }
  if (address !== undefined) {
    if (String(address).length > 255) return res.status(400).json({ error: 'Alamat rumah maksimal 255 karakter' });
    fields.push('address = :address'); params.address = address || null;
  }
  if (analysis_notes !== undefined) {
    if (String(analysis_notes).length > 2000) return res.status(400).json({ error: 'Hasil analisa maksimal 2000 karakter' });
    fields.push('analysis_notes = :analysis_notes'); params.analysis_notes = analysis_notes || null;
  }
  if (security_category !== undefined) {
    if (security_category !== null && security_category !== '' && !VALID_SECURITY_CATEGORIES.includes(security_category)) {
      return res.status(400).json({ error: 'Kategori tamu tidak valid' });
    }
    fields.push('security_category = :security_category');
    params.security_category = security_category || null;
  }
  if (device_status !== undefined) {
    if (!VALID_DEVICE_STATUSES.includes(device_status)) {
      return res.status(400).json({ error: 'Pilih status perangkat elektronik' });
    }
    if (device_status === 'dibawa_alasan_khusus' && !isValidDeviceReason(device_reason)) {
      return res.status(400).json({ error: 'Alasan wajib diisi, minimal 20 dan maksimal 500 karakter' });
    }
    fields.push('device_status = :device_status'); params.device_status = device_status;
    fields.push('device_reason = :device_reason');
    params.device_reason = device_status === 'dibawa_alasan_khusus' ? device_reason.trim() : null;
  }

  if (photo !== undefined || ktp_photo !== undefined) {
    // Pos Depan boleh mengisi/mengganti foto SELAMA pendaftarannya masih
    // berstatus Draft (tamu terjadwal yang belum lengkap datanya) -- di luar
    // itu (sudah masuk antrian verifikasi atau lebih lanjut), tetap hanya
    // Administrator yang boleh mengubah/menghapus foto tamu.
    const canEditPhotoAsPosDepan = req.user.role === 'pos_depan' && memberRows[0].guest_status === 'Draft';
    if (req.user.role !== 'admin' && !canEditPhotoAsPosDepan) {
      return res.status(403).json({ error: 'Hanya Administrator yang dapat mengubah atau menghapus foto tamu' });
    }
    if (photo !== undefined) {
      if (!isValidPhotoDataUrl(photo)) return res.status(400).json({ error: 'Foto tidak valid atau ukurannya terlalu besar (maks 3MB)' });
      fields.push('photo = :photo'); params.photo = photo || null;
    }
    if (ktp_photo !== undefined) {
      if (!isValidPhotoDataUrl(ktp_photo)) return res.status(400).json({ error: 'Foto KTP tidak valid atau ukurannya terlalu besar (maks 3MB)' });
      fields.push('ktp_photo = :ktp_photo'); params.ktp_photo = ktp_photo || null;
    }
  }

  if (fields.length) {
    await pool.execute(`UPDATE guest_members SET ${fields.join(', ')} WHERE id = :memberId`, params);
  }

  const auditDetail = { ...req.body };
  if (auditDetail.photo !== undefined) auditDetail.photo = auditDetail.photo ? '[foto diperbarui]' : '[foto dihapus]';
  if (auditDetail.ktp_photo !== undefined) auditDetail.ktp_photo = auditDetail.ktp_photo ? '[foto KTP diperbarui]' : '[foto KTP dihapus]';
  await logAudit(req.user.sub, 'update_guest', 'guest_member', memberId, auditDetail);

  res.json({ data: { id: Number(memberId) } });
}));

// DELETE /api/guests/:id/members/:memberId  (hapus data satu tamu -- dipakai
// dari Bank Data untuk menghapus catatan kunjungan seorang personel secara
// individual, tanpa ikut menghapus tamu lain dalam pendaftaran yang sama.
// Kalau tamu yang dihapus adalah satu-satunya anggota pendaftaran tersebut,
// pendaftarannya (guests) ikut dihapus sekalian lewat cascade FK supaya
// tidak menyisakan pendaftaran kosong tanpa tamu.)
router.delete('/:id/members/:memberId', requireRole('admin'), asyncHandler(async (req, res) => {
  const { id, memberId } = req.params;

  const [memberRows] = await pool.execute(
    'SELECT id, full_name FROM guest_members WHERE id = :memberId AND guest_id = :id',
    { memberId, id }
  );
  if (!memberRows[0]) return res.status(404).json({ error: 'Tamu tidak ditemukan pada pendaftaran ini' });

  await pool.execute('DELETE FROM guest_members WHERE id = :memberId', { memberId });

  const [countRows] = await pool.execute('SELECT COUNT(*) AS remaining FROM guest_members WHERE guest_id = :id', { id });
  let registrationDeleted = false;
  if (countRows[0].remaining === 0) {
    await pool.execute('DELETE FROM guests WHERE id = :id', { id });
    registrationDeleted = true;
  }

  await logAudit(req.user.sub, 'delete_guest_member', 'guest_member', memberId, {
    full_name: memberRows[0].full_name,
    guest_id: Number(id),
    registration_deleted: registrationDeleted,
  });

  res.json({ data: { id: Number(memberId), registration_deleted: registrationDeleted } });
}));

// POST /api/guests/:id/complete  (menyelesaikan tamu TERJADWAL -- setelah
// Foto Tamu & deklarasi Perangkat Elektronik seluruh anggota dilengkapi lewat
// PUT .../members/:memberId, endpoint ini memindahkan status dari "Draft" ke
// "Menunggu Verifikasi". Notifikasi Telegram & verifikator baru dikirim di
// sini -- sebelumnya belum ada yang benar-benar perlu diverifikasi.)
router.post('/:id/complete', requireRole('admin', 'pos_depan'), asyncHandler(async (req, res) => {
  const id = req.params.id;

  const [guestRows] = await pool.execute(
    `SELECT g.status, g.company, g.registration_number, g.target_officials, g.target_official_other,
            g.purpose, g.purpose_category, g.created_by,
            u.full_name AS created_by_name
     FROM guests g LEFT JOIN users u ON u.id = g.created_by
     WHERE g.id = :id`,
    { id }
  );
  const guest = guestRows[0];
  if (!guest) return res.status(404).json({ error: 'Pendaftaran tidak ditemukan' });
  if (guest.status !== 'Draft') {
    return res.status(409).json({ error: 'Pendaftaran ini bukan tamu terjadwal yang belum lengkap' });
  }

  const [members] = await pool.execute(
    'SELECT id, full_name, photo, device_status, device_reason FROM guest_members WHERE guest_id = :id',
    { id }
  );

  const errors = {};

  // Perusahaan/Tujuan Menghadap/Kategori Keperluan/Detail Tujuan boleh
  // ditunda saat pendaftaran awal (lihat POST /) tapi wajib lengkap sebelum
  // bisa diajukan ke antrian verifikasi -- dilengkapi lewat PUT /:id.
  if (!guest.company || !guest.company.trim()) errors.company = 'Perusahaan/instansi wajib diisi';
  const officials = guest.target_officials ? guest.target_officials.split(',').filter(Boolean) : [];
  if (!officials.length) {
    errors.target_officials = 'Pilih minimal satu tujuan menghadap kepada';
  } else if (officials.includes('lainnya') && (!guest.target_official_other || !guest.target_official_other.trim())) {
    errors.target_official_other = 'Sebutkan tujuan menghadap yang tidak ada dalam pilihan';
  }
  if (!guest.purpose_category || !PURPOSE_CATEGORIES.includes(guest.purpose_category)) {
    errors.purpose_category = 'Pilih kategori keperluan';
  }
  if (!guest.purpose || !guest.purpose.trim()) errors.purpose = 'Detail tujuan menghadap wajib diisi';

  members.forEach((m, i) => {
    if (!m.photo) errors[`members[${i}].photo`] = `Foto tamu "${m.full_name}" wajib diisi`;
    if (!VALID_DEVICE_STATUSES.includes(m.device_status)) {
      errors[`members[${i}].device_status`] = `Kebijakan perangkat elektronik untuk "${m.full_name}" belum dipilih`;
    } else if (m.device_status === 'dibawa_alasan_khusus' && !isValidDeviceReason(m.device_reason)) {
      errors[`members[${i}].device_reason`] = `Alasan membawa perangkat untuk "${m.full_name}" wajib diisi`;
    }
  });
  if (Object.keys(errors).length) {
    return res.status(400).json({ error: 'Lengkapi data yang masih kurang sebelum mengajukan verifikasi', fields: errors });
  }

  await pool.execute("UPDATE guests SET status = 'Menunggu Verifikasi' WHERE id = :id", { id });
  await logAudit(req.user.sub, 'complete_guest_schedule', 'guest', id, { registration_number: guest.registration_number });

  notifyNewRegistration({
    registrationNumber: guest.registration_number,
    company: guest.company,
    targetOfficials: guest.target_officials ? guest.target_officials.split(',') : [],
    targetOfficialOther: guest.target_official_other,
    purpose: guest.purpose,
    memberCount: members.length,
    memberNames: members.map((m) => m.full_name),
    createdByName: guest.created_by_name || '-',
  }).catch(() => {});
  notifyVerifiers({
    guestId: Number(id),
    message: `Pendaftaran tamu terjadwal dari ${guest.company} (${guest.registration_number}) sudah lengkap dan menunggu verifikasi Anda.`,
  });

  res.json({ data: { id: Number(id), status: 'Menunggu Verifikasi' } });
}));

// POST /api/guests/:id/verify  (Verifikator menyetujui/menolak seluruh pendaftaran)
router.post('/:id/verify', requireRole('admin', 'verifikator'), asyncHandler(async (req, res) => {
  const { status, note, accompanied_by } = req.body || {};
  const id = req.params.id;

  if (!['Disetujui', 'Ditolak'].includes(status)) {
    return res.status(400).json({ error: 'Status verifikasi harus "Disetujui" atau "Ditolak"' });
  }
  if (accompanied_by && String(accompanied_by).length > 150) {
    return res.status(400).json({ error: 'Keterangan pendamping maksimal 150 karakter' });
  }

  const [rows] = await pool.execute('SELECT status, company, registration_number, created_by FROM guests WHERE id = :id', { id });
  if (!rows[0]) return res.status(404).json({ error: 'Pendaftaran tidak ditemukan' });
  if (rows[0].status !== 'Menunggu Verifikasi') {
    return res.status(409).json({ error: 'Pendaftaran ini tidak sedang menunggu verifikasi' });
  }

  if (accompanied_by !== undefined) {
    await pool.execute('UPDATE guests SET status = :status, accompanied_by = :accompanied_by WHERE id = :id', {
      status,
      id,
      accompanied_by: String(accompanied_by).trim() ? String(accompanied_by).trim() : null,
    });
  } else {
    await pool.execute('UPDATE guests SET status = :status WHERE id = :id', { status, id });
  }
  await logAudit(req.user.sub, 'verify_guest', 'guest', id, { status, note: note || null, accompanied_by: accompanied_by || null });
  notifyGuestCreator({
    userId: rows[0].created_by,
    guestId: Number(id),
    message: `Pendaftaran ${rows[0].company} (${rows[0].registration_number}) telah ${status.toLowerCase()} oleh Verifikator.`,
  });

  res.json({ data: { id: Number(id), status } });
}));

// DELETE /api/guests/:id
router.delete('/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  await pool.execute('DELETE FROM guests WHERE id = :id', { id: req.params.id });
  await logAudit(req.user.sub, 'delete_guest', 'guest', req.params.id, null);
  res.status(204).send();
}));

// POST /api/guests/:id/check-in  (seluruh pendaftaran check-in bersamaan, hanya jika sudah Disetujui)
router.post('/:id/check-in', requireRole('admin', 'pos_depan'), asyncHandler(async (req, res) => {
  const id = req.params.id;

  const [guestRows] = await pool.execute('SELECT status FROM guests WHERE id = :id', { id });
  if (!guestRows[0]) return res.status(404).json({ error: 'Pendaftaran tidak ditemukan' });
  if (guestRows[0].status !== 'Disetujui') {
    return res.status(409).json({ error: 'Pendaftaran belum disetujui oleh verifikator' });
  }

  const [rows] = await pool.execute('SELECT status FROM visits WHERE guest_id = :id', { id });
  if (!rows[0]) return res.status(404).json({ error: 'Data kunjungan tidak ditemukan' });
  if (rows[0].status !== 'Belum Check-in') {
    return res.status(409).json({ error: 'Pendaftaran ini sudah check-in sebelumnya' });
  }

  await pool.execute("UPDATE visits SET check_in_at = NOW(), status = 'Sedang Berkunjung' WHERE guest_id = :id", { id });
  await pool.execute("UPDATE guests SET status = 'Sedang Berkunjung' WHERE id = :id", { id });
  await logAudit(req.user.sub, 'check_in', 'guest', id, null);

  res.json({ data: { id: Number(id), status: 'Sedang Berkunjung' } });
}));

// POST /api/guests/:id/check-out
router.post('/:id/check-out', requireRole('admin', 'pos_depan'), asyncHandler(async (req, res) => {
  const id = req.params.id;
  const [rows] = await pool.execute('SELECT status FROM visits WHERE guest_id = :id', { id });
  if (!rows[0]) return res.status(404).json({ error: 'Data kunjungan tidak ditemukan' });
  if (rows[0].status !== 'Sedang Berkunjung') {
    return res.status(409).json({ error: 'Pendaftaran ini belum check-in' });
  }

  await pool.execute("UPDATE visits SET check_out_at = NOW(), status = 'Selesai' WHERE guest_id = :id", { id });
  await pool.execute("UPDATE guests SET status = 'Selesai' WHERE id = :id", { id });
  await logAudit(req.user.sub, 'check_out', 'guest', id, null);

  res.json({ data: { id: Number(id), status: 'Selesai' } });
}));

// POST /api/guests/:id/re-check-in  (tamu yang sudah check-out balik lagi ke
// area PUSSIBERAL untuk urusan singkat -- misal tertinggal dokumen -- tanpa
// perlu mendaftar ulang dari nol. Wajib menyertakan alasan; alasan terakhir
// disimpan & ditampilkan di Detail Tamu, jejak lengkapnya ada di Log Aktivitas.)
router.post('/:id/re-check-in', requireRole('admin', 'pos_depan'), asyncHandler(async (req, res) => {
  const id = req.params.id;
  const { reason } = req.body || {};

  if (!reason || !String(reason).trim()) {
    return res.status(400).json({ error: 'Alasan check-in ulang wajib diisi' });
  }
  if (String(reason).length > 255) {
    return res.status(400).json({ error: 'Alasan check-in ulang maksimal 255 karakter' });
  }

  const [rows] = await pool.execute('SELECT status FROM visits WHERE guest_id = :id', { id });
  if (!rows[0]) return res.status(404).json({ error: 'Data kunjungan tidak ditemukan' });
  if (rows[0].status !== 'Selesai') {
    return res.status(409).json({ error: 'Check-in ulang hanya berlaku untuk tamu yang sudah check-out' });
  }

  const trimmedReason = String(reason).trim();
  await pool.execute(
    `UPDATE visits SET status = 'Sedang Berkunjung', check_in_at = NOW(), check_out_at = NULL,
            re_entry_reason = :reason, re_entry_at = NOW()
     WHERE guest_id = :id`,
    { id, reason: trimmedReason }
  );
  await pool.execute("UPDATE guests SET status = 'Sedang Berkunjung' WHERE id = :id", { id });
  await logAudit(req.user.sub, 're_check_in', 'guest', id, { reason: trimmedReason });

  res.json({ data: { id: Number(id), status: 'Sedang Berkunjung' } });
}));

module.exports = router;
