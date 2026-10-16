/**
 * ==============================================================================
 * MARCH FOR VICTORY - CORE DASHBOARD APPLICATION LOGIC
 * File : js/app.js
 * ==============================================================================
 * Deskripsi : Mengatur manajemen state pemain, generator QR code berlogo,
 *             sinkronisasi Cloud Apps Script, live report, chart analytics,
 *             ekspor PDF, serta penanganan PWA offline storage.
 * ==============================================================================
 */

const DEFAULT_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxJGU8YPqreBWTFWKFr4l0p_BGrodkH_DIWX4Wooc3CIsjVbm7GNhV-g5bcwgPVEhas/exec"; 

function getAppScriptUrl() {
    const savedUrl = localStorage.getItem('mb_setting_script');
    return savedUrl && savedUrl.trim() !== '' ? savedUrl : DEFAULT_SCRIPT_URL;
}

function getLocalDateString() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function getFormattedLocalDateTime() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// ==========================================
// 1. UI HELPER & TOAST NOTIFICATION
// ==========================================
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if(!container) return;

    const toast = document.createElement('div');
    const bgClass = type === 'success' ? 'bg-emerald-600' : (type === 'error' ? 'bg-red-600' : 'bg-slate-800');
    const icon = type === 'success' ? '✅' : (type === 'error' ? '⚠️' : 'ℹ️');
    
    toast.className = `${bgClass} text-white px-4 py-3 rounded-xl shadow-2xl text-xs sm:text-sm font-bold transform transition-all duration-300 translate-y-10 opacity-0 flex items-center gap-2 max-w-sm w-full mx-auto sm:mx-0 pointer-events-auto`;
    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;

    container.appendChild(toast);
    setTimeout(() => { toast.classList.remove('translate-y-10', 'opacity-0'); toast.classList.add('translate-y-0', 'opacity-100'); }, 10);
    setTimeout(() => { toast.classList.remove('translate-y-0', 'opacity-100'); toast.classList.add('translate-y-10', 'opacity-0'); setTimeout(() => toast.remove(), 300); }, 3000);
}

function setButtonLoading(button, isLoading, loadingText = "Memproses...") {
    if (!button) return;
    if (isLoading) {
        button.disabled = true;
        button.dataset.originalHtml = button.innerHTML;
        button.classList.add('opacity-65', 'cursor-not-allowed');
        button.innerHTML = `<svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> ${loadingText}`;
    } else {
        button.disabled = false;
        button.classList.remove('opacity-65', 'cursor-not-allowed');
        if (button.dataset.originalHtml) button.innerHTML = button.dataset.originalHtml;
    }
}

// ==========================================
// 2. NAVIGASI TAB & STATE SWITCHER
// ==========================================
function switchTab(targetId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    const targetElement = document.getElementById('tab-' + targetId);
    if(targetElement) targetElement.classList.remove('hidden');
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('bg-white', 'text-maroon', 'shadow');
        btn.classList.add('text-white', 'hover:bg-red-900');
        if(btn.getAttribute('data-target') === targetId) {
            btn.classList.add('bg-white', 'text-maroon', 'shadow');
            btn.classList.remove('text-white', 'hover:bg-red-900');
        }
    });

    if(targetId === 'players') loadPlayersTable();
    if(targetId === 'qr') loadQRTable();
    if(targetId === 'report') {
        document.getElementById('reportDate').value = getLocalDateString();
        loadReportData(true);
    }
    if(targetId === 'setting') {
        loadSettingsFromCloud(false);
    }
}

// ==========================================
// 3. MASTER PLAYER MANAGEMENT
// ==========================================
function getStoredPlayers() {
    try { return JSON.parse(localStorage.getItem('mb_players')) || []; } catch(e) { return []; }
}

function saveStoredPlayers(players) {
    localStorage.setItem('mb_players', JSON.stringify(players));
}

async function syncPlayersFromCloud(showAlert = false) {
    const scriptUrl = getAppScriptUrl();
    if (!scriptUrl) return;
    try {
        const response = await fetch(`${scriptUrl}?action=getPlayers`);
        const result = await response.json();
        if (result.result === 'success' && result.data) {
            saveStoredPlayers(result.data);
            loadPlayersTable();
            if (showAlert) showToast("Data player direfresh dari Cloud!", "success");
        }
    } catch (e) { 
        if (showAlert) showToast("Gagal terhubung ke Cloud.", "error");
    }
}

function manualRefreshPlayers() {
    syncPlayersFromCloud(true);
}

