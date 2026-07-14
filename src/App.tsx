/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useState } from 'react';

import { AdminPanel } from './components/AdminPanel';
import { Leaderboard } from './components/Leaderboard';
import { MatchesList } from './components/MatchesList';
import { AppHeader } from './components/layout/AppHeader';
import { AppNavigation } from './components/layout/AppNavigation';
import { OfflineBanner } from './components/layout/OfflineBanner';
import { DEFAULT_AVATAR } from './config/avatars';
import { HomePage } from './features/home/HomePage';
import { useAuthPlayer } from './hooks/useAuthPlayer';
import { useBolaoDerivedData } from './hooks/useBolaoDerivedData';
import { useChampionPick } from './hooks/useChampionPick';
import { useMatches } from './hooks/useMatches';
import { usePlayers } from './hooks/usePlayers';
import { usePredictions } from './hooks/usePredictions';
import type { AppTab, Player } from './types';

// Player temporário usado para visitantes não autenticados.
//
// Ele permite exibir a lista de partidas em modo leitura,
// mesmo quando não existe um usuário ou Player real.
const ANONYMOUS_VIEWER: Player = {
  id: 'anonymous-viewer',
  name: 'Visitante',
  avatar: DEFAULT_AVATAR,
  predictions: {},
  points: 0,
  exactHits: 0,
  partialHits: 0,
  errorHits: 0,
  manualPointsAdjustment: 0,
  manualPointsAdjustmentUpdatedAt: '',
  lastPredictionMatchId: '',
  isAdmin: false,
  email: '',
};

