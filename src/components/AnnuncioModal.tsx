import { useMemo } from 'react';
import { X } from 'lucide-react';

// ─── Metadata per ogni sfondo ──────────────────────────────────────────────────

export const SFONDO_META: Record<string, {
  label: string;
  emoji: string;
  defaultTesto: string;
  tagColor: string;
}> = {
  ferie: {
    label: 'Ferie',
    emoji: '🌴',
    defaultTesto: 'Ciao {nome}!\n\nVolevamo avvisarti che il nostro salone sarà chiuso per ferie dal [DATA INIZIO] al [DATA FINE].\n\nSiamo già al lavoro per tornare con tanta energia e tante novità per te!\n\nPuoi già prenotare il tuo appuntamento per la riapertura — saremo felici di rivederti presto.\n\nBuone vacanze!',
    tagColor: 'bg-sky-100 text-sky-700',
  },
  natale: {
    label: 'Natale',
    emoji: '🎄',
    defaultTesto: 'Ciao {nome}!\n\nLe feste si avvicinano e tutto il nostro team vuole augurarti un Natale pieno di calore, gioia e momenti speciali con le persone che ami.\n\nIl salone sarà chiuso dal [DATA INIZIO] al [DATA FINE].\n\nSe vuoi essere al top per le feste, prenota subito il tuo appuntamento pre-natalizio — i posti disponibili sono limitati!\n\nBuon Natale!',
    tagColor: 'bg-green-100 text-green-700',
  },
  capodanno: {
    label: 'Capodanno',
    emoji: '🎆',
    defaultTesto: 'Ciao {nome}!\n\nUn anno nuovo è alle porte e noi siamo qui per aiutarti a salutarlo nel migliore dei modi!\n\nChe il nuovo anno ti porti salute, serenità e tante giornate da trascorrere viziandoti.\n\nPrenota il tuo look da Capodanno — e inizia il nuovo anno con il piede giusto!\n\nFelice Anno Nuovo!',
    tagColor: 'bg-yellow-100 text-yellow-700',
  },
  estate: {
    label: 'Estate',
    emoji: '☀️',
    defaultTesto: 'Ciao {nome}!\n\nL\'estate è arrivata e il sole chiama! È il momento perfetto per prendersi cura dei capelli dopo le giornate all\'aria aperta, il mare e il caldo.\n\nTrattamenti idratanti, colori luminosi e tagli freschi ti aspettano.\n\nPrenota ora il tuo appuntamento estivo — perché i capelli sani partono da qui!\n\nA presto!',
    tagColor: 'bg-orange-100 text-orange-700',
  },
  pasqua: {
    label: 'Pasqua',
    emoji: '🐣',
    defaultTesto: 'Ciao {nome}!\n\nLa Pasqua si avvicina e con essa l\'aria di primavera, la voglia di rinnovamento e di nuovi inizi.\n\nChe questa Pasqua ti porti leggerezza, serenità e tanta dolcezza!\n\nSe vuoi un look fresco e rinnovato per le feste, siamo qui ad aspettarti.\n\nBuona Pasqua!',
    tagColor: 'bg-rose-100 text-rose-700',
  },
  san_valentino: {
    label: 'San Valentino',
    emoji: '❤️',
    defaultTesto: 'Ciao {nome}!\n\nSan Valentino si avvicina e l\'amore è nell\'aria! Che tu lo trascorra con il tuo partner, le amiche o semplicemente con te stessa, meriti di sentirti bellissima.\n\nPrenditi del tempo per te — un appuntamento in salone è il regalo più bello che puoi farti.\n\nPrenota il tuo momento di coccole, perché l\'amore inizia da sé stesse!\n\nBuon San Valentino!',
    tagColor: 'bg-pink-100 text-pink-700',
  },
  autunno: {
    label: 'Autunno',
    emoji: '🍂',
    defaultTesto: 'Ciao {nome}!\n\nL\'autunno è la stagione dei cambiamenti, dei colori caldi e del ritorno alle coccole. È il momento perfetto per rinnovare il tuo look con tonalità calde e trattamenti nutrienti.\n\nLasciati ispirare dai colori della stagione: ramati, castani profondi, biondi dorati.\n\nPrenota il tuo appuntamento autunnale — un nuovo look ti aspetta!\n\nA presto!',
    tagColor: 'bg-amber-100 text-amber-700',
  },
  halloween: {
    label: 'Halloween',
    emoji: '🎃',
    defaultTesto: 'Ciao {nome}!\n\nHalloween si avvicina e l\'atmosfera si fa misteriosa... ma il tuo look non deve esserlo!\n\nChe tu stia pianificando un costume da paura o voglia semplicemente qualcosa di audace e diverso, siamo pronti a trasformarti.\n\nPrenota il tuo appuntamento speciale — promesso, non ti spaventeremo!\n\nBuon Halloween!',
    tagColor: 'bg-orange-100 text-orange-700',
  },
  primavera: {
    label: 'Primavera',
    emoji: '🌸',
    defaultTesto: 'Ciao {nome}!\n\nLa primavera è finalmente arrivata! Giornate più lunghe, aria profumata e voglia di leggerezza e colore.\n\nÈ il momento ideale per un nuovo taglio, un colore fresco o un trattamento rigenerante dopo l\'inverno.\n\nPrenota il tuo appuntamento primaverile — perché anche i tuoi capelli meritano di fiorire!\n\nA presto!',
    tagColor: 'bg-emerald-100 text-emerald-700',
  },
  generico: {
    label: 'Comunicazione',
    emoji: '📢',
    defaultTesto: 'Ciao {nome}!\n\nAbbiamo un avviso importante da condividere con te e con tutte le nostre clienti.\n\nTi invitiamo a leggere con attenzione questo messaggio e a contattarci per qualsiasi informazione o chiarimento.\n\nSiamo sempre a tua disposizione — non esitare a scriverci o chiamarci.\n\nGrazie per la tua fiducia!',
    tagColor: 'bg-stone-100 text-stone-700',
  },
};