document.getElementById('addPlayerForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const submitBtn = this.querySelector('button[type="submit"]');
    setButtonLoading(submitBtn, true, "Menyimpan...");
    
    const id = document.getElementById('pId').value.trim();
    const nama = document.getElementById('pName').value.trim();
    const section = document.getElementById('pSection').value;
    const nim = document.getElementById('pNim').value.trim();
    const email = document.getElementById('pEmail').value.trim();

    let players = getStoredPlayers();
    if(players.some(p => p.Id === id)) {
        showToast("Error: ID Player sudah terdaftar!", "error");
        setButtonLoading(submitBtn, false);
        return;
    }
    
    players.push({ Id: id, Nama: nama, Section: section, NIM: nim, Email: email });
    saveStoredPlayers(players);
    showToast("Data player berhasil disimpan!", "success");
    this.reset();
    loadPlayersTable();
    setButtonLoading(submitBtn, false);

    const scriptUrl = getAppScriptUrl();
    if (scriptUrl) {
        fetch(`${scriptUrl}?${new URLSearchParams({ action: 'savePlayer', id, nama, section, nim, email }).toString()}`).catch(err => {});
    }
});

function handleExcelUpload() {
    const fileInput = document.getElementById('excelFile');
    const file = fileInput.files[0];
    if (!file) { showToast("Pilih file Excel (.xlsx) terlebih dahulu!", "error"); return; }

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet);
            let players = getStoredPlayers();
            let countAdded = 0;
            const scriptUrl = getAppScriptUrl();

            jsonData.forEach(row => {
                const id = String(row.ID || row.Id || row.id || '').trim();
                const nama = String(row.NAMA || row.Nama || row.nama || '').trim();
                const section = String(row.SECTION || row.Section || row.section || 'Brass').trim();
                const nim = String(row.NIM || row.Nim || row.nim || '').trim();
                const email = String(row.EMAIL || row.Email || row.email || '').trim();

                if(id && nama && !players.some(p => p.Id === id)) {
                    players.push({ Id: id, Nama: nama, Section: section, NIM: nim, Email: email });
                    countAdded++;
                    if (scriptUrl) {
                        fetch(`${scriptUrl}?${new URLSearchParams({ action: 'savePlayer', id, nama, section, nim, email }).toString()}`).catch(err => {});
                    }
                }
            });
            saveStoredPlayers(players);
            showToast(`Berhasil mengimpor ${countAdded} data player!`);
            fileInput.value = '';
            loadPlayersTable();
        } catch (err) { showToast("Gagal membaca file Excel.", "error"); }
    };
    reader.readAsArrayBuffer(file);
}

function loadPlayersTable() {
    const tbody = document.getElementById('playerTableBody');
    if (!tbody) return;
    
    const searchVal = document.getElementById('filterPlayerSearch') ? document.getElementById('filterPlayerSearch').value.toLowerCase() : '';
    const sectionVal = document.getElementById('filterPlayerSection') ? document.getElementById('filterPlayerSection').value : '';
    const players = getStoredPlayers();
    
    const filtered = players.filter(p => {
        const matchSearch = searchVal === '' || p.Id.toLowerCase().includes(searchVal) || p.Nama.toLowerCase().includes(searchVal);
        const matchSection = sectionVal === '' || p.Section === sectionVal;
        return matchSearch && matchSection;
    });

    tbody.innerHTML = filtered.length === 0 ? `<tr><td colspan="6" class="p-4 text-center text-slate-400">Tidak ada data yang cocok.</td></tr>` : '';
    
    filtered.forEach(p => {
        const tr = document.createElement('tr');
        tr.className = "border-b hover:bg-slate-50";
        tr.innerHTML = `
            <td class="p-3 font-mono font-bold whitespace-nowrap">${p.Id}</td>
            <td class="p-3 whitespace-nowrap">${p.Nama}</td>
            <td class="p-3 whitespace-nowrap"><span class="px-2.5 py-1 rounded-full text-xs font-semibold ${getSectionBadgeClass(p.Section)}">${p.Section}</span></td>
            <td class="p-3 font-mono text-xs whitespace-nowrap">${p.NIM || '-'}</td>
            <td class="p-3 text-xs text-slate-500 whitespace-nowrap">${p.Email || '-'}</td>
            <td class="p-3 text-center whitespace-nowrap"><button onclick="deletePlayer('${p.Id}', this)" class="bg-red-500 text-white px-2.5 py-1 rounded-lg text-xs hover:bg-red-600 font-bold shadow-sm">🗑️ Hapus</button></td>
        `;
        tbody.appendChild(tr);
    });
}