export default function App() {
  // Estados de composição que pertencem ao App.
  //
  // Os dados de partidas, jogadores, autenticação, palpites
  // e Bolsa Campeão são controlados pelos hooks especializados.
  const [activeTab, setActiveTab] = useState<AppTab>('home');
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  // Mantém uma referência estável para a função enviada aos hooks.
  // Isso evita recriar subscriptions apenas porque o App renderizou novamente.
  const handleOffline = useCallback(() => {
    setIsOfflineMode(true);
  }, []);

  // Carrega e controla a lista bruta de jogadores.
  const {
    players,
    isLoadingPlayers,
    hasPlayersSnapshotResolved,
    activateLocalFallback: activatePlayersFallback,
    upsertLocalPlayer,
    addPlayer: handleAddPlayer,
    updateManualAdjustment: handleUpdateManualAdjustment,
  } = usePlayers({
    onOffline: handleOffline,
  });

  // Carrega e controla as partidas.
  const {
    matches,
    isLoadingMatches,
    activateLocalFallback: activateMatchesFallback,
    updateMatchResult: handleUpdateMatchResult,
    saveMatchDetails: handleSaveMatchDetails,
    syncDefaultMatches: handleSyncDefaultMatches,
  } = useMatches({
    onOffline: handleOffline,
  });

  // Controla autenticação e vínculo entre a conta Google e o Player.
  const {
    currentUser,
    userPlayer,
    isCurrentUserAdmin,
    login: handleLogin,
    logout: handleLogout,
    updateProfile: handleUpdateProfile,
    updateCurrentPlayer,
  } = useAuthPlayer({
    players,
    isLoadingPlayers,
    hasPlayersSnapshotResolved,
    upsertLocalPlayer,
    onOffline: handleOffline,
  });

  // Controla validação e salvamento de palpites.
  const {
    canEditPredictions,
    updatePrediction: handleUpdatePrediction,
  } = usePredictions({
    currentUser,
    userPlayer,
    matches,
    hasPlayersSnapshotResolved,
    updateCurrentPlayer,
    upsertLocalPlayer,
    onOffline: handleOffline,
  });

  // Controla configurações e escolha da Bolsa Campeão.
  const {
    championPickSettings,
    currentChampionPick,
    isSavingChampionPick,
    pickChampionTeam: handlePickChampionTeam,
  } = useChampionPick({
    currentUser,
    userPlayer,
  });

  // Calcula ranking, participantes e premiação a partir dos dados carregados.
  const {
    uniquePlayers,
    leaderboardPlayers,
    paidParticipantsCount,
    totalPrizePool,
    firstPrize,
    secondPrize,
    currentRankingPlayer,
  } = useBolaoDerivedData({
    players,
    matches,
    currentUser,
  });

  const isLoading = isLoadingMatches || isLoadingPlayers;
  const matchesUserPlayer = userPlayer ?? ANONYMOUS_VIEWER;

  // Evita que o app fique preso eternamente na tela de carregamento.
  //
  // Se o Firestore demorar demais, os hooks liberam a interface
  // mantendo bloqueadas as ações que dependem de dados confirmados.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!isLoading) {
        return;
      }

      console.warn(
        'Conexão ao Firestore demorou. Carregando modo local para evitar tela travada.'
      );

      activateMatchesFallback();
      activatePlayersFallback();
    }, 3500);

    return () => window.clearTimeout(timer);
  }, [activateMatchesFallback, activatePlayersFallback, isLoading]);

  // Enquanto partidas e jogadores ainda estão carregando
  // e nenhuma informação foi recebida, mostra a tela inicial de conexão.
  if (isLoading && matches.length === 0 && players.length === 0) {
    return (
      <div className="min-h-screen bg-[#063f2d] flex items-center justify-center text-white font-sans">
        <div className="text-center space-y-4">
          <div className="w-14 h-14 rounded-full border-4 border-emerald-400 border-t-transparent animate-spin mx-auto" />

          <div>
            <p className="text-lg font-bold tracking-tight text-white font-display">
              Bolão da Copa 2026
            </p>

            <p className="text-xs text-slate-400 mt-1">
              Conectando ao banco de dados...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Renderização principal do aplicativo.
  //
  // O App monta a estrutura geral da página e escolhe
  // qual conteúdo será exibido conforme a aba ativa.
  return (
    <div className="min-h-screen bg-[#edf7f1] text-slate-900 font-sans flex flex-col">
      {/* Cabeçalho com dados do usuário, pontuação, prêmio e autenticação. */}
      <AppHeader
        currentUser={currentUser}
        avatar={
          currentRankingPlayer?.avatar ||
          userPlayer?.avatar ||
          DEFAULT_AVATAR
        }
        displayName={
          currentRankingPlayer?.name ||
          userPlayer?.name ||
          currentUser?.displayName ||
          'Jogador'
        }
        points={currentRankingPlayer?.points ?? 0}
        totalPrizePool={totalPrizePool}
        canEditProfile={Boolean(
          currentUser && userPlayer && hasPlayersSnapshotResolved
        )}
        onLogin={handleLogin}
        onLogout={handleLogout}
        onUpdateProfile={handleUpdateProfile}
      />

      {/* Navegação entre início, partidas, ranking e painel admin. */}
      <AppNavigation
        activeTab={activeTab}
        isAdmin={isCurrentUserAdmin}
        onChangeTab={setActiveTab}
      />

      {/* Mostra um aviso quando o App não conseguiu confirmar
          a conexão com o Firestore. */}
      {isOfflineMode && (
        <OfflineBanner
          onReconnect={() => {
            setIsOfflineMode(false);
            window.location.reload();
          }}
        />
      )}

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6 pb-24 md:py-8">
        {/* Aba inicial com resumo da premiação e Bolsa Campeão. */}
        {activeTab === 'home' && (
          <HomePage
            totalPrizePool={totalPrizePool}
            firstPrize={firstPrize}
            secondPrize={secondPrize}
            participantsCount={paidParticipantsCount}
            championPickSettings={championPickSettings}
            currentChampionPick={currentChampionPick}
            isUserLoggedIn={Boolean(currentUser && userPlayer)}
            isSavingChampionPick={isSavingChampionPick}
            onPickChampionTeam={handlePickChampionTeam}
            onGoToMatches={() => setActiveTab('matches')}
            onGoToRanking={() => setActiveTab('ranking')}
          />
        )}

        {/* Aba de partidas e palpites. */}
        {activeTab === 'matches' && (
          <div className="space-y-4">
            {/* Visitantes podem consultar as partidas,
                mas precisam entrar com Google para salvar palpites. */}
            {!currentUser && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1 text-center sm:text-left">
                  <h4 className="font-bold text-sm text-amber-950 font-display">
                    Modo leitura
                  </h4>

                  <p className="text-xs text-amber-800">
                    Você pode consultar os jogos, mas precisa entrar com Google
                    para salvar palpites.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleLogin}
                  className="app-button-primary whitespace-nowrap shrink-0 text-xs"
                >
                  Entrar com Google
                </button>
              </div>
            )}

            <MatchesList
              matches={matches}
              players={uniquePlayers}
              userPlayer={matchesUserPlayer}
              canEdit={canEditPredictions}
              onUpdatePrediction={handleUpdatePrediction}
            />
          </div>
        )}

        {/* Aba de classificação geral. */}
        {activeTab === 'ranking' && (
          <Leaderboard
            matches={matches}
            players={leaderboardPlayers}
            paidPlayersCount={paidParticipantsCount}
          />
        )}

        {/* Painel administrativo.
            Só é renderizado quando a aba admin está ativa
            e o usuário atual foi reconhecido como administrador. */}
        {activeTab === 'admin' && isCurrentUserAdmin && (
          <AdminPanel
            matches={matches}
            players={players}
            preferredPlayerId={currentUser?.uid}
            onUpdateMatchResult={handleUpdateMatchResult}
            onSaveMatch={handleSaveMatchDetails}
            onAddPlayer={handleAddPlayer}
            onUpdateManualAdjustment={handleUpdateManualAdjustment}
            onSyncDefaultMatches={handleSyncDefaultMatches}
          />
        )}
      </main>

      {/* Rodapé geral da aplicação. */}
      <footer className="bg-[#063f2d] border-t border-[#0a5a40] py-5 text-center shrink-0">
        <p className="text-xs text-emerald-50/70 font-mono">
          Bolão da Copa 2026 - sincronizado via Google Cloud Firestore
        </p>
      </footer>
    </div>
  );
}