/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';

import { Match, Player } from '../types';
import { BulkPredictionActions } from '../features/matches/BulkPredictionActions';
import { MatchCard } from '../features/matches/MatchCard';
import { MatchFilterTabs } from '../features/matches/MatchFilterTabs';
import { MatchesInfoBanner } from '../features/matches/MatchesInfoBanner';
import {
  buildAllPredictionsClipboardText,
  buildAllPredictionsWhatsAppText,
  buildSinglePredictionWhatsAppText,
} from '../features/matches/shareText';
import { getPredictionLockMessage, isPredictionLocked } from '../domain/rules';
import { MatchFilter, PredictionSide } from '../features/matches/types';

type EditedPredictions = Record<
  string,
  {
    scoreA: string;
    scoreB: string;
  }
>;

interface MatchesListProps {
  matches: Match[];
  players: Player[];
  userPlayer: Player;
  canEdit: boolean;
  onUpdatePrediction: (
    matchId: string,
    scoreA: number,
    scoreB: number
  ) => void | Promise<void>;
}

export function MatchesList({
  matches,
  players,
  userPlayer,
  canEdit,
  onUpdatePrediction,
}: MatchesListProps) {
  const [revealOthers, setRevealOthers] = useState(false);
  const [activeFilter, setActiveFilter] = useState<MatchFilter>('all');
  const [editedPreds, setEditedPreds] = useState<EditedPredictions>({});
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'info' | 'error';
  } | null>(null);

  const triggerToast = (
    message: string,
    type: 'success' | 'info' | 'error' = 'success'
  ) => {
    setToast({ message, type });
    window.setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  const handleInputChange = (
    matchId: string,
    side: PredictionSide,
    value: string
  ) => {
    const cleanValue = value.replace(/[^0-9]/g, '');

    setEditedPreds((currentPredictions) => ({
      ...currentPredictions,
      [matchId]: {
        scoreA:
          side === 'A'
            ? cleanValue
            : currentPredictions[matchId]?.scoreA ??
              userPlayer.predictions[matchId]?.scoreA?.toString() ??
              '',
        scoreB:
          side === 'B'
            ? cleanValue
            : currentPredictions[matchId]?.scoreB ??
              userPlayer.predictions[matchId]?.scoreB?.toString() ??
              '',
      },
    }));
  };

  const handleSavePrediction = async (matchId: string) => {
    if (!canEdit) {
      triggerToast('Entre com sua conta Google para salvar seus palpites.', 'info');
      return;
    }

    const targetMatch = matches.find((match) => match.id === matchId);

    if (!targetMatch) {
      triggerToast('Partida não encontrada.', 'info');
      return;
    }

    if (isPredictionLocked(targetMatch)) {
      triggerToast(getPredictionLockMessage(targetMatch), 'info');
      return;
    }

    const inputState = editedPreds[matchId];

    if (!inputState) {
      triggerToast('Altere o placar antes de salvar.', 'info');
      return;
    }

    const scoreA = inputState.scoreA === '' ? 0 : Number(inputState.scoreA);
    const scoreB = inputState.scoreB === '' ? 0 : Number(inputState.scoreB);

    try {
      await onUpdatePrediction(matchId, scoreA, scoreB);
    } catch (error) {
      console.warn('Erro ao confirmar palpite:', error);
      triggerToast('Não foi possível salvar no banco. Tente novamente.', 'error');
      return;
    }

    setEditedPreds((currentPredictions) => {
      const nextPredictions = { ...currentPredictions };
      delete nextPredictions[matchId];
      return nextPredictions;
    });

    triggerToast('Palpite salvo com sucesso.', 'success');
  };

  const handleShareMatchWhatsApp = (match: Match) => {
    const text = buildSinglePredictionWhatsAppText({
      match,
      userPlayer,
      editedPreds,
    });

    window.open(
      `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`,
      '_blank'
    );
  };

  const handleShareAllWhatsApp = () => {
    const text = buildAllPredictionsWhatsAppText({
      matches,
      userPlayer,
      editedPreds,
      pageUrl: window.location.href,
    });

    window.open(
      `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`,
      '_blank'
    );

    triggerToast('Abrindo compartilhamento no WhatsApp...', 'info');
  };

  const handleCopyClipboard = async () => {
    const text = buildAllPredictionsClipboardText({
      matches,
      userPlayer,
      editedPreds,
    });

    try {
      await navigator.clipboard.writeText(text);
      triggerToast('Palpites copiados para a área de transferência.', 'success');
    } catch (error) {
      console.warn('Erro ao copiar palpites:', error);
      triggerToast('Não foi possível copiar agora. Tente novamente.', 'info');
    }
  };

  const filteredMatches = matches.filter((match) => {
    if (activeFilter === 'scheduled') return match.status === 'scheduled';
    if (activeFilter === 'finished') return match.status === 'finished';

    return true;
  });

  return (
    <div className="space-y-6 relative" id="matches-section">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-slate-700 animate-slide-up max-w-[calc(100vw-2rem)]">
          <div
            className={`w-2.5 h-2.5 rounded-full ${
              toast.type === 'success'
                ? 'bg-emerald-400'
                : toast.type === 'error'
                  ? 'bg-red-400'
                  : 'bg-blue-400'
            }`}
          />

          <span className="text-xs font-bold">{toast.message}</span>
        </div>
      )}

      <MatchesInfoBanner
        revealOthers={revealOthers}
        onToggleRevealOthers={() =>
          setRevealOthers((currentValue) => !currentValue)
        }
      />

      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <MatchFilterTabs
          matches={matches}
          activeFilter={activeFilter}
          onChangeFilter={setActiveFilter}
        />

        <BulkPredictionActions
          onCopyAll={handleCopyClipboard}
          onShareAllWhatsApp={handleShareAllWhatsApp}
        />
      </div>

      {matches.length === 0 ? (
        <div className="app-card app-card-padding text-sm text-slate-600">
          Nenhuma partida cadastrada ainda. O administrador pode recriar a
          tabela inicial pelo Painel ADM.
        </div>
      ) : filteredMatches.length === 0 ? (
        <div className="app-card app-card-padding text-sm text-slate-600">
          Nenhuma partida encontrada para este filtro.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredMatches.map((match) => (
            <MatchCard
              key={match.id}
              match={match}
              players={players}
              userPlayer={userPlayer}
              editedPrediction={editedPreds[match.id]}
              revealOthers={revealOthers}
              canEdit={canEdit}
              onInputChange={handleInputChange}
              onSavePrediction={handleSavePrediction}
              onShareMatchWhatsApp={handleShareMatchWhatsApp}
            />
          ))}
        </div>
      )}
    </div>
  );
}
