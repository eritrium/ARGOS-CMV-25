# -*- coding: utf-8 -*-
"""
PIANO.py - scrive da solo le formule del Foglio1 (il piano dei turni).

Legge il tuo file principale (quello con il Foglio1 gia' fatto), prende il PRIMO giorno
(barche e posti scritti a mano) e i posti di ogni giorno, e ricrea tutto il resto con le formule:
  - le date (giorno prima + 1)
  - la rotazione giornaliera delle barche (ogni barca scorre di una colonna)
  - il cambio ogni 6 giorni (le coppie di righe si spostano)
  - la riga NOLEGGI
  - le colonne EXCELSIOR e NOTTE
Si puo' anche allungare il piano oltre l'ultimo giorno: i giorni nuovi vengono creati con le
formule e con i posti copiati dall'ultimo giorno (poi li modifichi a mano come sempre).

Due modi:
  1) NUOVO piano da zero: dici data di inizio, giorni, colonne e barche -> crea piano_nuovo.ods
     (le celle dei posti restano vuote)
  2) Ricrea / allunga un piano gia' fatto -> crea piano_generato.ods

Uso:  doppio clic su PIANO.py
Serve la libreria odfpy:  pip install odfpy
"""
import os, re, sys, zipfile
import xml.etree.ElementTree as ET
from datetime import date, datetime, timedelta

CARTELLA = os.path.dirname(os.path.abspath(__file__))
NS = {"t": "urn:oasis:names:tc:opendocument:xmlns:table:1.0",
      "o": "urn:oasis:names:tc:opendocument:xmlns:office:1.0",
      "x": "urn:oasis:names:tc:opendocument:xmlns:text:1.0"}
T = "{%s}" % NS["t"]; O = "{%s}" % NS["o"]
L = "ABCDEFGH"
BLK = 24  # righe per giorno


# ------------------------------------------------------------------ lettura
def _val(c):
    t = c.get(O + "value-type")
    if t == "date":
        return c.get(O + "date-value")[:10]
    if t in ("float", "percentage"):
        v = float(c.get(O + "value"))
        return str(int(v)) if v == int(v) else str(v)
    return "\n".join("".join(p.itertext()) for p in c.findall("x:p", NS)).strip()


def leggi_foglio1(path):
    """-> dict {(riga, colonna): (valore, formula)}  (righe da 1, colonne da 0)"""
    root = ET.fromstring(zipfile.ZipFile(path).read("content.xml"))
    tb = [t for t in root.findall(".//t:table", NS)][0]
    celle, r = {}, 0
    for row in tb.findall("t:table-row", NS):
        rr = int(row.get(T + "number-rows-repeated", "1"))
        c = 0
        dati = []
        for cell in row:
            if cell.tag not in (T + "table-cell", T + "covered-table-cell"):
                continue
            k = int(cell.get(T + "number-columns-repeated", "1"))
            v, f = _val(cell), cell.get(T + "formula")
            if v or f:
                dati += [(c + i, v, f) for i in range(min(k, 12))]
            c += k
        if dati:
            for i in range(min(rr, 5)):
                for c, v, f in dati:
                    celle[(r + 1 + i, c)] = (v, f)
        r += rr
    return celle


def ref(f):
    m = re.fullmatch(r"of:=\[\.([A-H])(\d+)\]", f or "")
    return (L.index(m.group(1)), int(m.group(2))) if m else None


# ------------------------------------------------------------------ modello
def estrai_modello(celle):
    n = 0
    while (n * BLK + 1, 0) in celle and re.fullmatch(r"\d{4}-\d{2}-\d{2}", celle[(n * BLK + 1, 0)][0] or "x") or \
            ((n * BLK + 1, 0) in celle and (celle[(n * BLK + 1, 0)][1] or "").endswith("+1")):
        n += 1
    giorni = []
    for b in range(n):
        R = b * BLK
        posti = {}
        for rel in range(2, 25):                      # tutto il blocco, solo celle di testo scritte a mano
            for c in range(12):
                v, f = celle.get((R + rel, c), ("", None))
                if (v or f) and not (f and ref(f)) and not (f and f.endswith("+1")):
                    posti[(rel, c)] = v
        gh = []
        for rel in range(3, 24):
            for c in (6, 7):
                v, f = celle.get((R + rel, c), ("", None))
                if ref(f):
                    sc, sr = ref(f)
                    gh.append((rel, c, (sr - 1) % BLK + 1))
        giorni.append({"posti": posti, "gh": gh})
    return n, giorni


