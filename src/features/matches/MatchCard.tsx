import { Calendar, CheckCircle2, Info, Share2, AlertTriangle, Loader2 } from 'lucide-react';

import { getPredictionLockMessage, isPredictionLocked } from '../../domain/rules';
import { calculatePredictionPoints } from '../../domain/scoring';
import { Match, Player } from '../../types';
import { PredictionInputs } from './PredictionInputs';
import { PredictionSide } from './types';
import { TeamBadge } from './TeamBadge';
import { getMatchGroupLabel } from '../../domain/matchLabels';

interface EditedPrediction {
  scoreA: string;
  scoreB: string;
}

export type PredictionSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface MatchCardProps {
  match: Match;
  userPlayer: Player;
  editedPrediction?: EditedPrediction;
  canEdit: boolean;
  saveStatus?: PredictionSaveStatus;
  onInputChange: (matchId: string, side: PredictionSide, value: string) => void;
  onSavePrediction: (matchId: string) => void;
  onShareMatchWhatsApp: (match: Match) => void;
  onOpenDetails: (match: Match) => void;
}

function formatPredictionDate(value?: string) {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function MatchCard({
  match,
  userPlayer,
  editedPrediction,
  canEdit,
  saveStatus = 'idle',
  onInputChange,
  onSavePrediction,
  onShareMatchWhatsApp,
  onOpenDetails,
}: MatchCardProps) {
  const userPrediction = userPlayer.predictions[match.id];
  const isLocked = isPredictionLocked(match);
  const lockMessage = getPredictionLockMessage(match);

  const currentA =
    editedPrediction?.scoreA ?? userPrediction?.scoreA?.toString() ?? '';

  const currentB =
    editedPrediction?.scoreB ?? userPrediction?.scoreB?.toString() ?? '';

  const predictionResult = calculatePredictionPoints(userPrediction, match);
  const pointsEarned =
    predictionResult.type === 'unplayed' ? null : predictionResult.points;
  const pointsType =
    predictionResult.type === 'unplayed' ? null : predictionResult.type;

  const hasEditedScoreA =
    editedPrediction?.scoreA !== undefined &&
    editedPrediction.scoreA !== (userPrediction?.scoreA?.toString() ?? '');

  const hasEditedScoreB =
    editedPrediction?.scoreB !== undefined &&
    editedPrediction.scoreB !== (userPrediction?.scoreB?.toString() ?? '');

  const hasUnsavedChanges = hasEditedScoreA || hasEditedScoreB;

  const isSaveVisible = canEdit && !isLocked && hasUnsavedChanges;

  const predictionSavedAt = formatPredictionDate(
    userPrediction?.updatedAt || userPrediction?.createdAt
  );

  const hasSavedPrediction =
    userPrediction &&
    typeof userPrediction.scoreA === 'number' &&
    typeof userPrediction.scoreB === 'number';

  return (
    <article
      className={`border rounded-xl p-4 md:p-5 shadow-sm bg-white flex flex-col justify-between transition relative overflow-hidden ${
        isLocked
          ? 'border-amber-200 bg-amber-50/30'
          : 'border-slate-200 hover:border-emerald-500/40'
      }`}
    >
      <div className="flex items-center justify-between gap-3 mb-4">
        <span className="text-[10px] uppercase font-bold text-slate-400 font-mono tracking-wider">
          {getMatchGroupLabel(match.group)}
        </span>

        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 text-right">
          <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>
            {match.date} às {match.time}
          </span>
        </div>
      </div>

      {(match.venue || match.city) && (
        <p className="text-[10px] text-slate-400 font-semibold -mt-2 mb-3 text-right">
          {[match.venue, match.city].filter(Boolean).join(' - ')}
        </p>
      )}

      <div className="grid grid-cols-7 items-center justify-center my-3 relative">
        <div className="col-span-2 flex flex-col items-center justify-center text-center">
          <TeamBadge flag={match.flagA} logo={match.logoA} name={match.teamA} />

          <span className="font-bold text-slate-700 text-sm mt-2 leading-tight truncate max-w-[90px]">
            {match.teamA}
          </span>
        </div>

        <div className="col-span-3 flex flex-col items-center justify-center">
          {match.status === 'finished' ? (
            <div className="flex flex-col items-center bg-slate-100 border border-slate-200/50 rounded-lg px-4 py-2 mb-2">
              <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                Resultado oficial
              </span>

              <span className="text-xl font-black text-slate-800">
                {match.scoreA} : {match.scoreB}
              </span>
            </div>
          ) : (
            <div className="text-slate-400 font-bold text-xs select-none uppercase mb-2">
              {isLocked ? 'Palpite travado' : 'Seu palpite'}
            </div>
          )}

          <PredictionInputs
            scoreA={currentA}
            scoreB={currentB}
            disabled={isLocked || !canEdit || saveStatus === 'saving'}
            canEdit={canEdit}
            isLocked={isLocked}
            lockMessage={lockMessage}
            isSaveVisible={isSaveVisible}
            onChange={(side, value) => onInputChange(match.id, side, value)}
            onSave={() => onSavePrediction(match.id)}
          />

          <div className="mt-2 min-h-[34px] text-center">
            {saveStatus === 'saving' && (
              <p className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-2.5 py-1 text-[10px] font-bold text-sky-700 border border-sky-100">
                <Loader2 className="h-3 w-3 animate-spin" />
                Salvando palpite...
              </p>
            )}

            {saveStatus === 'saved' && (
              <p className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700 border border-emerald-100">
                <CheckCircle2 className="h-3 w-3" />
                Palpite salvo
              </p>
            )}

            {saveStatus === 'error' && (
              <p className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-bold text-red-700 border border-red-100">
                <AlertTriangle className="h-3 w-3" />
                Erro ao salvar. Tente novamente.
              </p>
            )}

            {saveStatus === 'idle' && hasUnsavedChanges && !isLocked && (
              <p className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-700 border border-amber-100">
                <AlertTriangle className="h-3 w-3" />
                Alteração não salva
              </p>
            )}

            {saveStatus === 'idle' &&
              !hasUnsavedChanges &&
              hasSavedPrediction &&
              predictionSavedAt && (
                <p className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700 border border-emerald-100">
                  <CheckCircle2 className="h-3 w-3" />
                  Atualizado em {predictionSavedAt}
                </p>
              )}

            {saveStatus === 'idle' &&
              !hasUnsavedChanges &&
              !hasSavedPrediction &&
              !isLocked &&
              canEdit && (
                <p className="text-[10px] font-semibold text-slate-400">
                  Você pode salvar ou alterar até o início da partida.
                </p>
              )}
          </div>
        </div>

        <div className="col-span-2 flex flex-col items-center justify-center text-center">
          <TeamBadge flag={match.flagB} logo={match.logoB} name={match.teamB} />

          <span className="font-bold text-slate-700 text-sm mt-2 leading-tight truncate max-w-[90px]">
            {match.teamB}
          </span>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
        <div className="min-w-0">
          {pointsEarned !== null ? (
            <div className="flex items-center gap-1.5">
              {pointsType === 'exact' ? (
                <span className="bg-amber-100 text-amber-800 text-[10px] font-extrabold px-2.5 py-1 rounded-lg border border-amber-200">
                  +3 pts - Exato
                </span>
              ) : pointsType === 'partial' ? (
                <span className="bg-emerald-50 text-emerald-800 text-[10px] font-extrabold px-2.5 py-1 rounded-lg border border-emerald-100">
                  +1 pt - Parcial
                </span>
              ) : (
                <span className="bg-red-50 text-red-600 text-[10px] font-bold px-2.5 py-1 rounded-lg border border-red-100">
                  0 pts - Erro
                </span>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onShareMatchWhatsApp(match)}
              className="flex items-center gap-1 text-[11px] font-bold text-slate-500 transition hover:text-emerald-700"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Postar jogo</span>
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => onOpenDetails(match)}
          className="shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-600 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800"
        >
          <span className="inline-flex items-center gap-1">
            <Info className="h-3.5 w-3.5" />
            Detalhes
          </span>
        </button>
      </div>
    </article>
  );
}