function deletePlayer(id, btn) {
    if(!confirm(`Yakin ingin menghapus player ${id}?`)) return;
    saveStoredPlayers(getStoredPlayers().filter(p => p.Id !== id));
    loadPlayersTable();
    const scriptUrl = getAppScriptUrl();
    if (scriptUrl) fetch(`${scriptUrl}?action=deletePlayer&id=${id}`).catch(err => {});
}

function getSectionBadgeClass(section) {
    switch(section) {
        case 'Field Commander': return 'bg-amber-100 text-amber-800 border border-amber-300 whitespace-nowrap inline-block';
        case 'Brass': return 'bg-blue-100 text-blue-800 border border-blue-300 whitespace-nowrap inline-block';
        case 'Battery': return 'bg-red-100 text-red-800 border border-red-300 whitespace-nowrap inline-block';
        case 'Pit Percussion': return 'bg-pink-100 text-pink-800 border border-pink-300 whitespace-nowrap inline-block';
        case 'Color Guard': return 'bg-emerald-100 text-emerald-800 border border-emerald-300 whitespace-nowrap inline-block';
        default: return 'bg-slate-100 text-slate-800 border border-slate-300 whitespace-nowrap inline-block';
    }
}

function getStatusBadgeClass(status) {
    switch(status) {
        case 'Hadir': return 'bg-emerald-100 text-emerald-800 font-bold border border-emerald-300 whitespace-nowrap inline-block';
        case 'Terlambat': return 'bg-amber-100 text-amber-800 font-bold border border-amber-300 whitespace-nowrap inline-block';
        case 'Izin': return 'bg-orange-100 text-orange-800 font-bold border border-orange-300 whitespace-nowrap inline-block';
        case 'Sakit': return 'bg-slate-200 text-slate-700 font-bold border border-slate-300 whitespace-nowrap inline-block';
        case 'Alpa': return 'bg-red-100 text-red-800 font-bold border border-red-300 whitespace-nowrap inline-block';
        default: return 'bg-slate-100 text-slate-800 font-bold border border-slate-300 whitespace-nowrap inline-block';
    }
}

// ==========================================
// 4. QR GENERATOR & BATCH ZIP ENGINE
// ==========================================
function generateQRCodeWithLogo(playerData, callback) {
    const jsonString = JSON.stringify({ Id: playerData.Id, Nama: playerData.Nama, Section: playerData.Section });
    const tempDiv = document.createElement('div');
    tempDiv.style.display = 'none';
    document.body.appendChild(tempDiv);
    
    new QRCode(tempDiv, { text: jsonString, width: 400, height: 400, colorDark: "#800000", colorLight: "#ffffff", correctLevel: QRCode.CorrectLevel.H });
    
    setTimeout(() => {
        const qrCanvas = tempDiv.querySelector('canvas');
        if (!qrCanvas) { document.body.removeChild(tempDiv); callback(null); return; }
        
        const padding = 40;
        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = qrCanvas.width + (padding * 2);
        finalCanvas.height = qrCanvas.height + (padding * 2);
        const ctx = finalCanvas.getContext('2d');
        
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
        ctx.drawImage(qrCanvas, padding, padding);
        
        const logoImg = new Image();
        logoImg.crossOrigin = "anonymous";
        logoImg.src = "1.png";
        
        logoImg.onload = function() {
            const maxLogoSize = qrCanvas.width / 4;
            let logoW = logoImg.width, logoH = logoImg.height;
            if (logoW > maxLogoSize || logoH > maxLogoSize) {
                if (logoW > logoH) { logoH = (maxLogoSize / logoW) * logoH; logoW = maxLogoSize; }
                else { logoW = (maxLogoSize / logoH) * logoW; logoH = maxLogoSize; }
            }
            ctx.drawImage(logoImg, padding + (qrCanvas.width - logoW) / 2, padding + (qrCanvas.height - logoH) / 2, logoW, logoH);
            callback(finalCanvas.toDataURL("image/png"));
            document.body.removeChild(tempDiv);
        };
        logoImg.onerror = function() { callback(finalCanvas.toDataURL("image/png")); document.body.removeChild(tempDiv); };
    }, 250);
}

