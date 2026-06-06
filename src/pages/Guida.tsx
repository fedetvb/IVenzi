import { useState } from 'react';
import {
  LayoutDashboard, Calendar, Users, Scissors, FileText,
  CreditCard, ShoppingBag, Wallet, BarChart2, MessageSquare, Package,
  Settings, Trash2, UserCog, TrendingDown, Search, X,
} from 'lucide-react';

interface Section {
  id: string;
  label: string;
  icon: React.ElementType;
  color: string;
  items: { title: string; body: string }[];
}

const SECTIONS: Section[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    color: 'amber',
    items: [
      { title: 'Panoramica del giorno', body: 'Mostra quanti appuntamenti hai oggi e questa settimana, il totale clienti e l\'orologio in tempo reale.' },
      { title: 'Appuntamenti di oggi', body: 'Lista degli appuntamenti con orario, cliente e stato. Blu = Confermato · Giallo = In attesa · Verde = Completato · Rosso = Cancellato.' },
      { title: 'Azioni rapide', body: 'I pulsanti "Nuovo Appuntamento" e "Nuovo Cliente" ti portano direttamente alla creazione senza navigare altrove.' },
    ],
  },
  {
    id: 'agenda',
    label: 'Agenda',
    icon: Calendar,
    color: 'sky',
    items: [
      { title: 'Vista settimanale', body: 'Griglia lunedì–domenica con orari dalle 8:00 alle 20:00. La colonna del giorno attuale è evidenziata. Usa le frecce ← → per cambiare settimana.' },
      { title: 'Nuovo appuntamento', body: 'Clicca "Nuovo Appuntamento". Scegli cliente, data, orario e aggiungi uno o più servizi con il relativo parrucchiere. L\'orario dei servizi successivi si calcola automaticamente.' },
      { title: 'Modificare/cancellare', body: 'Clicca su un appuntamento per aprirlo in modifica. Per eliminarlo usa il pulsante rosso — l\'appuntamento va nel Cestino.' },
      { title: 'Promemoria WhatsApp', body: 'Clicca "Avvisami" per inviare un messaggio WhatsApp alle clienti con appuntamento il giorno successivo. Il testo è personalizzabile in Impostazioni.' },
      { title: 'Avviso compleanni', body: 'All\'apertura, se ci sono compleanni oggi, compare un modal per inviare gli auguri e creare una carta sconto omaggio.' },
    ],
  },
  {
    id: 'agenda-giorno',
    label: 'Agenda Giorno',
    icon: Calendar,
    color: 'sky',
    items: [
      { title: 'Vista per parrucchiere', body: 'Ogni parrucchiere ha la propria colonna con slot da 15 minuti. Usa + / – per ingrandire o ridurre gli slot. Le preferenze di zoom vengono salvate.' },
      { title: 'Assenze', body: 'Clicca l\'icona assenze per segnare quando un parrucchiere è assente (tutto il giorno o da un orario specifico). Appare come blocco grigio nella colonna.' },
    ],
  },
  {
    id: 'clienti',
    label: 'Clienti',
    icon: Users,
    color: 'emerald',
    items: [
      { title: 'Lista e ricerca', body: 'I clienti sono raggruppati per lettera del cognome. Cerca per nome, cognome, telefono o email tramite la barra in alto.' },
      { title: 'Nuovo cliente', body: 'Clicca "Nuovo Cliente". Nome e Cognome sono obbligatori. Puoi aggiungere telefono, email, data di nascita e note/allergie.' },
      { title: 'Schede da confermare', body: 'Quando una cliente compila il modulo QR, la scheda appare in Clienti → "Schede da confermare". Clicca per rivederla e confermarla o rifiutarla.' },
      { title: 'Eliminare un cliente', body: 'Passa il mouse sul cliente → pulsante rosso → inserisci la password. Il cliente va nel Cestino (recuperabile).' },
    ],
  },
  {
    id: 'scheda-cliente',
    label: 'Scheda Cliente',
    icon: Users,
    color: 'emerald',
    items: [
      { title: 'Info e modifica', body: 'Clicca su un cliente per aprire la sua scheda. Nel tab "Info" puoi modificare tutti i dati personali.' },
      { title: 'Scheda colore', body: 'Tab "Colore": registra ogni trattamento di colorazione con tecnica, formula, ossidante, colore e tempo di posa.' },
      { title: 'Storico appuntamenti', body: 'Tab "Appuntamenti": vedi tutti gli appuntamenti passati e futuri con servizi, parrucchiere e importo.' },
      { title: 'Carte', body: 'Tab "Carte": mostra le carte sconto e premium del cliente, con saldo e pulsante SMS.' },
    ],
  },
  {
    id: 'servizi',
    label: 'Servizi e Prodotti',
    icon: Scissors,
    color: 'rose',
    items: [
      { title: 'Catalogo servizi', body: 'Crea i servizi del salone con nome, durata, prezzo e colore. I servizi inattivi non appaiono nella selezione degli appuntamenti.' },
      { title: 'Voci extra', body: 'Tab "Voci Extra": articoli aggiuntivi (prodotti usati, supplementi) che puoi aggiungere a una fiche.' },
      { title: 'Catalogo trattamenti', body: 'Tab "Trattamenti": catalogo dei trattamenti tecnici usato nella scheda colore del cliente.' },
    ],
  },
  {
    id: 'parrucchieri',
    label: 'Parrucchieri',
    icon: UserCog,
    color: 'violet',
    items: [
      { title: 'Gestire i parrucchieri', body: 'Crea i parrucchieri con nome e colore identificativo. Quelli inattivi non appaiono in agenda.' },
      { title: 'Assenze e ferie', body: 'Nella sezione "Assenze" puoi registrare i periodi di assenza (ferie, malattia) con data di inizio, fine e nota.' },
    ],
  },
  {
    id: 'fiches',
    label: 'Fiches',
    icon: FileText,
    color: 'blue',
    items: [
      { title: 'Cosa sono le fiches', body: 'Le fiches registrano i servizi erogati e gli importi. Si creano automaticamente da un appuntamento completato, o manualmente.' },
      { title: 'Convalidare una fiche', body: 'Clicca "Convalida" su una fiche in attesa (badge giallo). La fiche diventa verde e crea automaticamente un incasso nelle Finanze.' },
      { title: 'Fiche manuale', body: 'Clicca "Nuova Fiche Manuale". Seleziona cliente, data, parrucchiere e aggiungi i servizi. Utile per incassi non prenotati.' },
      { title: 'Esporta PDF', body: 'Apri una fiche e clicca "PDF" per scaricare il documento da consegnare alla cliente.' },
    ],
  },
  {
    id: 'carte',
    label: 'Carte',
    icon: CreditCard,
    color: 'teal',
    items: [
      { title: 'Carta sconto', body: 'Crea carte sconto in percentuale (%) o valore fisso (€). Possono essere usa e getta o riutilizzabili. Il codice si genera automaticamente.' },
      { title: 'Carta premium (prepagata)', body: 'Carte con saldo in credito. La cliente le usa per pagare i servizi scalando dal saldo.' },
      { title: 'Ricaricare una carta', body: 'Trova la carta → clicca "Ricarica" → scegli l\'importo. Il sistema calcola il costo per la cliente. Tipi: Standard (a pagamento) o Gratuito (omaggio).' },
      { title: 'Usare il credito', body: 'Trova la carta → clicca "Usa" → inserisci l\'importo da scalare. Il saldo si aggiorna immediatamente.' },
      { title: 'Inviare SMS/WhatsApp', body: 'Clicca l\'icona SMS sulla carta per aprire il modal e inviare un messaggio WhatsApp alla cliente con i dettagli della carta.' },
    ],
  },
  {
    id: 'rivendita',
    label: 'Rivendita',
    icon: ShoppingBag,
    color: 'orange',
    items: [
      { title: 'Registrare una vendita', body: 'Clicca "Nuova Vendita". Scegli il parrucchiere, il prodotto dal catalogo, la quantità e il prezzo. La data è preimpostata a oggi.' },
      { title: 'Statistiche e classifica', body: 'Filtra per periodo per vedere la classifica parrucchieri per vendite e i prodotti più venduti. Esporta in PDF.' },
    ],
  },
  {
    id: 'finanze',
    label: 'Finanze',
    icon: Wallet,
    color: 'green',
    items: [
      { title: 'Visualizzare gli incassi', body: 'Gli incassi si creano automaticamente dalla convalida delle fiches e dalle ricariche carte. Filtra per periodo (oggi, settimana, mese, anno, personalizzato).' },
      { title: 'Grafico mensile', body: 'Grafico a barre con gli incassi mese per mese per monitorare l\'andamento del salone.' },
    ],
  },
  {
    id: 'gf',
    label: 'Entrate & Uscite',
    icon: TrendingDown,
    color: 'red',
    items: [
      { title: 'Registrare una spesa', body: 'Scegli categoria, descrizione, data e importo lordo. Specifica l\'aliquota IVA per calcolare il netto. Le spese ricorrenti (affitto, bollette) si impostano con frequenza automatica.' },
      { title: 'Configurazione fiscale', body: 'Imposta la forma giuridica e il regime fiscale (ordinario o forfettario) per i calcoli automatici di IVA, IRPEF e contributi.' },
    ],
  },
  {
    id: 'statistiche',
    label: 'Statistiche',
    icon: BarChart2,
    color: 'blue',
    items: [
      { title: 'Classifica clienti', body: 'Modalità: Combinata, Frequenza, Spesa o Fiches. Filtra per periodo. Mostra le migliori e le peggiori clienti.' },
      { title: 'Statistiche parrucchieri', body: 'Appuntamenti, clienti serviti, fatturato e valore medio per fiche. Filtrabili per parrucchiere e periodo.' },
      { title: 'Esporta PDF', body: 'Clicca "Esporta PDF" per scaricare un report professionale con tutte le statistiche nel periodo selezionato.' },
    ],
  },
  {
    id: 'comunicazioni',
    label: 'Comunicazioni',
    icon: MessageSquare,
    color: 'cyan',
    items: [
      { title: 'Messaggi di massa', body: 'Seleziona una o più clienti, scrivi il messaggio (o scegli un template) e clicca "Invia". Si apre WhatsApp per ogni cliente in sequenza. Solo le clienti con telefono appaiono nella lista.' },
      { title: 'Template messaggi', body: 'Seleziona un template preimpostato per inserirlo automaticamente nel campo testo. I template si configurano in Impostazioni.' },
    ],
  },
  {
    id: 'magazzino',
    label: 'Magazzino',
    icon: Package,
    color: 'stone',
    items: [
      { title: 'Inventario prodotti', body: 'Crea prima le categorie (Tinture, Shampoo…), poi aggiungi i prodotti con quantità, soglia minima e prezzo d\'acquisto. Sotto soglia = evidenziato in rosso.' },
      { title: 'Categorie', body: 'Vai su "Nuova Categoria". Inserisci nome e colore per organizzare i prodotti del magazzino.' },
    ],
  },
  {
    id: 'impostazioni',
    label: 'Impostazioni',
    icon: Settings,
    color: 'gray',
    items: [
      { title: 'Password di protezione', body: 'Imposta la password richiesta per eliminazioni, accesso a finanze e statistiche. Vai su Impostazioni → Password.' },
      { title: 'Promemoria convalida fiches', body: 'Scegli i giorni e l\'orario in cui ricevere il promemoria serale per convalidare le fiches del giorno.' },
      { title: 'Messaggio appuntamento', body: 'Personalizza il testo inviato alle clienti. Usa i segnaposto: {nome}, {data}, {ora}, {indirizzo}.' },
      { title: 'Template carte sconto', body: 'Configura i messaggi per compleanni, sconti e promozioni. Usa: {nome}, {codice}, {sconto}.' },
      { title: 'QR code registrazione', body: 'Genera il QR da stampare e appendere in salone. Le clienti lo scansionano, compilano il form e la scheda appare in Clienti → Schede da confermare.' },
      { title: 'Backup dati', body: 'Vai su Impostazioni → Backup → clicca "Esegui Backup". Si scarica un file con tutti i dati del salone. Fallo periodicamente.' },
      { title: 'Tema e logo', body: 'Personalizza colori della sidebar, icona dell\'app e logo del salone. Le modifiche si applicano su questo dispositivo.' },
    ],
  },
  {
    id: 'cestino',
    label: 'Cestino',
    icon: Trash2,
    color: 'red',
    items: [
      { title: 'Ripristinare elementi', body: 'Vai su Cestino, scegli la categoria (Clienti, Appuntamenti, Carte…), trova l\'elemento e clicca "Ripristina". Torna disponibile nella sezione originale.' },
      { title: 'Eliminazione definitiva', body: 'Dal Cestino puoi eliminare in modo permanente. Richiede la password. L\'operazione è irreversibile.' },
    ],
  },
];