def costruisci(celle_src, fine=None):
    n, giorni = estrai_modello(celle_src)
    d0 = date.fromisoformat(celle_src[(1, 0)][0])
    totale = n if not fine else max(n, (fine - d0).days + 1)
    out = {}
    for b in range(totale):
        R, Rp = b * BLK, (b - 1) * BLK
        if b < n:
            posti, gh = dict(giorni[b]["posti"]), giorni[b]["gh"]
        else:                                           # giorni nuovi: posti dell'ultimo giorno, colonne G/H a ciclo di 3
            posti = dict(giorni[n - 1]["posti"]); posti.pop((2, 8), None)
            gh = giorni[n - 3 + ((b - n) % 3)]["gh"]
        settimanale = (b > 0 and b % 6 == 0)
        if settimanale and (2, 8) not in posti:
            posti[(2, 8)] = "GIRO"

        # data
        out[(R + 1, 0)] = ("d", celle_src[(1, 0)][0]) if b == 0 else ("f", "of:=[.A%d]+1" % (R + 1 - BLK))

        # testi scritti a mano (posti, intestazioni, NOLEGGI, asterischi)
        for (rel, c), v in posti.items():
            e_barca = (4 <= rel <= 20 and rel % 2 == 0 and c < 6) or (rel == 23 and c < 6)
            if not e_barca:
                out[(R + rel, c)] = ("v", v)

        # barche
        if b == 0:                                      # primo giorno: scritte a mano
            for (rel, c), v in posti.items():
                if (4 <= rel <= 20 and rel % 2 == 0 and c < 6) or (rel == 23 and c < 6):
                    out[(rel, c)] = ("b", v)
        else:
            occ = [c for c in range(6) if out.get((Rp + 20, c), ("",))[0] in ("b", "f")]

            def F(dc, drel, sc, srel):
                out[(R + drel, dc)] = ("f", "of:=[.%s%d]" % (L[sc], Rp + srel))

            for p in range(8):                          # 8 coppie complete
                rel = 4 + 2 * p
                for c in range(6):
                    s = (c - 1) % 6
                    if not settimanale:
                        F(c, rel, s, rel)
                    elif p <= 5:                        # coppie 1-6 salgono di 2 posti
                        F(c, rel, s, rel + 4)
                    elif p == 7:                        # ultima <- prima
                        F(c, rel, s, 4)
                    else:                               # coppia 7: 2 barche dalla riga parziale, 4 dalla coppia 2
                        F(c, rel, s, 20 if s in occ else 6)
            for c in occ:                               # riga parziale (2 barche)
                F((c + 1) % 6, 20, c, 6 if settimanale else 20)
            for c in range(6):                          # NOLEGGI
                F(c, 23, (c - 1) % 6, 23)

        # EXCELSIOR / NOTTE
        for rel, c, srel in gh:
            out[(R + rel, c)] = ("f", "of:=[.F%d]" % (R + srel))
    return totale, out


