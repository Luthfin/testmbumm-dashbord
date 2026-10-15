// ==========================================
// KONFIGURASI UTAMA APLIKASI
// ==========================================
const DEFAULT_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxJGU8YPqreBWTFWKFr4l0p_BGrodkH_DIWX4Wooc3CIsjVbm7GNhV-g5bcwgPVEhas/exec"; 

function getAppScriptUrl() {
    const savedUrl = localStorage.getItem('mb_setting_script');
    return savedUrl && savedUrl.trim() !== '' ? savedUrl : DEFAULT_SCRIPT_URL;
}

function getLocalDateString() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if(!container) return;

    const toast = document.createElement('div');
    const bgClass = type === 'success' ? 'bg-emerald-600' : (type === 'error' ? 'bg-red-600' : 'bg-slate-800');
    const icon = type === 'success' ? '✅' : (type === 'error' ? '⚠️' : 'ℹ️');
    
    toast.className = `${bgClass} text-white px-4 py-3 rounded-xl shadow-2xl text-xs sm:text-sm font-bold transform transition-all duration-300 translate-y-10 opacity-0 flex items-center gap-2 max-w-xs w-full pointer-events-auto`;
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
            if (showAlert) {
                showToast("Data player berhasil direfresh dari Cloud!", "success");
            }
        }
    } catch (e) { 
        console.error("Gagal sinkronisasi cloud:", e);
        if (showAlert) {
            showToast("Gagal terhubung ke Cloud.", "error");
        }
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

// ==========================================
// 1. FUNGSI TABEL MASTER PLAYER (Dengan Fitur Filter & Search)
// ==========================================
function loadPlayersTable() {
    const tbody = document.getElementById('playerTableBody');
    if (!tbody) return;
    
    // Ambil nilai dari input pencarian
    const searchVal = document.getElementById('filterPlayerSearch') ? document.getElementById('filterPlayerSearch').value.toLowerCase() : '';
    const sectionVal = document.getElementById('filterPlayerSection') ? document.getElementById('filterPlayerSection').value : '';

    const players = getStoredPlayers();
    
    // Proses Filter
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
            <td class="p-3 font-mono font-bold">${p.Id}</td>
            <td class="p-3">${p.Nama}</td>
            <td class="p-3"><span class="px-2.5 py-1 rounded-full text-xs font-semibold ${getSectionBadgeClass(p.Section)}">${p.Section}</span></td>
            <td class="p-3 font-mono text-xs">${p.NIM || '-'}</td>
            <td class="p-3 text-xs text-slate-500">${p.Email || '-'}</td>
            <td class="p-3 text-center"><button onclick="deletePlayer('${p.Id}', this)" class="bg-red-500 text-white px-2.5 py-1 rounded-lg text-xs hover:bg-red-600 font-bold shadow-sm">🗑️ Hapus</button></td>
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

function clearAllPlayers() {
    if(confirm(`⚠️ PERINGATAN: Hapus semua data player lokal?`)) {
        localStorage.removeItem('mb_players');
        loadPlayersTable();
        showToast("Data player dikosongkan.", "success");
    }
}

function getSectionBadgeClass(section) {
    switch(section) {
        case 'Field Commander': return 'bg-amber-100 text-amber-800 border border-amber-300';
        case 'Brass': return 'bg-blue-100 text-blue-800 border border-blue-300';
        case 'Battery': return 'bg-red-100 text-red-800 border border-red-300';
        case 'Pit Percussion': return 'bg-pink-100 text-pink-800 border border-pink-300';
        case 'Color Guard': return 'bg-emerald-100 text-emerald-800 border border-emerald-300';
        default: return 'bg-slate-100 text-slate-800 border border-slate-300';
    }
}

function getStatusBadgeClass(status) {
    switch(status) {
        case 'Hadir': return 'bg-emerald-100 text-emerald-800 font-bold border border-emerald-300';
        case 'Terlambat': return 'bg-amber-100 text-amber-800 font-bold border border-amber-300';
        case 'Izin': return 'bg-orange-100 text-orange-800 font-bold border border-orange-300';
        case 'Sakit': return 'bg-slate-200 text-slate-700 font-bold border border-slate-300';
        case 'Alpa': return 'bg-red-100 text-red-800 font-bold border border-red-300';
        default: return 'bg-slate-100 text-slate-800 font-bold border border-slate-300';
    }
}

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
            <td class="p-3 font-mono font-bold">${p.Id}</td>
            <td class="p-3">${p.Nama}</td>
            <td class="p-3"><span class="px-2.5 py-1 rounded-full text-xs font-semibold ${getSectionBadgeClass(p.Section)}">${p.Section}</span></td>
            <td class="p-3 text-center"><button onclick='previewAndDownloadQR(${JSON.stringify(p)})' class="btn-maroon px-3 py-1.5 rounded-lg text-xs font-bold">📥 Download QR</button></td>
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
// 4. CLOUD SETTING & STATUS STABIL
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

            // Simpan ke localStorage
            localStorage.setItem('mb_setting_event_title', cloudEvent);
            localStorage.setItem('mb_setting_date', cloudDate);
            localStorage.setItem('mb_setting_open', cloudOpen);
            localStorage.setItem('mb_setting_close', cloudClose);

            // Masukkan ke form HTML Tab Setting
            const evInput = document.getElementById('settingEventTitle');
            const dateInput = document.getElementById('settingDate');
            const openInput = document.getElementById('settingOpenTime');
            const closeInput = document.getElementById('settingCloseTime');

            if (evInput) evInput.value = cloudEvent;
            if (dateInput) dateInput.value = cloudDate; // Format string yyyy-MM-dd pas untuk input date HTML
            if (openInput) openInput.value = cloudOpen;
            if (closeInput) closeInput.value = cloudClose;

            updateDashboardStatusBanner();
            if (showAlert) showToast("Data setting berhasil direfresh dari Cloud!", "success");
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
    
    // Hapus dari localStorage
    localStorage.removeItem('mb_setting_event_title');
    localStorage.removeItem('mb_setting_date');
    localStorage.removeItem('mb_setting_open');
    localStorage.removeItem('mb_setting_close');
    
    // Kosongkan form HTML
    if(document.getElementById('settingEventTitle')) document.getElementById('settingEventTitle').value = '';
    if(document.getElementById('settingDate')) document.getElementById('settingDate').value = '';
    if(document.getElementById('settingOpenTime')) document.getElementById('settingOpenTime').value = '';
    if(document.getElementById('settingCloseTime')) document.getElementById('settingCloseTime').value = '';
    
    // Kirim data kosong ke Cloud agar semua perangkat ikut kosong
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
        banner.className = "p-4 rounded-2xl shadow-sm border flex flex-col sm:flex-row justify-between items-center gap-3 bg-emerald-50 border-emerald-200";
        if(dot) dot.className = "w-3.5 h-3.5 rounded-full bg-emerald-600";
        if(title) { title.textContent = `AKTIF: ${eventTitle}`; title.className = "text-sm font-bold text-emerald-900"; }
        if(desc) desc.textContent = `Jadwal tanggal ${savedDate} aktif.`;
        if(hours) hours.textContent = `${openTime} - ${closeTime}`;
    } else {
        banner.className = "p-4 rounded-2xl shadow-sm border flex flex-col sm:flex-row justify-between items-center gap-3 bg-red-50 border-red-200";
        if(dot) dot.className = "w-3.5 h-3.5 rounded-full bg-red-600 animate-pulse";
        if(title) { title.textContent = "Status Absensi Hari Ini: BELUM DISETTING"; title.className = "text-sm font-bold text-red-900"; }
        if(desc) desc.textContent = savedDate ? `Jadwal tersimpan di tanggal ${savedDate} (Bukan hari ini).` : "Belum ada jadwal aktif.";
        if(hours) hours.textContent = "Belum Diatur";
    }
}

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

