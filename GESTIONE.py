# -*- coding: utf-8 -*-
"""
GESTIONE.py - tutto in uno per l'app del Consorzio Motoscafi.

  1) Crea il foglio VUOTO dei turni ARGOS          -> turni_generati.ods
  2) Crea il foglio VUOTO delle tabelle SALUTE/APT -> salute_apt.ods
  3) Converte i 3 file .ods in JSON, li controlla,
     aggiorna la versione e prepara la cartella DA_CARICARE
  4) Solo controllo (come il 3, ma non scrive niente)

Metti questo file nella stessa cartella di index.html, script.js, style.css
e dei file .ods. Poi doppio clic (oppure:  python GESTIONE.py).

SICUREZZA: se un file .ods esiste gia' (e magari contiene i tuoi turni compilati)
il programma NON lo sovrascrive senza chiedere, e ne tiene sempre una copia in "backup".

Per CONVERTIRE non serve installare niente.
Per CREARE i fogli vuoti serve la libreria odfpy (la stessa dei tuoi vecchi script):
    pip install odfpy
"""
import json
import os
import re
import shutil
import sys
import zipfile
import xml.etree.ElementTree as ET
from collections import Counter
from datetime import date, datetime, timedelta

CARTELLA = os.path.dirname(os.path.abspath(__file__))

FILE_TURNI = "turni_generati.ods"
FILE_SALUTE_APT = "salute_apt.ods"
FILE_TARIFFE = "tariffe.ods"
CARTELLA_BACKUP = "backup"
CARTELLA_USCITA = "DA_CARICARE"

# Usata solo se index.html non e' presente nella cartella
MOTOSCAFI_DI_RISERVA = [
    "13", "25", "35", "38", "40", "44", "48", "49", "119", "121", "123", "140", "142", "146",
    "156", "157", "159", "163", "171", "192", "194", "217", "222", "223", "226", "229", "236",
    "238", "245", "252", "254", "259", "263", "265", "303", "307", "311", "317", "322", "350",
    "351", "355", "356", "364", "366", "370", "383", "N13", "N16", "N18", "N36",
]


# ===============================================================
#  UTILITA'
# ===============================================================
def percorso(nome):
    return os.path.join(CARTELLA, nome)


def leggi_data(testo):
    """Accetta 05022026, 2026-02-05, 05/02/2026, 05-02-2026, 05.02.2026"""
    t = testo.strip()
    for fmt in ("%d%m%Y", "%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%d.%m.%Y"):
        try:
            return datetime.strptime(t, fmt).date()
        except ValueError:
            pass
    return None


def chiedi_data(domanda):
    while True:
        d = leggi_data(input(domanda + " (es: 05022026): "))
        if d:
            return d
        print("  Data non valida, riprova (es: 05022026 oppure 2026-02-05).")


def chiedi_periodo():
    inizio = chiedi_data("Data di INIZIO")
    fine = chiedi_data("Data di FINE")
    if fine < inizio:
        print("  La data di fine e' prima di quella di inizio. Annullato.")
        return None
    print("  Periodo: dal %s al %s (%d giorni)" % (inizio, fine, (fine - inizio).days + 1))
    return inizio, fine


def leggi_html():
    p = percorso("index.html")
    if os.path.exists(p):
        return open(p, encoding="utf-8").read()
    return None


def opzioni_select(html, id_select):
    if not html:
        return None
    m = re.search(r'<select id="%s">(.*?)</select>' % id_select, html, re.S)
    if not m:
        return None
    return [v for v in re.findall(r'<option value="([^"]*)"', m.group(1)) if v and not v.startswith("--")]


def lista_motoscafi():
    """La lista dei motoscafi viene da index.html (cosi' c'e' un solo posto da aggiornare)."""
    lst = opzioni_select(leggi_html(), "motoscafo")
    if lst:
        return lst, "index.html"
    return MOTOSCAFI_DI_RISERVA, "lista interna"


