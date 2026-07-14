import type { Player } from '../types';

// Adiciona um jogador à lista ou substitui o jogador
// que já possui o mesmo id.
//
// "Upsert" representa duas possibilidades:
// - update: atualiza o jogador quando ele já existe;
// - insert: adiciona o jogador quando ele ainda não existe.
//
// A função sempre retorna uma nova lista,
// sem modificar diretamente o array recebido.
export function upsertPlayer(
  players: Player[],
  nextPlayer: Player
): Player[] {
  // Verifica se já existe um jogador com o mesmo id.
  const alreadyExists = players.some(
    (player) => player.id === nextPlayer.id
  );

  // Se o jogador ainda não existe,
  // adiciona ele ao final de uma nova lista.
  if (!alreadyExists) {
    return [...players, nextPlayer];
  }

  // Se o jogador já existe, cria uma nova lista:
  // - substitui o jogador com o mesmo id;
  // - mantém todos os outros sem alteração.
  return players.map((player) =>
    player.id === nextPlayer.id ? nextPlayer : player
  );
}