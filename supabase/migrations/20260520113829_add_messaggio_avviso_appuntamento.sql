/*
  # Messaggio avviso appuntamento WhatsApp

  Aggiunge il template del messaggio di promemoria appuntamento inviato via WhatsApp.

  Variabili disponibili nel template:
  - {nome}  → nome di battesimo del cliente
  - {data}  → data dell'appuntamento (es. "martedì 21 maggio")
  - {ora}   → orario dell'appuntamento (es. "10:30")

  Il link Google Maps viene sempre allegato automaticamente dopo il messaggio.
*/

INSERT INTO impostazioni (chiave, valore)
VALUES (
  'messaggio_avviso_appuntamento',
  'Ciao {nome} ti ricordiamo l''appuntamento di domani {data} alle ore {ora} presso il nostro salone in via Palermo 15 Roma, ti aspettiamo!

I Venzi.'
)
ON CONFLICT (chiave) DO NOTHING;

INSERT INTO impostazioni (chiave, valore)
VALUES (
  'avviso_appuntamento_indirizzo',
  'via Palermo 15, Roma'
)
ON CONFLICT (chiave) DO NOTHING;
