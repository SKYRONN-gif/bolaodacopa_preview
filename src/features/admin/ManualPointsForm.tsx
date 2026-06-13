import { FormEvent, useEffect, useMemo, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';

import { Player } from '../../types';
import { getManualAdjustmentText } from '../leaderboard/manualAdjustment';

interface ManualPointsFormProps {
  players: Player[];
  onUpdateManualAdjustment: (
    playerId: string,
    manualPointsAdjustment: number
  ) => void | Promise<void>;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export function ManualPointsForm({
  players,
  onUpdateManualAdjustment,
  onSuccess,
  onError,
}: ManualPointsFormProps) {
  const [selectedPlayerId, setSelectedPlayerId] = useState(players[0]?.id || '');
  const [manualPointsAdjustment, setManualPointsAdjustment] = useState('0');
  const [isSaving, setIsSaving] = useState(false);

  const selectedPlayer = useMemo(
    () => players.find((player) => player.id === selectedPlayerId),
    [players, selectedPlayerId]
  );

  useEffect(() => {
    if (players.length === 0) {
      setSelectedPlayerId('');
      setManualPointsAdjustment('0');
      return;
    }

    const nextPlayer =
      selectedPlayer || players.find((player) => player.id === selectedPlayerId) || players[0];

    setSelectedPlayerId(nextPlayer.id);
    setManualPointsAdjustment(String(nextPlayer.manualPointsAdjustment || 0));
  }, [players, selectedPlayer, selectedPlayerId]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!selectedPlayer) {
      onError('Selecione um participante para ajustar.');
      return;
    }

    const nextAdjustment = Number(manualPointsAdjustment || 0);

    if (!Number.isFinite(nextAdjustment) || !Number.isInteger(nextAdjustment)) {
      onError('Use um numero inteiro para o ajuste de pontos.');
      return;
    }

    try {
      setIsSaving(true);
      await onUpdateManualAdjustment(selectedPlayer.id, nextAdjustment);
      onSuccess(`Ajuste de ${selectedPlayer.name} salvo no banco.`);
    } catch (error) {
      console.warn('Erro ao salvar ajuste manual:', error);
      onError('Nao foi possivel salvar o ajuste de pontos agora.');
    } finally {
      setIsSaving(false);
    }
  };

  if (players.length === 0) {
    return (
      <section className="app-card app-card-padding">
        <h3 className="font-bold text-lg text-slate-800">
          Ajuste manual de pontos
        </h3>

        <p className="text-sm text-slate-500 mt-2">
          Nenhum participante cadastrado ainda.
        </p>
      </section>
    );
  }

  return (
    <section className="app-card app-card-padding space-y-5">
      <div className="app-card-header">
        <SlidersHorizontal className="w-5 h-5 text-blue-600" />

        <h3 className="app-section-title">
          Ajuste manual de pontos
        </h3>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="app-label">
            Participante
          </label>

          <select
            value={selectedPlayerId}
            onChange={(event) => setSelectedPlayerId(event.target.value)}
            className="app-select"
            disabled={isSaving}
          >
            {players.map((player) => (
              <option key={player.id} value={player.id}>
                {player.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="app-label">
            Pontos manuais
          </label>

          <input
            type="number"
            step="1"
            value={manualPointsAdjustment}
            onChange={(event) => setManualPointsAdjustment(event.target.value)}
            className="app-input"
            disabled={isSaving}
          />
        </div>

        {selectedPlayer && (
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs font-semibold text-blue-800">
            <p>
              Pontos calculados por palpites continuam automáticos. Este campo
              soma ou subtrai pontos extras no ranking.
            </p>

            {getManualAdjustmentText(selectedPlayer) && (
              <p className="mt-2 text-blue-700">
                Atual: {getManualAdjustmentText(selectedPlayer)}
              </p>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={isSaving}
          className="app-button-primary w-full flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span>{isSaving ? 'Salvando ajuste...' : 'Salvar ajuste de pontos'}</span>
        </button>
      </form>
    </section>
  );
}
