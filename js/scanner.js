/**
 * ==============================================================================
 * MARCH FOR VICTORY - SCANNER ENGINE (v4 - Alarm Sync & Camera Lock)
 * Developer    : Luthfin Ramadhani Tuadingo
 * File : js/scanner.js
 * ==============================================================================
 */

const video = document.getElementById('video'); const canvas = document.getElementById('canvas'); const canvasContext = canvas.getContext('2d');
const resultDiv = document.getElementById('result'); const errorDiv = document.getElementById('error'); const statusDiv = document.getElementById('status');
const toggleBtn = document.getElementById('toggleScan'); const logoBox = document.getElementById('logoBox');

let stream = null; let scanningEnabled = false; let lastSentData = null; let lastSentTime = 0; const cooldownPeriod = 3000;

const DEFAULT_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxJGU8YPqreBWTFWKFr4l0p_BGrodkH_DIWX4Wooc3CIsjVbm7GNhV-g5bcwgPVEhas/exec";
function getAppScriptUrl() { const savedUrl = localStorage.getItem('mb_setting_script'); return savedUrl && savedUrl.trim() !== '' ? savedUrl : DEFAULT_SCRIPT_URL; }

function getFormattedLocalDateTime() {
    const d = new Date(); const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function playAudioFeedback(type) {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
        osc.connect(gain); gain.connect(audioCtx.destination);
        const now = audioCtx.currentTime;
        if (type === 'success') { osc.frequency.setValueAtTime(880, now); gain.gain.setValueAtTime(0.1, now); osc.start(now); osc.stop(now + 0.15); }
        else if (type === 'late') { osc.frequency.setValueAtTime(400, now); gain.gain.setValueAtTime(0.1, now); osc.start(now); osc.stop(now + 0.3); }
        else { osc.type = 'sawtooth'; osc.frequency.setValueAtTime(200, now); gain.gain.setValueAtTime(0.1, now); osc.start(now); osc.stop(now + 0.4); }
    } catch (e) { console.error("Audio Error:", e); }
}

function tick() {
    if (video.readyState === video.HAVE_ENOUGH_DATA && scanningEnabled && stream) {
        canvas.height = video.videoHeight; canvas.width = video.videoWidth;
        canvasContext.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imgData = canvasContext.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imgData.data, imgData.width, imgData.height);

        if (code) {
            try {
                const parsed = JSON.parse(code.data);
                if (parsed.Id && parsed.Nama) {
                    const now = Date.now();
                    if (lastSentData !== code.data || (now - lastSentTime) >= cooldownPeriod) {
                        
                        scanningEnabled = false; lastSentData = code.data; lastSentTime = Date.now();
                        const timeStr = new Date().toTimeString().substring(0, 5); 

                        // Baca Jadwal/Alarm Aktif untuk Hari Ini dari Storage
                        const schedules = JSON.parse(localStorage.getItem('mb_schedules') || '[]');
                        const d = new Date();
                        const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                        const todaySchedule = schedules.find(s => s.date === todayStr && s.isActive);

                        const resumeScanner = () => { setTimeout(() => { scanningEnabled = true; resultDiv.style.display = 'none'; }, 3000); };

                        // KONDISI 3: BELUM WAKTUNYA (Sebelum Jam Buka)
                        if (timeStr < todaySchedule.openTime) {
                            resultDiv.innerHTML = `<b>Ditolak:</b> ${parsed.Nama}<br><span class="text-xs">Belum waktunya absen! (Buka jam: ${todaySchedule.openTime})</span>`;
                            resultDiv.className = "w-full bg-red-50 border border-red-200 text-red-800 p-4 rounded-2xl text-center text-sm font-semibold shadow-sm";
                            resultDiv.style.display = 'block'; playAudioFeedback('reject'); resumeScanner(); return; 
                        }

                        // KONDISI 1 & 2: HADIR & TERLAMBAT
                        const statusOtomatis = timeStr > todaySchedule.closeTime ? "Terlambat" : "Hadir";

                        resultDiv.innerHTML = `<span class="animate-pulse"><b>Memproses:</b> ${parsed.Nama}...</span>`;
                        resultDiv.className = "w-full bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-2xl text-center text-sm font-semibold shadow-sm";
                        resultDiv.style.display = 'block';

                        const scriptUrl = getAppScriptUrl();
                        if (scriptUrl) {
                            fetch(`${scriptUrl}?${new URLSearchParams({ id: parsed.Id, nama: parsed.Nama, section: parsed.Section || '', status: statusOtomatis, timestamp: getFormattedLocalDateTime() }).toString()}`)
                                .then(res => res.json())
                                .then(data => {
                                    if (data.result === 'duplicate') {
                                        resultDiv.innerHTML = `<b>Peringatan:</b> ${parsed.Nama}<br><span class="text-xs">Sudah melakukan presensi hari ini!</span>`;
                                        resultDiv.className = "w-full bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-2xl text-center text-sm font-semibold shadow-sm";
                                        playAudioFeedback('reject');
                                    } else {
                                        if (statusOtomatis === "Hadir") {
                                            resultDiv.innerHTML = `<b>Berhasil:</b> ${parsed.Nama} <br><span class="text-xs">(Status: HADIR)</span>`;
                                            resultDiv.className = "w-full bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl text-center text-sm font-semibold shadow-sm";
                                            playAudioFeedback('success');
                                        } else {
                                            resultDiv.innerHTML = `<b>Berhasil:</b> ${parsed.Nama} <br><span class="text-xs">(Status: TERLAMBAT)</span>`;
                                            resultDiv.className = "w-full bg-red-50 border border-red-200 text-red-800 p-4 rounded-2xl text-center text-sm font-semibold shadow-sm";
                                            playAudioFeedback('late');
                                        }
                                    }
                                    resumeScanner();
                                }).catch(() => {
                                    resultDiv.innerHTML = `<b>Tersimpan Offline:</b> ${parsed.Nama}`;
                                    resultDiv.className = "w-full bg-slate-100 border border-slate-300 text-slate-800 p-4 rounded-2xl text-center text-sm font-semibold shadow-sm";
                                    let pending = JSON.parse(localStorage.getItem('mb_pending_sync')) || [];
                                    pending.push({ id: parsed.Id, nama: parsed.Nama, section: parsed.Section, status: statusOtomatis, timestamp: getFormattedLocalDateTime() });
                                    localStorage.setItem('mb_pending_sync', JSON.stringify(pending));
                                    playAudioFeedback(statusOtomatis === "Hadir" ? 'success' : 'late'); resumeScanner();
                                });
                        } else { resumeScanner(); }
                    }
                }
            } catch (e) {
                errorDiv.textContent = 'Format QR Code tidak dikenali.'; errorDiv.style.display = 'block';
                setTimeout(() => { errorDiv.style.display = 'none'; }, 2000);
            }
        }
    }
    if (stream) requestAnimationFrame(tick);
}

