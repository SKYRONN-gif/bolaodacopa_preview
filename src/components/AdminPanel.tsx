import React, { useState } from 'react';
import { Match, Player, Prediction } from '../types';
import { AddPlayerForm } from '../features/admin/AddPlayerForm';
import { AdminDangerZone } from '../features/admin/AdminDangerZone';
import { AdminToast } from '../features/admin/AdminToast';
import { ManualPointsForm } from '../features/admin/ManualPointsForm';
import { MatchEditorForm } from '../features/admin/MatchEditorForm';
import { MatchResultForm } from '../features/admin/MatchResultForm';
import { AdminToastState, ToastType } from '../features/admin/types';
import {
  importLegacyBolaoData,
  previewLegacyBolaoData,
} from '../services/legacyMigrationService';
import { AdminChampionPickConfigForm } from '../features/admin/AdminChampionPickConfigForm';

import { syncWorldCupMatchesFromApi } from '../services/matchesService';
import { consolidatePlayerDuplicates } from '../services/playersService';

interface AdminPanelProps {
  matches: Match[];
  players: Player[];
  preferredPlayerId?: string;
  onUpdateMatchResult: (
    matchId: string,
    scoreA: number,
    scoreB: number,
    status: 'scheduled' | 'finished'
  ) => void | Promise<void>;
  onSaveMatch: (
    match: Match,
    mode: 'create' | 'edit'
  ) => void | Promise<void>;
  onAddPlayer: (
    name: string,
    avatar: string,
    predictions: Record<string, Prediction>
  ) => void | Promise<void>;
  onUpdateManualAdjustment: (
    playerId: string,
    manualPointsAdjustment: number
  ) => void | Promise<void>;
  onSyncDefaultMatches: () => void | Promise<void>;
}

function getNormalizedEmail(email?: string | null) {
  return email?.trim().toLowerCase() || '';
}

function getPredictionTime(prediction?: Prediction) {
  const rawDate = prediction?.updatedAt || prediction?.createdAt || '';
  const timestamp = Date.parse(rawDate);

  return Number.isFinite(timestamp) ? timestamp : 0;
}

function shouldUseNextPrediction(
  currentPrediction?: Prediction,
  nextPrediction?: Prediction
) {
  if (!nextPrediction) return false;
  if (!currentPrediction) return true;

  return getPredictionTime(nextPrediction) > getPredictionTime(currentPrediction);
}

function mergePredictionMaps(
  primaryPredictions: Record<string, Prediction> = {},
  secondaryPredictions: Record<string, Prediction> = {}
) {
  const mergedPredictions: Record<string, Prediction> = {
    ...primaryPredictions,
  };

  for (const [matchId, secondaryPrediction] of Object.entries(
    secondaryPredictions
  )) {
    if (
      shouldUseNextPrediction(
        mergedPredictions[matchId],
        secondaryPrediction
      )
    ) {
      mergedPredictions[matchId] = secondaryPrediction;
    }
  }

  return mergedPredictions;
}

function countPredictions(player: Player) {
  return Object.keys(player.predictions || {}).length;
}

function choosePrimaryPlayer(
  duplicatedPlayers: Player[],
  preferredPlayerId?: string
) {
  const preferredPlayer = duplicatedPlayers.find(
    (player) => player.id === preferredPlayerId
  );

  if (preferredPlayer) {
    return preferredPlayer;
  }

  return [...duplicatedPlayers].sort((firstPlayer, secondPlayer) => {
    if (Boolean(firstPlayer.isAdmin) !== Boolean(secondPlayer.isAdmin)) {
      return Number(secondPlayer.isAdmin) - Number(firstPlayer.isAdmin);
    }

    return countPredictions(secondPlayer) - countPredictions(firstPlayer);
  })[0];
}

