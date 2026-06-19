/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Match, Player } from '../types';
import { BulkPredictionActions } from '../features/matches/BulkPredictionActions';
import {
  MatchCard,
  type PredictionSaveStatus,
} from '../features/matches/MatchCard';
import { MatchDetailsModal } from '../features/matches/MatchDetailsModal';
import { MatchFilterTabs } from '../features/matches/MatchFilterTabs';
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

const MATCHES_PAGE_SIZE = 24;

export function MatchesList({
  matches,
  players,
  userPlayer,
  canEdit,
  onUpdatePrediction,
}: MatchesListProps) {
  const [activeFilter, setActiveFilter] = useState<MatchFilter>('open');
  const [currentPage, setCurrentPage] = useState(1);
  const [editedPreds, setEditedPreds] = useState<EditedPredictions>({});
  const [selectedMatchDetails, setSelectedMatchDetails] = useState<Match | null>(
    null
  );

  const [predictionSaveStatuses, setPredictionSaveStatuses] = useState<
  Record<string, PredictionSaveStatus>
>({});

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

  const setPredictionSaveStatus = (
  matchId: string,
  status: PredictionSaveStatus
) => {
  setPredictionSaveStatuses((currentStatuses) => ({
    ...currentStatuses,
    [matchId]: status,
  }));
};

  const handleInputChange = (
    matchId: string,
    side: PredictionSide,
    value: string
  ) => {
    const cleanValue = value.replace(/[^0-9]/g, '').slice(0, 2);

    setPredictionSaveStatus(matchId, 'idle');

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

  setPredictionSaveStatus(matchId, 'saving');

  try {
    await onUpdatePrediction(matchId, scoreA, scoreB);

    setEditedPreds((currentPredictions) => {
      const nextPredictions = { ...currentPredictions };
      delete nextPredictions[matchId];
      return nextPredictions;
    });

    setPredictionSaveStatus(matchId, 'saved');

    window.setTimeout(() => {
      setPredictionSaveStatus(matchId, 'idle');
    }, 2500);

    triggerToast('Palpite salvo com sucesso.', 'success');
  } catch (error) {
    console.warn('Erro ao confirmar palpite:', error);

    setPredictionSaveStatus(matchId, 'error');

    window.setTimeout(() => {
      setPredictionSaveStatus(matchId, 'idle');
    }, 4000);

    triggerToast('Não foi possível salvar no banco. Tente novamente.', 'error');
  }
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

  const filteredMatches = useMemo(
  () =>
    matches.filter((match) => {
      const hasPrediction = Boolean(userPlayer.predictions[match.id]);
      const isLocked = isPredictionLocked(match);
      const isFinished = match.status === 'finished';
      const isOpen = match.status === 'scheduled' && !isLocked;

      if (activeFilter === 'open') return isOpen;
      if (activeFilter === 'predicted') return hasPrediction;
      if (activeFilter === 'missing') return !hasPrediction;
      if (activeFilter === 'locked') return isLocked && !isFinished;
      if (activeFilter === 'finished') return isFinished;

      return true;
    }),
  [activeFilter, matches, userPlayer.predictions]
);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredMatches.length / MATCHES_PAGE_SIZE)
  );

  const safeCurrentPage = Math.min(currentPage, totalPages);
  const firstVisibleMatchIndex = (safeCurrentPage - 1) * MATCHES_PAGE_SIZE;

  const visibleMatches = filteredMatches.slice(
    firstVisibleMatchIndex,
    firstVisibleMatchIndex + MATCHES_PAGE_SIZE
  );

  const visibleStart =
    filteredMatches.length === 0 ? 0 : firstVisibleMatchIndex + 1;

  const visibleEnd = Math.min(
    firstVisibleMatchIndex + visibleMatches.length,
    filteredMatches.length
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [activeFilter, matches.length]);

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

      {selectedMatchDetails && (
        <MatchDetailsModal
          match={selectedMatchDetails}
          players={players}
          onClose={() => setSelectedMatchDetails(null)}
        />
      )}

      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <MatchFilterTabs
  matches={matches}
  userPlayer={userPlayer}
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
  Nenhuma partida encontrada para este filtro. Use “Todos” para ver a lista
  completa.
</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {visibleMatches.map((match) => (
              <MatchCard
  key={match.id}
  match={match}
  userPlayer={userPlayer}
  editedPrediction={editedPreds[match.id]}
  canEdit={canEdit}
  saveStatus={predictionSaveStatuses[match.id] || 'idle'}
  onInputChange={handleInputChange}
  onSavePrediction={handleSavePrediction}
  onShareMatchWhatsApp={handleShareMatchWhatsApp}
  onOpenDetails={setSelectedMatchDetails}
/>
            ))}
          </div>

          <div className="app-soft-panel px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-[11px] font-semibold text-slate-500">
              Mostrando {visibleStart}-{visibleEnd} de {filteredMatches.length}{' '}
              partidas
            </span>

            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={safeCurrentPage === 1}
                  className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="Pagina anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <span className="text-[11px] font-mono font-bold text-slate-500 min-w-[86px] text-center">
                  {safeCurrentPage} / {totalPages}
                </span>

                <button
                  type="button"
                  onClick={() =>
                    setCurrentPage((page) => Math.min(totalPages, page + 1))
                  }
                  disabled={safeCurrentPage === totalPages}
                  className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="Proxima pagina"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}