async function startScanner() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        video.srcObject = stream; video.setAttribute("playsinline", true); video.play();
        video.style.display = 'block'; if(logoBox) logoBox.style.display = 'none';
        scanningEnabled = true; statusDiv.textContent = 'Kamera aktif. Arahkan ke QR Code.';
        toggleBtn.innerHTML = '<span>⏹ Stop Scanning</span>';
        requestAnimationFrame(tick);
    } catch (err) { errorDiv.textContent = 'Gagal mengakses kamera. Izinkan akses kamera di browser Anda.'; errorDiv.style.display = 'block'; }
}

function stopScanner() {
    if (stream) { stream.getTracks().forEach(track => track.stop()); stream = null; }
    scanningEnabled = false; video.style.display = 'none'; if(logoBox) logoBox.style.display = 'flex';
    statusDiv.textContent = 'Scanner berhenti. Tekan tombol Start untuk memulai.'; toggleBtn.innerHTML = '<span>📷 Start Scanning</span>';
}

// PERBAIKAN: Validasi Jadwal Sebelum Menyalakan Kamera
toggleBtn.addEventListener('click', () => { 
    if (stream) {
        stopScanner(); 
    } else { 
        const schedules = JSON.parse(localStorage.getItem('mb_schedules') || '[]');
        const d = new Date();
        const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const todaySchedule = schedules.find(s => s.date === todayStr && s.isActive);

        if (!todaySchedule) {
            // Blokir akses kamera & tampilkan peringatan
            errorDiv.textContent = '⚠️ Sesi Latihan belum aktif! Aktifkan jadwal di Dashboard terlebih dahulu.';
            errorDiv.style.display = 'block';
            playAudioFeedback('reject'); // Mainkan suara error buzzer
            setTimeout(() => { errorDiv.style.display = 'none'; }, 4000);
            return; // Hentikan fungsi disini, kamera tidak akan menyala
        }

        startScanner(); 
    } 
});

function loadScheduleInfo() {
    const card = document.getElementById('scannerScheduleCard'); const dot = document.getElementById('scannerStatusDot');
    const dateText = document.getElementById('scannerDateText'); const timeText = document.getElementById('scannerTimeText');
    if (!card) return;

    const schedules = JSON.parse(localStorage.getItem('mb_schedules') || '[]');
    const d = new Date();
    const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    
    const todaySchedule = schedules.find(s => s.date === todayStr && s.isActive);

    if (todaySchedule) {
        card.className = "w-full max-w-md mt-3 bg-emerald-50 border border-emerald-200 p-3 rounded-2xl text-center space-y-1 shadow-sm";
        if(dot) dot.className = "w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm";
        if(dateText) dateText.textContent = `SESI AKTIF: ${todaySchedule.eventTitle}`;
        if(timeText) timeText.textContent = `Tanggal: ${todaySchedule.date} | Jam: ${todaySchedule.openTime} - ${todaySchedule.closeTime}`;
    } else {
        card.className = "w-full max-w-md mt-3 bg-red-50 border border-red-200 p-3 rounded-2xl text-center space-y-1 shadow-sm";
        if(dot) dot.className = "w-2.5 h-2.5 rounded-full bg-red-500 shadow-sm animate-pulse";
        if(dateText) dateText.textContent = `SESI BELUM AKTIF / NONAKTIF`;
        if(timeText) timeText.textContent = `Pastikan alarm jadwal hari ini menyala di Dashboard.`;
    }
}
window.addEventListener('load', loadScheduleInfo);