export const COMPLEANNO_DEFAULT_TESTO =
  'Oggi è il tuo giorno speciale e tutto il nostro team vuole farti sentire l\'affetto che proviamo per te!\n\nTanti auguri di cuore — che questo compleanno ti porti gioia, salute e tante cose meravigliose.\n\nCome piccolo omaggio, hai diritto a una sorpresa speciale al tuo prossimo appuntamento da noi!\n\nCon tutto il nostro affetto!';

// ─── CSS Keyframes ─────────────────────────────────────────────────────────────

const KEYFRAMES = `
@keyframes ann-enter {
  from { opacity: 0; transform: scale(0.88) translateY(24px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}
@keyframes ann-fall {
  0%   { transform: translateY(-40px) rotate(0deg); opacity: 1; }
  100% { transform: translateY(110vh) rotate(400deg); opacity: 0.2; }
}
@keyframes ann-float {
  0%   { transform: translateY(0) rotate(0deg); opacity: 0.7; }
  100% { transform: translateY(-110vh) rotate(360deg); opacity: 0; }
}
@keyframes ann-snow {
  0%   { transform: translateY(-20px) translateX(0); opacity: 1; }
  50%  { transform: translateY(50vh) translateX(12px); }
  100% { transform: translateY(110vh) translateX(-8px); opacity: 0.3; }
}
@keyframes ann-pulse {
  0%, 100% { opacity: 0.3; transform: scale(1); }
  50%       { opacity: 0.7; transform: scale(1.12); }
}
@keyframes ann-sway {
  0%, 100% { transform: rotate(-6deg); }
  50%       { transform: rotate(6deg); }
}
@keyframes ann-shimmer {
  0%   { transform: translateX(-120%); }
  100% { transform: translateX(120%); }
}
@keyframes ann-bob {
  0%, 100% { transform: translateY(0); }
  50%       { transform: translateY(-8px); }
}
`;

// ─── Decorazioni statiche per ogni sfondo ─────────────────────────────────────

const snowData = Array.from({ length: 18 }, (_, i) => ({
  left: `${3 + (i * 5.4) % 94}%`,
  delay: `${(i * 0.38) % 5}s`,
  duration: `${3.5 + (i * 0.61) % 3.5}s`,
  char: ['❄', '❅', '❆'][i % 3],
  size: 10 + (i % 4) * 5,
  opacity: 0.6 + (i % 3) * 0.15,
}));

