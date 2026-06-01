document.addEventListener('DOMContentLoaded', function () {

    // ---------------------------------------------------
    // AVVISO
    // ---------------------------------------------------
    function gestisciAvviso() {
        const box = document.getElementById("messaggioAvviso");
        box.style.display = box.textContent.trim() !== "" ? "block" : "none";
    }
    gestisciAvviso();

    // ELEMENTI MOTOSCAFO
    const motoscafoSelect = document.getElementById('motoscafo');
    const dataInput = document.getElementById('dataMotoscafo');
    const btnMotoscafo = document.getElementById('verificaMotoscafo');
    const outputMotoscafo = document.getElementById('outputMotoscafo');

    // ELEMENTI SALUTE/APT
    const servizioSelect = document.getElementById('extraSelect');
    const dataServizio = document.getElementById('dataServizio');
    const btnServizio = document.getElementById('verificaServizio');
    const outputServizio = document.getElementById('outputServizio');

    // ---------------------------------------------------
    // MOTOSCAFO
    // ---------------------------------------------------
    btnMotoscafo.addEventListener('click', function () {

        const motoscafo = motoscafoSelect.value;
        const data = dataInput.value;

        if (!motoscafo || !data) {
            outputMotoscafo.textContent = 'Per favore seleziona un motoscafo e una data.';
            return;
        }

        fetch('turni.json')
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

    // ---------------------------------------------------
    // SALUTE + APT
    // ---------------------------------------------------
    btnServizio.addEventListener('click', async function () {

        const servizio = servizioSelect.value;
        const data = dataServizio.value;

        if (!servizio || !data) {
            outputServizio.textContent = 'Per favore seleziona un servizio e una data.';
            return;
        }

        try {
            const response = await fetch('salute_apt.json');
            const turni = await response.json();

            // ---------------------------------------------------
            // SALUTE
            // ---------------------------------------------------
            if (servizio === "SALUTE") {

                const filtrati = turni.filter(r =>
                    r.data === data &&
                    r.servizio === "SALUTE" &&
                    r.num.trim() !== "" &&
                    r.inizio.trim() !== "" &&
                    r.fine.trim() !== ""
                );

                if (filtrati.length === 0) {
                    outputServizio.innerHTML = "<p style='color:red;'>Nessun dato SALUTE per questa data.</p>";
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
                                </tr>
                            </thead>
                            <tbody>${righe}</tbody>
                        </table>
                    </div>
                `;

                return;
            }

            // ---------------------------------------------------
            // APT
            // ---------------------------------------------------
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
                outputServizio.innerHTML = "<p style='color:red;'>Nessun dato trovato.</p>";
                return;
            }

            let righeTotali = "";
            let i = 0;

            while (i < finali.length) {

                const r = finali[i];
                const orarioInizio = r.inizio;
                const orarioFine = r.fine;

                const gruppo = r.gruppo && r.gruppo.trim() !== "" ? r.gruppo : "normale";
                const orarioCompleto = `${orarioInizio} → ${orarioFine}`;

                let colore = "";

                if (servizio === "APT") {
                    if (orarioInizio === "07" && orarioFine === "18") colore = "verde";
                    if (orarioInizio === "07" && orarioFine === "24") colore = "arancio";
                    if (r.servizio === "EXTRA APT") colore = "giallo";
                    if (gruppo === "exc") colore = "giallo";
                }

                let j = i;
                while (
                    j < finali.length &&
                    finali[j].inizio === orarioInizio &&
                    finali[j].fine === orarioFine &&
                    ((finali[j].gruppo && finali[j].gruppo.trim() !== "") ? finali[j].gruppo : "normale") === gruppo &&
                    finali[j].servizio === r.servizio
                ) {
                    j++;
                }

                const rowspan = j - i;

                const notaExtra =
                    (gruppo === "extra" &&
                     orarioInizio === "08" &&
                     orarioFine === "20")
                    ? "<div class='nota-extra'>GUARDIA LONDRA</div>"
                    : "";

                const notaExcelsior =
                    (gruppo === "exc")
                    ? "<div class='nota-extra'>EXCELSIOR</div>"
                    : "";

                for (let k = i; k < j; k++) {
                    const riga = finali[k];

                    if (k === i) {
                        righeTotali += `
                            <tr class="${colore}">
                                <td>${riga.num}</td>
                                <td rowspan="${rowspan}" class="orario-unico">
                                    ${orarioCompleto}
                                    ${notaExtra}
                                    ${notaExcelsior}
                                </td>
                            </tr>
                        `;
                    } else {
                        righeTotali += `
                            <tr class="${colore}">
                                <td>${riga.num}</td>
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
                            </tr>
                        </thead>
                        <tbody>${righeTotali}</tbody>
                    </table>
                </div>
            `;

        } catch (error) {
            outputServizio.textContent = "Errore nel caricamento del file salute_apt.json.";
        }
    });

    // ---------------------------------------------------
    // FORMATTARE DATA
    // ---------------------------------------------------
    function formatDate(dateString) {
        const options = { day: '2-digit', month: '2-digit', year: 'numeric' };
        return new Date(dateString).toLocaleDateString('it-IT', options);
    }

    // ---------------------------------------------------
    // ⭐⭐⭐ SEZIONE TARIFFE ⭐⭐⭐
    // ---------------------------------------------------

    const hotelSelect = document.getElementById("hotelSelect");
    const btnTariffe = document.getElementById("verificaTariffe");
    const risultatiTariffe = document.getElementById("risultatiTariffe");

    fetch("tariffe.json")
        .then(r => r.json())
        .then(data => {

            btnTariffe.addEventListener("click", () => {
                const hotel = hotelSelect.value;
                risultatiTariffe.innerHTML = "";

                if (!hotel) {
                    risultatiTariffe.innerHTML = "<p style='color:red;'>Seleziona un hotel.</p>";
                    return;
                }

                const filtrate = data.tariffe.filter(t => t.hotel === hotel);

                if (filtrate.length === 0) {
                    risultatiTariffe.innerHTML = "<p style='color:red;'>Nessuna tariffa trovata.</p>";
                    return;
                }

                // 🎨 2 colori alternati: azzurro pastello + bianco
                const colore1 = "#DFF2FF";
                const colore2 = "#FFFFFF";

                let html = `
                    <h4>Tariffe per ${hotel}</h4>
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
                        <thead>
                            <tr>
                                <th>Supplemento</th>
                                <th>Importo</th>
                            </tr>
                        </thead>
                        <tbody>
                `;

                // ---------------------------------------------------
                // SUPPLEMENTI AUTOMATICI (ESCLUDENDO LA RIGA "SUPPLEMENTO - IMPORTO")
                // ---------------------------------------------------
                const supplementiAuto = data.tariffe.filter(t =>
                    (t.hotel.toUpperCase().includes("EXTRA") ||
                     t.hotel.toUpperCase().includes("NOTTURNO") ||
                     t.hotel.toUpperCase().includes("SOSTA") ||
                     t.hotel.toUpperCase().includes("SUPPLEMENTO"))
                    &&
                    t.destinazione.toUpperCase() !== "IMPORTO"
                );

                supplementiAuto.forEach((s, i) => {
                    const colore = (i % 2 === 0) ? colore1 : colore2;

                    html += `
                        <tr style="background:${colore};">
                            <td>${s.hotel}</td>
                            <td>${s.destinazione || "-"}</td>
                        </tr>
                    `;
                });

                html += `
                        </tbody>
                    </table>
                `;

                risultatiTariffe.innerHTML = html;
            });

        })
        .catch(() => {
            risultatiTariffe.innerHTML = "<p style='color:red;'>Errore nel caricamento delle tariffe.</p>";
        });

    // ---------------------------------------------------
    // ACCORDION: UNA SOLA SEZIONE APERTA ALLA VOLTA
    // ---------------------------------------------------
    const btnToggleArgos = document.getElementById('toggleArgos');
    const btnToggleSaluteApt = document.getElementById('toggleSaluteApt');
    const btnToggleTariffe = document.getElementById('toggleTariffe');

    const sezioneArgos = document.getElementById('sezioneArgos');
    const sezioneSaluteApt = document.getElementById('sezioneSaluteApt');
    const sezioneTariffe = document.getElementById('sezioneTariffe');

    const sezioni = [sezioneArgos, sezioneSaluteApt, sezioneTariffe];

    function toggleSezione(sezione) {
        const èVisibile = sezione.style.display === 'block';

        // chiudo tutte
        sezioni.forEach(s => s.style.display = 'none');

        // se prima era chiusa, la apro; se era aperta, rimane tutto chiuso
        if (!èVisibile) {
            sezione.style.display = 'block';
        }
    }

    btnToggleArgos.addEventListener('click', () => toggleSezione(sezioneArgos));
    btnToggleSaluteApt.addEventListener('click', () => toggleSezione(sezioneSaluteApt));
    btnToggleTariffe.addEventListener('click', () => toggleSezione(sezioneTariffe));

}); // ← CHIUSURA FINALE CORRETTA
