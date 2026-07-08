import { calculatePredictionPoints } from './scoring';
import type { Match, Player } from '../types';

// Tipos possíveis para representar o resultado previsto:
//
// A = time A vence.
// B = time B vence.
// Draw = empate.
type Outcome = 'A' | 'B' | 'Draw';

// Representa um placar escolhido por uma ou mais pessoas.
//
// Exemplo:
// {
//   scoreLabel: '2 x 1',
//   count: 3,
//   playerNames: ['João', 'Maria', 'Pedro']
// }
export interface TopScorePrediction {
  scoreLabel: string;
  count: number;
  playerNames: string[];
}

// Representa todas as estatísticas que serão exibidas
// no modal de detalhes de uma partida.
export interface MatchStats {
  // Quantidade total de jogadores que enviaram palpite para a partida.
  totalPredictions: number;

  // Quantidade de palpites prevendo vitória do time A.
  teamAWins: number;

  // Quantidade de palpites prevendo empate.
  draws: number;

  // Quantidade de palpites prevendo vitória do time B.
  teamBWins: number;

  // Até cinco placares mais escolhidos pelos jogadores.
  topScores: TopScorePrediction[];

  // Nomes de quem acertou o placar exato após a partida terminar.
  exactPlayers: string[];

  // Nomes de quem acertou vencedor ou empate, mas não o placar exato.
  partialPlayers: string[];

  // Nomes de quem enviou palpite e errou vencedor ou empate.
  errorPlayers: string[];
}

// Compara dois placares e retorna apenas o resultado geral.
//
// Não importa o placar exato aqui; importa somente:
// A = time A venceu.
// B = time B venceu.
// Draw = empate.
function getOutcome(scoreA: number, scoreB: number): Outcome {
  if (scoreA > scoreB) return 'A';
  if (scoreA < scoreB) return 'B';

  return 'Draw';
}

// Adiciona o nome do jogador à lista recebida.
//
// Se o nome estiver ausente ou vazio, usa "Jogador" como fallback.
function addPlayerName(list: string[], player: Player): void {
  list.push(player.name || 'Jogador');
}

// Gera as estatísticas exibidas no modal de detalhes de uma partida.
//
// Recebe uma partida e todos os jogadores.
// Depois procura o palpite de cada jogador especificamente para essa partida.
export function buildMatchStats(
  match: Match,
  players: Player[]
): MatchStats {
  // Contadores gerais dos palpites enviados.
  let totalPredictions = 0;
  let teamAWins = 0;
  let draws = 0;
  let teamBWins = 0;

  // Agrupa jogadores pelo placar que escolheram.
  //
  // Chave:
  // texto do placar, como "2 x 1".
  //
  // Valor:
  // quantidade de pessoas e nomes que escolheram esse placar.
  const scoreMap = new Map<string, TopScorePrediction>();

  // Listas preenchidas apenas depois que a partida possui resultado final.
  const exactPlayers: string[] = [];
  const partialPlayers: string[] = [];
  const errorPlayers: string[] = [];

  // Percorre todos os jogadores para procurar o palpite de cada um
  // para a partida recebida.
  players.forEach((player) => {
    // Busca o palpite do jogador usando o id da partida atual.
    const prediction = player.predictions?.[match.id];

    // Sem palpite para esta partida, encerra somente esta execução do forEach
    // e continua para o próximo jogador.
    if (!prediction) {
      return;
    }

    // Encontrou um palpite, então aumenta a quantidade total de palpites.
    totalPredictions++;

    // Descobre qual resultado o jogador previu:
    // vitória do time A, empate ou vitória do time B.
    const outcome = getOutcome(prediction.scoreA, prediction.scoreB);

    // Soma um voto para o resultado previsto pelo jogador.
    if (outcome === 'A') teamAWins++;
    if (outcome === 'Draw') draws++;
    if (outcome === 'B') teamBWins++;

    // Cria uma chave de texto para representar o placar previsto.
    //
    // Exemplo:
    // scoreA = 2
    // scoreB = 1
    // scoreLabel = "2 x 1"
    const scoreLabel = `${prediction.scoreA} x ${prediction.scoreB}`;

    // Procura se esse placar já foi escolhido por alguém.
    //
    // Retorna o registro existente ou undefined caso seja
    // a primeira pessoa a escolher esse placar.
    const currentScore = scoreMap.get(scoreLabel);

    if (currentScore) {
      // O placar já existe no Map.
      //
      // Aumenta a quantidade de pessoas que o escolheram
      // e adiciona o nome do jogador atual.
      currentScore.count++;
      addPlayerName(currentScore.playerNames, player);
    } else {
      // É o primeiro jogador a escolher esse placar.
      //
      // Cria um novo registro no Map usando scoreLabel como chave.
      scoreMap.set(scoreLabel, {
        scoreLabel,
        count: 1,
        playerNames: [player.name || 'Jogador'],
      });
    }

    // Depois que a partida termina, classifica cada palpite
    // usando a mesma regra oficial de pontuação do ranking.
    if (match.status === 'finished') {
      const result = calculatePredictionPoints(prediction, match);

      // Adiciona o jogador à lista correspondente ao desempenho dele.
      if (result.type === 'exact') {
        addPlayerName(exactPlayers, player);
      }

      if (result.type === 'partial') {
        addPlayerName(partialPlayers, player);
      }

      if (result.type === 'error') {
        addPlayerName(errorPlayers, player);
      }
    }
  });

  // scoreMap.values() pega apenas os valores guardados no Map.
  //
  // Array.from transforma esses valores em um array comum,
  // permitindo usar sort e slice.
  const topScores = Array.from(scoreMap.values())
    .sort((scoreA, scoreB) => {
      // Coloca primeiro os placares escolhidos por mais pessoas.
      if (scoreB.count !== scoreA.count) {
        return scoreB.count - scoreA.count;
      }

      // Em caso de empate, organiza pelo texto do placar
      // para a lista sempre aparecer em uma ordem consistente.
      return scoreA.scoreLabel.localeCompare(scoreB.scoreLabel);
    })

    // Mantém somente os cinco primeiros placares da lista já ordenada.
    .slice(0, 5);

  // Retorna o resumo completo que será usado pelo MatchDetailsModal.
  return {
    totalPredictions,
    teamAWins,
    draws,
    teamBWins,
    topScores,

    // Ordena os nomes antes de exibir no modal.
    exactPlayers: exactPlayers.sort(),
    partialPlayers: partialPlayers.sort(),
    errorPlayers: errorPlayers.sort(),
  };
}