const confettiData = Array.from({ length: 35 }, (_, i) => ({
  left: `${(i * 2.85 + 1) % 97}%`,
  w: `${5 + (i % 5) * 2}px`,
  h: `${3 + (i % 4) * 2}px`,
  color: ['#f59e0b', '#ec4899', '#8b5cf6', '#10b981', '#3b82f6', '#ef4444', '#f97316', '#a855f7'][i % 8],
  delay: `${(i * 0.12) % 2.8}s`,
  duration: `${1.8 + (i * 0.09) % 1.8}s`,
  rotate: `${(i * 37) % 180}deg`,
}));

const heartData = Array.from({ length: 10 }, (_, i) => ({
  left: `${5 + (i * 9.4) % 88}%`,
  bottom: `${5 + (i * 11.3) % 60}%`,
  size: 14 + (i % 4) * 8,
  delay: `${(i * 0.55) % 3}s`,
  duration: `${3 + (i * 0.4) % 2}s`,
  opacity: 0.25 + (i % 4) * 0.12,
}));

const starData = Array.from({ length: 20 }, (_, i) => ({
  left: `${(i * 4.8 + 2) % 96}%`,
  top: `${(i * 7.3 + 3) % 90}%`,
  size: 3 + (i % 3) * 3,
  delay: `${(i * 0.27) % 3}s`,
  duration: `${1.5 + (i * 0.3) % 2}s`,
}));

const petalData = Array.from({ length: 14 }, (_, i) => ({
  left: `${(i * 6.8 + 2) % 94}%`,
  delay: `${(i * 0.4) % 4}s`,
  duration: `${3 + (i * 0.5) % 3}s`,
  color: i % 2 === 0 ? '#fce7f3' : '#fbcfe8',
  size: 10 + (i % 3) * 6,
  rotate: `${(i * 41) % 360}deg`,
}));

// ─── Configurazioni sfondi ─────────────────────────────────────────────────────

interface BgConfig {
  bg: string;
  cardBg: string;
  closeBg: string;
  titleColor: string;
  textColor: string;
  decorations: React.ReactNode;
}

