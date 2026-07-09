import { isPredictionLocked } from './rules';
import type { Match, Player } from '../types';

// Define os filtros de partidas que podem ser aplicados na tela.
//
// open = partidas abertas para palpitar.
// all = todas as partidas.
// predicted = partidas em que o jogador já palpitou.
// missing = partidas abertas em que o jogador ainda não palpitou.
// locked = partidas travadas, mas ainda não finalizadas.
// finished = partidas finalizadas.
export type MatchFilter =
  | 'open'
  | 'all'
  | 'predicted'
  | 'missing'
  | 'locked'
  | 'finished';

// Define o formato dos contadores exibidos nos filtros.
//
// Cada campo guarda quantas partidas existem naquela categoria.
export interface MatchFilterCounts {
  open: number;
  missing: number;
  predicted: number;
  locked: number;
  finished: number;
  all: number;
}

// Verifica se a partida ainda está aberta para receber palpites.
//
// Para estar aberta, a partida precisa:
// - estar agendada;
// - não estar travada pela regra de horário.
export function isMatchOpenForPrediction(match: Match): boolean {
  return match.status === 'scheduled' && !isPredictionLocked(match);
}

// Verifica se o jogador já fez um palpite para a partida recebida.
//
// predictions é um objeto onde a chave é o id da partida.
// Exemplo:
// player.predictions["m10"] retorna o palpite do jogador para a partida m10.
function hasPrediction(player: Player, match: Match): boolean {
  return Boolean(player.predictions?.[match.id]);
}

// Calcula quantas partidas existem em cada filtro.
//
// Recebe todas as partidas e o jogador atual.
// Depois percorre partida por partida, atualizando os contadores.
export function getMatchFilterCounts(
  matches: Match[],
  userPlayer: Player
): MatchFilterCounts {
  return matches.reduce<MatchFilterCounts>(
    (counts, match) => {
      // Informações calculadas sobre a partida atual.
      const matchHasPrediction = hasPrediction(userPlayer, match);
      const isOpen = isMatchOpenForPrediction(match);
      const isFinished = match.status === 'finished';
      const isLocked = isPredictionLocked(match);

      // Conta partidas abertas para palpite.
      if (isOpen) counts.open++;

      // Conta partidas abertas em que o jogador ainda não palpitou.
      //
      // Uma partida travada sem palpite não entra em missing,
      // porque o jogador já não consegue mais palpitar nela.
      if (isOpen && !matchHasPrediction) counts.missing++;

      // Conta partidas em que o jogador já enviou palpite.
      //
      // Não importa se a partida está aberta, travada ou finalizada.
      if (matchHasPrediction) counts.predicted++;

      // Conta partidas travadas que ainda não foram finalizadas.
      //
      // Partidas finalizadas também ficam travadas na prática,
      // mas aqui elas devem aparecer apenas no filtro finished.
      if (isLocked && !isFinished) counts.locked++;

      // Conta partidas que já possuem status finalizado.
      if (isFinished) counts.finished++;

      // Toda partida entra no total geral.
      counts.all++;

      return counts;
    },
    {
      open: 0,
      missing: 0,
      predicted: 0,
      locked: 0,
      finished: 0,
      all: 0,
    }
  );
}

// Filtra as partidas com base no filtro selecionado pelo usuário.
//
// Diferente de getMatchFilterCounts, esta função não conta.
// Ela devolve uma nova lista contendo apenas as partidas que combinam
// com o filtro ativo.
export function getFilteredMatches(
  matches: Match[],
  userPlayer: Player,
  activeFilter: MatchFilter
): Match[] {
  return matches.filter((match) => {
    const matchHasPrediction = hasPrediction(userPlayer, match);
    const isOpen = isMatchOpenForPrediction(match);
    const isFinished = match.status === 'finished';
    const isLocked = isPredictionLocked(match);

    // Mostra apenas partidas abertas para palpite.
    if (activeFilter === 'open') return isOpen;

    // Mostra partidas em que o jogador já fez palpite.
    if (activeFilter === 'predicted') return matchHasPrediction;

    // Mostra partidas abertas em que o jogador ainda não palpitou.
    if (activeFilter === 'missing') return isOpen && !matchHasPrediction;

    // Mostra partidas que travaram, mas ainda não finalizaram.
    if (activeFilter === 'locked') return isLocked && !isFinished;

    // Mostra partidas finalizadas.
    if (activeFilter === 'finished') return isFinished;

    // Se nenhum filtro específico acima foi escolhido, sobra o filtro "all".
    //
    // return true mantém todas as partidas na lista filtrada.
    return true;
  });
}