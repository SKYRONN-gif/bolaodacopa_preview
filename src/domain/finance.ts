import { isAdminEmail } from '../config/admins';
import type { Player } from '../types';

// Regras financeiras atuais do bolão.
export const ENTRY_FEE = 10;
export const FIRST_PLACE_PERCENTAGE = 0.8;
export const SECOND_PLACE_PERCENTAGE = 0.2;

// Considera admin quando o perfil possui isAdmin verdadeiro
// ou quando o e-mail está na lista confiável de admins.
//
// Pick informa ao TypeScript que esta função só precisa de isAdmin e email,
// não do objeto Player inteiro.
export function isAdminPlayer(player: Pick<Player, 'isAdmin' | 'email'>) {
  return Boolean(player.isAdmin) || isAdminEmail(player.email);
}

// Define se o jogador entra no cálculo do prêmio.
//
// Pela regra atual, todo jogador que não é admin é considerado participante
// elegível ao prêmio
export function isPaidParticipant(
  player: Pick<Player, 'isAdmin' | 'email'>
) {
  return !isAdminPlayer(player);
}

// Cria uma nova lista contendo apenas jogadores que não são admins
// e, pela regra atual, entram no cálculo do prêmio.
export function getPaidParticipants(players: Player[]) {
  return players.filter(isPaidParticipant);
}

// Calcula o prêmio total multiplicando a quantidade de participantes
// elegíveis pelo valor fixo da entrada.
//
// paidPlayersCount vem de quem chamou esta função, normalmente por meio de:
// getPaidParticipants(players).length
export function calculatePrizePool(paidPlayersCount: number) {
  return paidPlayersCount * ENTRY_FEE;
}

// Calcula como o pote total será dividido entre primeiro e segundo lugar.
export function calculatePrizes(paidPlayersCount: number) {
  const totalPrizePool = calculatePrizePool(paidPlayersCount);

  return {
    totalPrizePool,
    firstPrize: totalPrizePool * FIRST_PLACE_PERCENTAGE,
    secondPrize: totalPrizePool * SECOND_PLACE_PERCENTAGE,
  };
}

// Retorna a colocação do jogador apenas entre participantes elegíveis ao prêmio.
//
// players precisa chegar já ordenado pelo ranking geral. A função não calcula
// pontos; ela apenas ignora admins ao descobrir a posição premiável.
export function getPaidRank(players: Player[], index: number) {
  // Obtém o jogador na posição atual do ranking geral.
  const player = players[index];

  // Admin não possui posição premiável. Índice inexistente também não.
  if (!player || !isPaidParticipant(player)) {
    return null;
  }

  // Pega todos os jogadores até a posição atual, incluindo ela.
  // Depois remove admins e conta os participantes restantes.
  //
  // O resultado é uma colocação iniciando em 1.
  return players.slice(0, index + 1).filter(isPaidParticipant).length;
}