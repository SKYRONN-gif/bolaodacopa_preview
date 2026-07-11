/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import type { User as FirebaseUser } from 'firebase/auth';

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
import {
  getNormalizedEmail,
  mergePlayersByEmail,
  mergePlayersKeepingPrimary,
  predictionMapsAreEqual,
} from './domain/playerMerge';
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
import {
  DEFAULT_CHAMPION_PICK_SETTINGS,
  saveChampionPick,
  subscribeToChampionPick,
  subscribeToChampionPickSettings,
} from './services/championPickService';
import type {
  AppTab,
  ChampionPick,
  ChampionPickSettings,
  ChampionPickTeam,
  Match,
  Player,
  Prediction,
} from './types';

// Define se o app pode usar dados locais quando não conseguir carregar
// informações do Firestore.
//
// Em desenvolvimento, o fallback local é permitido automaticamente.
// Em produção, só será permitido se a variável VITE_ENABLE_LOCAL_FALLBACK
// estiver configurada como "true".
const CAN_USE_LOCAL_FALLBACK =
  import.meta.env.DEV || import.meta.env.VITE_ENABLE_LOCAL_FALLBACK === 'true';

// Extrai e normaliza o e-mail do usuário autenticado.
//
// Remove espaços, transforma em minúsculo
// e retorna string vazia quando não houver e-mail.
function getUserEmail(user: FirebaseUser | null): string {
  return getNormalizedEmail(user?.email);
}

// Cria um Player inicial a partir dos dados da Conta Google.
//
// Essa função é usada quando o usuário logou,
// mas ainda não existe um documento de player para ele no Firestore.
function createPlayerFromFirebaseUser(user: FirebaseUser): Player {
  return {
    // Usa o uid do Firebase Auth como id do player.
    //
    // Isso cria uma ligação direta entre:
    // Conta Google ↔ documento do jogador.
    id: user.uid,

    // Usa o nome da Conta Google.
    // Se não existir, aplica um nome padrão.
    name: user.displayName || 'Novo jogador',

    // Começa com avatar padrão do sistema.
    avatar: DEFAULT_AVATAR,

    // Novo jogador começa sem palpites.
    predictions: {},

    // Campos de ranking começam zerados.
    //
    // O ranking real é recalculado depois com base nos palpites
    // e nos resultados das partidas.
    points: 0,
    exactHits: 0,
    partialHits: 0,
    errorHits: 0,

    // Ajuste manual começa zerado.
    manualPointsAdjustment: 0,
    manualPointsAdjustmentUpdatedAt: '',

    // Nenhum palpite foi alterado ainda.
    lastPredictionMatchId: '',

    // Salva o e-mail vindo da autenticação.
    email: getUserEmail(user),

    // Por padrão, usuário novo não é admin.
    isAdmin: false,
  };
}

// Compara dois e-mails depois de normalizá-los.
//
// Retorna false quando pelo menos um dos e-mails não estiver disponível.
function emailsMatch(first?: string | null, second?: string | null): boolean {
  const normalizedFirst = getNormalizedEmail(first);
  const normalizedSecond = getNormalizedEmail(second);

  return Boolean(
    normalizedFirst && normalizedSecond && normalizedFirst === normalizedSecond
  );
}

// Adiciona ou atualiza um jogador dentro de uma lista.
//
// "upsert" significa:
// - update, se o jogador já existe;
// - insert, se o jogador ainda não existe.
function upsertPlayer(players: Player[], nextPlayer: Player): Player[] {
  const alreadyExists = players.some((player) => player.id === nextPlayer.id);

  // Se ainda não existe player com esse id,
  // adiciona o novo jogador no final da lista.
  if (!alreadyExists) {
    return [...players, nextPlayer];
  }

  // Se já existe, substitui apenas o player com o mesmo id.
  return players.map((player) =>
    player.id === nextPlayer.id ? nextPlayer : player
  );
}

// Recria a lista de jogos padrão sem perder resultados já finalizados.
//
// Isso é usado quando o admin sincroniza os jogos padrão.
// Se uma partida atual já estiver finalizada com placar,
// o resultado dela é preservado.
function preserveFinishedResults(
  defaultMatches: Match[],
  currentMatches: Match[]
): Match[] {
  return sortMatchesBySchedule(
    defaultMatches.map((match) => {
      // Procura nos jogos atuais uma partida com o mesmo id.
      const currentMatch = currentMatches.find((item) => item.id === match.id);

      // Se a partida atual já foi finalizada e tem placar válido,
      // mantém status e placar do jogo atual.
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

      // Se não havia resultado finalizado para preservar,
      // usa a partida padrão normalmente.
      return match;
    })
  );
}

