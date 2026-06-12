import { isAdminEmail } from '../config/admins';
import { Player } from '../types';

export const ENTRY_FEE = 10;
export const FIRST_PLACE_PERCENTAGE = 0.8;
export const SECOND_PLACE_PERCENTAGE = 0.2;

export function isAdminPlayer(player: Pick<Player, 'isAdmin' | 'email'>) {
  return Boolean(player.isAdmin) || isAdminEmail(player.email);
}

export function isPaidParticipant(player: Pick<Player, 'isAdmin' | 'email'>) {
  return !isAdminPlayer(player);
}

export function getPaidParticipants(players: Player[]) {
  return players.filter(isPaidParticipant);
}

export function calculatePrizePool(paidPlayersCount: number) {
  return paidPlayersCount * ENTRY_FEE;
}

export function calculatePrizes(paidPlayersCount: number) {
  const totalPrizePool = calculatePrizePool(paidPlayersCount);

  return {
    totalPrizePool,
    firstPrize: totalPrizePool * FIRST_PLACE_PERCENTAGE,
    secondPrize: totalPrizePool * SECOND_PLACE_PERCENTAGE,
  };
}

export function getPaidRank(players: Player[], index: number) {
  const player = players[index];

  if (!player || !isPaidParticipant(player)) {
    return null;
  }

  return players.slice(0, index + 1).filter(isPaidParticipant).length;
}