function getConfig(sfondo: string): BgConfig {
  switch (sfondo) {

    case 'natale':
      return {
        bg: 'linear-gradient(160deg, #0d3b1e 0%, #1a0a0a 50%, #4a0000 100%)',
        cardBg: 'rgba(10,20,12,0.88)',
        closeBg: 'rgba(255,255,255,0.12)',
        titleColor: '#fbbf24',
        textColor: '#fef3c7',
        decorations: (
          <>
            {snowData.map((s, i) => (
              <span key={i} style={{
                position: 'absolute', left: s.left, top: '-30px',
                fontSize: s.size, opacity: s.opacity, color: '#e0f2fe',
                animation: `ann-snow ${s.duration} ${s.delay} linear infinite`,
                pointerEvents: 'none',
              }}>{s.char}</span>
            ))}
            <div style={{ position: 'absolute', top: '8%', left: '50%', transform: 'translateX(-50%)',
              width: 60, height: 60, borderRadius: '50%',
              background: 'radial-gradient(circle, #ffd70088 0%, transparent 70%)',
              animation: 'ann-pulse 2s ease-in-out infinite', pointerEvents: 'none' }} />
          </>
        ),
      };

    case 'capodanno':
      return {
        bg: 'linear-gradient(160deg, #050d1f 0%, #1a0a3d 55%, #0a1628 100%)',
        cardBg: 'rgba(5,10,30,0.85)',
        closeBg: 'rgba(255,255,255,0.12)',
        titleColor: '#fcd34d',
        textColor: '#fef9c3',
        decorations: (
          <>
            {starData.map((s, i) => (
              <div key={i} style={{
                position: 'absolute', left: s.left, top: s.top,
                width: s.size, height: s.size, borderRadius: '50%',
                background: '#fcd34d',
                animation: `ann-twinkle ${s.duration} ${s.delay} ease-in-out infinite`,
                pointerEvents: 'none',
              }} />
            ))}
            {[...Array(6)].map((_, i) => (
              <div key={i} style={{
                position: 'absolute',
                left: `${10 + i * 15}%`,
                top: `${20 + (i % 3) * 25}%`,
                width: 80 + i * 20,
                height: 80 + i * 20,
                borderRadius: '50%',
                border: `1px solid rgba(252,211,77,${0.05 + i * 0.03})`,
                animation: `ann-pulse ${2 + i * 0.4}s ${i * 0.3}s ease-in-out infinite`,
                pointerEvents: 'none',
              }} />
            ))}
          </>
        ),
      };

    case 'ferie':
      return {
        bg: 'linear-gradient(170deg, #0099cc 0%, #33ccaa 45%, #ffd166 80%, #ff9a3c 100%)',
        cardBg: 'rgba(255,255,255,0.92)',
        closeBg: 'rgba(0,0,0,0.12)',
        titleColor: '#0369a1',
        textColor: '#1e3a5f',
        decorations: (
          <>
            <div style={{
              position: 'absolute', top: '6%', right: '8%',
              width: 90, height: 90, borderRadius: '50%',
              background: 'radial-gradient(circle, #ffd700 30%, #ffaa00 70%, transparent 100%)',
              boxShadow: '0 0 40px 20px rgba(255,215,0,0.4)',
              animation: 'ann-pulse 3s ease-in-out infinite', pointerEvents: 'none',
            }} />
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0, height: '22%',
              background: 'linear-gradient(0deg, rgba(0,80,140,0.55) 0%, transparent 100%)',
              pointerEvents: 'none',
            }} />
            {[0,1,2,3].map(i => (
              <div key={i} style={{
                position: 'absolute', bottom: `${4 + i * 3}%`,
                left: `${i * 28}%`, right: 0,
                height: 30,
                borderRadius: '50% 50% 0 0',
                border: `2px solid rgba(255,255,255,${0.2 + i * 0.08})`,
                borderBottom: 'none',
                pointerEvents: 'none',
              }} />
            ))}
          </>
        ),
      };

    case 'estate':
      return {
        bg: 'linear-gradient(160deg, #ff4500 0%, #ff8c00 40%, #ffd700 80%, #fff176 100%)',
        cardBg: 'rgba(255,255,255,0.90)',
        closeBg: 'rgba(0,0,0,0.12)',
        titleColor: '#b45309',
        textColor: '#78350f',
        decorations: (
          <>
            <div style={{
              position: 'absolute', top: '5%', left: '50%', transform: 'translateX(-50%)',
              width: 110, height: 110, borderRadius: '50%',
              background: 'radial-gradient(circle, #fff7ed 0%, #fcd34d 40%, transparent 70%)',
              boxShadow: '0 0 60px 30px rgba(252,211,77,0.5)',
              animation: 'ann-bob 3s ease-in-out infinite', pointerEvents: 'none',
            }} />
            {[...Array(12)].map((_, i) => (
              <div key={i} style={{
                position: 'absolute', top: 'calc(5% + 55px)', left: '50%',
                width: 3, height: 60 + (i % 3) * 15,
                background: 'rgba(255,215,0,0.3)',
                transformOrigin: '50% 0',
                transform: `translateX(-50%) rotate(${i * 30}deg)`,
                pointerEvents: 'none',
              }} />
            ))}
          </>
        ),
      };

    case 'pasqua':
      return {
        bg: 'linear-gradient(160deg, #fce7f3 0%, #fef9c3 50%, #d1fae5 100%)',
        cardBg: 'rgba(255,255,255,0.93)',
        closeBg: 'rgba(0,0,0,0.10)',
        titleColor: '#9d174d',
        textColor: '#4a1942',
        decorations: (
          <>
            {[
              { l:'8%', t:'12%', c1:'#fbcfe8', c2:'#fde68a', w:45, h:60 },
              { l:'78%', t:'8%', c1:'#a7f3d0', c2:'#bfdbfe', w:38, h:52 },
              { l:'15%', t:'72%', c1:'#fde68a', c2:'#c7d2fe', w:42, h:56 },
              { l:'72%', t:'68%', c1:'#fca5a5', c2:'#6ee7b7', w:35, h:48 },
            ].map((egg, i) => (
              <div key={i} style={{
                position: 'absolute', left: egg.l, top: egg.t,
                width: egg.w, height: egg.h,
                borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%',
                background: `linear-gradient(135deg, ${egg.c1}, ${egg.c2})`,
                opacity: 0.55,
                animation: `ann-bob ${2.5 + i * 0.4}s ${i * 0.5}s ease-in-out infinite`,
                pointerEvents: 'none',
              }} />
            ))}
          </>
        ),
      };

    case 'san_valentino':
      return {
        bg: 'linear-gradient(160deg, #7b0028 0%, #c62366 50%, #f06292 100%)',
        cardBg: 'rgba(50,5,20,0.85)',
        closeBg: 'rgba(255,255,255,0.12)',
        titleColor: '#fda4af',
        textColor: '#ffe4e6',
        decorations: (
          <>
            {heartData.map((h, i) => (
              <div key={i} style={{
                position: 'absolute', left: h.left, bottom: h.bottom,
                fontSize: h.size, opacity: h.opacity, color: '#fecdd3',
                animation: `ann-float ${h.duration} ${h.delay} ease-in-out infinite`,
                pointerEvents: 'none',
              }}>♥</div>
            ))}
          </>
        ),
      };

    case 'autunno':
      return {
        bg: 'linear-gradient(160deg, #7c2d12 0%, #c2410c 45%, #92400e 100%)',
        cardBg: 'rgba(40,15,5,0.84)',
        closeBg: 'rgba(255,255,255,0.12)',
        titleColor: '#fcd34d',
        textColor: '#fef3c7',
        decorations: (
          <>
            {[...Array(12)].map((_, i) => (
              <div key={i} style={{
                position: 'absolute',
                left: `${(i * 8.2 + 3) % 93}%`,
                top: '-20px',
                fontSize: 18 + (i % 3) * 6,
                animation: `ann-fall ${2.5 + (i * 0.35) % 2.5}s ${(i * 0.3) % 3.5}s linear infinite`,
                pointerEvents: 'none',
              }}>
                {['🍂', '🍁', '🍃'][i % 3]}
              </div>
            ))}
          </>
        ),
      };

    case 'halloween':
      return {
        bg: 'linear-gradient(160deg, #0d0d0d 0%, #3d1a00 65%, #1a0a00 100%)',
        cardBg: 'rgba(8,4,2,0.88)',
        closeBg: 'rgba(255,255,255,0.10)',
        titleColor: '#f97316',
        textColor: '#fed7aa',
        decorations: (
          <>
            <div style={{
              position: 'absolute', top: '4%', right: '10%',
              width: 80, height: 80, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(251,191,36,0.9) 30%, rgba(245,158,11,0.4) 65%, transparent 85%)',
              boxShadow: '0 0 40px 15px rgba(245,158,11,0.3)',
              animation: 'ann-pulse 3s ease-in-out infinite', pointerEvents: 'none',
            }} />
            {[...Array(6)].map((_, i) => (
              <div key={i} style={{
                position: 'absolute',
                left: `${5 + i * 16}%`,
                top: `${10 + (i % 3) * 20}%`,
                fontSize: 20 + (i % 2) * 10,
                opacity: 0.25,
                animation: `ann-sway ${2 + i * 0.3}s ${i * 0.4}s ease-in-out infinite`,
                pointerEvents: 'none',
              }}>🦇</div>
            ))}
          </>
        ),
      };

    case 'primavera':
      return {
        bg: 'linear-gradient(160deg, #bae6fd 0%, #fbcfe8 50%, #bbf7d0 100%)',
        cardBg: 'rgba(255,255,255,0.92)',
        closeBg: 'rgba(0,0,0,0.10)',
        titleColor: '#0f766e',
        textColor: '#134e4a',
        decorations: (
          <>
            {petalData.map((p, i) => (
              <div key={i} style={{
                position: 'absolute', left: p.left, top: '-20px',
                width: p.size, height: p.size * 0.6,
                borderRadius: '50%',
                background: p.color,
                opacity: 0.6,
                transform: `rotate(${p.rotate})`,
                animation: `ann-fall ${p.duration} ${p.delay} ease-in-out infinite`,
                pointerEvents: 'none',
              }} />
            ))}
          </>
        ),
      };

    case 'generico':
      return {
        bg: 'linear-gradient(160deg, #1c1917 0%, #292524 50%, #3d3835 100%)',
        cardBg: 'rgba(20,18,16,0.88)',
        closeBg: 'rgba(255,255,255,0.10)',
        titleColor: '#fcd34d',
        textColor: '#fef3c7',
        decorations: (
          <>
            <div style={{
              position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none',
            }}>
              <div style={{
                position: 'absolute', top: '-10%', left: '-10%',
                width: '50%', height: '50%', borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(252,211,77,0.08) 0%, transparent 70%)',
              }} />
              <div style={{
                position: 'absolute', bottom: '-10%', right: '-10%',
                width: '60%', height: '60%', borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(252,211,77,0.06) 0%, transparent 70%)',
              }} />
            </div>
          </>
        ),
      };

    case 'compleanno':
    default:
      return {
        bg: 'linear-gradient(160deg, #92400e 0%, #c026d3 45%, #4f46e5 100%)',
        cardBg: 'rgba(255,255,255,0.93)',
        closeBg: 'rgba(0,0,0,0.12)',
        titleColor: '#7c3aed',
        textColor: '#1e1b4b',
        decorations: (
          <>
            {confettiData.map((c, i) => (
              <div key={i} style={{
                position: 'absolute', left: c.left, top: '-10px',
                width: c.w, height: c.h,
                background: c.color,
                borderRadius: 2,
                transform: `rotate(${c.rotate})`,
                animation: `ann-fall ${c.duration} ${c.delay} linear infinite`,
                pointerEvents: 'none',
              }} />
            ))}
          </>
        ),
      };
  }
}

