# cygnusguest

Aplikasi Pendaftaran Tamu PUSSIBERAL — sistem pencatatan, verifikasi, dan pengelolaan
kunjungan tamu, dengan RBAC (Administrator/Verifikator/Pos Depan), bank data personel,
dan laporan.

## Struktur

- `pussiberal-app/` — source code aplikasi (backend Express + MySQL, frontend, Docker Compose)
- `01_requirements_*.md`, `02_arsitektur_*.md`, `03_phase_*.md` — dokumen requirement, arsitektur, dan fase pengerjaan
- `04_dokumentasi_teknis_dan_keamanan.md` — dokumentasi teknis & hasil hardening keamanan

## Menjalankan secara lokal

```
cd pussiberal-app
cp .env.example .env   # isi dengan nilai rahasia Anda sendiri
docker compose up -d --build
```

Lihat `04_dokumentasi_teknis_dan_keamanan.md` untuk detail arsitektur, skema database, dan RBAC.
