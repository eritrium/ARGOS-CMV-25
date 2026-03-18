document.addEventListener('DOMContentLoaded', function () {

    // ---------------------------------------------------
    // 🔥 GESTIONE AVVISO (MOSTRA SE IL DIV NON È VUOTO)
    // ---------------------------------------------------
    function gestisciAvviso() {
        const box = document.getElementById("messaggioAvviso");

        if (box.textContent.trim() !== "") {
            box.style.display = "block";
        } else {
            box.style.display = "none";
        }
    }

    gestisciAvviso();

    // ELEMENTI PER MOTOSCAFO
    const motoscafoSelect = document.getElementById('motoscafo');
    const dataInput = document.getElementById('dataMotoscafo');
    const btnMotoscafo = document.getElementById('verificaMotoscafo');
    const outputMotoscafo = document.getElementById('outputMotoscafo');

    // ELEMENTI PER SALUTE/APT
    const servizioSelect = document.getElementById('extraSelect');
    const dataServizio = document.getElementById('dataServizio');
    const btnServizio = document.getElementById('verificaServizio');
    const outputServizio = document.getElementById('outputServizio');

    // -------------------------------
    // 🔵 BOTTONE MOTOSCAFO
    // -------------------------------
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
                    const formattedDate = formatDate(turno.data);
                    outputMotoscafo.textContent = `Motoscafo ${turno.motoscafo}: ${formattedDate} - ${turno.turno}`;
                } else {
                    outputMotoscafo.textContent = 'Nessun turno trovato per i criteri selezionati.';
                }
            })
            .catch(() => {
                outputMotoscafo.textContent = 'Errore nel caricamento dei dati.';
            });
    });

    // -------------------------------
    // 🟢 BOTTONE SALUTE/APT
    // -------------------------------
    btnServizio.addEventListener('click', async function () {

        const servizio = servizioSelect.value;
        const data = dataServizio.value;

        if (!servizio || !data) {
            outputServizio.textContent = 'Per favore seleziona SALUTE/APT e una data.';
            return;
        }

        try {
            const response = await fetch('salute_apt.json');
            const turni = await response.json();

            // FILTRA SOLO LE RIGHE VALIDE
            const finali = turni.filter(r =>
                r.servizio === servizio &&
                r.data === data &&
                r.num &&
                r.num.trim() !== ""
            );

            if (finali.length === 0) {
                outputServizio.innerHTML = "<p style='color:red;'>Nessun dato trovato.</p>";
                return;
            }

            // -------------------------------
            // 🔥 RAGGRUPPAMENTO PER ORARIO + GRUPPO
            // -------------------------------
            let righeTotali = "";
            let i = 0;

            while (i < finali.length) {

                const r = finali[i];
                const orarioInizio = r.inizio;
                const orarioFine = r.fine;

                // Gruppo: normale / extra / exc
                const gruppo = r.gruppo && r.gruppo.trim() !== "" ? r.gruppo : "normale";

                const orarioCompleto = `${orarioInizio} → ${orarioFine}`;

                // LOGICA COLORI
                let colore = "";

                if (servizio === "SALUTE") {
                    if (orarioInizio === "08" && orarioFine === "20") colore = "verde";
                    if (orarioInizio === "08" && orarioFine === "18") colore = "arancio";
                    if (orarioInizio === "08" && orarioFine === "24") colore = "giallo";
                }

                if (servizio === "APT") {
                    if (orarioInizio === "07" && orarioFine === "18") colore = "verde";
                    if (orarioInizio === "07" && orarioFine === "24") colore = "arancio";

                    // ⭐ NUOVO: gruppo EXCELSIOR → giallo
                    if (gruppo === "exc") colore = "giallo";
                }

                // TROVA QUANTE RIGHE HANNO STESSO ORARIO + STESSO GRUPPO
                let j = i;
                while (
                    j < finali.length &&
                    finali[j].inizio === orarioInizio &&
                    finali[j].fine === orarioFine &&
                    ((finali[j].gruppo && finali[j].gruppo.trim() !== "") ? finali[j].gruppo : "normale") === gruppo
                ) {
                    j++;
                }

                const rowspan = j - i;

                // NOTE SPECIALI
                const notaExtra =
                    (gruppo === "extra" &&
                     orarioInizio === "08" &&
                     orarioFine === "20")
                    ? "<div class='nota-extra'>GUARDIA LONDRA</div>"
                    : "";

                // ⭐ NUOVO: nota EXCELSIOR
                const notaExcelsior =
                    (gruppo === "exc")
                    ? "<div class='nota-extra'>EXCELSIOR</div>"
                    : "";

                // COSTRUZIONE RIGHE
                for (let k = i; k < j; k++) {
                    const riga = finali[k];

                    if (k === i) {
                        righeTotali += `
                            <tr class="${colore}">
                                <td>${riga.num}</td>
                                <td rowspan="${rowspan}" class="orario-unico">
                                    ${gruppo === "exc" ? "" : orarioCompleto}
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

            // -------------------------------
            // 🔥 TABELLA FINALE
            // -------------------------------
            outputServizio.innerHTML = `
                <div class="table-wrapper table-anim">
                    <div class="data-title">${formatDate(data)}</div>

                    <table>
                        <thead>
                            <tr>
                                <th>Num</th>
                                <th>Orario</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${righeTotali}
                        </tbody>
                    </table>
                </div>
            `;

        } catch (error) {
            outputServizio.textContent = "Errore nel caricamento del file salute_apt.json.";
        }
    });

    // -------------------------------
    // FUNZIONE FORMATTARE DATA
    // -------------------------------
    function formatDate(dateString) {
        const options = { day: '2-digit', month: '2-digit', year: 'numeric' };
        const date = new Date(dateString);
        return date.toLocaleDateString('it-IT', options);
    }
});
