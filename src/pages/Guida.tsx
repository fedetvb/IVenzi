import { useState, useMemo } from 'react';
import {
  Search, LayoutDashboard, Calendar, Users, Scissors, FileText,
  CreditCard, ShoppingBag, Wallet, BarChart2, MessageSquare, Package,
  Settings, Trash2, UserCog, TrendingDown, ChevronDown, ChevronRight,
  Palette, Clock, Star, AlertCircle, CheckCircle, Info, Zap, X,
} from 'lucide-react';

interface GuideItem {
  id: string;
  section: string;
  sectionIcon: React.ElementType;
  sectionColor: string;
  title: string;
  description: string;
  steps?: string[];
  tips?: string[];
  warnings?: string[];
  tags: string[];
}

const GUIDE_ITEMS: GuideItem[] = [
  // ── DASHBOARD ──
  {
    id: 'dashboard-panoramica',
    section: 'Dashboard',
    sectionIcon: LayoutDashboard,
    sectionColor: 'amber',
    title: 'Panoramica del giorno',
    description: 'La Dashboard mostra un riepilogo immediato della tua giornata: quanti appuntamenti hai oggi, quanti questa settimana e il totale clienti registrati. L\'orologio in alto si aggiorna in tempo reale.',
    tags: ['dashboard', 'riepilogo', 'oggi', 'statistiche rapide'],
  },
  {
    id: 'dashboard-appuntamenti',
    section: 'Dashboard',
    sectionIcon: LayoutDashboard,
    sectionColor: 'amber',
    title: 'Appuntamenti del giorno',
    description: 'Nella sezione centrale trovi tutti gli appuntamenti di oggi con orario, nome cliente, durata e stato (confermato, in attesa, completato, cancellato). I colori aiutano a distinguere gli stati a colpo d\'occhio.',
    tips: ['Blu = Confermato', 'Giallo = In attesa', 'Verde = Completato', 'Rosso = Cancellato'],
    tags: ['dashboard', 'appuntamenti', 'stati', 'oggi'],
  },
  {
    id: 'dashboard-azioni-rapide',
    section: 'Dashboard',
    sectionIcon: LayoutDashboard,
    sectionColor: 'amber',
    title: 'Azioni rapide',
    description: 'Dalla Dashboard puoi creare un nuovo appuntamento o aggiungere un nuovo cliente direttamente senza navigare in altre sezioni.',
    steps: [
      'Clicca "Nuovo Appuntamento" per aprire il form di prenotazione.',
      'Clicca "Nuovo Cliente" per andare alla sezione Clienti e aggiungerne uno.',
      'Clicca "Vai all\'Agenda" per vedere il calendario completo della settimana.',
    ],
    tags: ['dashboard', 'nuovo appuntamento', 'nuovo cliente', 'accesso rapido'],
  },

  // ── AGENDA SETTIMANALE ──
  {
    id: 'agenda-navigazione',
    section: 'Agenda',
    sectionIcon: Calendar,
    sectionColor: 'sky',
    title: 'Navigare tra le settimane',
    description: 'L\'Agenda mostra una vista settimanale (lunedì–domenica) con una griglia oraria dalle 8:00 alle 20:00. La colonna del giorno corrente è evidenziata.',
    steps: [
      'Usa le frecce ← → in alto per spostarti alla settimana precedente o successiva.',
      'Clicca su un giorno per aprire la vista dettagliata del giorno (AgendaGiorno).',
    ],
    tags: ['agenda', 'settimana', 'calendario', 'navigazione'],
  },
  {
    id: 'agenda-nuovo-appuntamento',
    section: 'Agenda',
    sectionIcon: Calendar,
    sectionColor: 'sky',
    title: 'Creare un nuovo appuntamento',
    description: 'Puoi aggiungere un appuntamento dall\'Agenda in qualsiasi momento.',
    steps: [
      'Clicca il pulsante "Nuovo Appuntamento" in alto a destra.',
      'Si apre il form MultiBook: seleziona il cliente (o scrivine il nome).',
      'Scegli la data e l\'orario.',
      'Aggiungi uno o più servizi — per ogni servizio scegli anche il parrucchiere.',
      'L\'orario dei servizi successivi si calcola automaticamente in base alla durata.',
      'Imposta lo stato (Confermato, In attesa…) e aggiungi eventuali note.',
      'Clicca "Salva" per confermare.',
    ],
    tags: ['agenda', 'appuntamento', 'nuovo', 'prenotazione', 'multibook'],
  },
  {
    id: 'agenda-modifica-appuntamento',
    section: 'Agenda',
    sectionIcon: Calendar,
    sectionColor: 'sky',
    title: 'Modificare o cancellare un appuntamento',
    description: 'Ogni blocco appuntamento nell\'agenda è cliccabile per aprire la modifica.',
    steps: [
      'Clicca sull\'appuntamento nel calendario.',
      'Si apre il form di modifica con tutti i dati precompilati.',
      'Modifica i campi necessari e clicca "Salva".',
      'Per cancellare, clicca il pulsante rosso "Elimina" nel form — l\'appuntamento viene spostato nel Cestino.',
    ],
    tags: ['agenda', 'modifica', 'cancella', 'appuntamento'],
  },
  {
    id: 'agenda-promemoria',
    section: 'Agenda',
    sectionIcon: Calendar,
    sectionColor: 'sky',
    title: 'Promemoria appuntamenti (WhatsApp)',
    description: 'Puoi inviare un messaggio WhatsApp a tutte le clienti con appuntamento il giorno successivo.',
    steps: [
      'Clicca il pulsante "Avvisami" (icona campanella) in agenda.',
      'Si apre il modal con la lista delle clienti di domani.',
      'Il messaggio precompilato include nome, data, ora e indirizzo (configurabile nelle Impostazioni).',
      'Clicca "Invia" per ogni cliente — si apre WhatsApp con il messaggio pronto.',
    ],
    tips: ['Puoi personalizzare il testo del messaggio in Impostazioni → Messaggio Avviso Appuntamento.'],
    tags: ['agenda', 'promemoria', 'whatsapp', 'sms', 'messaggio', 'domani'],
  },
  {
    id: 'agenda-compleanni',
    section: 'Agenda',
    sectionIcon: Calendar,
    sectionColor: 'sky',
    title: 'Avviso compleanni',
    description: 'All\'apertura dell\'app, se ci sono clienti con il compleanno oggi, compare automaticamente un modal per inviargli gli auguri e creare una carta sconto in omaggio.',
    steps: [
      'Il modal si apre automaticamente all\'avvio se ci sono compleanni.',
      'Per ogni cliente puoi scegliere il tipo di sconto (% o €) e il valore.',
      'Clicca "Invia" per aprire WhatsApp con il messaggio di auguri personalizzato.',
    ],
    tags: ['compleanni', 'auguri', 'whatsapp', 'carta sconto', 'agenda'],
  },

  // ── AGENDA GIORNO ──
  {
    id: 'agenda-giorno-vista',
    section: 'Agenda Giorno',
    sectionIcon: Calendar,
    sectionColor: 'sky',
    title: 'Vista dettagliata del giorno',
    description: 'La vista giorno mostra tutti i parrucchieri in colonne affiancate con una timeline verticale a slot da 15 minuti. Ogni colonna rappresenta un parrucchiere.',
    tips: ['Usa i pulsanti + / – per ingrandire o rimpicciolire gli slot orari.', 'Regola anche la dimensione del testo con i controlli appositi.', 'Le preferenze di zoom vengono salvate automaticamente.'],
    tags: ['agenda giorno', 'vista', 'parrucchieri', 'colonne', 'zoom'],
  },
  {
    id: 'agenda-giorno-assenze',
    section: 'Agenda Giorno',
    sectionIcon: Calendar,
    sectionColor: 'sky',
    title: 'Gestire le assenze dei parrucchieri',
    description: 'Puoi segnare quando un parrucchiere è assente per l\'intera giornata o da un certo orario in poi.',
    steps: [
      'Nella vista giorno, cerca il pulsante assenze (icona calendario con X).',
      'Seleziona il parrucchiere, la data e se l\'assenza è tutto il giorno o da un orario specifico.',
      'Aggiungi una nota opzionale.',
      'L\'assenza appare nella colonna del parrucchiere come blocco grigio.',
      'Per eliminare un\'assenza, clicca il tasto rimuovi accanto all\'assenza in lista.',
    ],
    tags: ['agenda giorno', 'assenza', 'parrucchiere', 'ferie', 'malattia'],
  },

  // ── CLIENTI ──
  {
    id: 'clienti-lista',
    section: 'Clienti',
    sectionIcon: Users,
    sectionColor: 'emerald',
    title: 'Cercare e filtrare i clienti',
    description: 'La lista clienti è raggruppata alfabeticamente per cognome. Puoi cercare per nome, cognome, telefono o email usando la barra di ricerca in alto.',
    tips: ['I clienti con una carta attiva (sconto o premium) mostrano un\'icona speciale.'],
    tags: ['clienti', 'cerca', 'filtro', 'lista', 'ricerca'],
  },
  {
    id: 'clienti-nuovo',
    section: 'Clienti',
    sectionIcon: Users,
    sectionColor: 'emerald',
    title: 'Aggiungere un nuovo cliente',
    description: 'Puoi aggiungere manualmente un cliente dalla sezione Clienti.',
    steps: [
      'Clicca il pulsante "Nuovo Cliente" in alto a destra.',
      'Compila i campi: Nome e Cognome sono obbligatori.',
      'Aggiungi telefono, email, data di nascita e note/allergie.',
      'Clicca "Salva" per creare la scheda cliente.',
    ],
    tags: ['clienti', 'nuovo', 'aggiungere', 'scheda'],
  },
  {
    id: 'clienti-scheda-confermare',
    section: 'Clienti',
    sectionIcon: Users,
    sectionColor: 'emerald',
    title: 'Schede da confermare (registrazioni online)',
    description: 'Quando una cliente compila il modulo di registrazione tramite QR code, la scheda appare nel tab "Schede da confermare" in attesa di revisione.',
    steps: [
      'Vai su Clienti → tab "Schede da confermare".',
      'Clicca su una scheda per vederne tutti i dettagli (nome, telefono, allergie, ecc.).',
      'Se tutto è corretto, clicca "Conferma e crea scheda" per aggiungere il cliente.',
      'Per rifiutare, clicca il pulsante elimina (richiede password).',
    ],
    tags: ['clienti', 'registrazione', 'qr code', 'conferma', 'scheda in attesa'],
  },
  {
    id: 'clienti-elimina',
    section: 'Clienti',
    sectionIcon: Users,
    sectionColor: 'emerald',
    title: 'Eliminare un cliente',
    description: 'L\'eliminazione di un cliente è protetta da password per evitare cancellazioni accidentali.',
    steps: [
      'Passa il mouse sulla scheda del cliente.',
      'Appare il pulsante rosso di eliminazione.',
      'Clicca e inserisci la password di conferma.',
      'Il cliente viene spostato nel Cestino (ripristinabile).',
    ],
    warnings: ['Il cliente eliminato viene spostato nel Cestino, non cancellato definitivamente. Puoi recuperarlo dalla sezione Cestino.'],
    tags: ['clienti', 'elimina', 'cancella', 'password', 'cestino'],
  },

  // ── SCHEDA CLIENTE ──
  {
    id: 'scheda-cliente-info',
    section: 'Scheda Cliente',
    sectionIcon: Users,
    sectionColor: 'emerald',
    title: 'Visualizzare e modificare una scheda cliente',
    description: 'Cliccando su un cliente si apre la sua scheda completa con 5 tab: Info, Colore, Appuntamenti, Storico e Carte.',
    steps: [
      'Clicca sul cliente dalla lista.',
      'Nel tab "Info" puoi modificare tutti i dati personali.',
      'Clicca "Modifica" per abilitare la modalità modifica, poi "Salva".',
    ],
    tags: ['scheda cliente', 'info', 'modifica', 'dati personali'],
  },
  {
    id: 'scheda-cliente-colore',
    section: 'Scheda Cliente',
    sectionIcon: Users,
    sectionColor: 'emerald',
    title: 'Schede colore (trattamenti tinta)',
    description: 'Il tab "Colore" permette di registrare ogni trattamento di colorazione con tutti i dettagli tecnici.',
    steps: [
      'Apri la scheda cliente → tab "Colore".',
      'Clicca "Nuova Scheda Colore".',
      'Compila: data, tecnica (balayage, meches, tinta radici…), colore base, colore target, formula, ossidante, tempo di posa e note.',
      'Clicca "Salva".',
      'Puoi rileggere e modificare ogni scheda in futuro.',
    ],
    tags: ['scheda colore', 'tinta', 'colorazione', 'formula', 'tecnica', 'ossidante'],
  },
  {
    id: 'scheda-cliente-appuntamenti',
    section: 'Scheda Cliente',
    sectionIcon: Users,
    sectionColor: 'emerald',
    title: 'Storico appuntamenti del cliente',
    description: 'Il tab "Appuntamenti" mostra tutti gli appuntamenti passati e futuri del cliente con dettagli su servizi, parrucchiere, stato e prezzo.',
    tags: ['scheda cliente', 'storico', 'appuntamenti', 'storia'],
  },
  {
    id: 'scheda-cliente-carte',
    section: 'Scheda Cliente',
    sectionIcon: Users,
    sectionColor: 'emerald',
    title: 'Carte sconto e premium del cliente',
    description: 'Il tab "Carte" mostra le carte sconto e premium associate al cliente, con saldo, stato e la possibilità di inviare SMS.',
    tags: ['scheda cliente', 'carte', 'sconto', 'premium', 'saldo'],
  },

  // ── SERVIZI ──
  {
    id: 'servizi-lista',
    section: 'Servizi e Prodotti',
    sectionIcon: Scissors,
    sectionColor: 'rose',
    title: 'Gestire il catalogo servizi',
    description: 'In questa sezione definisci tutti i servizi offerti dal salone con nome, durata, prezzo e colore identificativo.',
    steps: [
      'Vai su Servizi e Prodotti.',
      'Clicca "Nuovo Servizio".',
      'Inserisci nome, descrizione, durata (minuti), prezzo e colore.',
      'Attiva/disattiva il servizio con il toggle.',
      'Clicca "Salva".',
    ],
    tips: ['I servizi inattivi non appaiono nella selezione durante la creazione degli appuntamenti.'],
    tags: ['servizi', 'catalogo', 'prezzo', 'durata', 'nuovo servizio'],
  },
  {
    id: 'servizi-voci-extra',
    section: 'Servizi e Prodotti',
    sectionIcon: Scissors,
    sectionColor: 'rose',
    title: 'Voci extra (articoli aggiuntivi)',
    description: 'Le voci extra sono articoli o servizi aggiuntivi che puoi aggiungere a una fiche, come prodotti usati durante il trattamento o supplementi.',
    steps: [
      'Vai su Servizi e Prodotti → tab "Voci Extra".',
      'Clicca "Nuova Voce Extra".',
      'Inserisci nome, descrizione, prezzo e colore.',
      'Salva — la voce sarà disponibile quando crei o modifichi una fiche.',
    ],
    tags: ['voci extra', 'supplementi', 'fiche', 'prodotti aggiuntivi'],
  },

  // ── PARRUCCHIERI ──
  {
    id: 'parrucchieri-gestione',
    section: 'Parrucchieri',
    sectionIcon: UserCog,
    sectionColor: 'violet',
    title: 'Aggiungere e gestire i parrucchieri',
    description: 'Ogni parrucchiere ha un nome e un colore identificativo che viene usato nell\'agenda per distinguere le colonne.',
    steps: [
      'Vai su Parrucchieri.',
      'Clicca "Nuovo Parrucchiere".',
      'Inserisci il nome e seleziona un colore.',
      'Clicca "Salva".',
      'Puoi attivare o disattivare un parrucchiere con il toggle — quelli inattivi non appaiono in agenda.',
    ],
    tags: ['parrucchieri', 'staff', 'nuovo', 'colore', 'attivo'],
  },
  {
    id: 'parrucchieri-assenze',
    section: 'Parrucchieri',
    sectionIcon: UserCog,
    sectionColor: 'violet',
    title: 'Registrare assenze e ferie',
    description: 'Puoi registrare i periodi di assenza (ferie, malattia, permessi) per ogni parrucchiere.',
    steps: [
      'Vai su Parrucchieri → sezione "Assenze".',
      'Clicca "Aggiungi Assenza".',
      'Seleziona il parrucchiere.',
      'Inserisci la data di inizio e di fine.',
      'Se l\'assenza è solo da un certo orario, inserisci l\'ora di inizio (lascia vuoto per tutto il giorno).',
      'Aggiungi una nota opzionale e salva.',
    ],
    tags: ['parrucchieri', 'assenze', 'ferie', 'malattia', 'orario'],
  },

  // ── FICHES ──
  {
    id: 'fiches-cosa-sono',
    section: 'Fiches',
    sectionIcon: FileText,
    sectionColor: 'blue',
    title: 'Cosa sono le fiches',
    description: 'Le fiches sono i documenti di cassa che registrano i servizi erogati e i relativi importi. Vengono create automaticamente quando si completa un appuntamento, oppure manualmente.',
    tags: ['fiches', 'cassa', 'incassi', 'pagamento'],
  },
  {
    id: 'fiches-convalidare',
    section: 'Fiches',
    sectionIcon: FileText,
    sectionColor: 'blue',
    title: 'Convalidare una fiche',
    description: 'Convalidare una fiche significa confermare che il pagamento è stato incassato. Solo le fiches convalidate vengono conteggiate nelle finanze.',
    steps: [
      'Vai su Fiches.',
      'Trova la fiche da convalidare (quelle non convalidate hanno un badge giallo).',
      'Clicca sul pulsante "Convalida" (icona spunta verde).',
      'La fiche diventa verde e crea automaticamente un record di incasso nelle Finanze.',
    ],
    warnings: ['Ogni sera il sistema ti ricorda di convalidare le fiches del giorno — configurabile in Impostazioni.'],
    tags: ['fiches', 'convalidare', 'incasso', 'pagamento', 'finanze'],
  },
  {
    id: 'fiches-manuale',
    section: 'Fiches',
    sectionIcon: FileText,
    sectionColor: 'blue',
    title: 'Creare una fiche manuale',
    description: 'Puoi creare una fiche senza un appuntamento, utile per incassi in contante o servizi non prenotati in anticipo.',
    steps: [
      'Vai su Fiches.',
      'Clicca "Nuova Fiche Manuale".',
      'Seleziona il cliente, la data e il parrucchiere.',
      'Aggiungi i servizi e le voci extra.',
      'Imposta il totale e convalida.',
    ],
    tags: ['fiches', 'manuale', 'fiche manuale', 'incasso', 'senza appuntamento'],
  },
  {
    id: 'fiches-pdf',
    section: 'Fiches',
    sectionIcon: FileText,
    sectionColor: 'blue',
    title: 'Stampare o esportare una fiche in PDF',
    description: 'Ogni fiche può essere esportata come PDF da consegnare alla cliente.',
    steps: [
      'Apri la fiche desiderata.',
      'Clicca il pulsante "PDF" o "Stampa".',
      'Si scarica un file PDF formattato con tutti i dettagli del servizio.',
    ],
    tags: ['fiches', 'pdf', 'stampa', 'esporta'],
  },

  // ── CARTE ──
  {
    id: 'carte-sconto',
    section: 'Carte',
    sectionIcon: CreditCard,
    sectionColor: 'teal',
    title: 'Creare una carta sconto',
    description: 'Le carte sconto offrono uno sconto percentuale o fisso (in euro) alle clienti. Possono essere nominative o generiche.',
    steps: [
      'Vai su Carte → tab "Sconto".',
      'Clicca "Nuova Carta Sconto".',
      'Scegli il tipo: Percentuale (%) o Fisso (€).',
      'Inserisci il valore dello sconto.',
      'Opzionale: assegna a una cliente specifica e/o imposta come usa e getta (valida una sola volta).',
      'Il codice viene generato automaticamente o puoi personalizzarlo.',
      'Clicca "Salva".',
    ],
    tips: ['Puoi creare carte sconto multiple in una sola operazione.', 'Usa "Invia SMS" per inviare il codice alla cliente via WhatsApp.'],
    tags: ['carte', 'sconto', 'coupon', 'codice sconto', 'percentuale', 'usa e getta'],
  },
  {
    id: 'carte-premium',
    section: 'Carte',
    sectionIcon: CreditCard,
    sectionColor: 'teal',
    title: 'Carte premium (prepagata con credito)',
    description: 'Le carte premium sono carte prepagate con un saldo in credito che la cliente usa per pagare i servizi.',
    steps: [
      'Vai su Carte → tab "Premium".',
      'Clicca "Nuova Carta Premium".',
      'Seleziona la cliente e inserisci il codice e il saldo iniziale.',
      'Salva la carta.',
    ],
    tags: ['carte', 'premium', 'prepagata', 'credito', 'saldo'],
  },
  {
    id: 'carte-ricarica',
    section: 'Carte',
    sectionIcon: CreditCard,
    sectionColor: 'teal',
    title: 'Ricaricare una carta premium',
    description: 'La ricarica aggiunge credito alla carta premium della cliente.',
    steps: [
      'Vai su Carte → tab "Premium".',
      'Trova la carta da ricaricare e clicca "Ricarica".',
      'Scegli l\'importo di credito da aggiungere (ci sono importi preset o liberi).',
      'Scegli il tipo: Standard (cliente paga) o Gratuito (bonus omaggio).',
      'Clicca "Conferma" — il credito si aggiorna e viene creato un record nelle Finanze.',
    ],
    tags: ['carte', 'premium', 'ricarica', 'credito', 'saldo'],
  },
  {
    id: 'carte-usa',
    section: 'Carte',
    sectionIcon: CreditCard,
    sectionColor: 'teal',
    title: 'Scalare credito da una carta premium',
    description: 'Quando una cliente paga con la carta premium, devi scalare l\'importo dal suo saldo.',
    steps: [
      'Trova la carta della cliente.',
      'Clicca "Usa" o "Detrai".',
      'Inserisci l\'importo da scalare.',
      'Il nuovo saldo viene mostrato e aggiornato.',
    ],
    tags: ['carte', 'premium', 'scalare', 'detrai', 'pagamento'],
  },
  {
    id: 'carte-sms',
    section: 'Carte',
    sectionIcon: CreditCard,
    sectionColor: 'teal',
    title: 'Inviare SMS per le carte',
    description: 'Puoi inviare un messaggio WhatsApp alla cliente per comunicare la creazione di una carta, una ricarica, uno sconto o l\'utilizzo del credito.',
    steps: [
      'Trova la carta nella lista.',
      'Clicca l\'icona "SMS" o "WhatsApp".',
      'Si apre il modal SMS con un messaggio precompilato (basato sui template configurati in Impostazioni).',
      'Puoi modificare il testo prima di inviare.',
      'Clicca "Apri WhatsApp" per inviare.',
    ],
    tags: ['carte', 'sms', 'whatsapp', 'messaggio', 'notifica'],
  },

  // ── RIVENDITA ──
  {
    id: 'rivendita-vendite',
    section: 'Rivendita',
    sectionIcon: ShoppingBag,
    sectionColor: 'orange',
    title: 'Registrare una vendita prodotto',
    description: 'Nella sezione Rivendita tieni traccia dei prodotti venduti alle clienti e dei relativi incassi, con statistiche per parrucchiere.',
    steps: [
      'Vai su Rivendita.',
      'Clicca "Nuova Vendita".',
      'Seleziona il parrucchiere che ha effettuato la vendita.',
      'Seleziona il prodotto dal catalogo.',
      'Inserisci quantità e prezzo unitario.',
      'La data è preimpostata a oggi ma modificabile.',
      'Salva il record.',
    ],
    tags: ['rivendita', 'vendita', 'prodotto', 'incasso'],
  },
  {
    id: 'rivendita-statistiche',
    section: 'Rivendita',
    sectionIcon: ShoppingBag,
    sectionColor: 'orange',
    title: 'Statistiche di rivendita',
    description: 'La sezione mostra la classifica dei parrucchieri per vendite e i prodotti più venduti nel periodo selezionato.',
    steps: [
      'Usa il selettore periodo in alto (anno corrente, mese, intervallo personalizzato).',
      'La classifica si aggiorna in base al filtro scelto.',
      'Esporta il report in PDF con il pulsante apposito.',
    ],
    tags: ['rivendita', 'statistiche', 'classifica', 'report', 'pdf'],
  },

  // ── FINANZE ──
  {
    id: 'finanze-incassi',
    section: 'Finanze',
    sectionIcon: Wallet,
    sectionColor: 'green',
    title: 'Visualizzare gli incassi',
    description: 'La sezione Finanze mostra tutti gli incassi raggruppati per giorno, con il totale giornaliero. Gli incassi vengono creati automaticamente quando si convalida una fiche o si ricarica una carta premium.',
    steps: [
      'Vai su Finanze (richiede password).',
      'Usa i filtri in alto per selezionare il periodo (oggi, settimana, mese, anno, personalizzato).',
      'Ogni giorno mostra la lista degli incassi e il totale.',
    ],
    tags: ['finanze', 'incassi', 'entrate', 'cassa', 'totale'],
  },
  {
    id: 'finanze-grafico',
    section: 'Finanze',
    sectionIcon: Wallet,
    sectionColor: 'green',
    title: 'Grafico degli incassi mensili',
    description: 'Le Finanze includono un grafico a barre che mostra gli incassi mese per mese per avere una visione andamentale del business.',
    tags: ['finanze', 'grafico', 'trend', 'mese', 'andamento'],
  },

  // ── GESTIONE FINANZIARIA ──
  {
    id: 'gf-spese',
    section: 'Entrate & Uscite',
    sectionIcon: TrendingDown,
    sectionColor: 'red',
    title: 'Registrare una spesa',
    description: 'Nella sezione Entrate & Uscite puoi registrare tutte le spese del salone (affitto, bollette, prodotti, ecc.) per avere un quadro finanziario completo.',
    steps: [
      'Vai su Entrate & Uscite (richiede password).',
      'Clicca "Nuova Spesa".',
      'Seleziona la categoria (affitto, bollette, prodotti…).',
      'Inserisci la descrizione, la data e l\'importo lordo.',
      'Specifica l\'aliquota IVA per calcolare il netto.',
      'Se è una spesa ricorrente, attiva "Ricorrente" e scegli la frequenza (mensile, trimestrale, annuale…).',
      'Salva.',
    ],
    tags: ['entrate uscite', 'spese', 'uscite', 'iva', 'ricorrente', 'affitto', 'bollette'],
  },
  {
    id: 'gf-tasse',
    section: 'Entrate & Uscite',
    sectionIcon: TrendingDown,
    sectionColor: 'red',
    title: 'Configurare le impostazioni fiscali',
    description: 'Puoi configurare la tua struttura fiscale per calcoli automatici di IVA, IRPEF e contributi.',
    steps: [
      'Vai su Entrate & Uscite → sezione "Configurazione Fiscale".',
      'Seleziona la forma giuridica (Partita IVA, S.r.l., S.n.c…).',
      'Imposta il regime fiscale (ordinario o forfettario).',
      'Inserisci le aliquote applicabili.',
      'Salva la configurazione.',
    ],
    tags: ['entrate uscite', 'tasse', 'fiscale', 'iva', 'irpef', 'forfettario', 'regime'],
  },

  // ── STATISTICHE ──
  {
    id: 'statistiche-clienti',
    section: 'Statistiche',
    sectionIcon: BarChart2,
    sectionColor: 'blue',
    title: 'Statistiche clienti (classifica)',
    description: 'La sezione Statistiche mostra una classifica delle clienti in base a frequenza, spesa totale, valore medio della fiche e un punteggio combinato.',
    steps: [
      'Vai su Statistiche (richiede password).',
      'Seleziona la modalità: Combinata, Frequenza, Spesa o Fiches.',
      'Scegli il periodo (anno, tutti, personalizzato).',
      'Puoi vedere le migliori clienti o le peggiori (meno frequenti).',
    ],
    tags: ['statistiche', 'clienti', 'classifica', 'spesa', 'frequenza', 'ranking'],
  },
  {
    id: 'statistiche-parrucchieri',
    section: 'Statistiche',
    sectionIcon: BarChart2,
    sectionColor: 'blue',
    title: 'Statistiche parrucchieri',
    description: 'Analizza le performance di ogni parrucchiere: appuntamenti, clienti serviti, fatturato generato e valore medio per fiche.',
    tags: ['statistiche', 'parrucchieri', 'performance', 'fatturato', 'appuntamenti'],
  },
  {
    id: 'statistiche-pdf',
    section: 'Statistiche',
    sectionIcon: BarChart2,
    sectionColor: 'blue',
    title: 'Esportare statistiche in PDF',
    description: 'Puoi esportare tutte le statistiche in un report PDF professionale da conservare o condividere.',
    steps: [
      'Imposta il periodo e i filtri desiderati.',
      'Clicca il pulsante "Esporta PDF".',
      'Si scarica un file PDF con tabelle e dati formattati.',
    ],
    tags: ['statistiche', 'pdf', 'esporta', 'report'],
  },

  // ── COMUNICAZIONI ──
  {
    id: 'comunicazioni-invio',
    section: 'Comunicazioni',
    sectionIcon: MessageSquare,
    sectionColor: 'cyan',
    title: 'Inviare messaggi di massa',
    description: 'La sezione Comunicazioni permette di inviare un messaggio WhatsApp a più clienti contemporaneamente (ad es. promozioni, chiusure, avvisi).',
    steps: [
      'Vai su Comunicazioni.',
      'Seleziona le clienti destinatarie con le caselle di spunta (o usa "Seleziona tutte").',
      'Scrivi il messaggio nel campo testo, oppure scegli un template dal menu.',
      'Clicca "Invia" per aprire WhatsApp per ogni cliente in sequenza.',
    ],
    tips: ['Usa i template salvati per risparmiare tempo su messaggi ricorrenti.', 'Solo le clienti con numero di telefono appaiono nella lista.'],
    tags: ['comunicazioni', 'whatsapp', 'messaggi', 'invio', 'promo', 'broadcast'],
  },
  {
    id: 'comunicazioni-template',
    section: 'Comunicazioni',
    sectionIcon: MessageSquare,
    sectionColor: 'cyan',
    title: 'Usare i template messaggi',
    description: 'I template sono messaggi preimpostati che puoi richiamare rapidamente. Si configurano in Impostazioni → Template Messaggi Comunicazioni.',
    steps: [
      'In Comunicazioni, clicca sul menu template in alto.',
      'Seleziona il template desiderato.',
      'Il testo si inserisce automaticamente nel campo messaggio.',
      'Modifica il testo se necessario e poi invia.',
    ],
    tags: ['comunicazioni', 'template', 'messaggio preimpostato', 'modello'],
  },

  // ── MAGAZZINO ──
  {
    id: 'magazzino-inventario',
    section: 'Magazzino',
    sectionIcon: Package,
    sectionColor: 'stone',
    title: 'Gestire l\'inventario prodotti',
    description: 'Il Magazzino tiene traccia di tutti i prodotti professionali usati in salone: quantità, soglia minima di riordino, prezzo d\'acquisto e categoria.',
    steps: [
      'Vai su Magazzino → tab "Inventario".',
      'Crea prima le categorie (es. Tinture, Shampoo, Ossidanti).',
      'Poi aggiungi i prodotti specificando categoria, nome, marca, quantità, quantità minima e unità di misura.',
      'Quando la quantità scende sotto il minimo, il prodotto viene evidenziato in rosso.',
    ],
    tags: ['magazzino', 'inventario', 'prodotti', 'scorte', 'riordino', 'quantità'],
  },
  {
    id: 'magazzino-categorie',
    section: 'Magazzino',
    sectionIcon: Package,
    sectionColor: 'stone',
    title: 'Creare categorie prodotto',
    description: 'Organizza i prodotti in categorie per ritrovarli facilmente.',
    steps: [
      'Vai su Magazzino → "Nuova Categoria".',
      'Inserisci il nome e scegli un colore identificativo.',
      'Salva e poi assegna i prodotti a questa categoria.',
    ],
    tags: ['magazzino', 'categorie', 'organizzazione'],
  },

  // ── IMPOSTAZIONI ──
  {
    id: 'impostazioni-password',
    section: 'Impostazioni',
    sectionIcon: Settings,
    sectionColor: 'gray',
    title: 'Impostare la password di protezione',
    description: 'Alcune azioni sensibili (eliminazioni, accesso a finanze/statistiche) richiedono una password. La puoi configurare qui.',
    steps: [
      'Vai su Impostazioni → sezione "Password".',
      'Inserisci la nuova password desiderata.',
      'Salva. Da quel momento in poi la password viene richiesta per le operazioni protette.',
    ],
    warnings: ['Scegli una password che ricordi facilmente — non c\'è un recupero automatico.'],
    tags: ['impostazioni', 'password', 'protezione', 'sicurezza'],
  },
  {
    id: 'impostazioni-promemoria',
    section: 'Impostazioni',
    sectionIcon: Settings,
    sectionColor: 'gray',
    title: 'Configurare il promemoria convalida fiches',
    description: 'Il sistema può ricordarti ogni sera di convalidare le fiches della giornata.',
    steps: [
      'Vai su Impostazioni → "Promemoria Convalida Fiches".',
      'Seleziona i giorni della settimana in cui ricevere il promemoria.',
      'Imposta l\'orario desiderato.',
      'Salva. Ogni giorno, all\'ora impostata, apparirà un banner di promemoria.',
    ],
    tags: ['impostazioni', 'promemoria', 'fiches', 'convalida', 'orario'],
  },
  {
    id: 'impostazioni-messaggio-appuntamento',
    section: 'Impostazioni',
    sectionIcon: Settings,
    sectionColor: 'gray',
    title: 'Personalizzare il messaggio promemoria appuntamento',
    description: 'Il testo inviato alle clienti prima dell\'appuntamento può essere personalizzato con variabili dinamiche.',
    steps: [
      'Vai su Impostazioni → "Messaggio Avviso Appuntamento".',
      'Modifica il testo usando i segnaposto: {nome}, {data}, {ora}, {indirizzo}.',
      'Salva il template.',
    ],
    tips: ['{nome} = nome della cliente', '{data} = data dell\'appuntamento', '{ora} = orario', '{indirizzo} = indirizzo del salone'],
    tags: ['impostazioni', 'messaggio', 'appuntamento', 'template', 'whatsapp', 'variabili'],
  },
  {
    id: 'impostazioni-template-carte',
    section: 'Impostazioni',
    sectionIcon: Settings,
    sectionColor: 'gray',
    title: 'Template messaggi carte sconto',
    description: 'Configura i messaggi inviati alle clienti quando crei o usi una carta sconto (compleanno, Natale, regalo, ecc.).',
    steps: [
      'Vai su Impostazioni → "Template Messaggi Carta Sconto".',
      'Modifica i template esistenti o creane di nuovi.',
      'Usa i segnaposto: {nome}, {codice}, {sconto}, {da}.',
      'Salva.',
    ],
    tags: ['impostazioni', 'template', 'carte sconto', 'messaggio', 'compleanno', 'natale'],
  },
  {
    id: 'impostazioni-qr',
    section: 'Impostazioni',
    sectionIcon: Settings,
    sectionColor: 'gray',
    title: 'QR code registrazione clienti',
    description: 'Genera un QR code che le clienti possono scansionare per compilare autonomamente la scheda di registrazione.',
    steps: [
      'Vai su Impostazioni → "QR Code Registrazione".',
      'Apparirà il QR code da stampare e posizionare in salone.',
      'Le clienti lo scansionano, compilano il form e la scheda appare in Clienti → "Schede da confermare".',
    ],
    tags: ['impostazioni', 'qr code', 'registrazione', 'clienti', 'form'],
  },
  {
    id: 'impostazioni-backup',
    section: 'Impostazioni',
    sectionIcon: Settings,
    sectionColor: 'gray',
    title: 'Backup dei dati',
    description: 'Puoi eseguire manualmente un backup del database per mettere al sicuro tutti i dati del salone.',
    steps: [
      'Vai su Impostazioni → "Backup".',
      'Clicca "Esegui Backup".',
      'Si scarica un file con tutti i dati del salone.',
    ],
    warnings: ['Esegui il backup periodicamente per non rischiare di perdere dati in caso di problemi tecnici.'],
    tags: ['impostazioni', 'backup', 'dati', 'sicurezza', 'esporta'],
  },

  // ── CESTINO ──
  {
    id: 'cestino-ripristino',
    section: 'Cestino',
    sectionIcon: Trash2,
    sectionColor: 'red',
    title: 'Ripristinare elementi eliminati',
    description: 'Quando elimini un cliente, un appuntamento, una carta o altri elementi, vengono spostati nel Cestino e possono essere recuperati.',
    steps: [
      'Vai su Cestino.',
      'Seleziona la categoria (Clienti, Appuntamenti, Carte, ecc.).',
      'Trova l\'elemento da recuperare.',
      'Clicca "Ripristina" — l\'elemento torna disponibile nella sezione originale.',
    ],
    tags: ['cestino', 'ripristina', 'recupera', 'elimina', 'annulla'],
  },
  {
    id: 'cestino-elimina-definitivo',
    section: 'Cestino',
    sectionIcon: Trash2,
    sectionColor: 'red',
    title: 'Eliminazione definitiva',
    description: 'Dal Cestino puoi eliminare definitivamente un elemento. Questa operazione è irreversibile.',
    steps: [
      'Vai su Cestino.',
      'Trova l\'elemento.',
      'Clicca "Elimina definitivamente".',
      'Inserisci la password di conferma.',
      'L\'elemento viene rimosso permanentemente.',
    ],
    warnings: ['L\'eliminazione definitiva non può essere annullata. Procedi con cautela.'],
    tags: ['cestino', 'elimina definitivamente', 'permanente', 'irreversibile'],
  },

  // ── REGISTRAZIONE CLIENTE ──
  {
    id: 'registrazione-cliente-form',
    section: 'Registrazione Cliente',
    sectionIcon: Users,
    sectionColor: 'emerald',
    title: 'Modulo di registrazione online',
    description: 'Il modulo di registrazione è una pagina pubblica accessibile tramite QR code. Le clienti compilano i propri dati direttamente dal telefono.',
    steps: [
      'La cliente scansiona il QR code esposto in salone.',
      'Si apre un form con: Nome, Cognome, Telefono, Email, Data di nascita e Note/Allergie.',
      'La cliente clicca "Invia la mia scheda".',
      'La scheda appare in Clienti → "Schede da confermare" per la tua revisione.',
    ],
    tags: ['registrazione', 'qr code', 'form', 'online', 'scheda'],
  },
];