# ------------------------------------------------------------------ scrittura .ods
def scrivi_ods(out, nome_file):
    from odf.opendocument import OpenDocumentSpreadsheet
    from odf.table import Table, TableRow, TableCell
    from odf.text import P
    from odf.style import Style
    from odf.number import DateStyle, Year, Month, Day, Text

    doc = OpenDocumentSpreadsheet()
    ds = DateStyle(name="DataISO")
    for el in (Year(style="long"), Text(text="-"), Month(style="long"), Text(text="-"), Day(style="long")):
        ds.addElement(el)
    doc.automaticstyles.addElement(ds)
    st = Style(name="cData", family="table-cell", datastylename="DataISO")
    doc.automaticstyles.addElement(st)

    maxr = max(r for r, c in out)
    righe = {}
    for (r, c), v in out.items():
        righe.setdefault(r, {})[c] = v
    tab = Table(name="Foglio1")
    for r in range(1, maxr + 1):
        riga = TableRow()
        celle = righe.get(r, {})
        for c in range(0, (max(celle) + 1) if celle else 1):
            kind, txt = celle.get(c, ("", ""))
            if kind == "":
                cell = TableCell()
            elif kind == "d":
                cell = TableCell(valuetype="date", datevalue=txt, stylename=st)
                cell.addElement(P(text=txt))
            elif kind == "f":
                cell = TableCell(formula=txt, stylename=st) if txt.endswith("+1") else TableCell(formula=txt)
            elif kind == "b" and txt.isdigit():
                cell = TableCell(valuetype="float", value=int(txt))
                cell.addElement(P(text=txt))
            else:
                cell = TableCell(valuetype="string")
                cell.addElement(P(text=txt))
            riga.addElement(cell)
        tab.addElement(riga)
    doc.spreadsheet.addElement(tab)
    doc.save(nome_file)


