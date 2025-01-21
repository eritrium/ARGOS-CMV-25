document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('turniForm');
    const motoscafoSelect = document.getElementById('motoscafo');
    const dataInput = document.getElementById('data');
    const outputDiv = document.getElementById('output');

    form.addEventListener('submit', function(event) {
        event.preventDefault();
        const motoscafo = motoscafoSelect.value;
        const data = dataInput.value;

        if (!motoscafo || !data) {
            outputDiv.textContent = 'Per favore seleziona un motoscafo e una data.';
            return;
        }

        console.log('Attempting to fetch data...');
        fetch('turni.json')
            .then(response => {
                console.log('Response status:', response.status);
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(turni => {
                console.log('Data fetched successfully:', turni);
                const turno = turni.find(t => t.Motoscafo == motoscafo && t.Data == data);
                if (turno) {
                    const formattedDate = formatDate(turno.Data);
                    outputDiv.textContent = `Motoscafo ${turno.Motoscafo}: ${formattedDate} - ${turno.Turno}`;
                } else {
                    outputDiv.textContent = 'Nessun turno trovato per i criteri selezionati.';
                }
            })
            .catch(error => {
                console.error('Errore nel caricamento dei dati:', error);
                outputDiv.textContent = 'Errore nel caricamento dei dati.';
            });
    });

    function formatDate(dateString) {
        const options = { day: '2-digit', month: '2-digit', year: 'numeric' };
        const date = new Date(dateString);
        return date.toLocaleDateString('it-IT', options);
    }
});