def prepara_salvataggio(nome):
    """Se il file esiste chiede conferma e ne fa una copia in 'backup'."""
    p = percorso(nome)
    if not os.path.exists(p):
        return True
    print("\n  ATTENZIONE: '%s' esiste gia' e potrebbe contenere i tuoi dati compilati." % nome)
    r = input("  Vuoi sostituirlo? (una copia resta nella cartella '%s')  [s/N]: " % CARTELLA_BACKUP)
    if r.strip().lower() != "s":
        print("  Annullato, non ho toccato niente.")
        return False
    os.makedirs(percorso(CARTELLA_BACKUP), exist_ok=True)
    base, ext = os.path.splitext(nome)
    copia = "%s_%s%s" % (base, datetime.now().strftime("%Y%m%d_%H%M%S"), ext)
    shutil.copy2(p, percorso(os.path.join(CARTELLA_BACKUP, copia)))
    print("  Copia salvata: %s/%s" % (CARTELLA_BACKUP, copia))
    return True


def importa_odf():
    try:
        import odf.opendocument  # noqa: F401
        return True
    except ImportError:
        print("\n  Per creare i fogli serve la libreria 'odfpy'.")
        print("  Installala una volta sola scrivendo nel terminale:  pip install odfpy")
        return False


# ===============================================================
#  1) E 2) CREAZIONE DEI FOGLI VUOTI
# ===============================================================
def crea_foglio_argos(inizio, fine, cartella=None):
    from odf.opendocument import OpenDocumentSpreadsheet
    from odf.table import Table, TableRow, TableCell
    from odf.text import P
    from odf.style import Style, TableCellProperties

    motoscafi, fonte = lista_motoscafi()
    colori = ["#FFCCCC", "#FFE5CC", "#FFFFCC", "#E5FFCC", "#CCFFE5", "#CCE5FF", "#E5CCFF", "#FFCCF2"]

    doc = OpenDocumentSpreadsheet()
    tab = Table(name="Turni")
    stili = []
    for i, c in enumerate(colori):
        st = Style(name="Colore%d" % i, family="table-cell")
        st.addElement(TableCellProperties(backgroundcolor=c))
        doc.styles.addElement(st)
        stili.append(st)

    riga = TableRow()
    for col in ["motoscafo", "data", "turno"]:
        c = TableCell()
        c.addElement(P(text=col))
        riga.addElement(c)
    tab.addElement(riga)

    for idx, m in enumerate(motoscafi):
        stile = stili[idx % len(stili)]
        g = inizio
        while g <= fine:
            riga = TableRow()
            for valore in (str(m), g.strftime("%Y-%m-%d"), ""):
                c = TableCell(stylename=stile)
                c.addElement(P(text=valore))
                riga.addElement(c)
            tab.addElement(riga)
            g += timedelta(days=1)

    doc.spreadsheet.addElement(tab)
    doc.save(os.path.join(cartella or CARTELLA, FILE_TURNI))
    return len(motoscafi), fonte


def crea_foglio_salute_apt(inizio, fine, cartella=None):
    from odf.opendocument import OpenDocumentSpreadsheet
    from odf.table import Table, TableRow, TableCell
    from odf.text import P
    from odf.style import Style, TableCellProperties

    colori = {
        "SALUTE": "#FFF3B0",
        "APT_07_18": "#9DC3E6",
        "APT_07_24": "#F4B084",
        "EXTRA": "#FFEB3B",
    }
    doc = OpenDocumentSpreadsheet()
    tab = Table(name="Turni")
    stili = {}

    def stile(colore):
        if colore not in stili:
            st = Style(name="cell_" + colore.strip("#"), family="table-cell")
            st.addElement(TableCellProperties(backgroundcolor=colore))
            doc.styles.addElement(st)
            stili[colore] = st
        return stili[colore]

    def aggiungi(valori, colore=None):
        riga = TableRow()
        for v in valori:
            c = TableCell(stylename=stile(colore)) if colore else TableCell()
            c.addElement(P(text=v))
            riga.addElement(c)
        tab.addElement(riga)

    # la colonna "nota" e' nuova: serve per scrivere EXCELSIOR, GUARDIA LONDRA, ...
    aggiungi(["servizio", "data", "num", "inizio", "fine", "nota"])

    blocchi_apt = [
        ("APT", "07", "18", 15, colori["APT_07_18"]),
        ("APT", "07", "24", 15, colori["APT_07_24"]),
        ("EXTRA APT", "07", "18", 3, colori["EXTRA"]),
    ]
    g = inizio
    while g <= fine:
        d = g.strftime("%Y-%m-%d")
        for _ in range(30):
            aggiungi(["SALUTE", d, "", "", "", ""], colori["SALUTE"])
        for serv, ini, fin, n, col in blocchi_apt:
            for _ in range(n):
                aggiungi([serv, d, "", ini, fin, ""], col)
        g += timedelta(days=1)

    doc.spreadsheet.addElement(tab)
    doc.save(os.path.join(cartella or CARTELLA, FILE_SALUTE_APT))


