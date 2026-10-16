/**
 * ==============================================================================
 * MARCH FOR VICTORY - SCANNER ENGINE & AUDIO SYNTHESIZER
 * Developer    : Luthfin Ramadhani Tuadingo
 * File : js/scanner.js
 * ==============================================================================
 * Deskripsi : Mengelola akses kamera HTML5, pemindaian QR Code waktu nyata via jsQR,
 *             notifikasi suara (Web Audio API Synthesizer), validasi batasan waktu
 *             3-tier, serta pengiriman hasil scan ke Google Sheets.
 * ==============================================================================
 */

// Element DOM UI
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const canvasContext = canvas.getContext('2d');
const resultDiv = document.getElementById('result');
const errorDiv = document.getElementById('error');
const statusDiv = document.getElementById('status');
const toggleBtn = document.getElementById('toggleScan');
const logoBox = document.getElementById('logoBox');

// State Variabel
let stream = null;
let scanningEnabled = false;
let lastSentData = null;
let lastSentTime = 0;
const cooldownPeriod = 3000; // Cooldown 3 detik antar scan

const DEFAULT_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxJGU8YPqreBWTFWKFr4l0p_BGrodkH_DIWX4Wooc3CIsjVbm7GNhV-g5bcwgPVEhas/exec";

function getAppScriptUrl() {
    const savedUrl = localStorage.getItem('mb_setting_script');
    return savedUrl && savedUrl.trim() !== '' ? savedUrl : DEFAULT_SCRIPT_URL;
}

function getFormattedLocalDateTime() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// ==========================================
// 1. SYNTHESIZER AUDIO NOTIFIKASI (WEB AUDIO API)
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
            // Suara 1: Hadir (Nada tinggi singkat 880Hz, menyenangkan)
            osc.frequency.setValueAtTime(880, now); 
            gain.gain.setValueAtTime(0.1, now);
            osc.start(now); osc.stop(now + 0.15);
        } else if (type === 'late') {
            // Suara 2: Terlambat (Nada menengah 400Hz)
            osc.frequency.setValueAtTime(400, now); 
            gain.gain.setValueAtTime(0.1, now);
            osc.start(now); osc.stop(now + 0.3);
        } else {
            // Suara 3: Ditolak / Belum Waktunya / Duplikat (Nada sawtooth rendah 200Hz - Buzzer)
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(200, now); 
            gain.gain.setValueAtTime(0.1, now);
            osc.start(now); osc.stop(now + 0.4);
        }
    } catch (e) { console.error("Audio Context Error:", e); }
}

