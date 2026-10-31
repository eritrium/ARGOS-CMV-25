// ===== VERSIONE DELLA PAGINA =====
// Quando aggiorni il sito, cambia questo numero e quello in version.json (devono essere uguali)
const VERSIONE_PAGINA = "1";

document.addEventListener('DOMContentLoaded', function () {

    function gestisciAvviso() {
        const box = document.getElementById("messaggioAvviso");
        box.style.display = box.textContent.trim() !== "" ? "block" : "none";
    }
    gestisciAvviso();

    const motoscafoSelect = document.getElementById('motoscafo');
    const dataInput = document.getElementById('dataMotoscafo');
    const btnMotoscafo = document.getElementById('verificaMotoscafo');
    const outputMotoscafo = document.getElementById('outputMotoscafo');

    const servizioSelect = document.getElementById('extraSelect');
    const dataServizio = document.getElementById('dataServizio');
    const btnServizio = document.getElementById('verificaServizio');
    const outputServizio = document.getElementById('outputServizio');

    btnMotoscafo.addEventListener('click', function () {

        const motoscafo = motoscafoSelect.value;
        const data = dataInput.value;

        if (!motoscafo || !data) {
            outputMotoscafo.textContent = 'Per favore seleziona un motoscafo e una data.';
            return;
        }

        fetch('turni.json', { cache: 'no-store' })
            .then(response => response.json())
            .then(turni => {
                const turno = turni.find(t => t.motoscafo == motoscafo && t.data == data);

                if (turno) {
                    outputMotoscafo.textContent =
                        `Motoscafo ${turno.motoscafo}: ${formatDate(turno.data)} - ${turno.turno}`;
                } else {
                    outputMotoscafo.textContent = 'Nessun turno trovato.';
                }
            })
            .catch(() => {
                outputMotoscafo.textContent = 'Errore nel caricamento dei dati.';
            });
    });

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
                    <div class="table-wrapper">
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
                <div class="table-wrapper">
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

    btnServizio.addEventListener('click', function () {
        const servizio = servizioSelect.value;
        const data = dataServizio.value;
        if (!servizio || !data) {
            outputServizio.textContent = 'Per favore seleziona un servizio e una data.';
            return;
        }
        renderServizio(servizio, data, outputServizio);
    });

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

    const hotelSelect = document.getElementById("hotelSelect");
    const btnTariffe = document.getElementById("verificaTariffe");
    const risultatiTariffe = document.getElementById("risultatiTariffe");

    fetch("tariffe.json", { cache: "no-store" })
        .then(r => r.json())
        .then(data => {

            btnTariffe.addEventListener("click", () => {
                const hotel = hotelSelect.value;
                risultatiTariffe.innerHTML = "";

                if (!hotel) {
                    risultatiTariffe.innerHTML = "<p style='color:#ff6b6b;'>Seleziona un hotel.</p>";
                    return;
                }

                const hotelList = Array.from(hotelSelect.options)
                    .map(opt => opt.value)
                    .filter(v => v !== "");

                const filtrate = data.tariffe.filter(t => t.hotel === hotel);

                if (filtrate.length === 0) {
                    risultatiTariffe.innerHTML = "<p style='color:#ff6b6b;'>Nessuna tariffa trovata.</p>";
                    return;
                }

                // COLORI TEMA SCURO PER LE RIGHE ALTERNATE
                const colore1 = "#282828";
                const colore2 = "#1e1e1e";

                let html = `
                    <h4 style="margin-top:15px; margin-bottom:10px; text-align:center;">Tariffe per ${hotel}</h4>
                    <table>
                        <thead>
                            <tr>
                                <th>Destinazione</th>
                                <th>Importo (1-4 PAX)</th>
                            </tr>
                        </thead>
                        <tbody>
                `;

                filtrate.forEach((t, i) => {
                    const colore = (i % 2 === 0) ? colore1 : colore2;

                    html += `
                        <tr style="background:${colore};">
                            <td>${t.destinazione}</td>
                            <td>${t.importo && t.importo !== "" ? t.importo : "-"}</td>
                        </tr>
                    `;
                });

                html += `
                        </tbody>
                    </table>

                    <br><br>
                    <h4 style="text-align:center;">SUPPLEMENTI</h4>

                    <table>
                        <tbody>
                `;

                const supplementi = data.tariffe.filter(t =>
                    !hotelList.includes(t.hotel) &&
                    !(t.hotel.trim() === "" && t.destinazione.trim() === "")
                );

                if (supplementi.length > 0) {
                    // INTESTAZIONE SCURA IN EVIDENZA
                    html += `
                        <tr style="background:#333333; color:#ffffff; font-weight:bold; border-bottom:2px solid #555;">
                            <td>${supplementi[0].hotel}</td>
                            <td>${supplementi[0].destinazione}</td>
                        </tr>
                    `;

                    // ALTRE RIGHE CON SFONDO SCURO
                    for (let i = 1; i < supplementi.length; i++) {
                        const s = supplementi[i];
                        const colore = (i % 2 === 0) ? colore1 : colore2;

                        html += `
                            <tr style="background:${colore};">
                                <td>${s.hotel}</td>
                                <td>${s.destinazione}</td>
                            </tr>
                        `;
                    }
                }

                html += `
                        </tbody>
                    </table>
                `;

                risultatiTariffe.innerHTML = html;
                risultatiTariffe.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });

        })
        .catch(() => {
            risultatiTariffe.innerHTML = "<p style='color:#ff6b6b;'>Errore nel caricamento delle tariffe.</p>";
        });

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



    // ===== VISTA DI TUTTI I MOTOSCAFI (ARGOS) =====
    document.getElementById('verificaTutti').addEventListener('click', async () => {
        const data = dataInput.value;
        if (!data) { outputMotoscafo.textContent = 'Per favore seleziona una data.'; return; }
        try {
            const turni = await (await fetch('turni.json', { cache: 'no-store' })).json();
            const del = turni.filter(t => t.data === data);
            if (!del.length) { outputMotoscafo.textContent = 'Nessun turno trovato.'; return; }
            const ordine = Array.from(motoscafoSelect.options).map(o => o.value).filter(Boolean);
            const righe = ordine.map(m => {
                const t = del.find(x => x.motoscafo === m);
                return `<tr><td>${m}</td><td>${t && t.turno ? esc(t.turno) : '-'}</td></tr>`;
            }).join('');
            outputMotoscafo.innerHTML = `<div class="table-wrapper"><div class="data-title">${formatDate(data)}</div>
                <table><thead><tr><th>Num</th><th>Turno</th></tr></thead><tbody>${righe}</tbody></table></div>`;
        } catch (e) {
            outputMotoscafo.textContent = 'Errore nel caricamento dei dati.';
        }
    });

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

    function rifinisci(w, servizio) {
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
        w.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    [[outputServizio, () => servizioSelect.value], [outputMotoscafo, () => '']].forEach(([out, serv]) => {
        new MutationObserver(() => {
            const w = out.querySelector('.table-wrapper:not([data-ok])');
            if (w) { w.dataset.ok = '1'; rifinisci(w, serv()); }
        }).observe(out, { childList: true });
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
    dataServizio.addEventListener('change', () => { if (dataServizio.value) pronte[dataServizio.value] = preparaEntrambe(dataServizio.value); });
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