// ─── Componente principale ─────────────────────────────────────────────────────

interface Props {
  sfondo: string;
  testo: string;
  nome: string;
  isCompleanno?: boolean;
  onClose: () => void;
}

export default function AnnuncioModal({ sfondo, testo, nome, isCompleanno, onClose }: Props) {
  const effectiveSfondo = isCompleanno ? 'compleanno' : sfondo;
  const config = useMemo(() => getConfig(effectiveSfondo), [effectiveSfondo]);

  const processedTesto = testo.replace(/\{nome\}/gi, nome);

  const title = isCompleanno
    ? `Tanti auguri, ${nome}!`
    : SFONDO_META[sfondo]?.label ?? 'Comunicazione';

  const emoji = isCompleanno ? '🎂' : (SFONDO_META[sfondo]?.emoji ?? '📢');

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center overflow-hidden"
      style={{ background: config.bg }}
    >
      <style>{KEYFRAMES}</style>

      {/* Decorazioni di sfondo */}
      <div className="absolute inset-0 overflow-hidden" style={{ pointerEvents: 'none' }}>
        {config.decorations}
      </div>

      {/* Card contenuto */}
      <div
        className="relative z-10 w-full max-w-sm mx-5 rounded-3xl shadow-2xl overflow-hidden"
        style={{
          background: config.cardBg,
          backdropFilter: 'blur(12px)',
          animation: 'ann-enter 0.5s cubic-bezier(0.34,1.56,0.64,1) both',
        }}
      >
        {/* Header */}
        <div className="px-7 pt-8 pb-2 flex flex-col items-center text-center">
          <span className="text-5xl mb-3" style={{ animation: 'ann-bob 2s ease-in-out infinite' }}>
            {emoji}
          </span>
          <h1
            className="text-2xl font-extrabold leading-tight tracking-tight"
            style={{ color: config.titleColor }}
          >
            {title}
          </h1>
        </div>

        {/* Divider */}
        <div className="mx-7 my-3 h-px" style={{ background: `${config.titleColor}33` }} />

        {/* Testo */}
        <div className="px-7 pb-2">
          <p
            className="text-sm leading-relaxed whitespace-pre-line text-center"
            style={{ color: config.textColor }}
          >
            {processedTesto}
          </p>
        </div>

        {/* Pulsante chiudi */}
        <div className="px-7 pb-8 pt-5">
          <button
            onClick={onClose}
            className="w-full py-3.5 rounded-2xl font-bold text-sm transition-all active:scale-95"
            style={{
              background: config.titleColor,
              color: '#fff',
              boxShadow: `0 4px 20px ${config.titleColor}55`,
            }}
          >
            {isCompleanno ? 'Grazie! Continua →' : 'Ho capito, continua →'}
          </button>
        </div>
      </div>

      {/* X in alto a destra */}
      <button
        onClick={onClose}
        className="absolute top-5 right-5 z-20 w-9 h-9 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95"
        style={{ background: config.closeBg, backdropFilter: 'blur(4px)' }}
      >
        <X size={16} color={config.textColor} />
      </button>
    </div>
  );
}
