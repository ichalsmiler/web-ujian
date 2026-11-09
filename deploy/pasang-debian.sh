#!/usr/bin/env bash
# Memasang (atau memperbarui) Web Ujian di server Debian 12/13 dengan nginx.
#
# Pemakaian (sebagai root atau dengan sudo):
#   curl -fsSL https://raw.githubusercontent.com/ichalsmiler/web-ujian/main/deploy/pasang-debian.sh | sudo bash
#
# Pengaturan lewat variabel lingkungan (opsional), mis.:
#   curl -fsSL …/pasang-debian.sh | sudo NAMA_SERVER=ujian.sekolah.sch.id PORT=8080 bash
#
#   NAMA_SERVER  nama domain/IP untuk nginx          (bawaan: _ = semua nama)
#   PORT         port HTTP                           (bawaan: 80)
#   CABANG       cabang git yang dipasang            (bawaan: main)
#   KATA_SANDI   1 = minta username & password saat membuka halaman (bawaan: 0)
#
# Menjalankan ulang script ini = memperbarui ke versi terbaru di GitHub.
# Aplikasi hanya berupa satu halaman statis: semua file jadwal dan data siswa diproses
# di browser pengguna dan TIDAK pernah dikirim atau disimpan di server.

set -euo pipefail

REPO="${REPO:-https://github.com/ichalsmiler/web-ujian.git}"
CABANG="${CABANG:-main}"
NAMA_SERVER="${NAMA_SERVER:-_}"
PORT="${PORT:-80}"
KATA_SANDI="${KATA_SANDI:-0}"
FOLDER_KODE=/opt/web-ujian
FOLDER_WEB=/var/www/web-ujian
NODE_MINIMAL=22

info() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }
gagal() { printf '\n\033[1;31mGagal: %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || gagal "jalankan sebagai root, mis. dengan sudo."
command -v apt-get >/dev/null || gagal "script ini untuk Debian/Ubuntu (apt-get tidak ditemukan)."

export DEBIAN_FRONTEND=noninteractive

info "Memasang paket dasar (git, nginx, curl)"
apt-get update -qq
apt-get install -y -qq git nginx curl ca-certificates gnupg >/dev/null

versi_node() { command -v node >/dev/null && node -p 'process.versions.node.split(".")[0]' || echo 0; }
if [ "$(versi_node)" -lt "$NODE_MINIMAL" ]; then
  info "Memasang Node.js 24 LTS dari NodeSource (dibutuhkan untuk build)"
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi
echo "Node.js $(node --version), npm $(npm --version)"

if [ -d "$FOLDER_KODE/.git" ]; then
  info "Mengambil versi terbaru dari GitHub ($CABANG)"
  git -C "$FOLDER_KODE" fetch --quiet origin "$CABANG"
  git -C "$FOLDER_KODE" checkout --quiet "$CABANG"
  git -C "$FOLDER_KODE" reset --quiet --hard "origin/$CABANG"
else
  info "Mengunduh kode dari $REPO"
  git clone --quiet --branch "$CABANG" "$REPO" "$FOLDER_KODE"
fi
echo "Versi: $(git -C "$FOLDER_KODE" log -1 --format='%h %s')"

info "Build aplikasi"
cd "$FOLDER_KODE"
npm ci --no-audit --no-fund --loglevel=error
npm run build --silent
[ -s dist/index.html ] || gagal "build tidak menghasilkan dist/index.html."

info "Menyalin ke $FOLDER_WEB"
install -d -m 755 "$FOLDER_WEB"
install -m 644 dist/index.html "$FOLDER_WEB/index.html"

AUTH=""
if [ "$KATA_SANDI" = "1" ]; then
  apt-get install -y -qq apache2-utils >/dev/null
  if [ ! -s /etc/nginx/web-ujian.htpasswd ]; then
    info "Membuat akun untuk membuka halaman"
    read -rp "Username: " PENGGUNA </dev/tty
    htpasswd -c /etc/nginx/web-ujian.htpasswd "$PENGGUNA" </dev/tty
    chmod 640 /etc/nginx/web-ujian.htpasswd
    chown root:www-data /etc/nginx/web-ujian.htpasswd
  fi
  AUTH='    auth_basic "Web Ujian";
    auth_basic_user_file /etc/nginx/web-ujian.htpasswd;'
fi

info "Mengatur nginx (port $PORT, nama server $NAMA_SERVER)"
cat >/etc/nginx/sites-available/web-ujian <<EOF
server {
    listen $PORT;
    listen [::]:$PORT;
    server_name $NAMA_SERVER;

    root $FOLDER_WEB;
    index index.html;
$AUTH

    # Selalu ambil versi terbaru setelah diperbarui
    add_header Cache-Control "no-cache" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header Referrer-Policy "no-referrer" always;

    location / {
        try_files \$uri /index.html;
    }

    gzip on;
    gzip_types text/html;
}
EOF
ln -sf /etc/nginx/sites-available/web-ujian /etc/nginx/sites-enabled/web-ujian
if [ "$PORT" = "80" ] && [ -e /etc/nginx/sites-enabled/default ]; then
  rm -f /etc/nginx/sites-enabled/default  # situs bawaan nginx juga memakai port 80
fi
nginx -t
systemctl enable --now nginx >/dev/null 2>&1 || true
systemctl reload nginx

if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then
  ufw allow "$PORT/tcp" >/dev/null && echo "Firewall (ufw): port $PORT dibuka."
fi

ALAMAT=$(hostname -I 2>/dev/null | awk '{print $1}')
[ "$PORT" = "80" ] && SUFIKS="" || SUFIKS=":$PORT"
info "Selesai. Buka di browser: http://${ALAMAT:-<ip-server>}${SUFIKS}/"
echo "Untuk memperbarui nanti, jalankan perintah pemasangan yang sama sekali lagi."
