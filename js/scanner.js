const DEFAULT_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxJGU8YPqreBWTFWKFr4l0p_BGrodkH_DIWX4Wooc3CIsjVbm7GNhV-g5bcwgPVEhas/exec";

function getAppScriptUrl() {
    const savedUrl = localStorage.getItem('mb_setting_script');
    return savedUrl && savedUrl.trim() !== '' ? savedUrl : DEFAULT_SCRIPT_URL;
}

async function initScannerSettings() {
    updateScannerStatusDisplay();
    const scriptUrl = getAppScriptUrl();
    if (!scriptUrl) return;

    try {
        const response = await fetch(`${scriptUrl}?action=getSettings`);
        const result = await response.json();

        if (result.result === 'success' && result.data) {
            localStorage.setItem('mb_setting_event_title', result.data.eventTitle || '');
            localStorage.setItem('mb_setting_date', result.data.date || '');
            localStorage.setItem('mb_setting_open', result.data.openTime || '');
            localStorage.setItem('mb_setting_close', result.data.closeTime || '');
            updateScannerStatusDisplay();
        }
    } catch (e) { console.log("Scanner menggunakan cache lokal."); }
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `${type === 'success' ? 'bg-emerald-600' : 'bg-red-600'} text-white px-4 py-3 rounded-xl shadow-2xl text-xs font-bold transition transform duration-300 pointer-events-auto`;
    toast.innerHTML = `${type === 'success' ? '✅' : '⚠️'} ${message}`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function getLocalDateString() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getFormattedLocalDateTime() {
    const d = new Date();
    return `${getLocalDateString()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

const video = document.getElementById('video');
const logoBox = document.getElementById('logoBox');
const canvas = document.getElementById('canvas');
const resultDiv = document.getElementById('result');
const errorDiv = document.getElementById('error');
const statusDiv = document.getElementById('status');
const toggleScanBtn = document.getElementById('toggleScan');
const canvasContext = canvas.getContext('2d', { willReadFrequently: true });

let stream = null;
let lastSentData = null;
let lastSentTime = 0;
const cooldownPeriod = 3000;
let scanningEnabled = false;

// ==========================================
// ANIMASI LOGO BERGANTIAN (1.png & 2.png)
// ==========================================
const logos = ['1.png', '2.png'];
let logoIndex = 0;

setInterval(() => {
    const logoElement = document.getElementById('logo');
    const boxElement = document.getElementById('logoBox');
    
    if (logoElement && boxElement) {
        if (boxElement.style.display !== 'none') {
            logoElement.style.opacity = '0';
            setTimeout(() => {
                logoIndex = (logoIndex + 1) % logos.length;
                logoElement.src = logos[logoIndex];
                logoElement.style.opacity = '1';
            }, 300);
        }
    }
}, 3000);

// ==========================================
// 3 JENIS SUARA NOTIFIKASI
// ==========================================
function playAudioFeedback(type) {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain); 
        gain.connect(audioCtx.destination);
        
        const now = audioCtx.currentTime;
        if (type === 'success') {
            // Suara 1: Hadir (Nada tinggi singkat, menyenangkan)
            osc.frequency.setValueAtTime(880, now); 
            gain.gain.setValueAtTime(0.1, now);
            osc.start(now); osc.stop(now + 0.15);
        } else if (type === 'late') {
            // Suara 2: Terlambat (Nada menengah agak panjang)
            osc.frequency.setValueAtTime(400, now); 
            gain.gain.setValueAtTime(0.1, now);
            osc.start(now); osc.stop(now + 0.3);
        } else {
            // Suara 3: Ditolak / Belum Waktunya / Duplikat (Nada rendah/Buzzer)
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(200, now); 
            gain.gain.setValueAtTime(0.1, now);
            osc.start(now); osc.stop(now + 0.4);
        }
    } catch (e) { }
}

function updateScannerStatusDisplay() {
    const todayStr = getLocalDateString();
    const savedDate = localStorage.getItem('mb_setting_date');
    const closeTime = localStorage.getItem('mb_setting_close') || '18:00';
    const eventTitle = localStorage.getItem('mb_setting_event_title') || 'Latihan Rutin';

    const card = document.getElementById('scannerScheduleCard');
    const dot = document.getElementById('scannerStatusDot');
    const dateText = document.getElementById('scannerDateText');
    const timeText = document.getElementById('scannerTimeText');

    if (!dateText || !card) return;

    if (savedDate === todayStr) {
        card.className = "w-full max-w-md mt-3 p-3 rounded-2xl text-center space-y-1 bg-emerald-50 border border-emerald-200 shadow-sm";
        dot.className = "w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse";
        dateText.className = "text-xs font-bold text-emerald-900";
        dateText.textContent = `AKTIF: ${eventTitle} (${savedDate})`;
        timeText.textContent = `Batas Hadir: ${closeTime}`;
    } else {
        card.className = "w-full max-w-md mt-3 p-3 rounded-2xl text-center space-y-1 bg-red-50 border border-red-200 shadow-sm";
        dot.className = "w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse";
        dateText.className = "text-xs font-bold text-red-900";
        dateText.textContent = "Jadwal Hari Ini Belum Disetting / Nonaktif!";
        timeText.textContent = "Atur jadwal di Dashboard.";
    }
}

async function startCamera() {
    await initScannerSettings();
    const todayStr = getLocalDateString();
    const configuredDate = localStorage.getItem('mb_setting_date');

    if (!configuredDate || configuredDate !== todayStr) {
        errorDiv.style.display = 'block';
        errorDiv.textContent = `SCANNER DITOLAK: Jadwal belum aktif untuk hari ini (${todayStr}).`;
        toggleScanBtn.innerHTML = '<span>📷 Start Scanning</span>';
        scanningEnabled = false;
        return;
    }

    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        video.srcObject = stream;
        video.setAttribute("playsinline", true);
        await video.play();
        video.style.display = 'block';
        logoBox.style.display = 'none';
        requestAnimationFrame(tick);
        statusDiv.textContent = 'Kamera aktif. Arahkan ke QR Code.';
    } catch (err) {
        errorDiv.style.display = 'block';
        errorDiv.textContent = 'Gagal mengakses kamera: ' + err.message;
    }
}

function stopCamera() {
    if (stream) {
        stream.getTracks().forEach(t => t.stop());
        stream = null;
        video.style.display = 'none';
        logoBox.style.display = 'flex';
        statusDiv.textContent = 'Kamera dimatikan.';
    }
}

toggleScanBtn.addEventListener('click', () => {
    errorDiv.style.display = 'none';
    resultDiv.style.display = 'none';
    if (scanningEnabled) {
        scanningEnabled = false;
        stopCamera();
        toggleScanBtn.innerHTML = '<span>📷 Start Scanning</span>';
    } else {
        scanningEnabled = true;
        startCamera();
        toggleScanBtn.innerHTML = '<span>⏹ Stop Scanning</span>';
    }
});

// ==========================================
// LOGIKA SCANNER DENGAN 3 KONDISI WAKTU 
// (Telah Diperbaiki Delay Notifikasinya)
// ==========================================
function tick() {
    if (video.readyState === video.HAVE_ENOUGH_DATA && scanningEnabled && stream) {
        canvas.height = video.videoHeight;
        canvas.width = video.videoWidth;
        canvasContext.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imgData = canvasContext.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imgData.data, imgData.width, imgData.height);

        if (code) {
            try {
                const parsed = JSON.parse(code.data);
                if (parsed.Id && parsed.Nama) {
                    const now = Date.now();
                    
                    // Cek cooldown agar tidak men-scan QR yang sama berkali-kali dalam hitungan detik
                    if (lastSentData !== code.data || (now - lastSentTime) >= cooldownPeriod) {
                        
                        // 1. TAHAN SCANNER (Kamera tetap nyala, tapi tidak nge-scan dulu)
                        scanningEnabled = false; 
                        lastSentData = code.data;
                        lastSentTime = Date.now();
                        
                        const timeStr = new Date().toTimeString().substring(0, 5); // Format "HH:mm"
                        const openTime = localStorage.getItem('mb_setting_open') || '15:00';
                        const closeTime = localStorage.getItem('mb_setting_close') || '18:00';

                        // 2. FUNGSI HELPER UNTUK MELANJUTKAN SCAN
                        // Menahan banner selama 3 detik "SETELAH" hasil keluar
                        const resumeScanner = () => {
                            setTimeout(() => { 
                                scanningEnabled = true; 
                                resultDiv.style.display = 'none'; 
                            }, 3000); 
                        };

                        // 3. KONDISI 3: BELUM WAKTUNYA (Sebelum Jam Buka)
                        if (timeStr < openTime) {
                            resultDiv.innerHTML = `<b>Ditolak:</b> ${parsed.Nama}<br><span class="text-xs">Belum waktunya absen! (Buka: ${openTime})</span>`;
                            resultDiv.className = "w-full bg-red-50 border border-red-200 text-red-800 p-4 rounded-2xl text-center text-sm font-semibold shadow-sm";
                            resultDiv.style.display = 'block';
                            playAudioFeedback('reject');
                            
                            resumeScanner(); // Lanjut scan setelah 3 detik
                            return; // Stop disini, data TIDAK dikirim ke server
                        }

                        // 4. KONDISI 1 & 2: HADIR & TERLAMBAT
                        const statusOtomatis = timeStr > closeTime ? "Terlambat" : "Hadir";

                        // Tampilkan UI "Memproses" selagi menunggu Google Sheets
                        resultDiv.innerHTML = `<span class="animate-pulse"><b>Memproses:</b> ${parsed.Nama}...</span>`;
                        resultDiv.className = "w-full bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-2xl text-center text-sm font-semibold shadow-sm";
                        resultDiv.style.display = 'block';

                        const scriptUrl = getAppScriptUrl();
                        if (scriptUrl) {
                            fetch(`${scriptUrl}?${new URLSearchParams({ id: parsed.Id, nama: parsed.Nama, section: parsed.Section || '', status: statusOtomatis, timestamp: getFormattedLocalDateTime() }).toString()}`)
                                .then(res => res.json())
                                .then(data => {
                                    if (data.result === 'duplicate') {
                                        // Peringatan jika data ganda
                                        resultDiv.innerHTML = `<b>Peringatan:</b> ${parsed.Nama}<br><span class="text-xs">Sudah absen hari ini!</span>`;
                                        resultDiv.className = "w-full bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-2xl text-center text-sm font-semibold shadow-sm";
                                        playAudioFeedback('reject');
                                    } else {
                                        // Notifikasi berhasil sesuai status waktu
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
                                    resumeScanner(); // Lanjut scan setelah notif muncul
                                })
                                .catch(() => {
                                    // Jika sedang offline (tidak ada sinyal internet)
                                    resultDiv.innerHTML = `<b>Tersimpan Offline:</b> ${parsed.Nama}`;
                                    resultDiv.className = "w-full bg-slate-100 border border-slate-300 text-slate-800 p-4 rounded-2xl text-center text-sm font-semibold shadow-sm";
                                    let pending = JSON.parse(localStorage.getItem('mb_pending_sync')) || [];
                                    pending.push({ id: parsed.Id, nama: parsed.Nama, section: parsed.Section, status: statusOtomatis, timestamp: getFormattedLocalDateTime() });
                                    localStorage.setItem('mb_pending_sync', JSON.stringify(pending));
                                    
                                    playAudioFeedback(statusOtomatis === "Hadir" ? 'success' : 'late');
                                    resumeScanner();
                                });
                        } else {
                            resumeScanner();
                        }
                    }
                }
            } catch (e) {
                errorDiv.textContent = 'Format QR tidak dikenali.';
                errorDiv.style.display = 'block';
                setTimeout(() => { errorDiv.style.display = 'none'; }, 2000);
            }
        }
    }
    if (stream) requestAnimationFrame(tick);
}

window.addEventListener('DOMContentLoaded', async () => {
    await initScannerSettings();
});