function mergePlayersIntoPrimary(
  primaryPlayer: Player,
  duplicatedPlayers: Player[]
): Player {
  return duplicatedPlayers.reduce<Player>((mergedPlayer, currentPlayer) => {
    if (currentPlayer.id === mergedPlayer.id) {
      return mergedPlayer;
    }

    return {
      ...mergedPlayer,
      name: mergedPlayer.name || currentPlayer.name,
      avatar: mergedPlayer.avatar || currentPlayer.avatar,
      email: mergedPlayer.email || currentPlayer.email || '',
      isAdmin: Boolean(mergedPlayer.isAdmin || currentPlayer.isAdmin),
      predictions: mergePredictionMaps(
        mergedPlayer.predictions,
        currentPlayer.predictions
      ),
      manualPointsAdjustment:
        typeof mergedPlayer.manualPointsAdjustment === 'number'
          ? mergedPlayer.manualPointsAdjustment
          : currentPlayer.manualPointsAdjustment ?? 0,
      manualPointsAdjustmentUpdatedAt:
        mergedPlayer.manualPointsAdjustmentUpdatedAt ||
        currentPlayer.manualPointsAdjustmentUpdatedAt ||
        '',
      lastPredictionMatchId:
        mergedPlayer.lastPredictionMatchId ||
        currentPlayer.lastPredictionMatchId ||
        '',
    };
  }, primaryPlayer);
}

