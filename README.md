# YT Scraper APK (Capacitor, build lewat GitHub Actions)

Package: com.nyr.ytscraper (JANGAN diubah setelah APK dibagikan)

## Isi repo
- www/                              : aplikasi web (index.html, css/, js/)
- package.json                      : dependency Capacitor
- capacitor.config.json             : nama app, package, folder web
- .github/workflows/build-apk.yml   : workflow build APK

Folder android/ dibuat otomatis oleh workflow, tidak perlu di-upload.
Proxy tidak dipakai: request dikirim langsung oleh Android (CapacitorHttp).
"Offline" = tanpa server/hosting. Mengambil data YouTube tetap butuh internet.

## Langkah pertama (SEKALI)

1. Buat keystore di Termux:
   pkg update
   pkg install openjdk-17
   keytool -genkeypair -v -keystore nyr-release.jks -alias nyrkey -keyalg RSA -keysize 2048 -validity 10000
   base64 -w0 nyr-release.jks > keystore-base64.txt
   (Saat ditanya password key, tekan Enter agar sama dengan password keystore.)
   Cadangkan nyr-release.jks di luar HP. Hapus keystore-base64.txt setelah diisi ke Secrets.

2. Buat 1 repo GitHub PRIVAT (misal: youtube-scraper) lalu upload SEMUA isi folder ini,
   termasuk folder tersembunyi .github.

3. Repo > Settings > Secrets and variables > Actions, isi:

   Key: KEYSTORE_BASE64
   Value: (isi keystore-base64.txt)

   Key: KEYSTORE_PASSWORD
   Value: (password keystore)

   Key: KEY_ALIAS
   Value: nyrkey

   Key: KEY_PASSWORD
   Value: (sama dengan password keystore)

4. Actions > Build APK > Run workflow. Unduh APK dari Artifact.
5. Catat sidik jari SHA-256 di Summary. Build berikutnya harus sama.

## Revisi berikutnya
Ganti file yang berubah di repo yang SAMA (biasanya di folder www/), commit,
lalu jalankan workflow lagi. Jangan bikin repo baru dan jangan bikin keystore baru.
