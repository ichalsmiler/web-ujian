# Web Ujian — Konverter Jadwal & User

Aplikasi web satu halaman untuk menyiapkan file upload ujian:

- **Jadwal → Mapel**: jadwal ujian (.xlsx) menjadi daftar mapel (`category`, `format`, `shortname`, `fullname`).
- **User → CBTAdmin**: file `DATA PESERTA NO UJIAN` menjadi template upload user CBTAdmin (.xlsx / .csv).
- **Kelas Moving**: daftar hadir kelas moving (mapel pilihan kelas XI dan XII) dicocokkan ke peserta lewat nama.
- **User → Moodle**: file upload user Moodle (format `USER MOODLE.csv`) lengkap dengan mapel wajib dan mapel moving.
- **Kamus Mapel**: daftar kode mapel dan nama-nama yang dipakai di jadwal.

Semua file diproses **di browser**. Data siswa tidak dikirim ke server mana pun, dan yang disimpan
di browser hanya kamus mapel serta pilihan pencocokan.

## Pasang di server Debian

Di server Debian 12/13 (sebagai root atau pengguna dengan `sudo`):

```bash
curl -fsSL https://raw.githubusercontent.com/ichalsmiler/web-ujian/main/deploy/pasang-debian.sh | sudo bash
```

Script ini memasang git, nginx, dan Node.js 24 (hanya untuk build), mengambil kode dari GitHub,
melakukan build, lalu menyajikan halaman lewat nginx di port 80. Setelah selesai, alamatnya
ditampilkan, mis. `http://192.168.1.10/`.

Pengaturan tambahan (boleh digabung):

```bash
# Port lain, mis. 8080 (situs lain di port 80 tidak terganggu)
curl -fsSL https://raw.githubusercontent.com/ichalsmiler/web-ujian/main/deploy/pasang-debian.sh | sudo PORT=8080 bash

# Nama domain
curl -fsSL https://raw.githubusercontent.com/ichalsmiler/web-ujian/main/deploy/pasang-debian.sh | sudo NAMA_SERVER=ujian.sekolah.sch.id bash

# Minta username & password saat halaman dibuka
curl -fsSL https://raw.githubusercontent.com/ichalsmiler/web-ujian/main/deploy/pasang-debian.sh | sudo KATA_SANDI=1 bash
```

**Memperbarui**: jalankan perintah pemasangan yang sama sekali lagi. Script akan mengambil versi
terbaru dari GitHub, build ulang, dan mengganti halaman.

Lokasi file di server: kode di `/opt/web-ujian`, halaman di `/var/www/web-ujian/index.html`,
pengaturan nginx di `/etc/nginx/sites-available/web-ujian`.

## Pakai tanpa server

Jalankan `npm ci` lalu `npm run build`, kemudian buka `dist/index.html` dengan klik dua kali.
File itu bisa disalin ke komputer lain dan tetap jalan tanpa internet.

## Pengembangan

```bash
npm ci
npm run dev      # server pengembangan
npm test         # tes unit
npm run build    # cek tipe + build ke dist/index.html
```

Butuh Node.js 22 atau lebih baru.

## Data siswa

**Jangan commit file data sekolah** (daftar peserta, password, daftar hadir moving, jadwal asli).
`.gitignore` sudah mengecualikan semua `.xlsx`, `.xls`, `.csv`, dan `.pdf` kecuali fixture palsu di
`tests/fixtures/` dan template di `src/assets/`. Data contoh di tes hanya memakai nama karangan dan
nomor ujian palsu berawalan `91-`, `92-`, atau `93-`.