# ------------------------------------------------------------------ NUOVO PIANO DA ZERO
def crea_nuovo(inizio, giorni, cols, barche, noleggi=None, giro_ogni=0, giro_righe=2):
    """Costruisce un piano nuovo. Le celle dei posti restano VUOTE (le compili tu dopo)."""
    nfull, part = len(barche) // cols, len(barche) % cols
    nrow = nfull + (1 if part else 0)
    nol = bool(noleggi)
    BL = 2 + 2 * nrow + (3 if nol else 0) + 1
    rb = lambda p: 4 + 2 * p                            # riga (nel blocco) delle barche della riga p
    r_nol = 3 + 2 * nrow + 2                            # riga barche noleggi
    out = {}
    occ = []
    for b in range(giorni):
        R, Rp = b * BL, (b - 1) * BL
        out[(R + 1, 0)] = ("d", inizio.isoformat()) if b == 0 else ("f", "of:=[.A%d]+1" % (R + 1 - BL))
        giro = b > 0 and giro_ogni > 0 and b % giro_ogni == 0 and nfull > 1
        if giro:
            out[(R + 2, cols + 1)] = ("v", "GIRO")
        if nol:
            out[(R + 3 + 2 * nrow, 0)] = ("v", "NOLEGGI")
        out[(R + BL, 0)] = ("v", "* " * (cols + 2))
        if b == 0:
            i = 0
            for p in range(nfull):
                for c in range(cols):
                    out[(rb(p), c)] = ("b", barche[i]); i += 1
            if part:
                occ = [(k * cols) // part for k in range(part)]
                for c in occ:
                    out[(rb(nfull), c)] = ("b", barche[i]); i += 1
            if nol:
                lista = (list(noleggi) + ["X"] * cols)[:cols]
                for c in range(cols):
                    out[(r_nol, c)] = ("b", lista[c])
            continue

        def F(dc, drel, sc, srel):
            out[(R + drel, dc)] = ("f", "of:=[.%s%d]" % (L[sc], Rp + srel))
        k = giro_righe % nfull if giro else 0
        for p in range(nfull):
            for c in range(cols):
                F(c, rb(p), (c - 1) % cols, rb((p + k) % nfull))
        if part:
            for c in occ:
                F((c + 1) % cols, rb(nfull), c, rb(nfull))
            occ = [(c + 1) % cols for c in occ]
        if nol:
            for c in range(cols):
                F(c, r_nol, (c - 1) % cols, r_nol)
    return out


def barche_dal_menu():
    p = os.path.join(CARTELLA, "index.html")
    if not os.path.exists(p):
        return []
    h = open(p, encoding="utf-8").read()
    m = re.search(r'<select id="motoscafo">(.*?)</select>', h, re.S)
    return re.findall(r'<option value="([^"]+)"', m.group(1)) if m else []


def menu_nuovo():
    d = None
    while not d:
        d = leggi_data(input("Data del PRIMO giorno (es: 17032026): "))
    giorni = int(input("Quanti giorni deve durare il piano? ") or "0")
    cols = int(input("Quante colonne (barche per riga)? [6]: ") or "6")
    elenco = input("Barche del primo giorno, nell'ordine da sinistra a destra e riga dopo riga\n"
                   "(separate da spazio; INVIO = ordine del menu di index.html): ").replace(",", " ").split()
    barche = elenco or barche_dal_menu()
    if len(barche) < cols or len(set(barche)) != len(barche):
        print("Elenco barche non valido (poche barche o numeri ripetuti)."); return
    nol = input("Barche del noleggio, separate da spazio (INVIO = nessuna riga noleggi): ").replace(",", " ").split()
    go = int(input("Ogni quanti giorni c'e' il 'giro' (le righe salgono)? INVIO = nessun giro: ") or "0")
    gr = int(input("Di quante righe salgono nel giro? [2]: ") or "2") if go else 2
    print("\n%d barche in %d colonne: %d righe piene e %d barche nell'ultima riga." %
          (len(barche), cols, len(barche) // cols, len(barche) % cols))
    out = crea_nuovo(d, giorni, cols, barche, nol, go, gr)
    dest = os.path.join(CARTELLA, "piano_nuovo.ods")
    if os.path.exists(dest):
        dest = os.path.join(CARTELLA, "piano_nuovo_%s.ods" % datetime.now().strftime("%Y%m%d_%H%M%S"))
    print("Scrivo il file, attendi...")
    scrivi_ods(out, dest)
    print("\nFATTO:", os.path.basename(dest), "-", giorni, "giorni, dal", d, "al", d + timedelta(days=giorni - 1))
    print("Le celle sopra ai numeri sono vuote: scrivi li' i turni.")
    print("Il primo giorno puoi correggerlo a mano: tutti i giorni dopo si aggiornano da soli.")
    print("Aprilo con LibreOffice e salvalo una volta (Ctrl+S).")


# ------------------------------------------------------------------ programma
def trova_sorgente():
    for f in sorted(os.listdir(CARTELLA)):
        if f.lower().startswith("turno_cons") and f.lower().endswith(".ods"):
            return f
    return None


def leggi_data(t):
    for fmt in ("%d%m%Y", "%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
        try:
            return datetime.strptime(t.strip(), fmt).date()
        except ValueError:
            pass
    return None


def main():
    try:
        import odf  # noqa
    except ImportError:
        print("Serve la libreria odfpy. Scrivi nel terminale:  pip install odfpy"); return
    print("1) NUOVO piano da zero (nuova stagione)")
    print("2) Ricrea / allunga il piano da un file gia' fatto")
    if input("Scegli [1]: ").strip() in ("", "1"):
        menu_nuovo(); return
    nome = trova_sorgente()
    if not nome:
        nome = input("Nome del file principale (.ods): ").strip()
    sorg = os.path.join(CARTELLA, nome)
    if not os.path.exists(sorg):
        print("File non trovato:", nome); return
    print("Leggo", nome, "...")
    celle = leggi_foglio1(sorg)
    n, _ = estrai_modello(celle)
    d0 = date.fromisoformat(celle[(1, 0)][0]); dn = d0 + timedelta(days=n - 1)
    print("Il piano va dal %s al %s (%d giorni)." % (d0, dn, n))
    r = input("Fino a quale data lo vuoi? (es: 31122026, INVIO = come adesso): ").strip()
    fine = None
    if r:
        fine = leggi_data(r)
        if not fine:
            print("Data non valida."); return
    totale, out = costruisci(celle, fine)
    dest = os.path.join(CARTELLA, "piano_generato.ods")
    if os.path.exists(dest):
        dest = os.path.join(CARTELLA, "piano_generato_%s.ods" % datetime.now().strftime("%Y%m%d_%H%M%S"))
    print("Scrivo il file, attendi...")
    scrivi_ods(out, dest)
    print("\nFATTO:", os.path.basename(dest), "-", totale, "giorni, fino al", d0 + timedelta(days=totale - 1))
    if totale > n:
        print("I giorni nuovi hanno i posti copiati dall'ultimo giorno: modificali a mano come sempre.")
    print("Aprilo con LibreOffice e salvalo una volta (Ctrl+S) per fissare i risultati delle formule.")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print("Errore imprevisto:", e)
    if sys.stdin and sys.stdin.isatty():
        input("\nPremi INVIO per chiudere...")
