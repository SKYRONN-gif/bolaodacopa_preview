/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User as FirebaseUser,
} from 'firebase/auth';

import { AdminPanel } from './components/AdminPanel';
import { Leaderboard } from './components/Leaderboard';
import { MatchesList } from './components/MatchesList';
import { AppHeader } from './components/layout/AppHeader';
import { AppNavigation } from './components/layout/AppNavigation';
import { OfflineBanner } from './components/layout/OfflineBanner';
import { isAdminEmail } from './config/admins';
import { DEFAULT_AVATAR } from './config/avatars';
import { INITIAL_MATCHES } from './data';
import { calculatePrizes, getPaidParticipants } from './domain/finance';
import { sortMatchesBySchedule } from './domain/matches';
import { computeLeaderboard } from './domain/scoring';
import { isPredictionLocked } from './domain/rules';
import { HomePage } from './features/home/HomePage';
import { auth, googleProvider } from './firebase';
import {
  saveMatch,
  syncDefaultMatches,
  subscribeToMatches,
} from './services/matchesService';
import {
  savePlayer,
  savePlayerManualAdjustment,
  savePlayerPrediction,
  savePlayerProfile,
  subscribeToPlayers,
} from './services/playersService';
import { AppTab, Match, Player, Prediction } from './types';

const CAN_USE_LOCAL_FALLBACK =
  import.meta.env.DEV || import.meta.env.VITE_ENABLE_LOCAL_FALLBACK === 'true';

function createPlayerFromFirebaseUser(user: FirebaseUser): Player {
  return {
    id: user.uid,
    name: user.displayName || 'Novo jogador',
    avatar: DEFAULT_AVATAR,
    predictions: {},
    points: 0,
    exactHits: 0,
    partialHits: 0,
    errorHits: 0,
    manualPointsAdjustment: 0,
    manualPointsAdjustmentUpdatedAt: '',
    lastPredictionMatchId: '',
    email: '',
    isAdmin: isAdminEmail(user.email),
  };
}

function upsertPlayer(players: Player[], nextPlayer: Player): Player[] {
  const alreadyExists = players.some((player) => player.id === nextPlayer.id);

  if (!alreadyExists) {
    return [...players, nextPlayer];
  }

  return players.map((player) =>
    player.id === nextPlayer.id ? nextPlayer : player
  );
}

function preserveFinishedResults(
  defaultMatches: Match[],
  currentMatches: Match[]
): Match[] {
  return sortMatchesBySchedule(defaultMatches.map((match) => {
    const currentMatch = currentMatches.find((item) => item.id === match.id);

    if (
      currentMatch?.status === 'finished' &&
      typeof currentMatch.scoreA === 'number' &&
      typeof currentMatch.scoreB === 'number'
    ) {
      return {
        ...match,
        status: 'finished',
        scoreA: currentMatch.scoreA,
        scoreB: currentMatch.scoreB,
      };
    }

    return match;
  }));
}

