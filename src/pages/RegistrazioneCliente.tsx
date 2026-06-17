import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { User, Phone, Mail, Calendar, FileText, Check, Scissors, AlertCircle } from 'lucide-react';

interface Form {
  nome: string;
  cognome: string;
  telefono: string;
  email: string;
  data_nascita: string;
  note: string;
}

export default function RegistrazioneCliente() {
  const [form, setForm] = useState<Form>({
    nome: '',
    cognome: '',
    telefono: '',
    email: '',
    data_nascita: '',
    note: '',
  });
  const [stato, setStato] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errore, setErrore] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    const supabaseUrl = 'https://qfpeffzdszdanebmgafb.supabase.co';
    fetch(`${supabaseUrl}/functions/v1/registrazione-cliente?logo=1`)
      .then(r => r.json())
      .then((d: { url?: string }) => { if (d?.url) setLogoUrl(d.url); })
      .catch(() => {});
  }, []);

  function setField(k: keyof Form, v: string) {
    const val = (k === 'nome' || k === 'cognome') && v ? v.charAt(0).toUpperCase() + v.slice(1) : v;
    setForm(f => ({ ...f, [k]: val }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome.trim() || !form.cognome.trim()) {
      setErrore('Nome e cognome sono obbligatori.');
      return;
    }
    setErrore('');
    setStato('loading');

    const { error } = await supabase.from('schede_clienti_da_confermare').insert({
      nome: form.nome.trim(),
      cognome: form.cognome.trim(),
      telefono: form.telefono.trim(),
      email: form.email.trim(),
      data_nascita: form.data_nascita || null,
      note: form.note.trim(),
      stato: 'in_attesa',
    });

    if (error) {
      setStato('error');
      setErrore('Si è verificato un errore. Riprova.');
    } else {
      setStato('success');
    }
  }

  if (stato === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-stone-50 to-amber-50 flex items-center justify-center p-6">
        <div className="w-full max-w-sm text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check size={36} className="text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-stone-800 mb-3">Grazie!</h1>
          <p className="text-stone-500 text-base leading-relaxed">
            I tuoi dati sono stati inviati correttamente.<br />
            Il nostro staff creerà la tua scheda al più presto.
          </p>
          <div className="mt-8 flex items-center justify-center gap-2 text-amber-600">
            <Scissors size={18} />
            <span className="text-sm font-semibold">Ti aspettiamo!</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-amber-50">
      {/* Header */}
      <div className="bg-white border-b border-stone-200 px-6 py-5 text-center">
        <div className="flex items-center justify-center gap-2 mb-1">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo salone" className="w-8 h-8 rounded-lg object-cover" />
          ) : (
            <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center">
              <Scissors size={16} className="text-white" />
            </div>
          )}
          <span className="text-lg font-bold text-stone-800">Scheda Cliente</span>
        </div>
        <p className="text-sm text-stone-500">Compila il modulo per registrarti</p>
      </div>

      <div className="max-w-sm mx-auto px-6 py-8">
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Nome */}
          <div>
            <label className="block text-xs font-semibold text-stone-600 uppercase tracking-wide mb-1.5">
              Nome <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                value={form.nome}
                onChange={e => setField('nome', e.target.value)}
                placeholder="Il tuo nome"
                className="w-full pl-10 pr-4 py-3 bg-white border border-stone-200 rounded-xl text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition"
                required
              />
            </div>
          </div>

          {/* Cognome */}
          <div>
            <label className="block text-xs font-semibold text-stone-600 uppercase tracking-wide mb-1.5">
              Cognome <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                value={form.cognome}
                onChange={e => setField('cognome', e.target.value)}
                placeholder="Il tuo cognome"
                className="w-full pl-10 pr-4 py-3 bg-white border border-stone-200 rounded-xl text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition"
                required
              />
            </div>
          </div>

          {/* Telefono */}
          <div>
            <label className="block text-xs font-semibold text-stone-600 uppercase tracking-wide mb-1.5">
              Telefono
            </label>
            <div className="relative">
              <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="tel"
                value={form.telefono}
                onChange={e => setField('telefono', e.target.value)}
                placeholder="+39 333 000 0000"
                className="w-full pl-10 pr-4 py-3 bg-white border border-stone-200 rounded-xl text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-semibold text-stone-600 uppercase tracking-wide mb-1.5">
              Email
            </label>
            <div className="relative">
              <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="email"
                value={form.email}
                onChange={e => setField('email', e.target.value)}
                placeholder="nome@esempio.it"
                className="w-full pl-10 pr-4 py-3 bg-white border border-stone-200 rounded-xl text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition"
              />
            </div>
          </div>

          {/* Data di nascita */}
          <div>
            <label className="block text-xs font-semibold text-stone-600 uppercase tracking-wide mb-1.5">
              Data di nascita
            </label>
            <div className="relative">
              <Calendar size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="date"
                value={form.data_nascita}
                onChange={e => setField('data_nascita', e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-white border border-stone-200 rounded-xl text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition"
              />
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="block text-xs font-semibold text-stone-600 uppercase tracking-wide mb-1.5">
              Note / Allergie / Preferenze
            </label>
            <div className="relative">
              <FileText size={16} className="absolute left-3.5 top-3.5 text-stone-400" />
              <textarea
                value={form.note}
                onChange={e => setField('note', e.target.value)}
                placeholder="Allergie, preferenze, informazioni utili..."
                rows={3}
                className="w-full pl-10 pr-4 py-3 bg-white border border-stone-200 rounded-xl text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition resize-none"
              />
            </div>
          </div>

          {/* Errore */}
          {errore && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <AlertCircle size={15} className="text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-600">{errore}</p>
            </div>
          )}

          {/* Privacy */}
          <p className="text-xs text-stone-400 leading-relaxed">
            I tuoi dati saranno utilizzati esclusivamente per la gestione della scheda cliente nel salone e non saranno ceduti a terzi.
          </p>

          {/* Submit */}
          <button
            type="submit"
            disabled={stato === 'loading'}
            className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl transition-colors shadow-sm"
          >
            {stato === 'loading' ? 'Invio in corso...' : 'Invia la mia scheda'}
          </button>
        </form>
      </div>
    </div>
  );
}
