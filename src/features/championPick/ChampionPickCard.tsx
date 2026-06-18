import { LockKeyhole, Trophy, TrendingUp } from 'lucide-react';
import { useState } from 'react';

import type { ChampionPick, ChampionPickTeam } from '../../types';

interface ChampionPickCardProps {
  bonusPoints?: number;
  isOpen?: boolean;
  eligibleTeams?: ChampionPickTeam[];
  currentPick?: ChampionPick | null;
  isUserLoggedIn?: boolean;
  isSavingPick?: boolean;
  onPickTeam?: (team: ChampionPickTeam) => void | Promise<void>;
}

export function ChampionPickCard({
  bonusPoints = 30,
  isOpen = false,
  eligibleTeams = [],
  currentPick = null,
  isUserLoggedIn = false,
  isSavingPick = false,
  onPickTeam,
}: ChampionPickCardProps) {
  const [selectedTeamCode, setSelectedTeamCode] = useState('');

  const selectedTeam = eligibleTeams.find(
    (team) => team.code === selectedTeamCode
  );

  const canPick =
    isOpen &&
    isUserLoggedIn &&
    !currentPick &&
    eligibleTeams.length > 0 &&
    Boolean(onPickTeam);

  const handleConfirmPick = async () => {
    if (!selectedTeam || !onPickTeam) return;

    const confirmed = window.confirm(
      `Confirmar ${selectedTeam.name} como sua seleção campeã? Essa escolha não poderá ser alterada.`
    );

    if (!confirmed) return;

    await onPickTeam(selectedTeam);
  };

  return (
    <aside className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-white/80 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-amber-800">
            <Trophy className="h-3.5 w-3.5" />
            Bolsa Campeão
          </div>

          <h3 className="mt-3 text-lg font-black leading-tight text-slate-950">
            {bonusPoints} pts em jogo
          </h3>

          <p className="mt-1 text-xs font-semibold leading-relaxed text-slate-600">
            Escolha a seleção campeã no mata-mata. Quanto menos gente escolher
            o campeão, maior pode ser o bônus.
          </p>
        </div>

        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
          {isOpen ? (
            <TrendingUp className="h-5 w-5" />
          ) : (
            <LockKeyhole className="h-5 w-5" />
          )}
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-amber-100 bg-white/80 p-3">
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="font-bold text-slate-600">Status</span>

          <span
            className={
              isOpen
                ? 'rounded-md bg-emerald-100 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-700'
                : 'rounded-md bg-slate-100 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-slate-600'
            }
          >
            {isOpen ? 'Aberta' : 'Fechada'}
          </span>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 text-xs">
          <span className="font-bold text-slate-600">Seleções disponíveis</span>
          <strong className="text-slate-950">{eligibleTeams.length}</strong>
        </div>

        {currentPick ? (
          <div className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50 p-3">
            <p className="text-[10px] font-black uppercase tracking-wide text-emerald-700">
              Sua escolha
            </p>

            <div className="mt-2 flex items-center gap-3">
              {currentPick.teamLogo ? (
                <img
                  src={currentPick.teamLogo}
                  alt={currentPick.teamName}
                  className="h-8 w-8 object-contain"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-[10px] font-black text-slate-700">
                  {currentPick.teamCode}
                </div>
              )}

              <div>
                <p className="text-sm font-black text-slate-950">
                  {currentPick.teamName}
                </p>

                <p className="text-[11px] font-semibold text-slate-500">
                  Escolha travada
                </p>
              </div>
            </div>
          </div>
        ) : canPick ? (
          <div className="mt-4 space-y-3">
            <label className="space-y-1">
              <span className="text-xs font-bold text-slate-700">
                Escolha sua campeã
              </span>

              <select
                value={selectedTeamCode}
                onChange={(event) => setSelectedTeamCode(event.target.value)}
                disabled={isSavingPick}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800"
              >
                <option value="">Selecione...</option>

                {eligibleTeams.map((team) => (
                  <option key={team.code} value={team.code}>
                    {team.name}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={handleConfirmPick}
              disabled={!selectedTeam || isSavingPick}
              className="w-full rounded-lg bg-amber-600 px-3 py-2 text-sm font-black text-white transition hover:bg-amber-700 disabled:bg-slate-400"
            >
              {isSavingPick ? 'Salvando...' : 'Confirmar escolha'}
            </button>
          </div>
        ) : (
          <p className="mt-3 text-[11px] font-semibold leading-relaxed text-slate-500">
            {!isOpen
              ? 'A lista será liberada quando chegarmos na fase de mata-mata.'
              : !isUserLoggedIn
                ? 'Entre com sua conta Google para escolher sua campeã.'
                : eligibleTeams.length === 0
                  ? 'O admin ainda não cadastrou as seleções disponíveis.'
                  : 'A escolha ainda não está disponível.'}
          </p>
        )}
      </div>
    </aside>
  );
}