const SECTION_COLORS: Record<string, string> = {
  amber: 'bg-amber-100 text-amber-700 border-amber-200',
  sky: 'bg-sky-100 text-sky-700 border-sky-200',
  emerald: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  rose: 'bg-rose-100 text-rose-700 border-rose-200',
  violet: 'bg-violet-100 text-violet-700 border-violet-200',
  blue: 'bg-blue-100 text-blue-700 border-blue-200',
  teal: 'bg-teal-100 text-teal-700 border-teal-200',
  orange: 'bg-orange-100 text-orange-700 border-orange-200',
  green: 'bg-green-100 text-green-700 border-green-200',
  red: 'bg-red-100 text-red-700 border-red-200',
  cyan: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  stone: 'bg-stone-100 text-stone-700 border-stone-200',
  gray: 'bg-gray-100 text-gray-700 border-gray-200',
};

const SECTION_ICON_COLORS: Record<string, string> = {
  amber: 'bg-amber-500',
  sky: 'bg-sky-500',
  emerald: 'bg-emerald-500',
  rose: 'bg-rose-500',
  violet: 'bg-violet-500',
  blue: 'bg-blue-500',
  teal: 'bg-teal-500',
  orange: 'bg-orange-500',
  green: 'bg-green-500',
  red: 'bg-red-500',
  cyan: 'bg-cyan-500',
  stone: 'bg-stone-500',
  gray: 'bg-gray-500',
};