const COLOR_BADGE: Record<string, string> = {
  amber: 'bg-amber-100 text-amber-700',
  sky: 'bg-sky-100 text-sky-700',
  emerald: 'bg-emerald-100 text-emerald-700',
  rose: 'bg-rose-100 text-rose-700',
  violet: 'bg-violet-100 text-violet-700',
  blue: 'bg-blue-100 text-blue-700',
  teal: 'bg-teal-100 text-teal-700',
  orange: 'bg-orange-100 text-orange-700',
  green: 'bg-green-100 text-green-700',
  red: 'bg-red-100 text-red-700',
  cyan: 'bg-cyan-100 text-cyan-700',
  stone: 'bg-stone-100 text-stone-600',
  gray: 'bg-stone-100 text-stone-600',
};

const COLOR_ICON: Record<string, string> = {
  amber: 'bg-amber-500', sky: 'bg-sky-500', emerald: 'bg-emerald-500',
  rose: 'bg-rose-500', violet: 'bg-violet-500', blue: 'bg-blue-500',
  teal: 'bg-teal-500', orange: 'bg-orange-500', green: 'bg-green-500',
  red: 'bg-red-500', cyan: 'bg-cyan-500', stone: 'bg-stone-500', gray: 'bg-stone-500',
};

export default function Guida() {
  const [query, setQuery] = useState('');
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const q = query.toLowerCase().trim();

  const filtered = SECTIONS.map(sec => {
    if (activeSection && sec.id !== activeSection) return null;
    const items = sec.items.filter(it =>
      !q ||
      it.title.toLowerCase().includes(q) ||
      it.body.toLowerCase().includes(q) ||
      sec.label.toLowerCase().includes(q)
    );
    if (!items.length) return null;
    return { ...sec, items };
  }).filter(Boolean) as Section[];

  const hasFilters = q !== '' || activeSection !== null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-900 mb-1">Guida all'uso</h1>
        <p className="text-stone-500 text-sm">Trova rapidamente come usare ogni funzione del gestionale.</p>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Cerca... (es. fiche, carta sconto, whatsapp, backup)"
          className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-stone-200 bg-white text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent shadow-sm"
        />
        {query && (
          <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Section pills */}
      <div className="flex flex-wrap gap-1.5 mb-6">
        {SECTIONS.map(s => {
          const Icon = s.icon;
          const active = activeSection === s.id;
          return (
            <button
              key={s.id}
              onClick={() => setActiveSection(active ? null : s.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${
                active
                  ? `${COLOR_ICON[s.color]} text-white border-transparent`
                  : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
              }`}
            >
              <Icon size={11} />
              {s.label}
            </button>
          );
        })}
        {hasFilters && (
          <button
            onClick={() => { setQuery(''); setActiveSection(null); }}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium text-stone-400 hover:text-stone-700 transition-colors"
          >
            <X size={11} /> Rimuovi filtri
          </button>
        )}
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-stone-400">
          <Search size={28} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium text-stone-500">Nessun risultato per "{query}"</p>
          <button onClick={() => { setQuery(''); setActiveSection(null); }} className="mt-3 text-sm text-amber-600 hover:text-amber-700 font-medium">
            Mostra tutto
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {filtered.map(sec => {
            const Icon = sec.icon;
            return (
              <div key={sec.id} className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
                {/* Section header */}
                <div className={`flex items-center gap-3 px-5 py-3.5 border-b border-stone-100 ${COLOR_BADGE[sec.color]} bg-opacity-30`}>
                  <div className={`w-7 h-7 rounded-lg ${COLOR_ICON[sec.color]} flex items-center justify-center flex-shrink-0`}>
                    <Icon size={14} className="text-white" />
                  </div>
                  <h2 className="text-sm font-bold text-stone-800">{sec.label}</h2>
                </div>

                {/* Items */}
                <div className="divide-y divide-stone-100">
                  {sec.items.map((item, i) => (
                    <div key={i} className="px-5 py-3.5">
                      <p className="text-sm font-semibold text-stone-800 mb-0.5">{item.title}</p>
                      <p className="text-sm text-stone-500 leading-relaxed">{item.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-center text-xs text-stone-300 mt-10">Gestionale Parrucchieri · {SECTIONS.reduce((n, s) => n + s.items.length, 0)} argomenti</p>
    </div>
  );
}
