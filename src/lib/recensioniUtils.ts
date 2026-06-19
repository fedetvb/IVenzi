// Utility per il sistema recensioni Google

export type CategoriaRecensione =
  | 'schiariture'
  | 'colore_organico'
  | 'colore'
  | 'taglio_solo'
  | 'hairtouch'
  | 'stiraggio_permanente'
  | 'trattamento_keratina'
  | 'extension'
  | 'olaplex'
  | 'trattamento_rigenerante'
  | 'default';

export interface CategoriaInfo {
  categoria: CategoriaRecensione;
  hasTaglio: boolean;
}

const CORPO_COMUNE = `Se oggi uscendo hai notato sguardi d'invidia specchiandoti nelle vetrine (o se hai già fatto una sfilata davanti alla fotocamera del telefono!), noi siamo davvero orgogliosi del risultato!
Ti chiediamo un piccolissimo favore: dedica 30 secondi a dircelo con una recensione su Google. Non lo chiediamo per vantarci (okay, forse solo un pochino!), ma perché il tuo passaparola digitale è la carica più grande che ci permette di far crescere il salone i Venzi e prenderci cura dei tuoi capelli ogni giorno. Inquadra il QR o clicca qui sotto: le tue 5 stelle sono il nostro premio più bello! ⭐
Un abbraccio,
Stefano e Federico`;

function testo(apertura: string): string {
  return `Ciao! Grazie mille per averci fatto visita ieri, siamo Federico e Stefano. Ci tenevamo a dirti che abbiamo adorato prenderci cura di te! A proposito: ${apertura}
${CORPO_COMUNE}`;
}

export const DEFAULT_TESTI: Record<string, string> = {
  'schiariture|true':  testo('ti piacciono le tue Nuove Schiariture e il tuo Nuovo Taglio? Hai visto che incredibile Lucentezza e Morbidezza hanno i tuoi capelli? ✨'),
  'schiariture|false': testo('ti piacciono le tue Nuove Schiariture? Hai visto che incredibile Lucentezza e Morbidezza hanno i tuoi capelli? ✨'),
  'colore_organico|true':  testo('ti piacciono il tuo Nuovo Colore Organico e il tuo Nuovo Taglio? Hai visto che incredibile Lucentezza e Morbidezza hanno i tuoi capelli? ✨'),
  'colore_organico|false': testo('ti piace il tuo Nuovo Colore Organico? Hai visto che incredibile Lucentezza e Morbidezza hanno i tuoi capelli? ✨'),
  'colore|true':  testo('ti piacciono il tuo Nuovo Colore e il tuo Nuovo Taglio? Hai visto che splendido risultato? ✨'),
  'colore|false': testo('ti piace il tuo Nuovo Colore? Hai visto che splendido risultato? ✨'),
  'taglio_solo|false': testo('ti piace il tuo Nuovo Taglio? Hai visto quanto sono morbidi e lucenti i tuoi capelli? ✨'),
  'hairtouch|true':  testo('ti piacciono il tuo Nuovo Color Gloss e il tuo Nuovo Taglio? Hai visto come maschera i capelli bianchi in modo del tutto naturale? ✨'),
  'hairtouch|false': testo('ti piace il tuo Nuovo Color Gloss? Hai visto come maschera i capelli bianchi in modo del tutto naturale? ✨'),
  'stiraggio_permanente|true':  testo('ti piacciono il tuo Nuovo Stiraggio Permanente e il tuo Nuovo Taglio? Hai visto quanto sono lisci e disciplinati i tuoi capelli? ✨'),
  'stiraggio_permanente|false': testo('ti piace il tuo Nuovo Stiraggio Permanente? Hai visto quanto sono lisci e disciplinati i tuoi capelli? ✨'),
  'trattamento_keratina|true':  testo('ti piacciono il tuo Nuovo Trattamento Keratina e il tuo Nuovo Taglio? Hai visto quanto sono lisci e setosi i tuoi capelli? ✨'),
  'trattamento_keratina|false': testo('ti piace il tuo Nuovo Trattamento Keratina? Hai visto quanto sono lisci e setosi i tuoi capelli? ✨'),
  'extension|true':  testo('ti piacciono le tue Nuove Extension e il tuo Nuovo Taglio? Hai visto che lunghezza e volume straordinari? ✨'),
  'extension|false': testo('ti piacciono le tue Nuove Extension? Hai visto che lunghezza e volume straordinari? ✨'),
  'olaplex|true':  testo('ti piacciono il tuo Trattamento Olaplex e il tuo Nuovo Taglio? Hai visto quanto sono sani e brillanti i tuoi capelli? ✨'),
  'olaplex|false': testo('ti piace il tuo Trattamento Olaplex? Hai visto quanto sono sani e brillanti i tuoi capelli? ✨'),
  'trattamento_rigenerante|true':  testo('ti piacciono il tuo Trattamento Rigenerante e il tuo Nuovo Taglio? Hai visto quanto sono nutriti e forti i tuoi capelli? ✨'),
  'trattamento_rigenerante|false': testo('ti piace il tuo Trattamento Rigenerante? Hai visto quanto sono nutriti e forti i tuoi capelli? ✨'),
  'default|true':  testo('ti piace il tuo Nuovo Look? Hai visto quanto sono belli i tuoi capelli? ✨'),
  'default|false': testo('ti piace il tuo Nuovo Look? Hai visto quanto sono belli i tuoi capelli? ✨'),
};

