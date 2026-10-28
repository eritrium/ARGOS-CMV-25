// ===== VERSIONE DELLA PAGINA =====
// Quando aggiorni il sito, cambia questo numero e quello in version.json (devono essere uguali)
const VERSIONE_PAGINA = "8";

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

    btnServizio.addEventListener('click', async function () {

        const servizio = servizioSelect.value;
        const data = dataServizio.value;

        if (!servizio || !data) {
            outputServizio.textContent = 'Per favore seleziona un servizio e una data.';
            return;
        }

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
        btn.textContent = 'Condividi su WhatsApp';
        btn.addEventListener('click', () =>
            window.open('https://wa.me/?text=' + encodeURIComponent(testo), '_blank'));
        w.append(info, btn);
        w.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    [[outputServizio, () => servizioSelect.value], [outputMotoscafo, () => '']].forEach(([out, serv]) => {
        new MutationObserver(() => {
            const w = out.querySelector('.table-wrapper:not([data-ok])');
            if (w) { w.dataset.ok = '1'; rifinisci(w, serv()); }
        }).observe(out, { childList: true });
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