function GuideCard({ item, isOpen, onToggle }: { item: GuideItem; isOpen: boolean; onToggle: () => void }) {
  const badgeClass = SECTION_COLORS[item.sectionColor] ?? SECTION_COLORS.gray;
  const iconBg = SECTION_ICON_COLORS[item.sectionColor] ?? SECTION_ICON_COLORS.gray;
  const SectionIcon = item.sectionIcon;

  return (
    <div className={`bg-white rounded-xl border transition-all duration-200 ${isOpen ? 'border-stone-300 shadow-md' : 'border-stone-200 hover:border-stone-300 hover:shadow-sm'}`}>
      <button
        onClick={onToggle}
        className="w-full text-left px-5 py-4 flex items-start gap-4"
      >
        <div className={`w-9 h-9 rounded-lg ${iconBg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
          <SectionIcon size={16} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${badgeClass}`}>
              {item.section}
            </span>
          </div>
          <p className="text-sm font-semibold text-stone-800 leading-snug">{item.title}</p>
          {!isOpen && (
            <p className="text-xs text-stone-500 mt-0.5 line-clamp-1">{item.description}</p>
          )}
        </div>
        <div className="flex-shrink-0 mt-1 text-stone-400">
          {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </div>
      </button>

      {isOpen && (
        <div className="px-5 pb-5 border-t border-stone-100 pt-4 space-y-4">
          <p className="text-sm text-stone-600 leading-relaxed">{item.description}</p>

          {item.steps && item.steps.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Zap size={13} className="text-amber-500" />
                <p className="text-xs font-bold text-stone-700 uppercase tracking-wide">Come fare</p>
              </div>
              <ol className="space-y-2">
                {item.steps.map((step, i) => (
                  <li key={i} className="flex gap-3 text-sm text-stone-600">
                    <span className="w-5 h-5 bg-amber-100 text-amber-700 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <span className="leading-relaxed">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {item.tips && item.tips.length > 0 && (
            <div className="bg-sky-50 border border-sky-100 rounded-lg px-4 py-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Info size={13} className="text-sky-500" />
                <p className="text-xs font-bold text-sky-700 uppercase tracking-wide">Suggerimenti</p>
              </div>
              <ul className="space-y-1">
                {item.tips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-sky-700">
                    <CheckCircle size={12} className="text-sky-400 flex-shrink-0 mt-0.5" />
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {item.warnings && item.warnings.length > 0 && (
            <div className="bg-amber-50 border border-amber-100 rounded-lg px-4 py-3">
              <div className="flex items-center gap-1.5 mb-2">
                <AlertCircle size={13} className="text-amber-500" />
                <p className="text-xs font-bold text-amber-700 uppercase tracking-wide">Attenzione</p>
              </div>
              <ul className="space-y-1">
                {item.warnings.map((w, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-amber-700">
                    <Star size={12} className="text-amber-400 flex-shrink-0 mt-0.5" />
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Guida() {
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const sections = useMemo(() => {
    const seen = new Set<string>();
    return GUIDE_ITEMS.filter(item => {
      if (seen.has(item.section)) return false;
      seen.add(item.section);
      return true;
    }).map(item => ({ name: item.section, icon: item.sectionIcon, color: item.sectionColor }));
  }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return GUIDE_ITEMS.filter(item => {
      const matchesSection = !activeSection || item.section === activeSection;
      if (!matchesSection) return false;
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.section.toLowerCase().includes(q) ||
        item.tags.some(t => t.includes(q)) ||
        (item.steps || []).some(s => s.toLowerCase().includes(q))
      );
    });
  }, [query, activeSection]);

  function handleToggle(id: string) {
    setOpenId(prev => (prev === id ? null : id));
  }

  function clearFilters() {
    setQuery('');
    setActiveSection(null);
  }

  const hasFilters = query.trim() !== '' || activeSection !== null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-stone-900 mb-1">Guida all'uso</h1>
        <p className="text-stone-500 text-sm">Tutto quello che puoi fare con il gestionale, spiegato passo per passo.</p>
      </div>

      {/* Search bar */}
      <div className="relative mb-6">
        <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
        <input
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpenId(null); }}
          placeholder="Cerca un argomento... (es. carta sconto, whatsapp, fiche, backup)"
          className="w-full pl-11 pr-10 py-3 rounded-xl border border-stone-200 bg-white text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent shadow-sm"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setOpenId(null); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 p-1 rounded-lg"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {/* Section filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        {sections.map(s => {
          const Icon = s.icon;
          const isActive = activeSection === s.name;
          const iconBg = SECTION_ICON_COLORS[s.color] ?? SECTION_ICON_COLORS.gray;
          return (
            <button
              key={s.name}
              onClick={() => { setActiveSection(isActive ? null : s.name); setOpenId(null); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                isActive
                  ? `${iconBg} text-white border-transparent shadow-sm`
                  : 'bg-white text-stone-600 border-stone-200 hover:border-stone-300 hover:bg-stone-50'
              }`}
            >
              <Icon size={12} />
              {s.name}
            </button>
          );
        })}
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-stone-500 hover:text-stone-800 transition-colors"
          >
            <X size={12} /> Rimuovi filtri
          </button>
        )}
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-stone-400">
          {filtered.length} {filtered.length === 1 ? 'argomento trovato' : 'argomenti trovati'}
          {hasFilters && <span className="ml-1 text-amber-500 font-medium">(filtro attivo)</span>}
        </p>
        {filtered.length > 1 && (
          <button
            onClick={() => setOpenId(null)}
            className="text-xs text-stone-400 hover:text-stone-600 transition-colors"
          >
            Chiudi tutti
          </button>
        )}
      </div>

      {/* Cards */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-14 h-14 bg-stone-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Search size={22} className="text-stone-400" />
          </div>
          <p className="text-stone-600 font-medium mb-1">Nessun risultato per "{query}"</p>
          <p className="text-stone-400 text-sm">Prova con parole chiave diverse o rimuovi il filtro sezione.</p>
          <button onClick={clearFilters} className="mt-4 text-sm text-amber-600 hover:text-amber-700 font-medium">
            Mostra tutti gli argomenti
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(item => (
            <GuideCard
              key={item.id}
              item={item}
              isOpen={openId === item.id}
              onToggle={() => handleToggle(item.id)}
            />
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="mt-12 pt-6 border-t border-stone-200 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Palette size={14} className="text-stone-400" />
          <p className="text-xs text-stone-400">Gestionale Parrucchieri</p>
        </div>
        <p className="text-xs text-stone-400">
          Hai bisogno di aiuto su qualcosa che non trovi qui? Contatta il supporto tecnico.
        </p>
        <div className="flex items-center justify-center gap-1 mt-2">
          <Clock size={11} className="text-stone-300" />
          <p className="text-[11px] text-stone-300">{GUIDE_ITEMS.length} argomenti disponibili</p>
        </div>
      </div>
    </div>
  );
}