def menu_crea_argos():
    if not importa_odf():
        return
    per = chiedi_periodo()
    if not per or not prepara_salvataggio(FILE_TURNI):
        return
    print("  Creo il foglio, attendi qualche secondo...")
    n, fonte = crea_foglio_argos(*per)
    print("\n  FATTO: %s creato con %d motoscafi (lista letta da %s)." % (FILE_TURNI, n, fonte))
    print("  Ora apri il file e compila la colonna 'turno'.")


def menu_crea_salute_apt():
    if not importa_odf():
        return
    per = chiedi_periodo()
    if not per or not prepara_salvataggio(FILE_SALUTE_APT):
        return
    print("  Creo il foglio, attendi qualche secondo...")
    crea_foglio_salute_apt(*per)
    print("\n  FATTO: %s creato." % FILE_SALUTE_APT)
    print("  Compila 'num' (e inizio/fine per SALUTE).")
    print("  Nella colonna 'nota' scrivi per esempio EXCELSIOR o GUARDIA LONDRA sulle barche interessate.")


# ===============================================================
#  LETTURA .ods (senza librerie esterne)
# ===============================================================
NS = {
    "t": "urn:oasis:names:tc:opendocument:xmlns:table:1.0",
    "o": "urn:oasis:names:tc:opendocument:xmlns:office:1.0",
    "x": "urn:oasis:names:tc:opendocument:xmlns:text:1.0",
}
T = "{%s}" % NS["t"]
O = "{%s}" % NS["o"]


def testo_cella(cella):
    tipo = cella.get(O + "value-type")
    # (i file creati dagli script senza essere mai stati salvati da LibreOffice
    #  non hanno "value-type": in quel caso si legge direttamente il testo)
    if tipo == "date":
        return (cella.get(O + "date-value") or "")[:10]
    if tipo in ("float", "percentage", "currency"):
        v = cella.get(O + "value") or ""
        try:
            f = float(v)
            return str(int(f)) if f == int(f) else str(f)
        except ValueError:
            return v
    return "\n".join("".join(p.itertext()) for p in cella.findall("x:p", NS)).strip()


def leggi_ods(nome, errori):
    p = percorso(nome)
    if not os.path.exists(p):
        errori.append("File non trovato: %s" % nome)
        return None
    try:
        with zipfile.ZipFile(p) as z:
            radice = ET.fromstring(z.read("content.xml"))
    except Exception as e:
        errori.append("%s: impossibile aprirlo (%s)" % (nome, e))
        return None
    foglio = radice.find(".//t:table", NS)
    righe = []
    for riga in foglio.findall("t:table-row", NS):
        ripeti_riga = int(riga.get(T + "number-rows-repeated", "1"))
        valori = []
        for cella in riga:
            if cella.tag not in (T + "table-cell", T + "covered-table-cell"):
                continue
            ripeti = int(cella.get(T + "number-columns-repeated", "1"))
            valori.extend([testo_cella(cella)] * min(ripeti, 50))
        while valori and valori[-1] == "":
            valori.pop()
        if not valori:
            continue
        for _ in range(min(ripeti_riga, 50)):
            righe.append(valori)
    return righe


