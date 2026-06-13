import { useEffect, useState } from 'react';
import { Sparkles, Calendar, CreditCard, Clock, Scissors, MessageCircle, X } from 'lucide-react';

const STYLE = `
@keyframes benv-enter {
  from { opacity: 0; transform: scale(0.92) translateY(20px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}
@keyframes benv-float {
  0%, 100% { transform: translateY(0px) rotate(0deg); }
  33%       { transform: translateY(-8px) rotate(3deg); }
  66%       { transform: translateY(-4px) rotate(-2deg); }
}
@keyframes benv-shimmer {
  0%   { background-position: -200% center; }
  100% { background-position: 200% center; }
}
@keyframes benv-petal {
  0%   { transform: translateY(-20px) translateX(0) rotate(0deg); opacity: 0; }
  10%  { opacity: 0.7; }
  90%  { opacity: 0.5; }
  100% { transform: translateY(100vh) translateX(40px) rotate(720deg); opacity: 0; }
}
.benv-card   { animation: benv-enter 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards; }
.benv-float  { animation: benv-float 4s ease-in-out infinite; }
.benv-petal  { animation: benv-petal linear infinite; }
.benv-shimmer {
  background: linear-gradient(90deg, #fff0 0%, rgba(255,255,255,0.35) 50%, #fff0 100%);
  background-size: 200% auto;
  animation: benv-shimmer 3s linear infinite;
}
`;

const PETALS = [
  { left: '8%',  delay: '0s',   dur: '6s',  size: 10 },
  { left: '20%', delay: '0.8s', dur: '7s',  size: 8 },
  { left: '35%', delay: '1.5s', dur: '5.5s',size: 12 },
  { left: '50%', delay: '0.3s', dur: '8s',  size: 9 },
  { left: '65%', delay: '2s',   dur: '6.5s',size: 7 },
  { left: '78%', delay: '1s',   dur: '7.5s',size: 11 },
  { left: '90%', delay: '0.6s', dur: '5s',  size: 8 },
];

const VANTAGGI = [
  { icon: Calendar,       testo: 'Richiedi appuntamenti in qualsiasi momento, senza aspettare' },
  { icon: Clock,          testo: 'Consulta tutti i tuoi appuntamenti passati e futuri' },
  { icon: Scissors,       testo: 'Rivivi ogni servizio: data, parrucchiera e trattamento' },
  { icon: CreditCard,     testo: 'Monitora in tempo reale saldo carte e promozioni' },
  { icon: MessageCircle,  testo: 'Inviaci foto e messaggi per richieste speciali' },
];

interface Props {
  nome: string;
  onClose: () => void;
}

export default function BenvenutoModal({ nome, onClose }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 350);
  }

  return (
    <>
      <style>{STYLE}</style>
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
        style={{
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          background: 'rgba(0,0,0,0.45)',
          opacity: visible ? 1 : 0,
          transition: 'opacity 0.35s ease',
        }}
      >
        {/* Petali decorativi */}
        {PETALS.map((p, i) => (
          <div
            key={i}
            className="benv-petal fixed pointer-events-none"
            style={{
              left: p.left,
              top: '-20px',
              animationDelay: p.delay,
              animationDuration: p.dur,
              width: p.size,
              height: p.size,
              borderRadius: '50% 0 50% 0',
              background: i % 2 === 0
                ? 'rgba(244,194,194,0.8)'
                : 'rgba(251,207,232,0.7)',
            }}
          />
        ))}

        <div
          className="benv-card relative w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
          style={{
            background: 'linear-gradient(160deg, #fce4ec 0%, #fdf2f8 35%, #e8f5e9 70%, #f3e5f5 100%)',
          }}
        >
          {/* Shimmer overlay */}
          <div className="benv-shimmer absolute inset-0 pointer-events-none rounded-3xl" />

          {/* Header decorativo */}
          <div
            className="relative px-6 pt-8 pb-5 text-center"
            style={{ background: 'linear-gradient(160deg, #f8a5c2 0%, #f4c2c2 40%, #c8e6c9 100%)' }}
          >
            <div className="benv-float inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/40 backdrop-blur-sm mb-3 shadow-lg">
              <Sparkles size={28} className="text-rose-500" />
            </div>
            <h2
              className="text-xl font-extrabold leading-tight"
              style={{ color: '#6d1a36', textShadow: '0 1px 2px rgba(255,255,255,0.5)' }}
            >
              Finalmente sei qui,<br />{nome}!
            </h2>
            <p className="text-xs font-medium mt-1.5" style={{ color: '#9c3155' }}>
              La tua scheda e' confermata ✨
            </p>
          </div>

          {/* Corpo */}
          <div className="px-5 pt-4 pb-3 space-y-3 max-h-[55vh] overflow-y-auto">
            <p className="text-xs leading-relaxed text-stone-600 text-center">
              Non e' il solito sito e non e' la solita app: questo e' il tuo <strong>pass d'accesso esclusivo</strong> al futuro del nostro salone. Abbiamo digitalizzato le tue coccole.
            </p>

            <p className="text-[11px] font-bold text-stone-500 uppercase tracking-wider text-center mt-1">
              Cosa trovi nella tua Area Personale
            </p>

            <div className="space-y-2">
              {VANTAGGI.map(({ icon: Icon, testo }, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 bg-white/70 rounded-2xl px-3 py-2.5 backdrop-blur-sm"
                >
                  <div
                    className="flex-shrink-0 w-7 h-7 rounded-xl flex items-center justify-center mt-0.5"
                    style={{ background: 'linear-gradient(135deg, #f4c2c2, #fce4ec)' }}
                  >
                    <Icon size={13} className="text-rose-500" />
                  </div>
                  <p className="text-xs text-stone-700 leading-snug">{testo}</p>
                </div>
              ))}
            </div>

            <p className="text-xs text-center text-stone-500 leading-relaxed pt-1 pb-1">
              Curiosa di vedere come abbiamo rivoluzionato<br />il tuo modo di prenderti cura di te?
            </p>
          </div>

          {/* CTA */}
          <div className="px-5 pb-6 pt-2">
            <button
              onClick={handleClose}
              className="w-full py-3.5 rounded-2xl font-bold text-sm text-white shadow-lg transition-all active:scale-95"
              style={{
                background: 'linear-gradient(135deg, #f06292, #e91e63, #ad1457)',
              }}
            >
              Scopri il tuo spazio
            </button>
          </div>

          {/* X discreta */}
          <button
            onClick={handleClose}
            className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white/40 flex items-center justify-center hover:bg-white/60 transition-colors"
          >
            <X size={14} className="text-rose-700" />
          </button>
        </div>
      </div>
    </>
  );
}