function loadQRTable() {
    const searchVal = document.getElementById('filterQrSearch') ? document.getElementById('filterQrSearch').value.toLowerCase() : '';
    const sectionVal = document.getElementById('filterQrSection') ? document.getElementById('filterQrSection').value : '';
    const tbody = document.getElementById('qrTableBody');
    if (!tbody) return;
    
    const players = getStoredPlayers();
    tbody.innerHTML = '';
    if(players.length === 0) { tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-slate-400">Tidak ada data player.</td></tr>`; return; }
    
    const filtered = players.filter(p => (searchVal === '' || p.Id.toLowerCase().includes(searchVal) || p.Nama.toLowerCase().includes(searchVal)) && (sectionVal === '' || p.Section === sectionVal));
    if(filtered.length === 0) { tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-slate-400">Tidak ada player yang cocok.</td></tr>`; return; }
    
    filtered.forEach(p => {
        const tr = document.createElement('tr');
        tr.className = "border-b hover:bg-slate-50";
        tr.innerHTML = `
            <td class="p-3 font-mono font-bold whitespace-nowrap">${p.Id}</td>
            <td class="p-3 whitespace-nowrap">${p.Nama}</td>
            <td class="p-3 whitespace-nowrap"><span class="px-2.5 py-1 rounded-full text-xs font-semibold ${getSectionBadgeClass(p.Section)}">${p.Section}</span></td>
            <td class="p-3 text-center whitespace-nowrap"><button onclick='previewAndDownloadQR(${JSON.stringify(p)})' class="btn-maroon px-3 py-1.5 rounded-lg text-xs font-bold">📥 Download QR</button></td>
        `;
        tbody.appendChild(tr);
    });
}

function previewAndDownloadQR(player) {
    showToast(`Membuat QR untuk ${player.Nama}...`, "success");
    generateQRCodeWithLogo(player, function(dataUrl) {
        if(!dataUrl) return showToast("Gagal membuat QR.", "error");
        const win = window.open("", "_blank");
        win.document.write(`<html><head><title>Cetak - ${player.Nama}</title><script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script></head><body class="bg-slate-900 flex items-center justify-center min-h-screen p-4"><div class="bg-slate-100 p-8 rounded-3xl shadow-xl text-center max-w-sm w-full space-y-4"><h2 class="text-xs font-bold text-amber-600 uppercase">Marching Band UMM</h2><h1 class="text-2xl font-black text-[#800000]">${player.Nama}</h1><p class="text-xs font-mono font-bold text-amber-600">ID: ${player.Id}</p><div class="flex justify-center p-2 bg-white rounded-2xl border"><img src="${dataUrl}" class="w-48 h-48 object-contain"></div><a href="${dataUrl}" download="QR_${player.Id}.png" class="block w-full bg-[#800000] text-white py-3 rounded-xl font-bold">💾 Download Gambar</a></div></body></html>`);
    });
}

async function downloadAllQRZip() {
    const players = getStoredPlayers();
    if(players.length === 0) return showToast("Tidak ada data player.", "error");
    showToast("Memproses ZIP...", "success");
    const zip = new JSZip();
    const folder = zip.folder("qr_codes");
    for(let p of players) {
        await new Promise(resolve => {
            generateQRCodeWithLogo(p, dataUrl => {
                if(dataUrl) folder.file(`qr_${p.Id}.png`, dataUrl.replace(/^data:image\/png;base64,/, ""), {base64: true});
                resolve();
            });
        });
    }
    zip.generateAsync({type:"blob"}).then(blob => { saveAs(blob, "QR_Codes_MBUMM.zip"); showToast("Berhasil diunduh!", "success"); });
}

function copyPortalLink() {
    let url = window.location.href.replace(/\/[^/]*$/, '/portal.html');
    navigator.clipboard.writeText(url).then(() => showToast("Link Portal disalin!", "success"));
}

// ==========================================
// 5. CLOUD SETTING & STATUS SESI
// ==========================================
async function saveSettings() {
    const dateVal = document.getElementById('settingDate').value;
    if(!dateVal) return showToast("Tentukan tanggal latihan!", "error");
    
    const eventTitle = document.getElementById('settingEventTitle').value.trim() || 'Latihan Rutin';
    const openTime = document.getElementById('settingOpenTime').value;
    const closeTime = document.getElementById('settingCloseTime').value;
    const scriptUrl = getAppScriptUrl();

    localStorage.setItem('mb_setting_event_title', eventTitle);
    localStorage.setItem('mb_setting_date', dateVal);
    localStorage.setItem('mb_setting_open', openTime);
    localStorage.setItem('mb_setting_close', closeTime);
    
    showToast("Menyimpan ke Cloud...", "success");
    if (scriptUrl) {
        try {
            await fetch(`${scriptUrl}?${new URLSearchParams({ action: 'saveSettings', eventTitle, date: dateVal, openTime, closeTime }).toString()}`);
            showToast("Pengaturan tersinkron ke Cloud!", "success");
        } catch (e) { showToast("Tersimpan secara lokal (Offline).", "error"); }
    }
    updateDashboardStatusBanner();
}

async function loadSettingsFromCloud(showAlert = false) {
    const scriptUrl = getAppScriptUrl();
    if (!scriptUrl) return;

    try {
        const response = await fetch(`${scriptUrl}?action=getSettings`);
        const result = await response.json();
        
        if (result.result === 'success' && result.data) {
            const cloudEvent = result.data.eventTitle || '';
            let cloudDate = result.data.date ? String(result.data.date).trim() : '';
            const cloudOpen = result.data.openTime ? String(result.data.openTime).trim() : '';
            const cloudClose = result.data.closeTime ? String(result.data.closeTime).trim() : '';

            localStorage.setItem('mb_setting_event_title', cloudEvent);
            localStorage.setItem('mb_setting_date', cloudDate);
            localStorage.setItem('mb_setting_open', cloudOpen);
            localStorage.setItem('mb_setting_close', cloudClose);

            const evInput = document.getElementById('settingEventTitle');
            const dateInput = document.getElementById('settingDate');
            const openInput = document.getElementById('settingOpenTime');
            const closeInput = document.getElementById('settingCloseTime');

            if (evInput) evInput.value = cloudEvent;
            if (dateInput) dateInput.value = cloudDate;
            if (openInput) openInput.value = cloudOpen;
            if (closeInput) closeInput.value = cloudClose;

            updateDashboardStatusBanner();
            if (showAlert) showToast("Data setting direfresh dari Cloud!", "success");
        }
    } catch (e) {
        if (showAlert) showToast("Gagal terhubung ke Cloud.", "error");
    }
}

function manualRefreshSettings() {
    loadSettingsFromCloud(true);
}

function resetActiveSettings() {
    if(!confirm("⚠️ Nonaktifkan jadwal aktif? Semua form setting akan dikosongkan.")) return;
    
    localStorage.removeItem('mb_setting_event_title');
    localStorage.removeItem('mb_setting_date');
    localStorage.removeItem('mb_setting_open');
    localStorage.removeItem('mb_setting_close');
    
    if(document.getElementById('settingEventTitle')) document.getElementById('settingEventTitle').value = '';
    if(document.getElementById('settingDate')) document.getElementById('settingDate').value = '';
    if(document.getElementById('settingOpenTime')) document.getElementById('settingOpenTime').value = '';
    if(document.getElementById('settingCloseTime')) document.getElementById('settingCloseTime').value = '';
    
    const scriptUrl = getAppScriptUrl();
    if(scriptUrl) {
        fetch(`${scriptUrl}?${new URLSearchParams({ action: 'saveSettings', eventTitle: '', date: '', openTime: '', closeTime: '' }).toString()}`);
    }
    
    updateDashboardStatusBanner();
    showToast("Jadwal berhasil dikosongkan / dinonaktifkan.", "success");
}

function updateDashboardStatusBanner() {
    const todayStr = getLocalDateString();
    const savedDate = localStorage.getItem('mb_setting_date');
    const openTime = localStorage.getItem('mb_setting_open') || '15:00';
    const closeTime = localStorage.getItem('mb_setting_close') || '18:00';
    const eventTitle = localStorage.getItem('mb_setting_event_title') || 'Latihan Rutin';

    const banner = document.getElementById('attendanceStatusBanner');
    const dot = document.getElementById('statusDot');
    const title = document.getElementById('statusTitle');
    const desc = document.getElementById('statusDesc');
    const hours = document.getElementById('statusHours');

    if(!banner) return;

    if(savedDate === todayStr) {
        banner.className = "p-3.5 sm:p-4 rounded-2xl shadow-sm border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-emerald-50 border-emerald-200";
        if(dot) dot.className = "w-3.5 h-3.5 rounded-full bg-emerald-600 shrink-0";
        if(title) { title.textContent = `AKTIF: ${eventTitle}`; title.className = "text-xs sm:text-sm font-bold text-emerald-900"; }
        if(desc) desc.textContent = `Jadwal tanggal ${savedDate} aktif.`;
        if(hours) hours.textContent = `${openTime} - ${closeTime}`;
    } else {
        banner.className = "p-3.5 sm:p-4 rounded-2xl shadow-sm border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-red-50 border-red-200";
        if(dot) dot.className = "w-3.5 h-3.5 rounded-full bg-red-600 animate-pulse shrink-0";
        if(title) { title.textContent = "Status Absensi Hari Ini: BELUM DISETTING"; title.className = "text-xs sm:text-sm font-bold text-red-900"; }
        if(desc) desc.textContent = savedDate ? `Jadwal tersimpan di tanggal ${savedDate} (Bukan hari ini).` : "Belum ada jadwal aktif.";
        if(hours) hours.textContent = "Belum Diatur";
    }
}

// ==========================================
// 6. LIVE REPORT & ANALYTICS ENGINE
// ==========================================
let reportCache = { date: '', data: [] };

async function loadReportData(forceRefresh = false) {
    const dateVal = document.getElementById('reportDate').value;
    const tbody = document.getElementById('reportTableBody');
    if(!tbody) return;
    const scriptUrl = getAppScriptUrl();
    if(!scriptUrl) return;

    if (reportCache.date !== dateVal || forceRefresh || reportCache.data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-slate-400">Memuat data...</td></tr>`;
        try {
            const res = await fetch(`${scriptUrl}?action=getReport&date=${dateVal}`);
            const json = await res.json();
            reportCache = { date: dateVal, data: json.result === 'success' ? (json.data || []) : [] };
        } catch (e) { tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-red-500">Gagal memuat.</td></tr>`; return; }
    }
    renderReportTable();
}

function renderReportTable() {
    const dateVal = document.getElementById('reportDate').value;
    const tbody = document.getElementById('reportTableBody');
    if(!tbody) return;

    const searchVal = document.getElementById('filterSearch') ? document.getElementById('filterSearch').value.toLowerCase() : '';
    const sectionVal = document.getElementById('filterSection') ? document.getElementById('filterSection').value : '';
    const statusVal = document.getElementById('filterStatus') ? document.getElementById('filterStatus').value : '';

    let list = reportCache.data.filter(r => {
        const matchSearch = searchVal === '' || r.Id.toLowerCase().includes(searchVal) || r.Nama.toLowerCase().includes(searchVal);
        const matchSection = sectionVal === '' || r.Section === sectionVal;
        const matchStatus = statusVal === '' || r.Status === statusVal;
        return matchSearch && matchSection && matchStatus;
    });

    updateChart(list);

    if(list.length === 0) { 
        tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-slate-400">Tidak ada data absensi.</td></tr>`; 
        return; 
    }
    
    tbody.innerHTML = '';
    list.forEach(r => {
        const tr = document.createElement('tr');
        tr.className = "border-b hover:bg-slate-50";
        tr.innerHTML = `
            <td class="p-3 font-mono whitespace-nowrap">${r.Time}</td>
            <td class="p-3 font-mono text-[#800000] font-bold whitespace-nowrap">${r.Id}</td>
            <td class="p-3 font-semibold whitespace-nowrap">${r.Nama}</td>
            <td class="p-3 whitespace-nowrap"><span class="px-2.5 py-1 rounded-full text-xs font-bold border ${getSectionBadgeClass(r.Section)}">${r.Section}</span></td>
            <td class="p-3 whitespace-nowrap"><span class="px-2.5 py-1 rounded-full text-xs shadow-sm ${getStatusBadgeClass(r.Status)}">${r.Status}</span></td>
            <td class="p-3 text-center flex items-center justify-center gap-2 whitespace-nowrap">
                <select onchange="updateStatus('${dateVal}', '${r.Id}', this.value)" class="border border-slate-300 rounded-lg text-xs p-1.5 bg-white cursor-pointer hover:border-slate-400 outline-none">
                    <option value="">Ubah...</option>
                    <option value="Hadir">Hadir</option>
                    <option value="Terlambat">Terlambat</option>
                    <option value="Izin">Izin</option>
                    <option value="Sakit">Sakit</option>
                    <option value="Alpa">Alpa</option>
                </select>
                <button onclick="deleteDailyRecord('${dateVal}', '${r.Id}', this)" class="bg-red-50 hover:bg-red-100 text-red-600 px-2.5 py-1.5 rounded-lg text-xs font-bold transition border border-red-200 shadow-sm">✕ Hapus</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function updateStatus(dateStr, playerId, newStatus) {
    if(!newStatus) return;
    const scriptUrl = getAppScriptUrl();
    if(!scriptUrl) return;

    let item = reportCache.data.find(r => r.Id === playerId);
    if(item) item.Status = newStatus;
    renderReportTable();

    try {
        await fetch(`${scriptUrl}?action=updateStatus&date=${dateStr}&id=${playerId}&status=${newStatus}`);
        showToast("Status berhasil diperbarui!", "success");
    } catch(err) {
        showToast("Gagal memperbarui status ke server.", "error");
    }
}

async function deleteDailyRecord(dateStr, playerId, btn) {
    if(!confirm(`Yakin ingin menghapus data absensi untuk ID ${playerId}?`)) return;
    const scriptUrl = getAppScriptUrl();
    if(!scriptUrl) return;

    reportCache.data = reportCache.data.filter(r => r.Id !== playerId);
    renderReportTable();

    try {
        await fetch(`${scriptUrl}?action=deleteRecord&date=${dateStr}&id=${playerId}`);
        showToast("Data absensi dihapus.", "success");
    } catch(err) {
        showToast("Gagal menghapus data.", "error");
        loadReportData(true);
    }
}

let attendanceChart = null;
function updateChart(records) {
    const ctx = document.getElementById('attendanceChart');
    if(!ctx) return;
    const stats = { Hadir: 0, Terlambat: 0, Izin: 0, Sakit: 0, Alpa: 0 };
    records.forEach(r => { if(stats[r.Status] !== undefined) stats[r.Status]++; });
    
    if(attendanceChart) attendanceChart.destroy();
    attendanceChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Hadir', 'Terlambat', 'Izin', 'Sakit', 'Alpa'],
            datasets: [{
                label: 'Jumlah Anggota',
                data: [stats.Hadir, stats.Terlambat, stats.Izin, stats.Sakit, stats.Alpa],
                backgroundColor: ['#10b981', '#f59e0b', '#f97316', '#94a3b8', '#ef4444'],
                borderRadius: 6
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
    });
}

// ==========================================
// 7. MODALS, AKSI UNATTENDED & EXPORT
// ==========================================
function checkUnattendedPlayers() {
    const dateVal = document.getElementById('reportDate').value;
    if(!dateVal) return showToast("Pilih tanggal terlebih dahulu!", "error");
    
    const modal = document.getElementById('unattendedModal');
    const content = document.getElementById('unattendedModalContent');
    const subtitle = document.getElementById('unattendedModalSubtitle');
    
    modal.classList.remove('hidden');
    subtitle.textContent = `Tanggal: ${dateVal} • Klik inisial untuk input manual`;
    
    const allPlayers = getStoredPlayers();
    const attendedIds = reportCache.data.map(r => String(r.Id));
    const unattended = allPlayers.filter(p => !attendedIds.includes(String(p.Id)));
    
    if(unattended.length === 0) {
        content.innerHTML = `<div class="text-center py-8"><p class="text-emerald-600 font-bold text-lg">🎉 Sempurna!</p><p class="text-sm text-slate-500">Semua anggota telah hadir / tercatat hari ini.</p></div>`;
        return;
    }
    
    let html = `
    <div class="overflow-x-auto border rounded-2xl no-scrollbar">
        <table class="w-full text-left text-xs min-w-[420px]">
            <thead class="bg-slate-50 border-b text-slate-700">
                <tr>
                    <th class="p-3 whitespace-nowrap">ID</th>
                    <th class="p-3 whitespace-nowrap">Nama</th>
                    <th class="p-3 whitespace-nowrap">Section</th>
                    <th class="p-3 text-center whitespace-nowrap">Aksi Input Status</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">`;

    unattended.forEach(p => {
        html += `
        <tr class="hover:bg-slate-50">
            <td class="p-3 font-mono font-bold whitespace-nowrap">${p.Id}</td>
            <td class="p-3 whitespace-nowrap">${p.Nama}</td>
            <td class="p-3 whitespace-nowrap"><span class="px-2 py-0.5 rounded-full text-[10px] font-bold border ${getSectionBadgeClass(p.Section)}">${p.Section}</span></td>
            <td class="p-3 text-center whitespace-nowrap">
                <div class="flex items-center justify-center gap-1" id="btn-group-${p.Id}">
                    <button onclick="markUnattendedStatus('${p.Id}', 'Hadir', document.getElementById('btn-group-${p.Id}'))" title="Hadir" class="w-7 h-7 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-xs transition transform hover:scale-105 cursor-pointer">H</button>
                    <button onclick="markUnattendedStatus('${p.Id}', 'Terlambat', document.getElementById('btn-group-${p.Id}'))" title="Terlambat" class="w-7 h-7 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-black text-xs shadow-xs transition transform hover:scale-105 cursor-pointer">T</button>
                    <button onclick="markUnattendedStatus('${p.Id}', 'Izin', document.getElementById('btn-group-${p.Id}'))" title="Izin" class="w-7 h-7 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-black text-xs shadow-xs transition transform hover:scale-105 cursor-pointer">I</button>
                    <button onclick="markUnattendedStatus('${p.Id}', 'Sakit', document.getElementById('btn-group-${p.Id}'))" title="Sakit" class="w-7 h-7 rounded-lg bg-slate-500 hover:bg-slate-600 text-white font-black text-xs shadow-xs transition transform hover:scale-105 cursor-pointer">S</button>
                    <button onclick="markUnattendedStatus('${p.Id}', 'Alpa', document.getElementById('btn-group-${p.Id}'))" title="Alpa" class="w-7 h-7 rounded-lg bg-red-600 hover:bg-red-700 text-white font-black text-xs shadow-xs transition transform hover:scale-105 cursor-pointer">A</button>
                </div>
            </td>
        </tr>`;
    });

    html += `</tbody></table></div>`;
    content.innerHTML = html;
}

// Fungsi Input Manual Presensi Langsung dari Modal Belum Hadir
async function markUnattendedStatus(playerId, newStatus, btnGroup) {
    const player = getStoredPlayers().find(p => String(p.Id) === String(playerId));
    if (!player) return;

    const originalHtml = btnGroup.innerHTML;
    btnGroup.innerHTML = `<span class="text-[10px] text-slate-400 animate-pulse font-bold">Menyimpan...</span>`;

    const timestamp = getFormattedLocalDateTime();
    const timeOnly = timestamp.split(' ')[1] || '';
    const scriptUrl = getAppScriptUrl();

    try {
        if (scriptUrl) {
            const res = await fetch(`${scriptUrl}?${new URLSearchParams({
                id: player.Id,
                nama: player.Nama,
                section: player.Section || '',
                status: newStatus,
                timestamp: timestamp
            }).toString()}`);
            
            const data = await res.json();
            
            if (data.result === 'duplicate') {
                showToast(`Peringatan: ${player.Nama} sudah tercatat hari ini.`, "error");
            } else {
                showToast(`Presensi ${player.Nama} (${newStatus}) tersimpan!`, "success");
            }
        }

        reportCache.data.push({
            Time: timeOnly,
            Id: player.Id,
            Nama: player.Nama,
            Section: player.Section || '',
            Status: newStatus
        });

        renderReportTable();
        checkUnattendedPlayers();

    } catch (e) {
        showToast("Tersimpan secara lokal (Offline).", "error");
        btnGroup.innerHTML = originalHtml;
    }
}

function closeUnattendedModal() {
    document.getElementById('unattendedModal').classList.add('hidden');
}

function exportToPDF() {
    const dateVal = document.getElementById('reportDate').value;
    if(!dateVal || reportCache.data.length === 0) return showToast("Tidak ada data untuk diekspor!", "error");
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    doc.setFontSize(14);
    doc.setTextColor(128, 0, 0);
    doc.text(`Laporan Absensi Marching Band UMM`, 14, 15);
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Tanggal: ${dateVal}`, 14, 22);
    
    const tableColumn = ["Waktu Scan", "ID", "Nama", "Section", "Status"];
    const tableRows = [];
    
    reportCache.data.forEach(r => {
        tableRows.push([r.Time, r.Id, r.Nama, r.Section, r.Status]);
    });
    
    doc.autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: 28,
        theme: 'grid',
        headStyles: { fillColor: [128, 0, 0] }
    });
    
    doc.save(`Absensi_MBUMM_${dateVal}.pdf`);
    showToast("PDF berhasil diunduh!", "success");
}

window.onload = async function() {
    const today = getLocalDateString();
    
    document.getElementById('settingEventTitle').value = localStorage.getItem('mb_setting_event_title') || 'Latihan Rutin';
    document.getElementById('settingDate').value = localStorage.getItem('mb_setting_date') || today;
    document.getElementById('settingOpenTime').value = localStorage.getItem('mb_setting_open') || '15:00';
    document.getElementById('settingCloseTime').value = localStorage.getItem('mb_setting_close') || '18:00';
    document.getElementById('settingScriptUrl').value = getAppScriptUrl();

    updateDashboardStatusBanner();
    loadQRTable();
    syncPlayersFromCloud();
    
    await loadSettingsFromCloud(false);
    switchTab('home');
};