def tabella(nome, obbligatorie, errori):
    righe = leggi_ods(nome, errori)
    if righe is None:
        return None
    if not righe:
        errori.append("%s: il foglio e' vuoto" % nome)
        return None
    intest = [h.strip().lower() for h in righe[0]]
    for c in obbligatorie:
        if c not in intest:
            errori.append("%s: manca la colonna '%s' (trovate: %s)" % (nome, c, ", ".join(intest)))
            return None
    out = []
    for n, r in enumerate(righe[1:], start=2):
        r = r + [""] * (len(intest) - len(r))
        d = {intest[i]: r[i].strip() for i in range(len(intest)) if intest[i]}
        d["_riga"] = n
        out.append(d)
    return out


def data_valida(s):
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", s):
        return False
    try:
        date.fromisoformat(s)
        return True
    except ValueError:
        return False


# ===============================================================
#  3) CONVERSIONE + CONTROLLI
# ===============================================================
def converti_turni(errori, avvisi):
    righe = tabella(FILE_TURNI, ["motoscafo", "data", "turno"], errori)
    if righe is None:
        return None
    ammessi = set(opzioni_select(leggi_html(), "motoscafo") or [])
    visti, vuoti, out = set(), {}, []
    ignorati = {}
    for r in righe:
        n = r["_riga"]
        if not data_valida(r["data"]):
            errori.append("turni: riga %d data non valida: '%s'" % (n, r["data"]))
            continue
        if not r["motoscafo"]:
            errori.append("turni: riga %d motoscafo vuoto" % n)
            continue
        if ammessi and r["motoscafo"] not in ammessi:
            # motoscafo tolto dal menu di index.html: i suoi turni vengono ignorati
            ignorati[r["motoscafo"]] = ignorati.get(r["motoscafo"], 0) + 1
            continue
        chiave = (r["motoscafo"], r["data"])
        if chiave in visti:
            errori.append("turni: riga %d duplicato: motoscafo %s del %s" % (n, r["motoscafo"], r["data"]))
            continue
        visti.add(chiave)
        if not r["turno"]:
            vuoti[r["motoscafo"]] = vuoti.get(r["motoscafo"], 0) + 1
        out.append({"motoscafo": r["motoscafo"], "data": r["data"], "turno": r["turno"]})
    for m, k in ignorati.items():
        avvisi.append("turni: il motoscafo %s non e' piu' nel menu, ignorate %d righe (e' normale se l'hai tolto tu)" % (m, k))
    for m, k in vuoti.items():
        avvisi.append("turni: il motoscafo %s ha %d giorni senza turno (cella vuota)" % (m, k))
    if ammessi:
        presenti = {r["motoscafo"] for r in out}
        for m in sorted(ammessi - presenti):
            avvisi.append("turni: il motoscafo %s e' nel menu ma non ha nessun turno nel file" % m)
    return out


def converti_salute_apt(errori, avvisi):
    righe = tabella(FILE_SALUTE_APT, ["servizio", "data", "num", "inizio", "fine"], errori)
    if righe is None:
        return None
    ammessi = set(opzioni_select(leggi_html(), "motoscafo") or [])
    visti, out = set(), []
    scartate = 0
    note = 0
    for r in righe:
        n = r["_riga"]
        serv = r["servizio"].upper()
        if serv not in ("SALUTE", "APT", "EXTRA APT"):
            errori.append("salute_apt: riga %d servizio sconosciuto: '%s'" % (n, r["servizio"]))
            continue
        if not data_valida(r["data"]):
            errori.append("salute_apt: riga %d data non valida: '%s'" % (n, r["data"]))
            continue
        for campo in ("inizio", "fine"):
            v = r[campo]
            if v != "" and not (v.isdigit() and 0 <= int(v) <= 24):
                errori.append("salute_apt: riga %d %s non valido: '%s'" % (n, campo, v))
        nota = r.get("nota", "")
        if not r["num"]:
            scartate += 1  # riga del modello non compilata: l'app non la mostrerebbe comunque
            if nota:
                avvisi.append("salute_apt: riga %d ha una nota ma nessun numero di barca" % n)
            continue
        if r["inizio"] == "" or r["fine"] == "":
            avvisi.append("salute_apt: riga %d barca %s del %s senza orario (non verra' mostrata)"
                          % (n, r["num"], r["data"]))
        chiave = (serv, r["data"], r["num"])
        if chiave in visti:
            avvisi.append("salute_apt: riga %d barca %s ripetuta in %s del %s" % (n, r["num"], serv, r["data"]))
        visti.add(chiave)
        if ammessi and r["num"] not in ammessi:
            avvisi.append("salute_apt: riga %d barca %s non e' nel menu di index.html" % (n, r["num"]))
        riga = {"servizio": serv, "data": r["data"], "num": r["num"],
                "inizio": r["inizio"], "fine": r["fine"]}
        if nota:
            riga["nota"] = nota
            note += 1
        out.append(riga)
    return out, note, scartate