function upsertMatch(matches: Match[], nextMatch: Match) {
  const alreadyExists = matches.some((match) => match.id === nextMatch.id);

  if (!alreadyExists) {
    return sortMatchesBySchedule([...matches, nextMatch]);
  }

  return sortMatchesBySchedule(
    matches.map((match) => (match.id === nextMatch.id ? nextMatch : match))
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('home');
  const [matches, setMatches] = useState<Match[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userPlayer, setUserPlayer] = useState<Player | null>(null);
  const [isLoadingMatches, setIsLoadingMatches] = useState(true);
  const [isLoadingPlayers, setIsLoadingPlayers] = useState(true);
  const [hasPlayersSnapshotResolved, setHasPlayersSnapshotResolved] =
    useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  const isLoading = isLoadingMatches || isLoadingPlayers;

  const anonymousViewer = useMemo<Player>(
    () => ({
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
    }),
    []
  );

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    const unsubscribeMatches = subscribeToMatches({
      onData: (loadedMatches) => {
        setMatches(loadedMatches);
        setIsLoadingMatches(false);
      },
      onEmpty: () => {
        console.warn(
          'Coleção de jogos vazia. Use o Painel ADM para recriar os jogos iniciais.'
        );
        setMatches([]);
        setIsLoadingMatches(false);
      },
      onError: (error) => {
        console.warn(
          'Erro ao conectar ao Firestore para jogos. Ativando modo local:',
          error
        );
        setIsOfflineMode(true);
        setMatches(CAN_USE_LOCAL_FALLBACK ? INITIAL_MATCHES : []);
        setIsLoadingMatches(false);
      },
    });

    return () => unsubscribeMatches();
  }, []);

  useEffect(() => {
    const unsubscribePlayers = subscribeToPlayers({
      onData: (loadedPlayers, metadata) => {
        setPlayers(loadedPlayers);
        if (!metadata.fromCache) {
          setHasPlayersSnapshotResolved(true);
        }
        setIsLoadingPlayers(false);
      },
      onEmpty: (metadata) => {
        setPlayers([]);
        if (!metadata.fromCache) {
          setHasPlayersSnapshotResolved(true);
        }
        setIsLoadingPlayers(false);
      },
      onError: (error) => {
        console.warn(
          'Erro ao conectar ao Firestore para participantes. Ativando modo local:',
          error
        );
        setIsOfflineMode(true);
        setPlayers([]);
        setHasPlayersSnapshotResolved(false);
        setIsLoadingPlayers(false);
      },
    });

    return () => unsubscribePlayers();
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!isLoading) return;

      console.warn(
        'Conexão ao Firestore demorou. Carregando modo local para evitar tela travada.'
      );
      setIsOfflineMode(true);
      setIsLoadingMatches(false);
      setIsLoadingPlayers(false);
      setMatches((currentMatches) => {
        if (currentMatches.length > 0) return currentMatches;

        return CAN_USE_LOCAL_FALLBACK ? INITIAL_MATCHES : [];
      });
    }, 3500);

    return () => window.clearTimeout(timer);
  }, [isLoading]);

  useEffect(() => {
    if (!currentUser) {
      setUserPlayer(null);
      return;
    }

    if (isLoadingPlayers) return;
    if (!hasPlayersSnapshotResolved) return;

    const existingPlayer = players.find(
      (player) =>
        player.id === currentUser.uid ||
        Boolean(currentUser.email && player.email === currentUser.email)
    );

    if (existingPlayer) {
      const normalizedPlayer: Player = {
        ...existingPlayer,
        email: existingPlayer.email || '',
        isAdmin: existingPlayer.isAdmin || isAdminEmail(currentUser.email),
      };

      setUserPlayer(normalizedPlayer);
      return;
    }

    const newPlayer = createPlayerFromFirebaseUser(currentUser);

    setUserPlayer(newPlayer);
    setPlayers((currentPlayers) => upsertPlayer(currentPlayers, newPlayer));

    savePlayer(newPlayer).catch((error) => {
      console.warn('Erro ao registrar novo perfil no Firestore:', error);
      setIsOfflineMode(true);
    });
  }, [currentUser, hasPlayersSnapshotResolved, isLoadingPlayers, players]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Erro ao realizar login:', error);
      alert(
        'Não foi possível autenticar com sua Conta Google. Tente abrir o app fora de iframes ou pop-ups bloqueados.'
      );
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Erro ao sair:', error);
    }
  };

  const handleUpdateProfile = async (name: string, avatar: string) => {
    if (!currentUser || !userPlayer) {
      throw new Error('profile-user-not-ready');
    }

    if (!hasPlayersSnapshotResolved) {
      throw new Error('profile-snapshot-not-ready');
    }

    const trimmedName = name.trim();

    if (!trimmedName || trimmedName.length > 128 || avatar.length > 10) {
      throw new Error('profile-invalid-data');
    }

    const updatedPlayer: Player = {
      ...userPlayer,
      name: trimmedName,
      avatar,
      email: userPlayer.email || '',
      isAdmin: userPlayer.isAdmin || isAdminEmail(currentUser.email),
    };

    try {
      await savePlayerProfile(updatedPlayer.id, trimmedName, avatar).catch(
        async (error) => {
          const code =
            typeof error === 'object' && error !== null && 'code' in error
              ? String(error.code)
              : '';

          if (code === 'not-found') {
            await savePlayer(updatedPlayer);
            return;
          }

          throw error;
        }
      );

      setUserPlayer(updatedPlayer);
      setPlayers((currentPlayers) =>
        upsertPlayer(currentPlayers, updatedPlayer)
      );
    } catch (error) {
      console.warn('Erro ao salvar perfil no Firestore:', error);
      setIsOfflineMode(true);
      throw error;
    }
  };

  const handleUpdatePrediction = async (
    matchId: string,
    scoreA: number,
    scoreB: number
  ) => {
    if (!currentUser || !userPlayer) {
      alert('Faça login com sua conta Google para salvar seus palpites.');
      return;
    }

    if (!hasPlayersSnapshotResolved) {
      alert(
        'Ainda estamos confirmando seus dados no banco. Aguarde alguns segundos ou toque em Reconectar banco antes de salvar.'
      );
      return;
    }

    const targetMatch = matches.find((match) => match.id === matchId);

    if (!targetMatch) {
      alert('Partida não encontrada.');
      return;
    }

    if (isPredictionLocked(targetMatch)) {
      alert(
        'Esse palpite já está travado porque a partida começou ou foi finalizada.'
      );
      return;
    }

    const existingPrediction = userPlayer.predictions[matchId];
    const savedAt = new Date().toISOString();
    const prediction: Prediction = {
      scoreA,
      scoreB,
      createdAt: existingPrediction?.createdAt || savedAt,
      updatedAt: savedAt,
    };
    const updatedPlayer: Player = {
      ...userPlayer,
      predictions: {
        ...userPlayer.predictions,
        [matchId]: prediction,
      },
      lastPredictionMatchId: matchId,
      email: userPlayer.email || '',
      isAdmin: isAdminEmail(currentUser.email),
    };

    try {
      await savePlayerPrediction(updatedPlayer.id, matchId, prediction).catch(
        async (error) => {
          const code =
            typeof error === 'object' && error !== null && 'code' in error
              ? String(error.code)
              : '';

          if (code === 'not-found') {
            await savePlayer(updatedPlayer);
            return;
          }

          throw error;
        }
      );

      setUserPlayer(updatedPlayer);
      setPlayers((currentPlayers) =>
        upsertPlayer(currentPlayers, updatedPlayer)
      );
    } catch (error) {
      console.warn('Erro ao salvar palpite no Firestore:', error);
      setIsOfflineMode(true);
      alert(
        'Não consegui confirmar esse palpite no banco. Ele não foi marcado como salvo; confira sua conexão e tente novamente.'
      );
      throw error;
    }
  };

  const handleUpdateMatchResult = async (
    matchId: string,
    scoreA: number,
    scoreB: number,
    status: 'scheduled' | 'finished'
  ) => {
    const targetMatch = matches.find((match) => match.id === matchId);
    if (!targetMatch) return;

    const updatedMatch: Match = {
      ...targetMatch,
      scoreA,
      scoreB,
      status,
    };

    try {
      await saveMatch(updatedMatch);
      setMatches((currentMatches) =>
        currentMatches.map((match) =>
          match.id === matchId ? updatedMatch : match
        )
      );
    } catch (error) {
      console.warn('Erro ao atualizar partida no Firestore:', error);
      setIsOfflineMode(true);
      throw error;
    }
  };

  const handleSaveMatchDetails = async (match: Match) => {
    try {
      await saveMatch(match);
      setMatches((currentMatches) => upsertMatch(currentMatches, match));
    } catch (error) {
      console.warn('Erro ao salvar partida no Firestore:', error);
      setIsOfflineMode(true);
      throw error;
    }
  };

  const handleAddPlayer = async (
    name: string,
    avatar: string,
    predictions: Record<string, Prediction>
  ) => {
    const newPlayer: Player = {
      id: `manual-${Date.now()}`,
      name,
      avatar,
      predictions,
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

    try {
      await savePlayer(newPlayer);
      setPlayers((currentPlayers) => upsertPlayer(currentPlayers, newPlayer));
    } catch (error) {
      console.warn('Erro ao adicionar participante no Firestore:', error);
      setIsOfflineMode(true);
      throw error;
    }
  };

  const handleUpdateManualAdjustment = async (
    playerId: string,
    manualPointsAdjustment: number
  ) => {
    const targetPlayer = players.find((player) => player.id === playerId);

    if (!targetPlayer) {
      throw new Error('player-not-found');
    }

    try {
      await savePlayerManualAdjustment(playerId, manualPointsAdjustment);

      setPlayers((currentPlayers) =>
        currentPlayers.map((player) =>
          player.id === playerId
            ? {
                ...player,
                manualPointsAdjustment,
                manualPointsAdjustmentUpdatedAt: new Date().toISOString(),
              }
            : player
        )
      );
    } catch (error) {
      console.warn('Erro ao salvar ajuste manual no Firestore:', error);
      setIsOfflineMode(true);
      throw error;
    }
  };

  const handleSyncDefaultMatches = async () => {
    try {
      setIsLoadingMatches(true);

      await syncDefaultMatches(INITIAL_MATCHES);

      setMatches((currentMatches) =>
        sortMatchesBySchedule([
          ...currentMatches.filter(
            (currentMatch) =>
              !INITIAL_MATCHES.some(
                (defaultMatch) => defaultMatch.id === currentMatch.id
              )
          ),
          ...preserveFinishedResults(INITIAL_MATCHES, currentMatches),
        ])
      );
      setIsLoadingMatches(false);
    } catch (error) {
      console.error('Erro ao sincronizar jogos padrão:', error);
      setIsLoadingMatches(false);
      setIsOfflineMode(true);
      throw error;
    }
  };

  const leaderboardPlayers = useMemo(
    () => computeLeaderboard(players, matches),
    [matches, players]
  );
  const paidPlayers = useMemo(() => getPaidParticipants(players), [players]);
  const paidParticipantsCount = paidPlayers.length;
  const { totalPrizePool, firstPrize, secondPrize } = useMemo(
    () => calculatePrizes(paidParticipantsCount),
    [paidParticipantsCount]
  );

  const currentRankingPlayer = useMemo(
    () =>
      currentUser
        ? leaderboardPlayers.find(
            (player) =>
              player.id === currentUser.uid ||
              Boolean(currentUser.email && player.email === currentUser.email)
          )
        : null,
    [currentUser, leaderboardPlayers]
  );

  const matchesUserPlayer = userPlayer || anonymousViewer;
  const canEditPredictions = Boolean(
    currentUser && userPlayer && hasPlayersSnapshotResolved
  );
  const isCurrentUserAdmin = isAdminEmail(currentUser?.email);

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

  return (
    <div className="min-h-screen bg-[#edf7f1] text-slate-900 font-sans flex flex-col">
      <AppHeader
        currentUser={currentUser}
        avatar={currentRankingPlayer?.avatar || userPlayer?.avatar || DEFAULT_AVATAR}
        displayName={
          currentRankingPlayer?.name ||
          userPlayer?.name ||
          currentUser?.displayName ||
          'Jogador'
        }
        points={currentRankingPlayer?.points || 0}
        totalPrizePool={totalPrizePool}
        canEditProfile={Boolean(
          currentUser && userPlayer && hasPlayersSnapshotResolved
        )}
        onLogin={handleLogin}
        onLogout={handleLogout}
        onUpdateProfile={handleUpdateProfile}
      />

      <AppNavigation
        activeTab={activeTab}
        isAdmin={isCurrentUserAdmin}
        onChangeTab={setActiveTab}
      />

      {isOfflineMode && (
        <OfflineBanner
          onReconnect={() => {
            setIsOfflineMode(false);
            window.location.reload();
          }}
        />
      )}

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6 pb-24 md:py-8">
        {activeTab === 'home' && (
          <HomePage
            totalPrizePool={totalPrizePool}
            firstPrize={firstPrize}
            secondPrize={secondPrize}
            participantsCount={paidParticipantsCount}
            onGoToMatches={() => setActiveTab('matches')}
            onGoToRanking={() => setActiveTab('ranking')}
          />
        )}

        {activeTab === 'matches' && (
          <div className="space-y-4">
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
              userPlayer={matchesUserPlayer}
              canEdit={canEditPredictions}
              onUpdatePrediction={handleUpdatePrediction}
            />
          </div>
        )}

        {activeTab === 'ranking' && (
          <Leaderboard
            matches={matches}
            players={leaderboardPlayers}
            paidPlayersCount={paidParticipantsCount}
          />
        )}

        {activeTab === 'admin' && isCurrentUserAdmin && (
          <AdminPanel
            matches={matches}
            players={players}
            onUpdateMatchResult={handleUpdateMatchResult}
            onSaveMatch={handleSaveMatchDetails}
            onAddPlayer={handleAddPlayer}
            onUpdateManualAdjustment={handleUpdateManualAdjustment}
            onSyncDefaultMatches={handleSyncDefaultMatches}
          />
        )}
      </main>

      <footer className="bg-[#063f2d] border-t border-[#0a5a40] py-5 text-center shrink-0">
        <p className="text-xs text-emerald-50/70 font-mono">
          Bolão da Copa 2026 - sincronizado via Google Cloud Firestore
        </p>
      </footer>
    </div>
  );
}
