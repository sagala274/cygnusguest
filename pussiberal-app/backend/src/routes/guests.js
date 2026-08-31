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

function validateMember(member, index, errors) {
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
  if (!member.photo) errors[`${prefix}.photo`] = 'Foto tamu wajib diisi';
  else if (!isValidPhotoDataUrl(member.photo)) errors[`${prefix}.photo`] = 'Foto tidak valid atau ukurannya terlalu besar (maks 3MB)';
  if (member.ktp_photo && !isValidPhotoDataUrl(member.ktp_photo)) errors[`${prefix}.ktp_photo`] = 'Foto KTP tidak valid atau ukurannya terlalu besar (maks 3MB)';

  if (!VALID_DEVICE_STATUSES.includes(member.device_status)) {
    errors[`${prefix}.device_status`] = 'Pilih status perangkat elektronik';
  } else if (member.device_status === 'dibawa_alasan_khusus' && !isValidDeviceReason(member.device_reason)) {
    errors[`${prefix}.device_reason`] = 'Alasan wajib diisi, minimal 20 dan maksimal 500 karakter';
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
    `SELECT g.*, v.vehicle_type, v.plate_number, vi.check_in_at, vi.check_out_at, vi.status AS visit_status
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
      created_at: g.created_at,
      members: memberRows.map((m) => formatMember(m, req.user.role)),
    },
  });
}));

// POST /api/guests  (Pos Depan mendaftarkan 1+ tamu dari perusahaan yang sama -> masuk antrian verifikasi)
router.post('/', requireRole('admin', 'pos_depan'), asyncHandler(async (req, res) => {
  const { company, target_officials, target_official_other, purpose, purpose_category, accompanied_by, vehicle_type, plate_number, members } = req.body || {};

  const errors = {};
  if (!company || !String(company).trim()) errors.company = 'Perusahaan/instansi wajib diisi';
  if (!isValidTargetOfficials(target_officials)) errors.target_officials = 'Pilih minimal satu tujuan menghadap kepada';
  else if (target_officials.includes('lainnya') && (!target_official_other || !String(target_official_other).trim())) {
    errors.target_official_other = 'Sebutkan tujuan menghadap yang tidak ada dalam pilihan';
  }
  if (!purpose_category || !PURPOSE_CATEGORIES.includes(purpose_category)) errors.purpose_category = 'Pilih kategori keperluan';
  if (!purpose || !String(purpose).trim()) errors.purpose = 'Detail tujuan menghadap wajib diisi';
  if (accompanied_by && String(accompanied_by).length > 150) errors.accompanied_by = 'Keterangan pendamping maksimal 150 karakter';

  if (!Array.isArray(members) || members.length === 0) {
    errors.members = 'Minimal satu tamu harus diisi';
  } else {
    members.forEach((m, i) => validateMember(m, i, errors));
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
       VALUES ('', :company, :target_officials, :target_official_other, :purpose, :purpose_category, :accompanied_by, 'Menunggu Verifikasi', :created_by)`,
      {
        company,
        target_officials: target_officials.join(','),
        target_official_other: target_officials.includes('lainnya') ? target_official_other.trim() : null,
        purpose,
        purpose_category,
        accompanied_by: accompanied_by && String(accompanied_by).trim() ? String(accompanied_by).trim() : null,
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
          device_status: member.device_status,
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

    await logAudit(req.user.sub, 'create_guest', 'guest', guestId, {
      registration_number: regNumber,
      company,
      member_count: members.length,
    });
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

    res.status(201).json({ data: { id: guestId, registration_number: regNumber, member_count: members.length } });
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

  const [memberRows] = await pool.execute('SELECT id FROM guest_members WHERE id = :memberId AND guest_id = :id', { memberId, id });
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
    if (req.user.role !== 'admin') {
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

  const [rows] = await pool.execute('SELECT status FROM guests WHERE id = :id', { id });
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

module.exports = router;
