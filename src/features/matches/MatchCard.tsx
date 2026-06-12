import { Calendar, CheckCircle, Share2 } from 'lucide-react';

import { calculatePredictionPoints } from '../../domain/scoring';
import { getPredictionLockMessage, isPredictionLocked } from '../../domain/rules';
import { Match, Player } from '../../types';
import { PredictionSide } from './types';

interface EditedPrediction {
  scoreA: string;
  scoreB: string;
}

interface MatchCardProps {
  match: Match;
  players: Player[];
  userPlayer: Player;
  editedPrediction?: EditedPrediction;
  revealOthers: boolean;
  canEdit: boolean;
  onInputChange: (matchId: string, side: PredictionSide, value: string) => void;
  onSavePrediction: (matchId: string) => void;
  onShareMatchWhatsApp: (match: Match) => void;
}

export function MatchCard({
  match,
  players,
  userPlayer,
  editedPrediction,
  revealOthers,
  canEdit,
  onInputChange,
  onSavePrediction,
  onShareMatchWhatsApp,
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

  const isSaveVisible =
    canEdit &&
    !isLocked &&
    ((editedPrediction?.scoreA !== undefined &&
      editedPrediction.scoreA !== (userPrediction?.scoreA?.toString() ?? '')) ||
      (editedPrediction?.scoreB !== undefined &&
        editedPrediction.scoreB !== (userPrediction?.scoreB?.toString() ?? '')));

  const otherPlayers = players
    .filter((player) => player.id !== userPlayer.id)
    .slice(0, 4);

  const showOtherPredictions = match.status === 'finished' || revealOthers;

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
          {match.group}
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
          <span className="text-4xl filter drop-shadow select-none">
            {match.flagA}
          </span>

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

          <div className="flex items-center justify-center gap-2">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="0"
              disabled={isLocked || !canEdit}
              value={currentA}
              onChange={(event) =>
                onInputChange(match.id, 'A', event.target.value)
              }
              className={`w-14 h-14 text-center font-black text-2xl border-2 rounded-lg focus:outline-none transition ${
                isLocked || !canEdit
                  ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-slate-50 border-slate-200 text-slate-800 focus:bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'
              }`}
            />

            <span className="text-slate-400 font-black">X</span>

            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="0"
              disabled={isLocked || !canEdit}
              value={currentB}
              onChange={(event) =>
                onInputChange(match.id, 'B', event.target.value)
              }
              className={`w-14 h-14 text-center font-black text-2xl border-2 rounded-lg focus:outline-none transition ${
                isLocked || !canEdit
                  ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-slate-50 border-slate-200 text-slate-800 focus:bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'
              }`}
            />
          </div>

          <p
            className={`mt-2 text-[10px] font-semibold text-center ${
              isLocked ? 'text-amber-700' : 'text-slate-400'
            }`}
          >
            {canEdit ? lockMessage : 'Entre com o Google para salvar seu palpite.'}
          </p>

          {isSaveVisible && (
            <button
              type="button"
              onClick={() => onSavePrediction(match.id)}
              className="mt-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] px-2.5 py-1 rounded-lg flex items-center gap-1 transition"
            >
              <CheckCircle className="w-3 h-3" />
              <span>Salvar palpite</span>
            </button>
          )}
        </div>

        <div className="col-span-2 flex flex-col items-center justify-center text-center">
          <span className="text-4xl filter drop-shadow select-none">
            {match.flagB}
          </span>

          <span className="font-bold text-slate-700 text-sm mt-2 leading-tight truncate max-w-[90px]">
            {match.teamB}
          </span>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
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
            className="text-[11px] font-bold text-slate-500 hover:text-emerald-700 flex items-center gap-1 transition"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Postar jogo</span>
          </button>
        )}

        <div className="text-right text-[10px] min-w-0">
          <span className="text-slate-400 block font-normal text-right">
            Outros participantes:
          </span>

          <div className="flex gap-1.5 mt-1 justify-end max-w-[150px] overflow-x-auto select-none">
            {otherPlayers.map((otherPlayer, index) => {
              const otherPrediction = otherPlayer.predictions[match.id];

              return (
                <div
                  key={otherPlayer.id || index}
                  className={`flex flex-col items-center p-1 rounded min-w-[32px] border ${
                    showOtherPredictions
                      ? 'bg-slate-50 border-slate-100'
                      : 'bg-slate-100 border-slate-200/50'
                  }`}
                  title={otherPlayer.name}
                >
                  <span className="text-xs">{otherPlayer.avatar}</span>

                  <span className="font-mono text-[9px] font-bold text-slate-500 mt-0.5">
                    {showOtherPredictions && otherPrediction
                      ? `${otherPrediction.scoreA}x${otherPrediction.scoreB}`
                      : showOtherPredictions && !otherPrediction
                        ? '--'
                        : '🔒'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </article>
  );
}
