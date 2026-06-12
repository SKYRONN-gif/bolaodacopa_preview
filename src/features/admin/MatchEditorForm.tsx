import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { CalendarPlus, Pencil, Save, ShieldCheck } from 'lucide-react';

import { Match } from '../../types';

type MatchEditorMode = 'create' | 'edit';

interface MatchEditorFormProps {
  matches: Match[];
  onSaveMatch: (
    match: Match,
    mode: MatchEditorMode
  ) => void | Promise<void>;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

interface MatchFormState {
  id: string;
  teamA: string;
  flagA: string;
  teamB: string;
  flagB: string;
  date: string;
  time: string;
  group: string;
  venue: string;
  city: string;
}

const EMPTY_FORM: MatchFormState = {
  id: '',
  teamA: '',
  flagA: '',
  teamB: '',
  flagB: '',
  date: '',
  time: '',
  group: '',
  venue: '',
  city: '',
};

function getNextMatchId(matches: Match[]) {
  const highestNumber = matches.reduce((highest, match) => {
    const matchNumber = /^m(\d+)$/i.exec(match.id)?.[1];

    if (!matchNumber) return highest;

    return Math.max(highest, Number(matchNumber));
  }, 0);

  return `m${highestNumber + 1}`;
}

function toDateInputValue(date: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;

  const [day, month, year] = date.split('/');

  if (!day || !month || !year) return '';

  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function toBrazilianDate(date: string) {
  const [year, month, day] = date.split('-');

  return `${day}/${month}/${year}`;
}

function toSaoPauloIso(date: string, time: string) {
  return new Date(`${date}T${time}:00-03:00`).toISOString();
}

function toFormState(match: Match): MatchFormState {
  return {
    id: match.id,
    teamA: match.teamA,
    flagA: match.flagA,
    teamB: match.teamB,
    flagB: match.flagB,
    date: toDateInputValue(match.date),
    time: match.time,
    group: match.group,
    venue: match.venue || '',
    city: match.city || '',
  };
}

function createEmptyForm(matches: Match[]): MatchFormState {
  return {
    ...EMPTY_FORM,
    id: getNextMatchId(matches),
    group: 'Grupo ',
  };
}

export function MatchEditorForm({
  matches,
  onSaveMatch,
  onSuccess,
  onError,
}: MatchEditorFormProps) {
  const [mode, setMode] = useState<MatchEditorMode>('create');
  const [selectedMatchId, setSelectedMatchId] = useState(matches[0]?.id || '');
  const [form, setForm] = useState<MatchFormState>(() =>
    createEmptyForm(matches)
  );
  const [isSaving, setIsSaving] = useState(false);

  const selectedMatch = useMemo(
    () => matches.find((match) => match.id === selectedMatchId),
    [matches, selectedMatchId]
  );

  useEffect(() => {
    if (mode === 'create') {
      setForm((currentForm) => ({
        ...currentForm,
        id: currentForm.id || getNextMatchId(matches),
      }));
      return;
    }

    if (matches.length === 0) {
      setSelectedMatchId('');
      setForm(EMPTY_FORM);
      return;
    }

    const nextSelectedMatch =
      selectedMatch || matches.find((match) => match.id === selectedMatchId) || matches[0];

    setSelectedMatchId(nextSelectedMatch.id);
    setForm(toFormState(nextSelectedMatch));
  }, [matches, mode, selectedMatch, selectedMatchId]);

  const updateField = (field: keyof MatchFormState, value: string) => {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  };

  const handleModeChange = (nextMode: MatchEditorMode) => {
    setMode(nextMode);

    if (nextMode === 'create') {
      setForm(createEmptyForm(matches));
      return;
    }

    if (matches[0]) {
      setSelectedMatchId(matches[0].id);
      setForm(toFormState(matches[0]));
    }
  };

  const handleMatchChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const match = matches.find((item) => item.id === event.target.value);

    if (!match) return;

    setSelectedMatchId(match.id);
    setForm(toFormState(match));
  };

  const validateForm = () => {
    const id = form.id.trim();

    if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
      return 'Use um código interno simples, como m9 ou jogo-9.';
    }

    if (mode === 'create' && matches.some((match) => match.id === id)) {
      return 'Já existe uma partida com esse código interno.';
    }

    if (!form.teamA.trim() || !form.teamB.trim()) {
      return 'Informe os dois times da partida.';
    }

    if (!form.flagA.trim() || !form.flagB.trim()) {
      return 'Informe as duas bandeiras.';
    }

    if (!form.date || !form.time) {
      return 'Informe data e horário no Brasil.';
    }

    if (!form.group.trim()) {
      return 'Informe o grupo, fase ou rodada.';
    }

    return null;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    const validationError = validateForm();

    if (validationError) {
      onError(validationError);
      return;
    }

    const existingMatch = mode === 'edit' ? selectedMatch : undefined;
    const venue = form.venue.trim();
    const city = form.city.trim();

    const nextMatch: Match = {
      id: form.id.trim(),
      teamA: form.teamA.trim(),
      flagA: form.flagA.trim(),
      teamB: form.teamB.trim(),
      flagB: form.flagB.trim(),
      date: toBrazilianDate(form.date),
      time: form.time,
      startsAt: toSaoPauloIso(form.date, form.time),
      status: existingMatch?.status || 'scheduled',
      group: form.group.trim(),
    };

    if (venue) nextMatch.venue = venue;
    if (city) nextMatch.city = city;

    if (
      existingMatch?.status === 'finished' &&
      typeof existingMatch.scoreA === 'number' &&
      typeof existingMatch.scoreB === 'number'
    ) {
      nextMatch.scoreA = existingMatch.scoreA;
      nextMatch.scoreB = existingMatch.scoreB;
    }

    try {
      setIsSaving(true);
      await onSaveMatch(nextMatch, mode);

      if (mode === 'create') {
        onSuccess('Jogo cadastrado. Ele já aparece para os participantes.');
        setForm(createEmptyForm([...matches, nextMatch]));
        return;
      }

      onSuccess('Jogo atualizado sem alterar os palpites já salvos.');
    } catch (error) {
      console.warn('Erro ao salvar jogo:', error);
      onError('Não foi possível salvar o jogo no banco agora.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="app-card app-card-padding space-y-5">
      <div className="app-card-header">
        <CalendarPlus className="w-5 h-5 text-emerald-700" />

        <h3 className="app-section-title">
          Gerenciar jogos
        </h3>
      </div>

      <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-lg">
        <button
          type="button"
          onClick={() => handleModeChange('create')}
          className={`flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-bold transition ${
            mode === 'create'
              ? 'bg-white text-emerald-800 shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <CalendarPlus className="w-3.5 h-3.5" />
          <span>Novo jogo</span>
        </button>

        <button
          type="button"
          onClick={() => handleModeChange('edit')}
          className={`flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-bold transition ${
            mode === 'edit'
              ? 'bg-white text-emerald-800 shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Pencil className="w-3.5 h-3.5" />
          <span>Editar jogo</span>
        </button>
      </div>

      {mode === 'edit' && (
        <div>
          <label className="app-label">
            Partida cadastrada
          </label>

          <select
            value={selectedMatchId}
            onChange={handleMatchChange}
            className="app-select"
            disabled={matches.length === 0}
          >
            {matches.length === 0 ? (
              <option>Nenhuma partida cadastrada</option>
            ) : (
              matches.map((match) => (
                <option key={match.id} value={match.id}>
                  [{match.id}] {match.flagA} {match.teamA} x {match.teamB}{' '}
                  {match.flagB} - {match.date} às {match.time}
                </option>
              ))
            )}
          </select>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div>
            <label className="app-label">
              Código interno
            </label>

            <input
              type="text"
              value={form.id}
              disabled={mode === 'edit'}
              onChange={(event) => updateField('id', event.target.value)}
              placeholder="m9"
              className="app-input disabled:bg-slate-100 disabled:text-slate-400"
            />
          </div>

          <div className="sm:col-span-3">
            <label className="app-label">
              Grupo, fase ou rodada
            </label>

            <input
              type="text"
              value={form.group}
              onChange={(event) => updateField('group', event.target.value)}
              placeholder="Grupo A, Oitavas, Quartas..."
              className="app-input"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="grid grid-cols-[72px_1fr] gap-3">
            <div>
              <label className="app-label">
                Bandeira
              </label>

              <input
                type="text"
                value={form.flagA}
                onChange={(event) => updateField('flagA', event.target.value)}
                placeholder="🇧🇷"
                className="app-input text-center px-2"
                maxLength={8}
              />
            </div>

            <div>
              <label className="app-label">
                Time A
              </label>

              <input
                type="text"
                value={form.teamA}
                onChange={(event) => updateField('teamA', event.target.value)}
                placeholder="Brasil"
                className="app-input"
              />
            </div>
          </div>

          <div className="grid grid-cols-[72px_1fr] gap-3">
            <div>
              <label className="app-label">
                Bandeira
              </label>

              <input
                type="text"
                value={form.flagB}
                onChange={(event) => updateField('flagB', event.target.value)}
                placeholder="🇲🇦"
                className="app-input text-center px-2"
                maxLength={8}
              />
            </div>

            <div>
              <label className="app-label">
                Time B
              </label>

              <input
                type="text"
                value={form.teamB}
                onChange={(event) => updateField('teamB', event.target.value)}
                placeholder="Marrocos"
                className="app-input"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="app-label">
              Data no Brasil
            </label>

            <input
              type="date"
              value={form.date}
              onChange={(event) => updateField('date', event.target.value)}
              className="app-input"
            />
          </div>

          <div>
            <label className="app-label">
              Horário no Brasil
            </label>

            <input
              type="time"
              value={form.time}
              onChange={(event) => updateField('time', event.target.value)}
              className="app-input"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="app-label">
              Estádio, opcional
            </label>

            <input
              type="text"
              value={form.venue}
              onChange={(event) => updateField('venue', event.target.value)}
              placeholder="Estádio"
              className="app-input"
            />
          </div>

          <div>
            <label className="app-label">
              Cidade, opcional
            </label>

            <input
              type="text"
              value={form.city}
              onChange={(event) => updateField('city', event.target.value)}
              placeholder="Cidade"
              className="app-input"
            />
          </div>
        </div>

        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />

          <p className="text-[11px] text-emerald-900 leading-relaxed">
            Esta área aparece só para admin. Participantes comuns veem apenas
            os jogos publicados, os campos de palpite e a conferência pública.
          </p>
        </div>

        <button
          type="submit"
          disabled={isSaving || (mode === 'edit' && matches.length === 0)}
          className="app-button-primary w-full flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Save className="w-4 h-4" />
          <span>
            {isSaving
              ? 'Salvando...'
              : mode === 'create'
                ? 'Cadastrar jogo'
                : 'Salvar alterações do jogo'}
          </span>
        </button>
      </form>
    </section>
  );
}