// Adiciona ou atualiza uma partida dentro da lista de partidas.
//
// Depois de adicionar ou substituir,
// sempre ordena os jogos pela data/horário.
function upsertMatch(matches: Match[], nextMatch: Match): Match[] {
  const alreadyExists = matches.some((match) => match.id === nextMatch.id);

  // Se a partida ainda não existe,
  // adiciona e ordena a lista.
  if (!alreadyExists) {
    return sortMatchesBySchedule([...matches, nextMatch]);
  }

  // Se a partida já existe,
  // substitui a partida antiga pela nova e ordena a lista.
  return sortMatchesBySchedule(
    matches.map((match) => (match.id === nextMatch.id ? nextMatch : match))
  );
}

// Verifica se o player atual é um perfil admin pertencente ao usuário logado.
//
// Não basta o player ter isAdmin.
// O e-mail do player precisa bater com o e-mail da Conta Google atual.
function isAdminProfileForUser(
  player: Player | null,
  user: FirebaseUser | null
): boolean {
  return Boolean(player?.isAdmin && emailsMatch(player.email, user?.email));
}

export default function App() {
  // Estados centrais do App.
  //
  // Aqui ficam:
  // - aba ativa;
  // - partidas carregadas;
  // - jogadores carregados;
  // - usuário logado;
  // - player vinculado ao usuário;
  // - estados de carregamento;
  // - modo offline;
  // - dados da Bolsa Campeão.
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

  const [championPickSettings, setChampionPickSettings] =
    useState<ChampionPickSettings>(DEFAULT_CHAMPION_PICK_SETTINGS);

  const [currentChampionPick, setCurrentChampionPick] =
    useState<ChampionPick | null>(null);

  const [isSavingChampionPick, setIsSavingChampionPick] = useState(false);

  const isLoading = isLoadingMatches || isLoadingPlayers;

  // Player temporário usado para visitantes não logados.
  //
  // Ele permite que a tela de partidas seja exibida em modo leitura,
  // mesmo quando não existe um usuário autenticado.
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

  // Observa o estado de autenticação do Firebase.
  //
  // Quando o usuário loga ou desloga,
  // o Firebase avisa e o App atualiza currentUser.
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });

    return () => unsubscribeAuth();
  }, []);

  // Carrega e mantém as partidas sincronizadas com o Firestore.
  //
  // Se os dados chegarem, atualiza matches.
  // Se a coleção estiver vazia, libera a tela sem jogos.
  // Se der erro, ativa modo offline e usa fallback local quando permitido.
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

  // Carrega as configurações da Bolsa Campeão.
  //
  // Essas configurações dizem se a escolha está aberta,
  // se está travada e quais seleções são elegíveis.
  useEffect(() => {
    const unsubscribe = subscribeToChampionPickSettings({
      onData: setChampionPickSettings,
      onError: (error) => {
        console.error('Erro ao carregar configuração da Bolsa Campeão:', error);
      },
    });

    return unsubscribe;
  }, []);

  // Carrega a escolha da campeã feita pelo usuário logado.
  //
  // Só escuta essa informação quando já existe:
  // - usuário logado;
  // - player vinculado;
  // - e-mail disponível.
  useEffect(() => {
    setCurrentChampionPick(null);

    const playerEmail = currentUser?.email || userPlayer?.email || '';

    if (!currentUser || !userPlayer || !playerEmail) {
      return;
    }

    const unsubscribe = subscribeToChampionPick({
      playerEmail,
      onData: setCurrentChampionPick,
      onError: (error) => {
        console.error('Erro ao carregar escolha da Bolsa Campeão:', error);
        setCurrentChampionPick(null);
      },
    });

    return unsubscribe;
  }, [currentUser?.email, userPlayer?.email]);

  // Carrega e mantém os jogadores sincronizados com o Firestore.
  //
  // Também controla se o snapshot real do servidor já respondeu,
  // para evitar salvar dados antes da confirmação do banco.
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

  // Evita que o app fique preso eternamente na tela de carregamento.
  //
  // Se o Firestore demorar demais,
  // o app libera a tela em modo offline.
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

  // Vincula o usuário logado ao documento Player correspondente.
  //
  // Primeiro tenta encontrar pelo uid do Firebase.
  // Depois procura jogadores com o mesmo e-mail,
  // mescla duplicados e salva o player consolidado quando necessário.
  useEffect(() => {
    // Se não existe usuário logado, limpa o player atual.
    if (!currentUser) {
      setUserPlayer(null);
      return;
    }

    // Aguarda a lista de jogadores terminar de carregar.
    if (isLoadingPlayers) return;

    // Aguarda uma resposta real do servidor antes de criar ou mesclar o player.
    //
    // Isso evita gravar dados por cima de um snapshot incompleto ou apenas cacheado.
    if (!hasPlayersSnapshotResolved) return;

    // Extrai o e-mail normalizado do usuário autenticado.
    const userEmail = getUserEmail(currentUser);

    // Procura primeiro o documento cujo id corresponde ao uid do Firebase Auth.
    const playerByUid = players.find((player) => player.id === currentUser.uid);

    // Procura outros documentos de jogadores vinculados ao mesmo e-mail.
    const playersWithSameEmail = players.filter((player) =>
      emailsMatch(player.email, userEmail)
    );

    // Usa o player encontrado pelo uid como base.
    // Se ele não existir, cria uma estrutura inicial para o usuário autenticado.
    const basePlayer: Player =
      playerByUid || createPlayerFromFirebaseUser(currentUser);

    // Garante que o player base tenha e-mail e flag de admin definidos.
    const basePlayerWithEmail: Player = {
      ...basePlayer,
      email: basePlayer.email || userEmail,
      isAdmin: basePlayer.isAdmin || false,
    };

    // Mescla os dados dos documentos que possuem o mesmo e-mail,
    // mantendo o player vinculado ao uid como principal.
    const mergedPlayer = playersWithSameEmail.reduce<Player>(
      (currentPlayer, duplicatedPlayer) => {
        if (duplicatedPlayer.id === currentPlayer.id) {
          return currentPlayer;
        }

        return mergePlayersKeepingPrimary(currentPlayer, duplicatedPlayer, {
          fallbackAvatar: DEFAULT_AVATAR,
        });
      },
      basePlayerWithEmail
    );

    setUserPlayer(mergedPlayer);

    // Verifica se ainda não existe um documento com o uid do usuário logado.
    const shouldCreateCurrentPlayer = !playerByUid;

    // Verifica se o merge produziu uma lista de palpites diferente
    // daquela salva no documento vinculado ao uid.
    const shouldUpdatePredictions =
      !playerByUid ||
      !predictionMapsAreEqual(
        playerByUid.predictions,
        mergedPlayer.predictions
      );

    // Verifica se a flag de administrador mudou durante o merge.
    const shouldUpdateAdminFlag =
      Boolean(playerByUid?.isAdmin) !== Boolean(mergedPlayer.isAdmin);

    // Verifica se o documento vinculado ao uid estava sem e-mail.
    const shouldUpdateEmail = !playerByUid?.email && Boolean(userEmail);

    // Verifica se nome ou avatar foram recuperados de outro documento duplicado.
    const shouldUpdateProfile =
      !playerByUid ||
      playerByUid.name !== mergedPlayer.name ||
      playerByUid.avatar !== mergedPlayer.avatar;

    // Verifica se o ajuste manual de pontos mudou durante o merge.
    const shouldUpdateManualAdjustment =
      !playerByUid ||
      (playerByUid.manualPointsAdjustment ?? 0) !==
        (mergedPlayer.manualPointsAdjustment ?? 0) ||
      (playerByUid.manualPointsAdjustmentUpdatedAt || '') !==
        (mergedPlayer.manualPointsAdjustmentUpdatedAt || '');

    // Verifica se o identificador do último palpite alterado mudou no merge.
    const shouldUpdateLastPredictionMatchId =
      !playerByUid ||
      (playerByUid.lastPredictionMatchId || '') !==
        (mergedPlayer.lastPredictionMatchId || '');

    if (
      shouldCreateCurrentPlayer ||
      shouldUpdatePredictions ||
      shouldUpdateAdminFlag ||
      shouldUpdateEmail ||
      shouldUpdateProfile ||
      shouldUpdateManualAdjustment ||
      shouldUpdateLastPredictionMatchId
    ) {
      // Salva o player consolidado quando ele foi criado
      // ou quando algum dado importante mudou durante o merge.
      savePlayer(mergedPlayer).catch((error) => {
        console.warn('Erro ao mesclar perfil duplicado por e-mail:', error);
        setIsOfflineMode(true);
      });
    }
  }, [currentUser, hasPlayersSnapshotResolved, isLoadingPlayers, players]);

  // Ações disparadas pela interface.

  // Inicia o login com Google usando Firebase Auth.
  //
  // Se o popup falhar, mostra uma mensagem para o usuário.
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

  // Desloga o usuário atual pelo Firebase Auth.
  //
  // Depois do logout, o onAuthStateChanged recebe null
  // e o App limpa o usuário/player atual.
  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Erro ao sair:', error);
    }
  };
  // Atualiza nome e avatar do jogador logado.
  //
  // Antes de salvar, valida se:
  // - existe usuário logado;
  // - o player do usuário já está carregado;
  // - a lista real de jogadores já foi confirmada pelo Firestore;
  // - nome e avatar respeitam os limites definidos.
  const handleUpdateProfile = async (name: string, avatar: string) => {
    if (!currentUser || !userPlayer) {
      throw new Error('profile-user-not-ready');
    }

    if (!hasPlayersSnapshotResolved) {
      throw new Error('profile-snapshot-not-ready');
    }

    // Remove espaços no começo e no fim do nome.
    const trimmedName = name.trim();

    // Impede salvar perfil com nome vazio, nome grande demais
    // ou avatar acima do limite de caracteres definido pelo app.
    if (!trimmedName || trimmedName.length > 128 || avatar.length > 10) {
      throw new Error('profile-invalid-data');
    }

    // Monta o player atualizado mantendo os dados atuais
    // e substituindo apenas nome, avatar e campos de segurança necessários.
    const updatedPlayer: Player = {
      ...userPlayer,
      name: trimmedName,
      avatar,
      email: userPlayer.email || getUserEmail(currentUser),
      isAdmin: userPlayer.isAdmin || false,
    };

    try {
      // Primeiro tenta atualizar apenas os campos de perfil no Firestore.
      //
      // Se o documento ainda não existir, o catch interno cria o player completo.
      await savePlayerProfile(updatedPlayer.id, trimmedName, avatar).catch(
        async (error) => {
          const code =
            typeof error === 'object' && error !== null && 'code' in error
              ? String(error.code)
              : '';

          // Caso o documento do player ainda não exista,
          // cria o player completo com os dados atuais.
          if (code === 'not-found') {
            await savePlayer(updatedPlayer);
            return;
          }

          // Outros erros continuam sendo tratados pelo catch externo.
          throw error;
        }
      );

      // Atualiza o estado local para refletir a mudança imediatamente na tela.
      setUserPlayer(updatedPlayer);
      setPlayers((currentPlayers) =>
        upsertPlayer(currentPlayers, updatedPlayer)
      );
    } catch (error) {
      // Se não conseguir salvar no Firestore, ativa modo offline
      // e repassa o erro para o componente que chamou a função.
      console.warn('Erro ao salvar perfil no Firestore:', error);
      setIsOfflineMode(true);
      throw error;
    }
  };

  // Salva ou atualiza o palpite do jogador para uma partida.
  //
  // Antes de salvar, valida se:
  // - o usuário está logado;
  // - o player já está carregado;
  // - os dados reais do Firestore já foram confirmados;
  // - a partida existe;
  // - a partida ainda permite palpites.
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

    // Procura a partida correspondente ao palpite.
    const targetMatch = matches.find((match) => match.id === matchId);

    if (!targetMatch) {
      alert('Partida não encontrada.');
      return;
    }

    // Bloqueia alteração quando a partida já começou ou foi finalizada.
    if (isPredictionLocked(targetMatch)) {
      alert(
        'Esse palpite já está travado porque a partida começou ou foi finalizada.'
      );
      return;
    }

    // Preserva a data original de criação quando o palpite já existia.
    const existingPrediction = userPlayer.predictions[matchId];
    const savedAt = new Date().toISOString();

    const prediction: Prediction = {
      scoreA,
      scoreB,
      createdAt: existingPrediction?.createdAt || savedAt,
      updatedAt: savedAt,
    };

    // Monta uma nova versão do player com o palpite atualizado.
    //
    // Mantém todos os palpites existentes e substitui/adiciona
    // apenas o palpite da partida atual.
    const updatedPlayer: Player = {
      ...userPlayer,
      predictions: {
        ...userPlayer.predictions,
        [matchId]: prediction,
      },
      lastPredictionMatchId: matchId,
      email: userPlayer.email || getUserEmail(currentUser),
      isAdmin: userPlayer.isAdmin || false,
    };

    try {
      // Tenta salvar apenas o palpite específico no Firestore.
      //
      // Se o documento do player ainda não existir,
      // cria o player completo como plano B.
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

      // Atualiza o estado local imediatamente após confirmar o salvamento.
      setUserPlayer(updatedPlayer);
      setPlayers((currentPlayers) =>
        upsertPlayer(currentPlayers, updatedPlayer)
      );
    } catch (error) {
      // Se o salvamento falhar, não considera o palpite como confirmado.
      console.warn('Erro ao salvar palpite no Firestore:', error);
      setIsOfflineMode(true);
      alert(
        'Não consegui confirmar esse palpite no banco. Ele não foi marcado como salvo; confira sua conexão e tente novamente.'
      );
      throw error;
    }
  };

  // Atualiza o placar e o status de uma partida.
  //
  // Usado pelo painel admin para marcar uma partida como:
  // - scheduled;
  // - finished.
  //
  // Depois de salvar no Firestore, atualiza também a lista local de partidas.
  const handleUpdateMatchResult = async (
    matchId: string,
    scoreA: number,
    scoreB: number,
    status: 'scheduled' | 'finished'
  ) => {
    const targetMatch = matches.find((match) => match.id === matchId);

    if (!targetMatch) return;

    // Cria uma nova versão da partida mantendo os dados atuais
    // e substituindo apenas placar e status.
    const updatedMatch: Match = {
      ...targetMatch,
      scoreA,
      scoreB,
      status,
    };

    try {
      await saveMatch(updatedMatch);

      // Atualiza a partida correspondente no estado local.
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

  // Salva os detalhes de uma partida.
  //
  // Pode ser usado tanto para criar uma nova partida
  // quanto para editar uma partida existente.
  const handleSaveMatchDetails = async (match: Match) => {
    try {
      await saveMatch(match);

      // Atualiza a lista local adicionando ou substituindo a partida.
      setMatches((currentMatches) => upsertMatch(currentMatches, match));
    } catch (error) {
      console.warn('Erro ao salvar partida no Firestore:', error);
      setIsOfflineMode(true);
      throw error;
    }
  };

  // Adiciona um participante manualmente pelo painel admin.
  //
  // Esse fluxo cria um player sem vínculo direto com login Google,
  // usando um id manual baseado no horário atual.
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

      // Atualiza a lista local para o novo participante aparecer na tela
      // sem depender de uma nova resposta do Firestore.
      setPlayers((currentPlayers) => upsertPlayer(currentPlayers, newPlayer));
    } catch (error) {
      console.warn('Erro ao adicionar participante no Firestore:', error);
      setIsOfflineMode(true);
      throw error;
    }
  };

  // Atualiza o ajuste manual de pontos de um jogador.
  //
  // Esse ajuste é somado ao cálculo normal do ranking,
  // sem alterar diretamente os palpites do jogador.
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

      // Atualiza localmente apenas o jogador alterado.
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

  // Sincroniza os jogos padrão do projeto.
  //
  // Esse fluxo é usado pelo admin para recriar ou atualizar a base inicial
  // de partidas sem perder resultados que já foram finalizados.
  const handleSyncDefaultMatches = async () => {
    try {
      setIsLoadingMatches(true);

      await syncDefaultMatches(INITIAL_MATCHES);

      setMatches((currentMatches) =>
        sortMatchesBySchedule([
          // Mantém partidas atuais que não fazem parte da lista padrão.
          ...currentMatches.filter(
            (currentMatch) =>
              !INITIAL_MATCHES.some(
                (defaultMatch) => defaultMatch.id === currentMatch.id
              )
          ),

          // Adiciona os jogos padrão preservando placares já finalizados.
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

  // Salva a escolha da seleção campeã do usuário.
  //
  // Antes de salvar, valida se:
  // - o usuário está logado;
  // - o player está carregado;
  // - a Bolsa Campeão está aberta;
  // - o usuário ainda não escolheu;
  // - a seleção está na lista de elegíveis.
  const handlePickChampionTeam = async (team: ChampionPickTeam) => {
    if (!currentUser || !userPlayer) {
      alert('Faça login com sua conta Google para escolher sua campeã.');
      return;
    }

    if (!championPickSettings.enabled || championPickSettings.locked) {
      alert('A Bolsa Campeão ainda não está aberta para escolhas.');
      return;
    }

    if (currentChampionPick) {
      alert('Você já escolheu sua campeã. Essa escolha não pode ser alterada.');
      return;
    }

    // Normaliza o código da seleção antes de comparar com a lista permitida.
    const normalizedTeamCode = team.code.trim().toUpperCase();

    if (!championPickSettings.eligibleTeamCodes.includes(normalizedTeamCode)) {
      alert('Essa seleção não está liberada na Bolsa Campeão.');
      return;
    }

    // Garante que o player enviado para o salvamento tenha e-mail.
    const playerWithEmail: Player = {
      ...userPlayer,
      email: userPlayer.email || getUserEmail(currentUser),
    };

    setIsSavingChampionPick(true);

    try {
      const savedPick = await saveChampionPick(playerWithEmail, team);

      // Atualiza o estado local para a tela já mostrar a escolha salva.
      setCurrentChampionPick(savedPick);
    } catch (error) {
      console.error('Erro ao salvar escolha da Bolsa Campeão:', error);

      alert(
        'Não consegui salvar sua escolha. Confira se a Bolsa está aberta e tente novamente.'
      );
    } finally {
      // Garante que o estado de salvamento seja desligado,
      // tanto em caso de sucesso quanto de erro.
      setIsSavingChampionPick(false);
    }
  };
  // Calcula dados derivados a partir das listas de jogadores e partidas.
  //
  // useMemo evita repetir cálculos enquanto as dependências não mudarem.

  // Junta jogadores com o mesmo e-mail para evitar duplicidade
  // nas telas públicas, no ranking e no cálculo de participantes.
  const uniquePlayers = useMemo(
    () => mergePlayersByEmail(players, { fallbackAvatar: DEFAULT_AVATAR }),
    [players]
  );

  // Recalcula a pontuação e a ordem do ranking
  // sempre que partidas ou jogadores consolidados mudarem.
  const leaderboardPlayers = useMemo(
    () => computeLeaderboard(uniquePlayers, matches),
    [matches, uniquePlayers]
  );

  // Mantém apenas os jogadores elegíveis ao cálculo da premiação.
  //
  // Pela regra atual, jogadores administradores não entram no pote.
  const paidPlayers = useMemo(
    () => getPaidParticipants(uniquePlayers),
    [uniquePlayers]
  );

  const paidParticipantsCount = paidPlayers.length;

  // Calcula o valor total do pote e a divisão
  // entre primeiro e segundo lugar.
  const { totalPrizePool, firstPrize, secondPrize } = useMemo(
    () => calculatePrizes(paidParticipantsCount),
    [paidParticipantsCount]
  );

  // Procura, dentro do ranking calculado, o jogador correspondente
  // ao usuário atualmente autenticado.
  //
  // Primeiro compara pelo uid do Firebase.
  // Como fallback, também compara pelo e-mail.
  const currentRankingPlayer = useMemo(() => {
    if (!currentUser) {
      return null;
    }

    const playerByUid = leaderboardPlayers.find(
      (player) => player.id === currentUser.uid
    );

    if (playerByUid) {
      return playerByUid;
    }

    return (
      leaderboardPlayers.find((player) =>
        emailsMatch(player.email, currentUser.email)
      ) || null
    );
  }, [currentUser, leaderboardPlayers]);

  // Define qual player será enviado para a tela de partidas.
  //
  // Usuário logado:
  // usa seu Player real.
  //
  // Visitante:
  // usa o anonymousViewer para permitir consulta em modo leitura.
  const matchesUserPlayer = userPlayer || anonymousViewer;

  // Permite editar palpites apenas quando:
  // - existe usuário logado;
  // - o Player correspondente foi encontrado;
  // - o Firestore já confirmou a lista real de jogadores.
  const canEditPredictions = Boolean(
    currentUser && userPlayer && hasPlayersSnapshotResolved
  );

  // Considera o usuário admin quando:
  // - seu e-mail está na configuração de administradores;
  // - ou seu perfil confirmado no Firestore possui isAdmin.
  const isCurrentUserAdmin =
    isAdminEmail(currentUser?.email) ||
    isAdminProfileForUser(userPlayer, currentUser);

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
          currentRankingPlayer?.avatar || userPlayer?.avatar || DEFAULT_AVATAR
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