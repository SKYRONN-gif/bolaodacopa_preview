import { FormEvent, useState } from 'react';
import { Plus, Sparkles } from 'lucide-react';

import { AVAILABLE_AVATARS, DEFAULT_AVATAR } from '../../config/avatars';
import { Match, Prediction } from '../../types';
import { NewPlayerPredictions, ScoreInputValue } from './types';

interface AddPlayerFormProps {
  matches: Match[];
  onAddPlayer: (
    name: string,
    avatar: string,
    predictions: Record<string, Prediction>
  ) => void | Promise<void>;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export function AddPlayerForm({
  matches,
  onAddPlayer,
  onSuccess,
  onError,
}: AddPlayerFormProps) {
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerAvatar, setNewPlayerAvatar] = useState(DEFAULT_AVATAR);
  const [newPlayerPreds, setNewPlayerPreds] = useState<NewPlayerPredictions>({});
  const [isSaving, setIsSaving] = useState(false);

  const setPredValue = (matchId: string, side: 'A' | 'B', value: string) => {
    const cleanValue = value.replace(/[^0-9]/g, '').slice(0, 2);
    const numberValue: ScoreInputValue =
      cleanValue === '' ? '' : Number(cleanValue);

    setNewPlayerPreds((currentPredictions) => ({
      ...currentPredictions,
      [matchId]: {
        scoreA:
          side === 'A'
            ? numberValue
            : currentPredictions[matchId]?.scoreA ?? '',
        scoreB:
          side === 'B'
            ? numberValue
            : currentPredictions[matchId]?.scoreB ?? '',
      },
    }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!newPlayerName.trim()) {
      onError('Digite um nome para o participante.');
      return;
    }

    const preparedPredictions: Record<string, Prediction> = {};
    const savedAt = new Date().toISOString();

    matches.forEach((match) => {
      const prediction = newPlayerPreds[match.id];
      const scoreAValue = prediction?.scoreA;
      const scoreBValue = prediction?.scoreB;
      const hasScoreA = scoreAValue !== undefined && scoreAValue !== '';
      const hasScoreB = scoreBValue !== undefined && scoreBValue !== '';

      if (hasScoreA || hasScoreB) {
        preparedPredictions[match.id] = {
          scoreA: hasScoreA ? Number(scoreAValue) : 0,
          scoreB: hasScoreB ? Number(scoreBValue) : 0,
          createdAt: savedAt,
          updatedAt: savedAt,
        };
      }
    });

    const playerName = newPlayerName.trim();

    try {
      setIsSaving(true);
      await onAddPlayer(playerName, newPlayerAvatar, preparedPredictions);

      setNewPlayerName('');
      setNewPlayerAvatar(DEFAULT_AVATAR);
      setNewPlayerPreds({});

      onSuccess(`Participante ${playerName} adicionado. R$10,00 somados à premiação.`);
    } catch (error) {
      console.warn('Erro ao adicionar participante:', error);
      onError('Não foi possível salvar o participante no banco agora.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="app-card app-card-padding space-y-5">
      <div className="app-card-header">
        <Plus className="w-5 h-5 text-emerald-600" />

        <h3 className="app-section-title">
          Registrar novo participante
        </h3>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <label className="app-label">
              Nome do participante
            </label>

            <input
              type="text"
              value={newPlayerName}
              onChange={(event) => setNewPlayerName(event.target.value)}
              placeholder="Ex: Carlos Silva"
              className="app-input"
              disabled={isSaving}
            />
          </div>

          <div>
            <label className="app-label">
              Avatar
            </label>

            <select
              value={newPlayerAvatar}
              onChange={(event) => setNewPlayerAvatar(event.target.value)}
              className="app-select text-center px-2 py-2.5"
              disabled={isSaving}
            >
              {AVAILABLE_AVATARS.map((avatar) => (
                <option key={avatar} value={avatar}>
                  {avatar}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-3">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">
            Palpites iniciais, opcional
          </label>

          <p className="text-[11px] text-slate-400">
            Se deixar em branco, o participante entra sem palpites cadastrados.
          </p>

          <div className="max-h-[240px] overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 p-1 space-y-1">
            {matches.map((match) => {
              const currentPrediction = newPlayerPreds[match.id];

              return (
                <div
                  key={match.id}
                  className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 p-2 hover:bg-slate-50 rounded-lg text-xs"
                >
                  <span className="font-semibold text-slate-600 flex items-center gap-1 min-w-0">
                    <span>{match.flagA}</span>
                    <span className="truncate">{match.teamA}</span>
                  </span>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="0"
                      value={currentPrediction?.scoreA ?? ''}
                      onChange={(event) =>
                        setPredValue(match.id, 'A', event.target.value)
                      }
                      className="w-10 text-center border border-slate-200 bg-white rounded py-1 font-bold focus:ring-1 focus:ring-emerald-500"
                      disabled={isSaving}
                    />

                    <span className="text-slate-400 font-bold font-mono">
                      x
                    </span>

                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="0"
                      value={currentPrediction?.scoreB ?? ''}
                      onChange={(event) =>
                        setPredValue(match.id, 'B', event.target.value)
                      }
                      className="w-10 text-center border border-slate-200 bg-white rounded py-1 font-bold focus:ring-1 focus:ring-emerald-500"
                      disabled={isSaving}
                    />
                  </div>

                  <span className="font-semibold text-slate-600 flex items-center gap-1 justify-end min-w-0">
                    <span className="truncate">{match.teamB}</span>
                    <span>{match.flagB}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <button
          type="submit"
          disabled={isSaving}
          className="w-full border border-emerald-600 text-emerald-700 hover:bg-emerald-50 font-bold text-sm py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Sparkles className="w-4 h-4" />

          <span>
            {isSaving
              ? 'Salvando participante...'
              : `Adicionar ${newPlayerName || 'novo participante'} - R$ 10`}
          </span>
        </button>
      </form>
    </section>
  );
}
