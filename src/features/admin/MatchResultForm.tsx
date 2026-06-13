import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { Save, Trophy } from 'lucide-react';

import { Match } from '../../types';
import { ScoreInputValue } from './types';
import { AdminRuleNotice } from './AdminRuleNotice';

interface MatchResultFormProps {
  matches: Match[];
  onUpdateMatchResult: (
    matchId: string,
    scoreA: number,
    scoreB: number,
    status: 'scheduled' | 'finished'
  ) => void | Promise<void>;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export function MatchResultForm({
  matches,
  onUpdateMatchResult,
  onSuccess,
  onError,
}: MatchResultFormProps) {
  const [selectedMatchId, setSelectedMatchId] = useState(matches[0]?.id || '');
  const [scoreA, setScoreA] = useState<ScoreInputValue>('');
  const [scoreB, setScoreB] = useState<ScoreInputValue>('');
  const [finishMatchState, setFinishMatchState] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (matches.length === 0) {
      setSelectedMatchId('');
      return;
    }

    const selectedMatchStillExists = matches.some(
      (match) => match.id === selectedMatchId
    );

    if (!selectedMatchId || !selectedMatchStillExists) {
      setSelectedMatchId(matches[0].id);
    }
  }, [matches, selectedMatchId]);

  const selectedMatch =
    matches.find((match) => match.id === selectedMatchId) || matches[0];

  function syncFormWithMatch(match: Match | undefined) {
    if (match?.status === 'finished') {
      setScoreA(match.scoreA ?? 0);
      setScoreB(match.scoreB ?? 0);
      setFinishMatchState(true);
      return;
    }

    setScoreA('');
    setScoreB('');
    setFinishMatchState(true);
  }

  useEffect(() => {
    syncFormWithMatch(selectedMatch);
  }, [selectedMatch?.id, selectedMatch?.scoreA, selectedMatch?.scoreB, selectedMatch?.status]);

  const handleMatchChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const id = event.target.value;
    const match = matches.find((item) => item.id === id);

    setSelectedMatchId(id);
    syncFormWithMatch(match);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!selectedMatchId) return;

    const finalScoreA = scoreA === '' ? 0 : Number(scoreA);
    const finalScoreB = scoreB === '' ? 0 : Number(scoreB);

    try {
      setIsSaving(true);
      await onUpdateMatchResult(
        selectedMatchId,
        finalScoreA,
        finalScoreB,
        finishMatchState ? 'finished' : 'scheduled'
      );

      onSuccess('Resultado salvo. O ranking foi recalculado automaticamente.');
    } catch (error) {
      console.warn('Erro ao salvar resultado:', error);
      onError('Não foi possível salvar o resultado no banco agora.');
    } finally {
      setIsSaving(false);
    }
  };

  if (matches.length === 0) {
    return (
      <section className="app-card app-card-padding">
        <h3 className="font-bold text-lg text-slate-800">
          Lançar resultado
        </h3>

        <p className="text-sm text-slate-500 mt-2">
          Nenhuma partida cadastrada ainda.
        </p>
      </section>
    );
  }

  return (
    <section className="app-card app-card-padding space-y-6">
      <div className="app-card-header">
        <Trophy className="w-5 h-5 text-amber-500" />

        <h3 className="app-section-title">
          Lançar resultado de partida
        </h3>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="app-label">
            Selecione a partida
          </label>

          <select
            value={selectedMatchId}
            onChange={handleMatchChange}
            className="app-select"
            disabled={isSaving}
          >
            {matches.map((match) => (
              <option key={match.id} value={match.id}>
                [{match.group}] {match.flagA} {match.teamA} x {match.teamB}{' '}
                {match.flagB} - {match.date} (
                {match.status === 'finished' ? 'Finalizado' : 'Aguardando'})
                {match.city ? ` - ${match.city}` : ''}
              </option>
            ))}
          </select>
        </div>

        {selectedMatch && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col items-center justify-center space-y-4">
            <span className="text-[10px] bg-slate-200/60 text-slate-600 px-2 py-0.5 rounded font-bold font-mono">
              {selectedMatch.group}
            </span>

            <div className="flex items-center justify-center gap-6 w-full">
              <div className="flex-1 flex flex-col items-center text-center">
                <span className="text-3xl drop-shadow mb-1">
                  {selectedMatch.flagA}
                </span>

                <span className="font-semibold text-slate-800 text-xs truncate max-w-[120px]">
                  {selectedMatch.teamA}
                </span>

                <input
                  type="number"
                  min="0"
                  placeholder="--"
                  value={scoreA}
                  onChange={(event) =>
                    setScoreA(
                      event.target.value === '' ? '' : Number(event.target.value)
                    )
                  }
                  className="w-16 text-center text-lg font-bold bg-white border border-slate-200 rounded-lg py-2 mt-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  required
                  disabled={isSaving}
                />
              </div>

              <div className="text-xl font-black text-slate-400">
                X
              </div>

              <div className="flex-1 flex flex-col items-center text-center">
                <span className="text-3xl drop-shadow mb-1">
                  {selectedMatch.flagB}
                </span>

                <span className="font-semibold text-slate-800 text-xs truncate max-w-[120px]">
                  {selectedMatch.teamB}
                </span>

                <input
                  type="number"
                  min="0"
                  placeholder="--"
                  value={scoreB}
                  onChange={(event) =>
                    setScoreB(
                      event.target.value === '' ? '' : Number(event.target.value)
                    )
                  }
                  className="w-16 text-center text-lg font-bold bg-white border border-slate-200 rounded-lg py-2 mt-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  required
                  disabled={isSaving}
                />
              </div>
            </div>

            <div className="flex items-center gap-4 pt-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-600">
                <input
                  type="checkbox"
                  checked={finishMatchState}
                  onChange={(event) => setFinishMatchState(event.target.checked)}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  disabled={isSaving}
                />

                <span>Finalizar partida e calcular pontos</span>
              </label>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={isSaving}
          className="app-button-primary w-full flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Save className="w-4 h-4" />
          <span>{isSaving ? 'Salvando resultado...' : 'Salvar resultado oficial'}</span>
        </button>
      </form>

      <AdminRuleNotice />
    </section>
  );
}
