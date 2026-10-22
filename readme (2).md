# Latihan CBT OMN

Aplikasi latihan ujian berbasis komputer (CBT) sederhana untuk siswa SD berlatih Olimpiade Matematika Nasional.

## 🚀 Panduan Deploy (Langkah demi Klik)

### 1. Supabase (Database)
1. Buka [supabase.com](https://supabase.com), login, dan **New Project**.
2. Tunggu proyek siap, buka menu **SQL Editor** di sidebar kiri.
3. Klik **New Query**, salin SELURUH isi file `supabase/schema.sql`, lalu klik **Run**.
4. (Nanti di Tahap 2) Jalankan juga file seed soal di SQL Editor.
5. Buka **Project Settings** (ikon gear) > **API**.
6. Salin **Project URL** dan **anon public** key.

### 2. Lokal (Pengembangan)
1. Pastikan Node.js terinstal. Buka terminal.
2. Jalankan: `npm install`
3. Buat file `.env` (salin dari `.env.example`), isi dengan URL dan anon key dari Supabase.
4. Jalankan: `npm run dev`
5. Buka `http://localhost:3000` di browser.

### 3. GitHub (Version Control)
1. Buat repository baru di GitHub (misal: `latihan-cbt-omn`).
2. Di terminal lokal, jalankan:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/USERNAME/latihan-cbt-omn.git
   git push -u origin main