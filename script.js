document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('turniForm');
    const motoscafoSelect = document.getElementById('motoscafo');
    const dataInput = document.getElementById('data');
    const outputDiv = document.getElementById('output');

    form.addEventListener('submit', function(event) {
        event.preventDefault();  // Evita il submit del form per gestire l'evento tramite JavaScript
        const motoscafo = motoscafoSelect.value;
        const data = dataInput.value;

        if (!motoscafo || !data) {
            outputDiv.textContent = 'Per favore seleziona un motoscafo e una data.';
            return;
        }

        fetch('turni.json')
            .then(response => response.json())
            .then(turni => {
                const turno = turni.find(t => t.Motoscafo == motoscafo && t.Data == data);
                if (turno) {
                    outputDiv.textContent = `Motoscafo ${turno.Motoscafo}: ${turno.Data} - ${turno.Turno}`;
                } else {
                    outputDiv.textContent = 'Nessun turno trovato per i criteri selezionati.';
                }
            })
            .catch(error => {
                console.error('Errore nel caricamento dei dati:', error);
                outputDiv.textContent = 'Errore nel caricamento dei dati.';
            });
    });
});