// ==========================================
// 2. FUNGSI TABEL LIVE REPORT (Perbaikan Filter & Chart Kosong)
// ==========================================
function renderReportTable() {
    const dateVal = document.getElementById('reportDate').value;
    const tbody = document.getElementById('reportTableBody');
    if(!tbody) return;

    // Ambil nilai filter dari HTML
    const searchVal = document.getElementById('filterSearch') ? document.getElementById('filterSearch').value.toLowerCase() : '';
    const sectionVal = document.getElementById('filterSection') ? document.getElementById('filterSection').value : '';
    const statusVal = document.getElementById('filterStatus') ? document.getElementById('filterStatus').value : '';

    // Proses Filter Data Live Report
    let list = reportCache.data.filter(r => {
        const matchSearch = searchVal === '' || r.Id.toLowerCase().includes(searchVal) || r.Nama.toLowerCase().includes(searchVal);
        const matchSection = sectionVal === '' || r.Section === sectionVal;
        const matchStatus = statusVal === '' || r.Status === statusVal;
        return matchSearch && matchSection && matchStatus;
    });

    // UPDATE CHART TERLEBIH DAHULU: 
    // Ini memastikan jika "list" kosong, grafik akan di-reset (0 semua)
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
            <td class="p-3 font-mono">${r.Time}</td>
            <td class="p-3 font-mono text-[#800000] font-bold">${r.Id}</td>
            <td class="p-3 font-semibold">${r.Nama}</td>
            <td class="p-3"><span class="px-2.5 py-1 rounded-full text-xs font-bold border ${getSectionBadgeClass(r.Section)}">${r.Section}</span></td>
            <td class="p-3"><span class="px-2.5 py-1 rounded-full text-xs shadow-sm ${getStatusBadgeClass(r.Status)}">${r.Status}</span></td>
            <td class="p-3 text-center flex items-center justify-center gap-2">
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

// Inisialisasi Halaman Utama
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

// ==========================================
// FITUR MODAL CEK BELUM HADIR
// ==========================================
function checkUnattendedPlayers(btn) {
    const dateVal = document.getElementById('reportDate').value;
    if(!dateVal) return showToast("Pilih tanggal terlebih dahulu!", "error");
    
    const modal = document.getElementById('unattendedModal');
    const content = document.getElementById('unattendedModalContent');
    const subtitle = document.getElementById('unattendedModalSubtitle');
    
    modal.classList.remove('hidden');
    subtitle.textContent = `Tanggal: ${dateVal}`;
    
    const allPlayers = getStoredPlayers();
    const attendedIds = reportCache.data.map(r => String(r.Id));
    const unattended = allPlayers.filter(p => !attendedIds.includes(String(p.Id)));
    
    if(unattended.length === 0) {
        content.innerHTML = `<div class="text-center py-8"><p class="text-emerald-600 font-bold text-lg">🎉 Sempurna!</p><p class="text-sm text-slate-500">Semua anggota telah hadir hari ini.</p></div>`;
        return;
    }
    
    let html = `<table class="w-full text-left text-xs"><thead class="bg-slate-50 border-b text-slate-700"><tr><th class="p-3">ID</th><th class="p-3">Nama</th><th class="p-3">Section</th></tr></thead><tbody class="divide-y divide-slate-100">`;
    unattended.forEach(p => {
        html += `<tr class="hover:bg-slate-50"><td class="p-3 font-mono">${p.Id}</td><td class="p-3">${p.Nama}</td><td class="p-3"><span class="px-2.5 py-1 rounded-full text-[10px] font-bold border ${getSectionBadgeClass(p.Section)}">${p.Section}</span></td></tr>`;
    });
    html += `</tbody></table>`;
    content.innerHTML = html;
}

function closeUnattendedModal() {
    document.getElementById('unattendedModal').classList.add('hidden');
}

// ==========================================
// FITUR EKSPOR PDF & KOSONGKAN TAB
// ==========================================
function exportToPDF() {
    const dateVal = document.getElementById('reportDate').value;
    if(!dateVal || reportCache.data.length === 0) return showToast("Tidak ada data untuk diekspor!", "error");
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    doc.setFontSize(14);
    doc.setTextColor(128, 0, 0); // Maroon
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

function clearDailyAttendance() {
    showToast("Fitur hapus satu tabel dilarang dari sisi klien untuk alasan keamanan. Silakan hapus sheet dari Google Sheets langsung.", "error");
}