// ==========================================
// 2. LOGIKA UTAMA PEMINDAIAN & VALIDASI WAKTU
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
                    
                    if (lastSentData !== code.data || (now - lastSentTime) >= cooldownPeriod) {
                        
                        // Tahan proses scan sementara
                        scanningEnabled = false; 
                        lastSentData = code.data;
                        lastSentTime = Date.now();
                        
                        const timeStr = new Date().toTimeString().substring(0, 5); // Format "HH:mm"
                        const openTime = localStorage.getItem('mb_setting_open') || '15:00';
                        const closeTime = localStorage.getItem('mb_setting_close') || '18:00';

                        // Timer helper untuk mengaktifkan kembali scanner setelah 3 detik
                        const resumeScanner = () => {
                            setTimeout(() => { 
                                scanningEnabled = true; 
                                resultDiv.style.display = 'none'; 
                            }, 3000); 
                        };

                        // KONDISI 3: BELUM WAKTUNYA (Sebelum Jam Buka)
                        if (timeStr < openTime) {
                            resultDiv.innerHTML = `<b>Ditolak:</b> ${parsed.Nama}<br><span class="text-xs">Belum waktunya absen! (Buka jam: ${openTime})</span>`;
                            resultDiv.className = "w-full bg-red-50 border border-red-200 text-red-800 p-4 rounded-2xl text-center text-sm font-semibold shadow-sm";
                            resultDiv.style.display = 'block';
                            playAudioFeedback('reject');
                            
                            resumeScanner();
                            return; // Batalkan, data tidak dikirim ke cloud
                        }

                        // KONDISI 1 & 2: HADIR & TERLAMBAT
                        const statusOtomatis = timeStr > closeTime ? "Terlambat" : "Hadir";

                        // Tampilan Loading
                        resultDiv.innerHTML = `<span class="animate-pulse"><b>Memproses:</b> ${parsed.Nama}...</span>`;
                        resultDiv.className = "w-full bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-2xl text-center text-sm font-semibold shadow-sm";
                        resultDiv.style.display = 'block';

                        const scriptUrl = getAppScriptUrl();
                        if (scriptUrl) {
                            fetch(`${scriptUrl}?${new URLSearchParams({ id: parsed.Id, nama: parsed.Nama, section: parsed.Section || '', status: statusOtomatis, timestamp: getFormattedLocalDateTime() }).toString()}`)
                                .then(res => res.json())
                                .then(data => {
                                    if (data.result === 'duplicate') {
                                        // Peringatan Duplikasi
                                        resultDiv.innerHTML = `<b>Peringatan:</b> ${parsed.Nama}<br><span class="text-xs">Sudah melakukan presensi hari ini!</span>`;
                                        resultDiv.className = "w-full bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-2xl text-center text-sm font-semibold shadow-sm";
                                        playAudioFeedback('reject');
                                    } else {
                                        // Presensi Berhasil
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
                                })
                                .catch(() => {
                                    // Penanganan Mode Offline
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
                errorDiv.textContent = 'Format QR Code tidak dikenali.';
                errorDiv.style.display = 'block';
                setTimeout(() => { errorDiv.style.display = 'none'; }, 2000);
            }
        }
    }
    if (stream) requestAnimationFrame(tick);
}

// ==========================================
// 3. KONTROL KAMERA ON / OFF
// ==========================================
async function startScanner() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        video.srcObject = stream;
        video.setAttribute("playsinline", true);
        video.play();
        
        video.style.display = 'block';
        if(logoBox) logoBox.style.display = 'none';
        
        scanningEnabled = true;
        statusDiv.textContent = 'Kamera aktif. Arahkan ke QR Code.';
        toggleBtn.innerHTML = '<span>⏹ Stop Scanning</span>';
        requestAnimationFrame(tick);
    } catch (err) {
        errorDiv.textContent = 'Gagal mengakses kamera. Izinkan akses kamera di browser Anda.';
        errorDiv.style.display = 'block';
    }
}

function stopScanner() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    scanningEnabled = false;
    video.style.display = 'none';
    if(logoBox) logoBox.style.display = 'flex';
    statusDiv.textContent = 'Scanner berhenti. Tekan tombol Start untuk memulai.';
    toggleBtn.innerHTML = '<span>📷 Start Scanning</span>';
}

toggleBtn.addEventListener('click', () => {
    if (stream) { stopScanner(); } else { startScanner(); }
});

// Sync info jadwal di kartu atas scanner
function loadScheduleInfo() {
    const card = document.getElementById('scannerScheduleCard');
    const dot = document.getElementById('scannerStatusDot');
    const dateText = document.getElementById('scannerDateText');
    const timeText = document.getElementById('scannerTimeText');
    if (!card) return;

    const savedDate = localStorage.getItem('mb_setting_date');
    const openTime = localStorage.getItem('mb_setting_open') || '15:00';
    const closeTime = localStorage.getItem('mb_setting_close') || '18:00';
    const eventTitle = localStorage.getItem('mb_setting_event_title') || 'Latihan Rutin';
    
    const d = new Date();
    const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    if (savedDate === todayStr) {
        card.className = "w-full max-w-md mt-3 bg-emerald-50 border border-emerald-200 p-3 rounded-2xl text-center space-y-1 shadow-sm";
        if(dot) dot.className = "w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm";
        if(dateText) dateText.textContent = `SESI AKTIF: ${eventTitle}`;
        if(timeText) timeText.textContent = `Tanggal: ${savedDate} | Jam: ${openTime} - ${closeTime}`;
    } else {
        card.className = "w-full max-w-md mt-3 bg-red-50 border border-red-200 p-3 rounded-2xl text-center space-y-1 shadow-sm";
        if(dot) dot.className = "w-2.5 h-2.5 rounded-full bg-red-500 shadow-sm animate-pulse";
        if(dateText) dateText.textContent = `SESI BELUM AKTIF / NONAKTIF`;
        if(timeText) timeText.textContent = savedDate ? `Tersimpan untuk tgl: ${savedDate}` : `Atur jadwal di Tab Setting Dashboard`;
    }
}

window.addEventListener('load', loadScheduleInfo);