def converti_tariffe(errori, avvisi):
    righe = tabella(FILE_TARIFFE, ["hotel", "destinazione", "importo"], errori)
    if righe is None:
        return None
    out = [{"hotel": r["hotel"], "destinazione": r["destinazione"], "importo": r["importo"]}
           for r in righe]
    for r in righe:
        if r["importo"] and not re.fullmatch(r"\d+([.,]\d+)?", r["importo"]):
            avvisi.append("tariffe: riga %d importo strano: '%s'" % (r["_riga"], r["importo"]))
    menu = opzioni_select(leggi_html(), "hotelSelect")
    if menu:
        conta = Counter(r["hotel"] for r in righe if r["hotel"])
        for h in menu:
            if h not in conta:
                avvisi.append("tariffe: l'hotel %s e' nel menu ma non ha tariffe nel file" % h)
        for h, k in conta.items():
            if k >= 5 and h not in menu:
                avvisi.append("tariffe: '%s' ha %d righe ma NON e' nel menu hotel di index.html "
                              "(finirebbe tra i supplementi)" % (h, k))
    return {"tariffe": out, "supplementi": []}


def scrivi_json(nome, dati):
    with open(percorso(nome), "w", encoding="utf-8") as f:
        json.dump(dati, f, indent=4, ensure_ascii=False)


def aggiorna_versione(avvisi):
    vecchia = 0
    try:
        vecchia = int(json.load(open(percorso("version.json"), encoding="utf-8")).get("versione", 0))
    except Exception:
        pass
    nuova = vecchia + 1
    oggi = date.today().strftime("%d/%m/%Y")
    scrivi_json("version.json", {"versione": str(nuova), "aggiornato": oggi})
    if os.path.exists(percorso("script.js")):
        s = open(percorso("script.js"), encoding="utf-8").read()
        s2, k = re.subn(r'const VERSIONE_PAGINA = "[^"]*";', 'const VERSIONE_PAGINA = "%d";' % nuova, s)
        if k:
            open(percorso("script.js"), "w", encoding="utf-8").write(s2)
        else:
            avvisi.append("script.js: riga VERSIONE_PAGINA non trovata, cambiala a mano in %d" % nuova)
    else:
        avvisi.append("script.js non trovato: cambia a mano VERSIONE_PAGINA in %d" % nuova)
    return nuova, oggi


