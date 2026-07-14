import { useMemo } from 'react';

import type { User as FirebaseUser } from 'firebase/auth';

import { DEFAULT_AVATAR } from '../config/avatars';
import {
  calculatePrizes,
  getPaidParticipants,
} from '../domain/finance';
import {
  getNormalizedEmail,
  mergePlayersByEmail,
} from '../domain/playerMerge';
import { computeLeaderboard } from '../domain/scoring';
import type { Match, Player } from '../types';

interface UseBolaoDerivedDataOptions {
  // Lista bruta de jogadores recebida do Firestore.
  //
  // Ela ainda pode conter documentos duplicados.
  players: Player[];

  // Lista de partidas usada para calcular
  // pontos e estatísticas do ranking.
  matches: Match[];

  // Usuário autenticado, usado para localizar
  // seu Player dentro do ranking calculado.
  currentUser: FirebaseUser | null;
}

// Calcula os dados derivados utilizados pelo Bolão.
//
// O hook concentra:
// - consolidação de jogadores pelo e-mail;
// - cálculo e ordenação do ranking;
// - identificação dos participantes pagantes;
// - cálculo dos valores da premiação;
// - localização do jogador autenticado no ranking.
export function useBolaoDerivedData({
  players,
  matches,
  currentUser,
}: UseBolaoDerivedDataOptions) {
  // Consolida jogadores com o mesmo e-mail.
  //
  // A lista bruta continua preservada no usePlayers
  // para que o painel admin consiga enxergar os duplicados reais.
  const uniquePlayers = useMemo(
    () =>
      mergePlayersByEmail(players, {
        fallbackAvatar: DEFAULT_AVATAR,
      }),
    [players]
  );

  // Calcula pontos, estatísticas e posição dos jogadores
  // sempre que partidas ou jogadores consolidados mudarem.
  const leaderboardPlayers = useMemo(
    () => computeLeaderboard(uniquePlayers, matches),
    [matches, uniquePlayers]
  );

  // Mantém apenas os jogadores que participam
  // do cálculo financeiro da premiação.
  const paidPlayers = useMemo(
    () => getPaidParticipants(uniquePlayers),
    [uniquePlayers]
  );

  const paidParticipantsCount = paidPlayers.length;

  // Calcula o valor total arrecadado e a divisão
  // entre primeiro e segundo lugar.
  const {
    totalPrizePool,
    firstPrize,
    secondPrize,
  } = useMemo(
    () => calculatePrizes(paidParticipantsCount),
    [paidParticipantsCount]
  );

  // Mantém somente os dados de identificação necessários
  // para localizar o usuário atual no ranking.
  const currentUserId = currentUser?.uid || '';
  const currentUserEmail = getNormalizedEmail(
    currentUser?.email
  );

  // Procura o Player do usuário autenticado no ranking.
  //
  // Primeiro tenta encontrar pelo uid do Firebase Auth.
  // Somente quando não encontra, utiliza o e-mail como fallback.
  const currentRankingPlayer = useMemo<Player | null>(() => {
    if (!currentUserId) {
      return null;
    }

    const playerByUid = leaderboardPlayers.find(
      (player) => player.id === currentUserId
    );

    if (playerByUid) {
      return playerByUid;
    }

    if (!currentUserEmail) {
      return null;
    }

    return (
      leaderboardPlayers.find(
        (player) =>
          getNormalizedEmail(player.email) ===
          currentUserEmail
      ) || null
    );
  }, [
    currentUserEmail,
    currentUserId,
    leaderboardPlayers,
  ]);

  return {
    uniquePlayers,
    leaderboardPlayers,
    paidPlayers,
    paidParticipantsCount,
    totalPrizePool,
    firstPrize,
    secondPrize,
    currentRankingPlayer,
  };
}