export const NOME_VARIANTE: Record<string, string> = {
  'schiariture|true':  'Schiariture + Taglio',
  'schiariture|false': 'Schiariture (senza taglio)',
  'colore_organico|true':  'Colore Organico / Henné + Taglio',
  'colore_organico|false': 'Colore Organico / Henné (senza taglio)',
  'colore|true':  'Colore + Taglio',
  'colore|false': 'Colore (senza taglio)',
  'taglio_solo|false': 'Solo Taglio',
  'hairtouch|true':  'Color Gloss + Taglio',
  'hairtouch|false': 'Color Gloss (senza taglio)',
  'stiraggio_permanente|true':  'Stiraggio Permanente + Taglio',
  'stiraggio_permanente|false': 'Stiraggio Permanente (senza taglio)',
  'trattamento_keratina|true':  'Trattamento Keratina + Taglio',
  'trattamento_keratina|false': 'Trattamento Keratina (senza taglio)',
  'extension|true':  'Extension + Taglio',
  'extension|false': 'Extension (senza taglio)',
  'olaplex|true':  'Olaplex + Taglio',
  'olaplex|false': 'Olaplex (senza taglio)',
  'trattamento_rigenerante|true':  'Trattamento Rigenerante + Taglio',
  'trattamento_rigenerante|false': 'Trattamento Rigenerante (senza taglio)',
  'default|true':  'Generico + Taglio',
  'default|false': 'Generico (senza taglio)',
};

// Mappa servizi → categoria
function classificaVoce(nomeVoce: string): CategoriaRecensione | null {
  const n = nomeVoce.toLowerCase().trim();
  if (/taglio (donna|uomo|under|bambino)/i.test(nomeVoce) || n === 'taglio') return null; // gestito come hasTaglio
  if (/colpi di sole|balayage|schiariture/i.test(nomeVoce)) return 'schiariture';
  if (/hairtouch/i.test(nomeVoce)) return 'hairtouch';
  if (/colore organico|henné|henna/i.test(nomeVoce)) return 'colore_organico';
  if (/gloss/i.test(nomeVoce)) return 'hairtouch';
  if (/colore sopracciglia/i.test(nomeVoce)) return null; // ignorato
  if (/colore totale|colore/i.test(nomeVoce)) return 'colore';
  if (/x-tenso|x tenso/i.test(nomeVoce)) return 'stiraggio_permanente';
  if (/biotryx|keratina/i.test(nomeVoce)) return 'trattamento_keratina';
  if (/extension/i.test(nomeVoce)) return 'extension';
  if (/olaplex/i.test(nomeVoce)) return 'olaplex';
  if (/maschera rigenerante|rigenerante/i.test(nomeVoce)) return 'trattamento_rigenerante';
  return null;
}

// Ordine di priorità delle categorie
const PRIORITA: CategoriaRecensione[] = [
  'schiariture', 'colore_organico', 'colore', 'stiraggio_permanente',
  'trattamento_keratina', 'extension', 'hairtouch', 'olaplex',
  'trattamento_rigenerante', 'taglio_solo', 'default',
];

export function analizzaVoci(voci: { nome_voce: string; tipo?: string }[]): CategoriaInfo {
  const categorie = new Set<CategoriaRecensione>();
  let hasTaglio = false;

  for (const v of voci) {
    const n = v.nome_voce?.toLowerCase() ?? '';
    if (/taglio (donna|uomo|under|bambino)/i.test(v.nome_voce) || n === 'taglio') {
      hasTaglio = true;
      continue;
    }
    const cat = classificaVoce(v.nome_voce);
    if (cat) categorie.add(cat);
  }

  // Gloss + Colore → vince Colore
  if (categorie.has('colore') && categorie.has('hairtouch')) {
    categorie.delete('hairtouch');
  }

  // Scegli categoria con priorità più alta
  for (const p of PRIORITA) {
    if (categorie.has(p)) return { categoria: p, hasTaglio };
  }

  // Solo taglio
  if (hasTaglio) return { categoria: 'taglio_solo', hasTaglio: false }; // hasTaglio false per la key 'taglio_solo|false'

  return { categoria: 'default', hasTaglio };
}

export function getTestoKey(categoria: CategoriaRecensione, hasTaglio: boolean): string {
  if (categoria === 'taglio_solo') return 'taglio_solo|false';
  return `${categoria}|${hasTaglio}`;
}

export function getDefaultTesto(categoria: CategoriaRecensione, hasTaglio: boolean): string {
  const key = getTestoKey(categoria, hasTaglio);
  return DEFAULT_TESTI[key] ?? DEFAULT_TESTI['default|false'];
}