def converti_tutto(scrivi=True):
    errori, avvisi = [], []
    print("\n  Lettura e controllo dei file...")

    turni = sa = tariffe = None
    saltati = []
    if os.path.exists(percorso(FILE_TURNI)):
        turni = converti_turni(errori, avvisi)
    else:
        saltati.append(FILE_TURNI)
    if os.path.exists(percorso(FILE_SALUTE_APT)):
        sa = converti_salute_apt(errori, avvisi)
    else:
        saltati.append(FILE_SALUTE_APT)
    if os.path.exists(percorso(FILE_TARIFFE)):
        tariffe = converti_tariffe(errori, avvisi)
    else:
        saltati.append(FILE_TARIFFE)

    if len(saltati) == 3:
        errori.append("Non trovo nessun file .ods in questa cartella (%s, %s, %s)."
                      % (FILE_TURNI, FILE_SALUTE_APT, FILE_TARIFFE))

    if errori:
        print("\n  ERRORI - nessun file e' stato scritto:")
        for e in errori[:60]:
            print("   -", e)
        if len(errori) > 60:
            print("   ... e altri %d errori" % (len(errori) - 60))
        return False

    print("\n  Controllo superato.")
    da_copiare = []
    if turni is not None:
        dt = sorted(r["data"] for r in turni)
        print("   turni.json      : %d righe, dal %s al %s" % (len(turni), dt[0], dt[-1]))
        da_copiare.append("turni.json")
    if sa is not None:
        ds = sorted(r["data"] for r in sa[0]) or ["-"]
        print("   salute_apt.json : %d barche, dal %s al %s, note: %d (righe vuote scartate: %d)"
              % (len(sa[0]), ds[0], ds[-1], sa[1], sa[2]))
        da_copiare.append("salute_apt.json")
    if tariffe is not None:
        print("   tariffe.json    : %d righe" % len(tariffe["tariffe"]))
        da_copiare.append("tariffe.json")
    for f in saltati:
        print("   (%s non c'e' in questa cartella: saltato, il suo JSON online resta com'e')" % f)

    if scrivi:
        if turni is not None:
            scrivi_json("turni.json", turni)
        if sa is not None:
            scrivi_json("salute_apt.json", sa[0])
        if tariffe is not None:
            scrivi_json("tariffe.json", tariffe)
        versione, oggi = aggiorna_versione(avvisi)
        print("   version.json    : versione %d, aggiornato al %s" % (versione, oggi))
        da_copiare += ["version.json", "script.js"]

        os.makedirs(percorso(CARTELLA_USCITA), exist_ok=True)
        for f in da_copiare:
            if os.path.exists(percorso(f)):
                shutil.copy2(percorso(f), percorso(os.path.join(CARTELLA_USCITA, f)))
        print("\n  FATTO. Nella cartella '%s' trovi i file pronti da caricare su GitHub:" % CARTELLA_USCITA)
        print("   " + ", ".join(f for f in da_copiare if os.path.exists(percorso(f))))
        print("  (index.html e style.css vanno caricati solo se li hai cambiati.)")
    else:
        print("\n  (Solo controllo: non ho scritto nessun file.)")

    if avvisi:
        print("\n  AVVISI da controllare:")
        for a in avvisi[:60]:
            print("   -", a)
        if len(avvisi) > 60:
            print("   ... e altri %d avvisi" % (len(avvisi) - 60))
    return True


# ===============================================================
#  MENU
# ===============================================================
def menu():
    while True:
        print("\n==============================================")
        print("  CONSORZIO MOTOSCAFI - gestione dati")
        print("==============================================")
        print("  1) Crea foglio VUOTO turni ARGOS")
        print("  2) Crea foglio VUOTO tabelle SALUTE / APT")
        print("  3) CONVERTI in JSON e prepara i file da caricare")
        print("  4) Solo CONTROLLO (non scrive niente)")
        print("  0) Esci")
        scelta = input("\n  Scegli: ").strip()
        if scelta == "1":
            menu_crea_argos()
        elif scelta == "2":
            menu_crea_salute_apt()
        elif scelta == "3":
            converti_tutto(True)
        elif scelta == "4":
            converti_tutto(False)
        elif scelta == "0":
            return
        else:
            print("  Scelta non valida.")


if __name__ == "__main__":
    try:
        if len(sys.argv) > 1 and sys.argv[1] == "converti":
            converti_tutto(True)
        elif len(sys.argv) > 1 and sys.argv[1] == "controlla":
            converti_tutto(False)
        else:
            menu()
    except KeyboardInterrupt:
        pass
    except Exception as e:
        print("\n  Errore imprevisto:", e)
        input("  Premi INVIO per chiudere...")