function buildDuplicatePlayerPlans(
  players: Player[],
  preferredPlayerId?: string
) {
  const playersByEmail = new Map<string, Player[]>();

  for (const player of players) {
    const email = getNormalizedEmail(player.email);

    if (!email) continue;

    const currentPlayers = playersByEmail.get(email) || [];

    playersByEmail.set(email, [...currentPlayers, player]);
  }

  return Array.from(playersByEmail.entries())
    .filter(([, duplicatedPlayers]) => duplicatedPlayers.length > 1)
    .map(([email, duplicatedPlayers]) => {
      const primaryPlayer = choosePrimaryPlayer(
        duplicatedPlayers,
        preferredPlayerId
      );

      const mergedPlayer = mergePlayersIntoPrimary(
        primaryPlayer,
        duplicatedPlayers
      );

      const duplicatePlayers = duplicatedPlayers.filter(
        (player) => player.id !== primaryPlayer.id
      );

      return {
        email,
        primaryPlayer,
        mergedPlayer,
        duplicatePlayers,
        totalPredictions: countPredictions(mergedPlayer),
      };
    });
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  matches,
  players,
  onUpdateMatchResult,
  onSaveMatch,
  preferredPlayerId,
  onAddPlayer,
  onUpdateManualAdjustment,
  onSyncDefaultMatches,
}) => {
  const [toast, setToast] = useState<AdminToastState | null>(null);

  const [isPreviewingLegacyData, setIsPreviewingLegacyData] = useState(false);

  const [isImportingLegacyData, setIsImportingLegacyData] = useState(false);

  const [isConsolidatingPlayers, setIsConsolidatingPlayers] = useState(false);

  const [apiSyncMode, setApiSyncMode] = useState<
  'upcoming' | 'today' | 'finished' | 'all'
>('upcoming');

const [apiSyncLimit, setApiSyncLimit] = useState(10);
const [isSyncingApiMatches, setIsSyncingApiMatches] = useState(false);

  const triggerToast = (
    message: string,
    type: ToastType = 'success'
  ) => {
    setToast({ message, type });

    setTimeout(() => {
      setToast(null);
    }, 4500);
  };

const handlePreviewLegacyData = async () => {
  setIsPreviewingLegacyData(true);

  try {
    const result = await previewLegacyBolaoData();

    triggerToast(
      `Banco antigo encontrado: ${result.playersCount} players, ${result.matchesCount} jogos e ${result.predictionsCount} palpites.`,
      'success'
    );

    console.log('Prévia do banco antigo:', result);
  } catch (error) {
    triggerToast(
      error instanceof Error
        ? error.message
        : 'Erro ao verificar banco antigo.',
      'error'
    );
  } finally {
    setIsPreviewingLegacyData(false);
  }
};

const handleImportLegacyData = async () => {
  const confirmed = window.confirm(
    'Tem certeza que deseja importar o banco antigo para este banco novo? Essa ação vai copiar players e matches preservando os IDs antigos.'
  );

  if (!confirmed) return;

  setIsImportingLegacyData(true);

  try {
    const result = await importLegacyBolaoData();

    triggerToast(
      `Importação concluída: ${result.importedPlayers} players, ${result.importedMatches} jogos e ${result.predictionsCount} palpites.`,
      'success'
    );

    console.log('Importação do banco antigo:', result);
  } catch (error) {
    triggerToast(
      error instanceof Error
        ? error.message
        : 'Erro ao importar banco antigo.',
      'error'
    );
  } finally {
    setIsImportingLegacyData(false);
  }
};

const handleConsolidateDuplicatePlayers = async () => {
  const duplicatePlans = buildDuplicatePlayerPlans(players, preferredPlayerId);

  if (duplicatePlans.length === 0) {
    triggerToast('Nenhum jogador duplicado por e-mail encontrado.', 'info');
    return;
  }

  const duplicatedEmails = duplicatePlans
    .map(
      (plan) =>
        `${plan.email}: manter ${plan.primaryPlayer.name} (${plan.primaryPlayer.id}) e apagar ${plan.duplicatePlayers.length} duplicado(s)`
    )
    .join('\n');

  const confirmed = window.confirm(
    `Encontramos ${duplicatePlans.length} e-mail(s) duplicado(s).\n\n${duplicatedEmails}\n\nDeseja consolidar agora?`
  );

  if (!confirmed) return;

  setIsConsolidatingPlayers(true);

  try {
    for (const plan of duplicatePlans) {
      await consolidatePlayerDuplicates({
        mergedPlayer: plan.mergedPlayer,
        duplicatePlayerIds: plan.duplicatePlayers.map((player) => player.id),
      });
    }

    const removedPlayersCount = duplicatePlans.reduce(
      (total, plan) => total + plan.duplicatePlayers.length,
      0
    );

    triggerToast(
      `Consolidação concluída: ${removedPlayersCount} jogador(es) duplicado(s) removido(s).`,
      'success'
    );
  } catch (error) {
    triggerToast(
      error instanceof Error
        ? error.message
        : 'Erro ao consolidar jogadores duplicados.',
      'error'
    );
  } finally {
    setIsConsolidatingPlayers(false);
  }
};

  const handleSyncWorldCupMatchesFromApi = async () => {
  setIsSyncingApiMatches(true);

  try {
    const result = await syncWorldCupMatchesFromApi({
      today: apiSyncMode === 'today',
      upcoming: apiSyncMode === 'upcoming',
      finished: apiSyncMode === 'finished',
      limit: apiSyncLimit > 0 ? apiSyncLimit : undefined,
    });

    triggerToast(
      `Sincronização concluída: ${result.imported} jogos importados pela fonte ${result.source}.`,
      'success'
    );
  } catch (error) {
    triggerToast(
      error instanceof Error
        ? error.message
        : 'Erro ao sincronizar jogos da Copa pela API.',
      'error'
    );
  } finally {
    setIsSyncingApiMatches(false);
  }
};

  return (
    <div className="space-y-6 relative" id="admin-panel">
      <AdminToast toast={toast} />

      <MatchEditorForm
        matches={matches}
        onSaveMatch={onSaveMatch}
        onSuccess={(message) => triggerToast(message, 'success')}
        onError={(message) => triggerToast(message, 'error')}
      />

      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
  <div>
    <h3 className="text-lg font-bold text-slate-900">
      Sincronizar jogos pela API
    </h3>
    <p className="text-sm text-slate-600 mt-1">
      Busca os jogos da Copa pela ESPN e usa OpenFootball como fallback.
      Os jogos são salvos em matches sem mexer nos palpites dos participantes.
    </p>
  </div>

  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
    <label className="space-y-1">
      <span className="text-sm font-semibold text-slate-700">
        O que puxar?
      </span>

      <select
        value={apiSyncMode}
        onChange={(event) =>
          setApiSyncMode(
            event.target.value as 'upcoming' | 'today' | 'finished' | 'all'
          )
        }
        className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm"
        disabled={isSyncingApiMatches}
      >
        <option value="upcoming">Próximos jogos</option>
        <option value="today">Jogos de hoje</option>
        <option value="finished">Jogos finalizados</option>
        <option value="all">Todos os jogos</option>
      </select>
    </label>

    <label className="space-y-1">
      <span className="text-sm font-semibold text-slate-700">
        Quantidade
      </span>

      <select
        value={apiSyncLimit}
        onChange={(event) => setApiSyncLimit(Number(event.target.value))}
        className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm"
        disabled={isSyncingApiMatches}
      >
        <option value={5}>5 jogos</option>
        <option value={10}>10 jogos</option>
        <option value={20}>20 jogos</option>
        <option value={0}>Todos</option>
      </select>
    </label>

    <div className="flex items-end">
      <button
        type="button"
        onClick={handleSyncWorldCupMatchesFromApi}
        disabled={isSyncingApiMatches}
        className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white font-bold rounded-xl px-4 py-2 transition"
      >
        {isSyncingApiMatches
          ? 'Sincronizando...'
          : 'Sincronizar jogos'}
      </button>
    </div>
  </div>

  <p className="text-xs text-slate-500">
    Dica: para o uso normal do bolão, use “Próximos jogos” com 10 ou 20.
    Use “Todos os jogos” apenas quando quiser carregar a tabela completa da Copa.
  </p>
</div>

      <AdminChampionPickConfigForm
        onSuccess={(message) => triggerToast(message, 'success')}
        onError={(message) => triggerToast(message, 'error')}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MatchResultForm
          matches={matches}
          onUpdateMatchResult={onUpdateMatchResult}
          onSuccess={(message) => triggerToast(message, 'success')}
          onError={(message) => triggerToast(message, 'error')}
        />

        <ManualPointsForm
          players={players}
          onUpdateManualAdjustment={onUpdateManualAdjustment}
          onSuccess={(message) => triggerToast(message, 'success')}
          onError={(message) => triggerToast(message, 'error')}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AddPlayerForm
          matches={matches}
          onAddPlayer={onAddPlayer}
          onSuccess={(message) => triggerToast(message, 'success')}
          onError={(message) => triggerToast(message, 'error')}
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
  <div>
    <h3 className="text-lg font-bold text-slate-900">
      Migração do banco antigo
    </h3>

    <p className="text-sm text-slate-600 mt-1">
      Primeiro vamos apenas verificar os dados do Firebase antigo. Essa ação não
      grava nada no banco novo e não altera o banco antigo.
    </p>
  </div>

<div className="flex flex-col sm:flex-row gap-3">
  <button
    type="button"
    onClick={handlePreviewLegacyData}
    disabled={isPreviewingLegacyData || isImportingLegacyData}
    className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-bold rounded-xl px-4 py-2 transition"
  >
    {isPreviewingLegacyData
      ? 'Verificando...'
      : 'Verificar banco antigo'}
  </button>

  <button
    type="button"
    onClick={handleImportLegacyData}
    disabled={isPreviewingLegacyData || isImportingLegacyData}
    className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white font-bold rounded-xl px-4 py-2 transition"
  >
    {isImportingLegacyData
      ? 'Importando...'
      : 'Importar banco antigo'}
  </button>
</div>

<div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
  <div>
    <h4 className="text-sm font-bold text-amber-950">
      Consolidar jogadores duplicados
    </h4>

    <p className="mt-1 text-xs leading-relaxed text-amber-800">
      Use depois de importar o banco antigo. O sistema agrupa jogadores com o
      mesmo e-mail, junta os palpites no jogador principal e remove os
      duplicados.
    </p>
  </div>

  <button
    type="button"
    onClick={handleConsolidateDuplicatePlayers}
    disabled={
      isPreviewingLegacyData ||
      isImportingLegacyData ||
      isConsolidatingPlayers
    }
    className="bg-amber-600 hover:bg-amber-700 disabled:bg-slate-400 text-white font-bold rounded-xl px-4 py-2 transition"
  >
    {isConsolidatingPlayers
      ? 'Consolidando...'
      : 'Consolidar duplicados por e-mail'}
  </button>
</div>

      <AdminDangerZone
        onSyncDefaultMatches={onSyncDefaultMatches}
        onSuccess={(message) => triggerToast(message, 'info')}
        onError={(message) => triggerToast(message, 'error')}
      />
    </div>
  </div>
);
};
