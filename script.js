function controllaTurno() {
    var matricola = document.getElementById('matricola').value;
    var data = document.getElementById('data').value;
    var turno = ottieniTurno(matricola, data);
    
    var risultatoDiv = document.getElementById('risultato');
    if (turno) {
        risultatoDiv.innerHTML = 'Il tuo turno per il ' + data + ' è: ' + turno;
    } else {
        risultatoDiv.innerHTML = 'Nessun turno trovato per la data ' + data;
    }
}

function ottieniTurno(matricola, data) {
    var turni = {
        "146": {"2025-01-16": "San Marco 8/18", "2023-01-17": "Pomeriggio"},
        "67890": {"2023-01-16": "Notte", "2023-01-17": "Mattina"},
        "54321": {"2023-01-16": "Pomeriggio", "2023-01-17": "Notte"},
        // Puoi continuare ad aggiungere matricole e turni qui
    };
    
    if (turni[matricola] && turni[matricola][data]) {
        return turni[matricola][data];
    } else {
        return null;
    }
}
