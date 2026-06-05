import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, Users, Clock, ChevronRight } from 'lucide-react';
import { supabase, type Appuntamento, type Cliente } from '../lib/supabase';
import { dbSelect, dbSelectWithRelated } from '../lib/localDb';
import MultiBookModal from '../components/MultiBookModal';

function useItalianTime() {
  const fmt = new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const [time, setTime] = useState(() => fmt.format(new Date()));
  useEffect(() => {
    const id = setInterval(() => setTime(fmt.format(new Date())), 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}

interface DashboardProps {
  onNavigate: (page: 'agenda' | 'clienti') => void;
}

interface Stats {
  appuntamentiOggi: number;
  appuntamentiSettimana: number;
  totaleClienti: number;
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  const [stats, setStats] = useState<Stats>({ appuntamentiOggi: 0, appuntamentiSettimana: 0, totaleClienti: 0 });
  const [appuntamentiOggi, setAppuntamentiOggi] = useState<Appuntamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [nuovoAppModal, setNuovoAppModal] = useState(false);
  const oraItaliana = useItalianTime();

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    const oggi = new Date();
    const inizioOggi = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate()).toISOString();
    const fineOggi = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate(), 23, 59, 59).toISOString();
    const giornoSettimana = oggi.getDay() === 0 ? 6 : oggi.getDay() - 1;
    const inizioSettimana = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate() - giornoSettimana).toISOString();
    const fineSettimana = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate() - giornoSettimana + 6, 23, 59, 59).toISOString();

    const { data: appOggiData } = await dbSelect<Appuntamento>({
      table: 'appuntamenti',
      filters: [
        { col: 'data_ora', op: 'gte', val: inizioOggi },
        { col: 'data_ora', op: 'lte', val: fineOggi },
        { col: 'stato', op: 'neq', val: 'cancellato' },
      ],
      orderBy: [{ col: 'data_ora' }],
    });

    const { data: appSettimanaData } = await dbSelect<Appuntamento>({
      table: 'appuntamenti',
      filters: [
        { col: 'data_ora', op: 'gte', val: inizioSettimana },
        { col: 'data_ora', op: 'lte', val: fineSettimana },
        { col: 'stato', op: 'neq', val: 'cancellato' },
      ],
    });

    const { data: clientiData } = await dbSelect({
      table: 'clienti',
    });

    const countOggi = appOggiData?.length || 0;
    const countSettimana = appSettimanaData?.length || 0;
    const countClienti = clientiData?.length || 0;

    // Fetch cliente data for appuntamenti with relations
    const appOggiWithClienti: (Appuntamento & { clienti?: Cliente })[] = [];
    if (appOggiData) {
      for (const app of appOggiData) {
        const { data: clienteData } = await dbSelect<Cliente>({
          table: 'clienti',
          filters: [{ col: 'id', op: 'eq', val: app.cliente_id }],
        });
        appOggiWithClienti.push({
          ...app,
          clienti: clienteData?.[0],
        });
      }
    }

    setStats({
      appuntamentiOggi: countOggi,
      appuntamentiSettimana: countSettimana,
      totaleClienti: countClienti,
    });
    setAppuntamentiOggi(appOggiWithClienti);
    setLoading(false);
  }

  const statoConfig: Record<string, { label: string; class: string }> = {
    confermato: { label: 'Confermato', class: 'bg-blue-100 text-blue-700' },
    in_attesa: { label: 'In attesa', class: 'bg-amber-100 text-amber-700' },
    completato: { label: 'Completato', class: 'bg-emerald-100 text-emerald-700' },
    cancellato: { label: 'Cancellato', class: 'bg-red-100 text-red-700' },
  };

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      {/* Ora corrente */}
      <div className="flex items-center gap-2">
        <Clock size={15} className="text-stone-400" />
        <span className="text-sm font-semibold text-stone-500 tabular-nums">{oraItaliana}</span>
        <span className="text-xs text-stone-400">— ora italiana</span>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={<Calendar size={20} className="text-blue-600" />} bg="bg-blue-50" label="Appuntamenti oggi" value={stats.appuntamentiOggi} />
        <StatCard icon={<Clock size={20} className="text-amber-600" />} bg="bg-amber-50" label="Questa settimana" value={stats.appuntamentiSettimana} />
        <StatCard icon={<Users size={20} className="text-emerald-600" />} bg="bg-emerald-50" label="Totale clienti" value={stats.totaleClienti} />
      </div>

      {/* Appuntamenti oggi */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
          <h2 className="font-semibold text-stone-800">Appuntamenti di Oggi</h2>
          <button
            onClick={() => onNavigate('agenda')}
            className="flex items-center gap-1 text-sm text-amber-600 hover:text-amber-700 font-medium"
          >
            Vai all'agenda <ChevronRight size={14} />
          </button>
        </div>
        {appuntamentiOggi.length === 0 ? (
          <div className="px-6 py-10 text-center text-stone-400 text-sm">
            Nessun appuntamento per oggi
          </div>
        ) : (
          <div className="divide-y divide-stone-50">
            {appuntamentiOggi.map(app => {
              const ora = new Date(app.data_ora).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
              const cliente = (app as Appuntamento & { clienti?: Cliente }).clienti;
              const cfg = statoConfig[app.stato] ?? statoConfig.confermato;
              return (
                <div key={app.id} className="flex items-center gap-4 px-6 py-3">
                  <div className="w-14 text-center">
                    <span className="text-sm font-semibold text-stone-700">{ora}</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-stone-800">
                      {cliente ? `${cliente.nome} ${cliente.cognome}` : 'Cliente sconosciuto'}
                    </p>
                    <p className="text-xs text-stone-400">{app.durata_minuti} min</p>
                  </div>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${cfg.class}`}>
                    {cfg.label}
                  </span>
                  {app.prezzo_totale > 0 && (
                    <span className="text-sm font-semibold text-stone-700">€{app.prezzo_totale.toFixed(2)}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-4">
        <QuickAction
          label="Nuovo Appuntamento"
          description="Aggiungi appuntamento all'agenda"
          icon={<Calendar size={24} className="text-amber-600" />}
          onClick={() => setNuovoAppModal(true)}
        />
        <QuickAction
          label="Nuovo Cliente"
          description="Aggiungi una nuova scheda cliente"
          icon={<Users size={24} className="text-emerald-600" />}
          onClick={() => onNavigate('clienti')}
        />
      </div>

      {nuovoAppModal && createPortal(
        <MultiBookModal
          dataIniziale={new Date()}
          onClose={() => setNuovoAppModal(false)}
          onSaved={() => { setNuovoAppModal(false); loadDashboard(); }}
        />,
        document.body
      )}
    </div>
  );
}

function StatCard({ icon, bg, label, value }: { icon: React.ReactNode; bg: string; label: string; value: number | string }) {
  return (
    <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-sm">
      <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center mb-3`}>
        {icon}
      </div>
      <p className="text-2xl font-bold text-stone-800">{value}</p>
      <p className="text-xs text-stone-500 mt-1">{label}</p>
    </div>
  );
}

function QuickAction({ label, description, icon, onClick }: { label: string; description: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="bg-white rounded-xl border border-stone-200 p-5 shadow-sm text-left hover:border-amber-300 hover:shadow-md transition-all group"
    >
      <div className="mb-3">{icon}</div>
      <p className="font-semibold text-stone-800 group-hover:text-amber-700">{label}</p>
      <p className="text-xs text-stone-400 mt-1">{description}</p>
    </button>
  );
}
