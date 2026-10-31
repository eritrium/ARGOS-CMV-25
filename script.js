// ===== VERSIONE DELLA PAGINA =====
// Quando aggiorni il sito, cambia questo numero e quello in version.json (devono essere uguali)
const VERSIONE_PAGINA = "2";

document.addEventListener('DOMContentLoaded', function () {

    const norm = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

    function gestisciAvviso() {
        const box = document.getElementById("messaggioAvviso");
        box.style.display = box.textContent.trim() !== "" ? "block" : "none";
    }
    gestisciAvviso();

    const motoscafoSelect = document.getElementById('motoscafo');
    const dataInput = document.getElementById('dataMotoscafo');
    const outputMotoscafo = document.getElementById('outputMotoscafo');

    const dataServizio = document.getElementById('dataServizio');
    const outputServizio = document.getElementById('outputServizio');

    // ===== ARGOS: griglia di numeri, un tocco = turno =====
    const grigliaNum = document.getElementById('grigliaMotoscafi');
    const filtro = document.getElementById('filtroMotoscafo');
    const btnTutti = document.getElementById('verificaTutti');
    let scelta = null;                 // numero del motoscafo oppure 'TUTTI'
    let tokenArgos = 0;
    Array.from(motoscafoSelect.options).map(o => o.value).filter(Boolean).forEach(n => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'num-btn'; b.textContent = n; b.dataset.n = n;
        b.addEventListener('click', () => { scelta = n; mostraArgos(); });
        grigliaNum.appendChild(b);
    });
    filtro.addEventListener('input', () => {
        const q = norm(filtro.value).replace(/ /g, '');
        grigliaNum.querySelectorAll('.num-btn').forEach(b => { b.style.display = norm(b.dataset.n).startsWith(q) ? '' : 'none'; });
    });
    btnTutti.addEventListener('click', () => { scelta = 'TUTTI'; mostraArgos(); });
    dataInput.addEventListener('change', mostraArgos);

    async function mostraArgos() {
        grigliaNum.querySelectorAll('.num-btn').forEach(b => b.classList.toggle('attivo', b.dataset.n === scelta));
        btnTutti.classList.toggle('attivo', scelta === 'TUTTI');
        if (!scelta) return;
        const data = dataInput.value;
        if (!data) { outputMotoscafo.textContent = 'Per favore seleziona una data.'; return; }
        const id = ++tokenArgos;
        try {
            const turni = await (await fetch('turni.json', { cache: 'no-store' })).json();
            if (id !== tokenArgos) return;
            const del = turni.filter(t => t.data === data);
            if (scelta === 'TUTTI') {
                if (!del.length) { outputMotoscafo.textContent = 'Nessun turno trovato.'; return; }
                const ordine = Array.from(motoscafoSelect.options).map(o => o.value).filter(Boolean);
                const righe = ordine.map(m => {
                    const t = del.find(x => x.motoscafo === m);
                    return `<tr><td>${m}</td><td>${t && t.turno ? esc(t.turno) : '-'}</td></tr>`;
                }).join('');
                outputMotoscafo.innerHTML = `<div class="table-wrapper"><div class="data-title">${formatDate(data)}</div>
                    <table><thead><tr><th>Num</th><th>Turno</th></tr></thead><tbody>${righe}</tbody></table></div>`;
            } else {
                const t = del.find(x => x.motoscafo === scelta);
                outputMotoscafo.innerHTML = `<div class="risultato"><div class="rn">Motoscafo ${esc(scelta)}</div>
                    <div class="rd">${formatDate(data)}</div><div class="rt">${t && t.turno ? esc(t.turno) : 'Nessun turno trovato'}</div></div>`;
                outputMotoscafo.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        } catch (e) {
            outputMotoscafo.textContent = 'Errore nel caricamento dei dati.';
        }
    }

    async function renderServizio(servizio, data, outputServizio) {
        try {
            const response = await fetch('salute_apt.json', { cache: 'no-store' });
            const turni = await response.json();

            if (servizio === "SALUTE") {

                const filtrati = turni.filter(r =>
                    r.data === data &&
                    r.servizio === "SALUTE" &&
                    r.num.trim() !== "" &&
                    r.inizio.trim() !== "" &&
                    r.fine.trim() !== ""
                );

                if (filtrati.length === 0) {
                    outputServizio.innerHTML = "<p style='color:#ff6b6b;'>Nessun dato SALUTE per questa data.</p>";
                    return;
                }

                function coloreFascia(inizio, fine) {
                    const fascia = `${inizio}-${fine}`;
                    switch (fascia) {
                        case "08-20": return "verde";
                        case "08-18": return "arancio";
                        case "18-20": return "blu";
                        case "18-24": return "viola";
                        case "08-24": return "giallo";
                        default: return "";
                    }
                }

                const haNote = filtrati.some(r => r.nota && r.nota.trim() !== "");
                let righe = "";

                filtrati.forEach(r => {
                    const inizio = r.inizio.padStart(2, "0");
                    const fine = r.fine.padStart(2, "0");

                    const fascia = `${inizio}-${fine}`;
                    const colore = coloreFascia(inizio, fine);

                    righe += `
                        <tr class="${colore}">
                            <td>${r.num}</td>
                            <td>${fascia}</td>
                            ${haNote ? `<td class="nota-cella">${r.nota ? `<span class="chip-nota">${esc(r.nota)}</span>` : ""}</td>` : ""}
                        </tr>
                    `;
                });

                outputServizio.innerHTML = `
                    <div class="table-wrapper" data-servizio="${servizio}">
                        <div class="data-title">${formatDate(data)}</div>
                        <table>
                            <thead>
                                <tr>
                                    <th>Num</th>
                                    <th>Orario</th>
                                    ${haNote ? "<th>Note</th>" : ""}
                                </tr>
                            </thead>
                            <tbody>${righe}</tbody>
                        </table>
                    </div>
                `;

                return;
            }

            const finali = turni.filter(r =>
                r.data === data &&
                r.num &&
                r.num.trim() !== "" &&
                (
                    r.servizio === servizio ||
                    (servizio === "APT" && r.servizio === "EXTRA APT")
                )
            );

            if (finali.length === 0) {
                outputServizio.innerHTML = "<p style='color:#ff6b6b;'>Nessun dato trovato.</p>";
                return;
            }

            const haNote = finali.some(r => r.nota && r.nota.trim() !== "");

            function coloreRiga(r) {
                const ini = r.inizio.padStart(2, "0");
                const fin = r.fine.padStart(2, "0");
                let colore = "";
                if (servizio === "APT") {
                    if (ini === "07" && fin === "18") colore = "verde";
                    if (ini === "07" && fin === "24") colore = "arancio";
                    if (r.servizio === "EXTRA APT") colore = "giallo";
                    if (/excelsior/i.test(r.nota || "")) colore = "giallo";
                }
                return colore;
            }

            let righeTotali = "";
            let i = 0;

            while (i < finali.length) {

                const r = finali[i];
                const orarioCompleto = `${r.inizio.padStart(2, "0")} → ${r.fine.padStart(2, "0")}`;
                const colore = coloreRiga(r);

                // raggruppa le barche consecutive con stesso orario e stesso colore
                let j = i;
                while (
                    j < finali.length &&
                    finali[j].inizio === r.inizio &&
                    finali[j].fine === r.fine &&
                    finali[j].servizio === r.servizio &&
                    coloreRiga(finali[j]) === colore
                ) {
                    j++;
                }

                const rowspan = j - i;

                for (let k = i; k < j; k++) {
                    const riga = finali[k];
                    const cellaNota = haNote
                        ? `<td class="nota-cella">${riga.nota ? `<span class="chip-nota">${esc(riga.nota)}</span>` : ""}</td>`
                        : "";

                    if (k === i) {
                        righeTotali += `
                            <tr class="${colore}">
                                <td>${riga.num}</td>
                                <td rowspan="${rowspan}" class="orario-unico">${orarioCompleto}</td>
                                ${cellaNota}
                            </tr>
                        `;
                    } else {
                        righeTotali += `
                            <tr class="${colore}">
                                <td>${riga.num}</td>
                                ${cellaNota}
                            </tr>
                        `;
                    }
                }

                i = j;
            }

            outputServizio.innerHTML = `
                <div class="table-wrapper" data-servizio="${servizio}">
                    <div class="data-title">${formatDate(data)}</div>
                    <table>
                        <thead>
                            <tr>
                                <th>Num</th>
                                <th>Orario</th>
                                ${haNote ? "<th>Note</th>" : ""}
                            </tr>
                        </thead>
                        <tbody>${righeTotali}</tbody>
                    </table>
                </div>
            `;

        } catch (error) {
            outputServizio.textContent = "Errore nel caricamento dei dati.";
        }
    }

    // ===== SALUTE / APT: un tocco = tabella =====
    const segServizio = document.getElementById('segServizio');
    let servizioCorrente = null, tokenServ = 0;
    segServizio.querySelectorAll('button').forEach(b =>
        b.addEventListener('click', () => { servizioCorrente = b.dataset.s; mostraServizi(); }));
    async function mostraServizi() {
        segServizio.querySelectorAll('button').forEach(b => b.classList.toggle('attivo', b.dataset.s === servizioCorrente));
        if (!servizioCorrente) return;
        const data = dataServizio.value;
        if (!data) { outputServizio.textContent = 'Per favore seleziona una data.'; return; }
        const id = ++tokenServ;
        outputServizio.innerHTML = '';
        for (const s of (servizioCorrente === 'BOTH' ? ['APT', 'SALUTE'] : [servizioCorrente])) {
            const t = document.createElement('div');
            outputServizio.appendChild(t);
            await renderServizio(s, data, t);
            if (id !== tokenServ) return;
        }
    }

    function esc(t) {
        return String(t == null ? "" : t)
            .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    function formatDate(s) {
        const [y, m, d] = s.split('-').map(Number);
        const t = new Date(y, m - 1, d).toLocaleDateString('it-IT',
            { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
        return t.charAt(0).toUpperCase() + t.slice(1);
    }

    // ===== TARIFFE: bottoni hotel, un tocco = tariffe =====
    const hotelSelect = document.getElementById("hotelSelect");     // resta nascosto: e' l'elenco degli hotel
    const grigliaHotel = document.getElementById("grigliaHotel");
    const filtroHotel = document.getElementById("filtroHotel");
    const risultatiTariffe = document.getElementById("risultatiTariffe");
    const hotelList = Array.from(hotelSelect.options).map(o => o.value).filter(v => v !== "");
    let datiTariffe = null, hotelScelto = null;

    hotelList.forEach(h => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'hotel-btn'; b.textContent = h; b.dataset.h = h;
        b.addEventListener('click', () => {
            hotelScelto = h;
            mostraTariffe(true);
        });
        grigliaHotel.appendChild(b);
    });
    filtroHotel.addEventListener('input', () => {
        const q = norm(filtroHotel.value);
        grigliaHotel.querySelectorAll('.hotel-btn').forEach(b => { b.style.display = norm(b.dataset.h).includes(q) ? '' : 'none'; });
    });

    async function mostraTariffe(scorri) {
        grigliaHotel.querySelectorAll('.hotel-btn').forEach(b => b.classList.toggle('attivo', b.dataset.h === hotelScelto));
        if (!hotelScelto) { risultatiTariffe.innerHTML = ''; return; }
        try {
            if (!datiTariffe) datiTariffe = await (await fetch("tariffe.json", { cache: "no-store" })).json();
        } catch (e) {
            risultatiTariffe.innerHTML = "<p style='color:#ff6b6b;'>Errore nel caricamento delle tariffe.</p>";
            return;
        }
        const visibili = datiTariffe.tariffe.filter(t => t.hotel === hotelScelto);   // tutto l'elenco, nell'ordine del file
        if (!visibili.length) { risultatiTariffe.innerHTML = "<p style='color:#ff6b6b;'>Nessuna tariffa trovata.</p>"; return; }

        // supplementi: righe che non appartengono a nessun hotel (la prima e' l'intestazione)
        const suppl = datiTariffe.tariffe.filter(t => !hotelList.includes(t.hotel) && !(t.hotel.trim() === "" && t.destinazione.trim() === ""))
            .filter(t => t.hotel.trim().toUpperCase() !== "SUPPLEMENTO");

        let html = `<h4 style="margin:15px 0 8px; text-align:center;">Tariffe per ${esc(hotelScelto)}</h4>`;
        if (suppl.length) {
            html += `<div class="suppl"><div class="suppl-t">SUPPLEMENTI</div>` +
                suppl.map(s => `<span>${esc(s.hotel)} <b>${esc(s.destinazione)}</b></span>`).join('') + `</div>`;
        }
        {
            html += `<table><thead><tr><th>Destinazione</th><th>Importo (1-4 PAX)</th></tr></thead><tbody>` +
                visibili.map((t, i) => {
                    const ok = t.importo && t.importo !== "";
                    return `<tr class="${i % 2 === 0 ? 'riga-pari' : 'riga-dispari'}${ok ? '' : ' senza-prezzo'}">
                        <td>${esc(t.destinazione)}</td><td class="imp">${ok ? esc(t.importo) : '-'}</td></tr>`;
                }).join('') + `</tbody></table>`;
        }
        risultatiTariffe.innerHTML = html;
        if (scorri) risultatiTariffe.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // ===== RICERCA VOCALE =====
    const UNITA = { zero: 0, uno: 1, un: 1, due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6, sette: 7, otto: 8, nove: 9, dieci: 10, undici: 11,
        dodici: 12, tredici: 13, quattordici: 14, quindici: 15, sedici: 16, diciassette: 17, diciotto: 18, diciannove: 19,
        venti: 20, trenta: 30, quaranta: 40, cinquanta: 50, sessanta: 60, settanta: 70, ottanta: 80, novanta: 90 };
    const TOKEN = Object.keys(UNITA).concat('cento').sort((a, b) => b.length - a.length);
    function paroleANumero(t) {          // "centocinquantasei" -> 156, "uno cinque sei" -> 156
        const parole = t.toLowerCase().replace(/[^a-z ]/g, ' ').trim().split(/\s+/).filter(Boolean);
        if (parole.length > 1 && parole.every(p => UNITA[p] !== undefined && UNITA[p] < 10)) return parole.map(p => UNITA[p]).join('');
        let s = parole.join('').replace(/(vent|trent|quarant|cinquant|sessant|settant|ottant|novant)(uno|otto)/g, (m, a, b) => a + (a === 'vent' ? 'i' : 'a') + b);
        let cur = 0, ok = s.length > 0;
        while (s && ok) {
            const k = TOKEN.find(x => s.startsWith(x));
            if (!k) { ok = false; break; }
            if (k === 'cento') cur = (cur || 1) * 100; else cur += UNITA[k];
            s = s.slice(k.length);
        }
        return ok ? String(cur) : '';
    }
    function candidatoMotoscafo(t) {
        let u = t.toUpperCase().replace(/\b(ENNE|NOLO|NOLEGGIO)\b/g, 'N').replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
        const n = u.match(/^N ?(.*)$/);
        const prefisso = n ? 'N' : '';
        let resto = n ? n[1] : u;
        if (/^[0-9 ]+$/.test(resto) && resto) return prefisso + resto.replace(/ /g, '');
        const p = paroleANumero(resto.toLowerCase());
        return p ? prefisso + p : u.replace(/ /g, '');
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    function applicaVoce(per, alternative) {
        if (per === 'filtroMotoscafo') {
            const esistenti = Array.from(grigliaNum.querySelectorAll('.num-btn')).map(b => b.dataset.n);
            const cand = alternative.map(candidatoMotoscafo);
            const esatto = cand.find(c => esistenti.includes(c));
            filtro.value = esatto || cand[0] || '';
            filtro.dispatchEvent(new Event('input'));
            if (esatto) grigliaNum.querySelector('.num-btn[data-n="' + esatto + '"]').click();
        } else {
            const pulisci = t => norm(t).replace(/^(HOTEL|ALBERGO|PALAZZO DI) /, '');
            let scelto = alternative[0] || '';
            for (const a of alternative) {
                const q = pulisci(a);
                if (q && hotelList.some(h => norm(h).includes(q))) { scelto = a; break; }
            }
            filtroHotel.value = pulisci(scelto);
            filtroHotel.dispatchEvent(new Event('input'));
            const visibili = Array.from(grigliaHotel.querySelectorAll('.hotel-btn')).filter(b => b.style.display !== 'none');
            if (visibili.length === 1) visibili[0].click();
        }
    }
    document.querySelectorAll('.mic').forEach(btn => {
        if (!SR) { btn.style.display = 'none'; return; }
        btn.addEventListener('click', () => {
            const r = new SR();
            r.lang = 'it-IT'; r.interimResults = false; r.maxAlternatives = 4;
            btn.classList.add('ascolta');
            r.onresult = e => applicaVoce(btn.dataset.per, Array.from(e.results[0]).map(a => a.transcript));
            r.onerror = r.onend = () => btn.classList.remove('ascolta');
            try { r.start(); } catch (e) { btn.classList.remove('ascolta'); }
        });
    });
    window.__voce = { paroleANumero, candidatoMotoscafo, applicaVoce };   // solo per le prove

    const btnToggleArgos = document.getElementById('toggleArgos');
    const btnToggleSaluteApt = document.getElementById('toggleSaluteApt');
    const btnToggleTariffe = document.getElementById('toggleTariffe');

    const sezioneArgos = document.getElementById('sezioneArgos');
    const sezioneSaluteApt = document.getElementById('sezioneSaluteApt');
    const sezioneTariffe = document.getElementById('sezioneTariffe');

    const sezioni = [sezioneArgos, sezioneSaluteApt, sezioneTariffe];

    function toggleSezione(sezione) {
        const èVisibile = sezione.style.display === 'block';
        sezioni.forEach(s => {
            s.style.display = 'none';
            s.previousElementSibling.classList.remove('aperto');
        });
        if (!èVisibile) {
            sezione.style.display = 'block';
            sezione.previousElementSibling.classList.add('aperto');
        }
    }

    btnToggleArgos.addEventListener('click', () => toggleSezione(sezioneArgos));
    btnToggleSaluteApt.addEventListener('click', () => toggleSezione(sezioneSaluteApt));
    btnToggleTariffe.addEventListener('click', () => toggleSezione(sezioneTariffe));



    // ===== RIFINITURE TABELLE: conteggio, legenda, WhatsApp, scorrimento =====
    const LEGENDA = {
        SALUTE: [['verde', '08-20'], ['arancio', '08-18'], ['blu', '18-20'], ['viola', '18-24'], ['giallo', '08-24']],
        APT: [['verde', '07-18'], ['arancio', '07-24'], ['giallo', 'Extra / Excelsior']]
    };

    // ===== TABELLA COME IMMAGINE =====
    function disegnaTabella(w, nome, conteggio, Wmin) {
        const S = 2, PAD = 20, RH = 54, TOP = 100, BOT = 56, F = 'bold 24px Arial, Helvetica, sans-serif';
        const M = [];
        Array.from(w.querySelector('table').rows).forEach((tr, r) => {
            M[r] = M[r] || [];
            let c = 0;
            Array.from(tr.cells).forEach(cell => {
                while (M[r][c]) c++;
                const rs = cell.rowSpan || 1;
                for (let i = 0; i < rs; i++) { M[r + i] = M[r + i] || []; M[r + i][c] = i ? { sotto: true } : { cell, rs }; }
                c++;
            });
        });
        const nc = Math.max(...M.map(r => r.length));
        const cv = document.createElement('canvas'), g = cv.getContext('2d');
        g.font = F;
        const wc = Array.from({ length: nc }, (_, c) => Math.max(90, ...M.map(r =>
            r[c] && r[c].cell ? Math.ceil(g.measureText(r[c].cell.textContent.trim()).width) + 44 : 0)));
        const W = Math.max(Wmin || 420, wc.reduce((a, b) => a + b, 0) + PAD * 2), H = TOP + M.length * RH + BOT;
        const x0 = (W - wc.reduce((a, b) => a + b, 0)) / 2;
        cv.width = W * S; cv.height = H * S; g.scale(S, S);
        g.fillStyle = '#121212'; g.fillRect(0, 0, W, H);
        g.fillStyle = '#0b2a4a'; g.fillRect(0, 0, W, 88);
        g.fillStyle = '#ffd700'; g.fillRect(0, 88, W, 6);
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.font = 'bold 30px Arial, Helvetica, sans-serif'; g.fillText(nome, W / 2, 32);
        g.fillStyle = '#ffffff'; g.font = 'bold 22px Arial, Helvetica, sans-serif';
        g.fillText(w.querySelector('.data-title').textContent, W / 2, 66);
        M.forEach((riga, r) => {
            let x = x0;
            riga.forEach((e, c) => {
                if (e && e.cell) {
                    const cs = getComputedStyle(e.cell), y = TOP + r * RH, h = RH * e.rs;
                    let bg = cs.backgroundColor;
                    if (!bg || bg === 'transparent' || /rgba\(0, 0, 0, 0\)/.test(bg)) bg = '#1e1e1e';
                    g.fillStyle = bg; g.fillRect(x, y, wc[c], h);
                    g.strokeStyle = '#333'; g.lineWidth = 1; g.strokeRect(x, y, wc[c], h);
                    g.font = F; g.textAlign = 'center';
                    const chip = e.cell.querySelector('.chip-nota'), t = e.cell.textContent.trim();
                    if (chip && t) {
                        const tw = g.measureText(t).width + 24, cx = x + wc[c] / 2;
                        g.fillStyle = '#ffd700'; g.fillRect(cx - tw / 2, y + h / 2 - 17, tw, 34);
                        g.fillStyle = '#000000'; g.fillText(t, cx, y + h / 2 + 1);
                    } else {
                        g.fillStyle = cs.color || '#ffffff'; g.fillText(t, x + wc[c] / 2, y + h / 2 + 1);
                    }
                }
                x += wc[c];
            });
        });
        g.fillStyle = '#ffd700'; g.font = 'bold 20px Arial, Helvetica, sans-serif'; g.textAlign = 'center';
        g.fillText(conteggio || '', W / 2, TOP + M.length * RH + 20);
        g.fillStyle = '#888888'; g.font = '14px Arial, Helvetica, sans-serif';
        g.fillText('CONSORZIO MOTOSCAFI', W / 2, H - 14);
        return cv;
    }

    function rifinisci(w, servizio, scroll) {
        const righe = Array.from(w.querySelectorAll('tbody tr'));
        const intest = Array.from(w.querySelectorAll('thead th')).map(t => t.textContent);
        let ultimo = '';
        const linee = righe.map(tr => {
            const c = Array.from(tr.cells).map(x => x.textContent.trim());
            if (c.length < intest.length) c.splice(1, 0, ultimo); else ultimo = c[1];
            return c.filter(Boolean).join(' · ');
        });
        const nome = servizio ? 'TABELLA ' + servizio : 'TURNI ARGOS';
        const testo = '*' + nome + '*\n' + w.querySelector('.data-title').textContent + '\n' + linee.join('\n');

        let html = '';
        if (intest[1] === 'Orario') html += `<div class="conteggio">${righe.length} barche in servizio</div>`;
        if (LEGENDA[servizio] && intest[1] === 'Orario') {
            html += '<div class="legenda">' + LEGENDA[servizio]
                .map(([c, t]) => `<span class="chip ${c}">${t}</span>`).join('') + '</div>';
        }
        const info = document.createElement('div');
        info.innerHTML = html;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn-condividi';
        btn.textContent = 'Condividi tabella (immagine)';
        // la tabella viene disegnata come immagine, cosi' com'e' nella pagina
        let pronto = null;
        try {
            const cv = disegnaTabella(w, nome, intest[1] === 'Orario' ? righe.length + ' barche in servizio' : '');
            pronto = new Promise(res => cv.toBlob(res, 'image/png'));
        } catch (e) { pronto = null; }
        btn.addEventListener('click', async () => {
            const blob = pronto ? await pronto : null;
            if (!blob) { window.open('https://wa.me/?text=' + encodeURIComponent(testo), '_blank'); return; }
            condividiBlob(blob, nome + ' ' + w.querySelector('.data-title').textContent, nome);
        });
        w.append(info, btn);
        if (scroll) w.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    [outputServizio, outputMotoscafo].forEach(out => {
        new MutationObserver(() => {
            out.querySelectorAll('.table-wrapper:not([data-ok])').forEach(w => {
                w.dataset.ok = '1';
                rifinisci(w, w.dataset.servizio || '', out.querySelector('.table-wrapper') === w);
            });
        }).observe(out, { childList: true, subtree: true });
    });

    // ===== CONDIVISIONE (menu del telefono, oppure download sul computer) =====
    async function condividiBlob(blob, nomeFile, titolo) {
        const nf = nomeFile.toLowerCase().replace(/[^a-z0-9]+/g, '_') + '.png';
        const file = new File([blob], nf, { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            try { await navigator.share({ files: [file], title: titolo }); } catch (e) { /* annullato */ }
        } else {
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob); a.download = nf; a.click();
        }
    }

    // ===== UNA SOLA IMMAGINE CON APT + SALUTE =====
    const btnEntrambe = document.getElementById('condividiEntrambe');
    const pronte = {};
    async function preparaEntrambe(data) {
        const box = document.createElement('div');
        box.style.cssText = 'position:fixed;left:-10000px;top:0;width:700px';
        document.body.appendChild(box);
        try {
            const wr = [];
            for (const s of ['APT', 'SALUTE']) {
                const t = document.createElement('div');
                box.appendChild(t);
                await renderServizio(s, data, t);
                const w = t.querySelector('.table-wrapper');
                if (w) wr.push([w, s]);
            }
            if (!wr.length) return null;
            const disegna = Wmin => wr.map(([w, s]) =>
                disegnaTabella(w, 'TABELLA ' + s, w.querySelectorAll('tbody tr').length + ' barche in servizio', Wmin));
            let canvases = disegna(0);
            const Wm = Math.max(...canvases.map(c => c.width / 2));
            canvases = disegna(Wm);                        // stessa larghezza per tutte e due
            const GAP = 24, W = canvases[0].width, H = canvases.reduce((a, c) => a + c.height, 0) + GAP * (canvases.length - 1);
            const cv = document.createElement('canvas');
            cv.width = W; cv.height = H;
            const g = cv.getContext('2d');
            g.fillStyle = '#121212'; g.fillRect(0, 0, W, H);
            let y = 0;
            canvases.forEach(c => { g.drawImage(c, 0, y); y += c.height + GAP; });
            return await new Promise(res => cv.toBlob(res, 'image/png'));
        } catch (e) { return null; } finally { box.remove(); }
    }
    dataServizio.addEventListener('change', () => {
        if (dataServizio.value) pronte[dataServizio.value] = preparaEntrambe(dataServizio.value);
        mostraServizi();
    });
    btnEntrambe.addEventListener('click', async () => {
        const data = dataServizio.value;
        if (!data) { outputServizio.textContent = 'Per favore seleziona una data.'; return; }
        if (!pronte[data]) pronte[data] = preparaEntrambe(data);
        const blob = await pronte[data];
        if (!blob) { outputServizio.innerHTML = "<p style='color:#ff6b6b;'>Nessun dato per questa data.</p>"; delete pronte[data]; return; }
        condividiBlob(blob, 'tabelle apt salute ' + formatDate(data), 'Tabelle APT e SALUTE');
    });

    // ===== CONTROLLO AGGIORNAMENTI =====
    const avvisoAggiornamento = document.getElementById('avvisoAggiornamento');
    const infoAggiornamento = document.getElementById('infoAggiornamento');

    function controllaVersione() {
        fetch('version.json?t=' + Date.now(), { cache: 'no-store' })
            .then(r => r.json())
            .then(v => {
                if (v.aggiornato && infoAggiornamento) {
                    infoAggiornamento.textContent = 'Dati aggiornati al ' + v.aggiornato;
                }
                if (String(v.versione) !== VERSIONE_PAGINA) {
                    avvisoAggiornamento.textContent = 'Sono disponibili nuovi aggiornamenti. Tocca qui per aggiornare (' + VERSIONE_PAGINA + ' → ' + v.versione + ')';
                    avvisoAggiornamento.style.display = 'block';
                }
            })
            .catch(() => { /* offline: nessun avviso */ });
    }

    avvisoAggiornamento.addEventListener('click', async () => {
        avvisoAggiornamento.textContent = 'Aggiornamento in corso...';
        try {
            // forza il telefono a scaricare di nuovo i file, ignorando quelli in memoria
            await Promise.all(['index.html', 'script.js', 'style.css']
                .map(f => fetch(f, { cache: 'reload' })));
        } catch (e) { /* si ricarica comunque */ }
        const url = new URL(window.location.href);
        url.searchParams.set('v', Date.now());
        window.location.href = url.toString();
    });

    controllaVersione();
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') controllaVersione();
    });

});
