import type { Player, Prediction } from '../types';

// Opções extras usadas durante o merge de jogadores.
//
// fallbackAvatar é usado quando nem o jogador principal
// nem o jogador secundário possuem avatar.
export interface MergePlayerOptions {
  fallbackAvatar?: string;
}

// Representa um plano de correção para jogadores duplicados.
//
// Esse plano não salva nada no banco sozinho.
// Ele apenas descreve:
// - qual e-mail está duplicado;
// - qual jogador deve ser mantido como principal;
// - como ficará o jogador após juntar os dados;
// - quais jogadores são duplicados secundários;
// - quantos palpites o jogador final terá.
export interface DuplicatePlayerPlan {
  email: string;
  primaryPlayer: Player;
  mergedPlayer: Player;
  duplicatePlayers: Player[];
  totalPredictions: number;
}

// Normaliza o e-mail para comparação.
//
// Remove espaços no começo e no fim,
// transforma tudo em minúsculo
// e retorna string vazia quando não houver e-mail.
export function getNormalizedEmail(email?: string | null): string {
  return email?.trim().toLowerCase() || '';
}

// Retorna a data do palpite em formato numérico.
//
// Dá prioridade para updatedAt, porque uma edição mais recente
// deve valer mais do que a data original de criação.
//
// Se a data estiver vazia ou inválida, retorna 0.
function getPredictionTime(prediction?: Prediction): number {
  const rawDate = prediction?.updatedAt || prediction?.createdAt || '';
  const timestamp = Date.parse(rawDate);

  return Number.isFinite(timestamp) ? timestamp : 0;
}

// Decide se o próximo palpite deve substituir o palpite atual.
//
// Regras:
// - Se não existe próximo palpite, não troca.
// - Se não existe palpite atual, usa o próximo.
// - Se existem os dois, usa o mais recente.
function shouldUseNextPrediction(
  currentPrediction?: Prediction,
  nextPrediction?: Prediction
): boolean {
  if (!nextPrediction) return false;
  if (!currentPrediction) return true;

  return getPredictionTime(nextPrediction) > getPredictionTime(currentPrediction);
}


// Junta dois mapas de palpites.
//
// primaryPredictions são os palpites do jogador principal.
// secondaryPredictions são os palpites do jogador duplicado.
//
// Quando os dois possuem palpite para a mesma partida,
// fica com o palpite mais recente.
export function mergePredictionMaps(
  primaryPredictions: Record<string, Prediction> = {},
  secondaryPredictions: Record<string, Prediction> = {}
): Record<string, Prediction> {
  // Começa criando uma cópia dos palpites principais.
  //
  // Isso evita alterar diretamente o objeto original do primaryPlayer.
  const mergedPredictions: Record<string, Prediction> = {
    ...primaryPredictions,
  };

  // Object.entries transforma o objeto de palpites em pares:
  //
  // {
  //   m10: predictionA,
  //   m11: predictionB
  // }
  //
  // vira:
  //
  // [
  //   ['m10', predictionA],
  //   ['m11', predictionB]
  // ]
  for (const [matchId, secondaryPrediction] of Object.entries(
    secondaryPredictions
  )) {
    // Verifica se o palpite secundário deve entrar no merge.
    //
    // Ele entra quando:
    // - o principal não tinha palpite para essa partida;
    // - ou o palpite secundário é mais recente.
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

// Verifica se dois mapas de palpites são equivalentes.
//
// Essa função compara:
// - se possuem a mesma quantidade de partidas;
// - se cada partida possui o mesmo placar;
// - se as datas createdAt e updatedAt também são iguais.
export function predictionMapsAreEqual(
  firstPredictions: Record<string, Prediction> = {},
  secondPredictions: Record<string, Prediction> = {}
): boolean {
  // Pega apenas os ids das partidas existentes em cada mapa de palpites.
  //
  // Exemplo:
  // {
  //   m10: {...},
  //   m11: {...}
  // }
  //
  // Object.keys(...) retorna:
  // ['m10', 'm11']
  const firstKeys = Object.keys(firstPredictions);
  const secondKeys = Object.keys(secondPredictions);

  // Se a quantidade de partidas for diferente,
  // os mapas já não podem ser considerados iguais.
  if (firstKeys.length !== secondKeys.length) {
    return false;
  }

  // every verifica se todas as chaves do primeiro mapa
  // também existem no segundo mapa com os mesmos dados.
  return firstKeys.every((matchId) => {
    const first = firstPredictions[matchId];
    const second = secondPredictions[matchId];

    // Se second não existir, a comparação falha.
    //
    // Se existir, compara placar e datas.
    return (
      second &&
      first.scoreA === second.scoreA &&
      first.scoreB === second.scoreB &&
      (first.createdAt || '') === (second.createdAt || '') &&
      (first.updatedAt || '') === (second.updatedAt || '')
    );
  });
}

// Junta dois jogadores mantendo o primaryPlayer como base.
//
// Regra geral:
// - o primaryPlayer tem prioridade;
// - o secondaryPlayer só preenche dados que faltam;
// - os palpites são mesclados para evitar perda de informação.
export function mergePlayersKeepingPrimary(
  primaryPlayer: Player,
  secondaryPlayer: Player,
  options: MergePlayerOptions = {}
): Player {
  return {
    // Começa copiando todos os dados do jogador principal.
    //
    // Depois, abaixo, alguns campos são sobrescritos com regras específicas.
    ...primaryPlayer,

    // Mantém o nome do principal.
    // Se o principal não tiver nome, usa o nome do secundário.
    name: primaryPlayer.name || secondaryPlayer.name,

    // Escolhe o primeiro avatar disponível nesta ordem:
    // 1. avatar do principal;
    // 2. avatar do secundário;
    // 3. avatar padrão recebido nas opções;
    // 4. string vazia.
    avatar:
      primaryPlayer.avatar ||
      secondaryPlayer.avatar ||
      options.fallbackAvatar ||
      '',

    // Mantém o e-mail do principal.
    // Se não tiver, usa o e-mail do secundário.
    email: primaryPlayer.email || secondaryPlayer.email || '',

    // Se qualquer um dos dois jogadores for admin,
    // o jogador final também será admin.
    //
    // Isso evita perder permissão de admin durante o merge.
    isAdmin: Boolean(primaryPlayer.isAdmin || secondaryPlayer.isAdmin),

    // Junta os palpites dos dois jogadores.
    //
    // Quando os dois possuem palpite para o mesmo jogo,
    // fica com o palpite mais recente.
    predictions: mergePredictionMaps(
      primaryPlayer.predictions,
      secondaryPlayer.predictions
    ),

    // Mantém o ajuste manual de pontos do principal quando ele for número.
    //
    // O typeof é usado porque 0 é um valor válido.
    // Se usasse apenas "primaryPlayer.manualPointsAdjustment || ...",
    // o 0 poderia ser tratado como falso.
    manualPointsAdjustment:
      typeof primaryPlayer.manualPointsAdjustment === 'number'
        ? primaryPlayer.manualPointsAdjustment
        : secondaryPlayer.manualPointsAdjustment ?? 0,

    // Mantém a data de ajuste manual do principal.
    // Se não existir, usa a do secundário.
    manualPointsAdjustmentUpdatedAt:
      primaryPlayer.manualPointsAdjustmentUpdatedAt ||
      secondaryPlayer.manualPointsAdjustmentUpdatedAt ||
      '',

    // Mantém o último jogo alterado do principal.
    // Se não existir, usa o do secundário.
    lastPredictionMatchId:
      primaryPlayer.lastPredictionMatchId ||
      secondaryPlayer.lastPredictionMatchId ||
      '',
  };
}

// Junta jogadores duplicados pelo mesmo e-mail.
//
// Regra geral:
// - jogador sem e-mail não é mesclado, porque não dá para confirmar duplicidade;
// - primeiro jogador encontrado com um e-mail é guardado;
// - se outro jogador com o mesmo e-mail aparecer, os dois são mesclados;
// - se um deles for admin, o admin tem prioridade como jogador principal.
export function mergePlayersByEmail(
  players: Player[],
  options: MergePlayerOptions = {}
): Player[] {
  // Lista final que será construída aos poucos.
  //
  // Ela começa vazia e recebe:
  // - jogadores únicos;
  // - jogadores sem e-mail;
  // - jogadores já mesclados quando houver duplicidade.
  const mergedPlayers: Player[] = [];

  // Guarda em qual posição de mergedPlayers cada e-mail já apareceu.
  //
  // Exemplo:
  // "joao@email.com" → 0
  // "maria@email.com" → 1
  //
  // Isso permite encontrar rapidamente o player já salvo para aquele e-mail.
  const emailIndexMap = new Map<string, number>();

  // Percorre todos os jogadores recebidos.
  for (const player of players) {
    // Normaliza o e-mail para evitar diferença por maiúsculas,
    // minúsculas ou espaços extras.
    const email = getNormalizedEmail(player.email);

    // Se o jogador não possui e-mail, não dá para saber se ele é duplicado.
    //
    // Por segurança, mantém esse jogador separado na lista final.
    if (!email) {
      mergedPlayers.push(player);
      continue;
    }

    // Verifica se esse e-mail já apareceu antes.
    //
    // Se já apareceu, existingIndex será a posição dele em mergedPlayers.
    // Se não apareceu, será undefined.
    const existingIndex = emailIndexMap.get(email);

    // Primeira vez que este e-mail aparece.
    if (existingIndex === undefined) {
      // Salva a posição em que este e-mail ficará dentro da lista final.
      emailIndexMap.set(email, mergedPlayers.length);

      // Adiciona o jogador na lista final.
      mergedPlayers.push(player);

      // Vai para o próximo jogador.
      continue;
    }

    // Se chegou aqui, já existe um jogador na lista final com este e-mail.
    const existingPlayer = mergedPlayers[existingIndex];

    // Escolhe qual dos dois jogadores será o principal do merge.
    //
    // Regra:
    // - se o jogador já existente for admin, mantém ele como principal;
    // - se o novo jogador não for admin, mantém o existente como principal;
    // - se o novo jogador for admin e o existente não for, o novo vira principal.
    const primaryPlayer =
      existingPlayer.isAdmin || !player.isAdmin ? existingPlayer : player;

    // O jogador secundário é o outro jogador da comparação.
    //
    // Se o principal é o existingPlayer, então o secundário é o player novo.
    // Se o principal é o player novo, então o secundário é o existingPlayer.
    const secondaryPlayer =
      primaryPlayer.id === existingPlayer.id ? player : existingPlayer;

    // Substitui a posição antiga pelo resultado do merge.
    //
    // A lista continua tendo apenas um jogador para esse e-mail,
    // mas agora com dados combinados dos dois.
    mergedPlayers[existingIndex] = mergePlayersKeepingPrimary(
      primaryPlayer,
      secondaryPlayer,
      options
    );
  }

  // Retorna a lista final com duplicados por e-mail já mesclados.
  return mergedPlayers;
}

// Conta quantos palpites o jogador possui.
//
// predictions é um objeto onde cada chave é o id de uma partida.
// Object.keys pega somente essas chaves.
// length conta quantas chaves existem.
function countPredictions(player: Player): number {
  return Object.keys(player.predictions || {}).length;
}

// Escolhe qual jogador deve ser tratado como principal
// dentro de um grupo de jogadores duplicados.
//
// Prioridade:
// 1. jogador escolhido manualmente por preferredPlayerId;
// 2. jogador admin;
// 3. jogador com mais palpites.
function choosePrimaryPlayer(
  duplicatedPlayers: Player[],
  preferredPlayerId?: string
): Player {
  // Procura um jogador específico que tenha sido escolhido como preferido.
  const preferredPlayer = duplicatedPlayers.find(
    (player) => player.id === preferredPlayerId
  );

  // Se encontrou o jogador preferido, ele vence as regras automáticas.
  if (preferredPlayer) {
    return preferredPlayer;
  }

  // Cria uma cópia da lista antes de ordenar.
  //
  // sort altera o array onde é chamado, então a cópia evita modificar
  // duplicatedPlayers diretamente.
  return [...duplicatedPlayers].sort((firstPlayer, secondPlayer) => {
    // Se apenas um dos dois for admin, o admin deve vir primeiro.
    if (Boolean(firstPlayer.isAdmin) !== Boolean(secondPlayer.isAdmin)) {
      return Number(secondPlayer.isAdmin) - Number(firstPlayer.isAdmin);
    }

    // Se os dois têm o mesmo status de admin,
    // quem tem mais palpites vem primeiro.
    return countPredictions(secondPlayer) - countPredictions(firstPlayer);
  })[0];
}

export function buildDuplicatePlayerPlans(
  players: Player[],
  preferredPlayerId?: string,
  options: MergePlayerOptions = {}
): DuplicatePlayerPlan[] {
  // Agrupa jogadores pelo e-mail normalizado.
  //
  // Exemplo:
  // "joao@email.com" → [Player antigo, Player Google]
  // "maria@email.com" → [Player Maria]
  const playersByEmail = new Map<string, Player[]>();

  // Percorre todos os jogadores para separar em grupos por e-mail.
  for (const player of players) {
    const email = getNormalizedEmail(player.email);

    // Jogador sem e-mail não entra no plano de duplicidade,
    // porque não existe uma chave confiável para comparar.
    if (!email) continue;

    // Busca a lista de jogadores que já foram encontrados com esse e-mail.
    //
    // Se ainda não existir ninguém com esse e-mail,
    // começa com uma lista vazia.
    const currentPlayers = playersByEmail.get(email) || [];

    // Atualiza o Map colocando o jogador atual junto dos outros
    // que possuem o mesmo e-mail.
    //
    // O spread cria uma nova lista:
    // jogadores antigos daquele e-mail + jogador atual.
    playersByEmail.set(email, [...currentPlayers, player]);
  }

  // Transforma o Map em uma lista de pares:
  //
  // [
  //   ["joao@email.com", [Player antigo, Player Google]],
  //   ["maria@email.com", [Player Maria]]
  // ]
  return Array.from(playersByEmail.entries())

    // Mantém apenas e-mails com mais de um jogador.
    //
    // Se só existe um jogador com aquele e-mail,
    // ele não é duplicado e não precisa de plano de merge.
    .filter(([, duplicatedPlayers]) => duplicatedPlayers.length > 1)

    // Para cada e-mail duplicado, monta um plano de consolidação.
    .map(([email, duplicatedPlayers]) => {
      // Escolhe qual jogador será tratado como principal.
      //
      // Prioridade:
      // 1. preferredPlayerId, caso tenha sido informado;
      // 2. jogador admin;
      // 3. jogador com mais palpites.
      const primaryPlayer = choosePrimaryPlayer(
        duplicatedPlayers,
        preferredPlayerId
      );

      // Junta todos os jogadores duplicados em um único player final.
      //
      // O reduce começa com primaryPlayer como valor inicial.
      //
      // currentMergedPlayer:
      // jogador acumulado até o momento.
      //
      // duplicatedPlayer:
      // jogador duplicado atual da rodada.
      const mergedPlayer = duplicatedPlayers.reduce<Player>(
        (currentMergedPlayer, duplicatedPlayer) => {
          // Se o jogador atual do loop é o próprio principal,
          // não precisa mesclar ele com ele mesmo.
          if (duplicatedPlayer.id === currentMergedPlayer.id) {
            return currentMergedPlayer;
          }

          // Junta o jogador acumulado com o duplicado atual,
          // mantendo o acumulado como principal.
          return mergePlayersKeepingPrimary(
            currentMergedPlayer,
            duplicatedPlayer,
            options
          );
        },

        // Valor inicial do reduce.
        //
        // É daqui que currentMergedPlayer começa na primeira rodada.
        primaryPlayer
      );

      // Lista apenas os jogadores duplicados secundários.
      //
      // O principal fica fora dessa lista, porque ele será mantido.
      // Os outros são os candidatos a remoção depois da consolidação.
      const duplicatePlayers = duplicatedPlayers.filter(
        (player) => player.id !== primaryPlayer.id
      );

      // Retorna o plano completo para esse e-mail duplicado.
      //
      // Esse objeto permite mostrar no admin:
      // - qual e-mail está duplicado;
      // - quem será mantido;
      // - como ficará o player final;
      // - quem será removido;
      // - quantos palpites o player final terá.
      return {
        email,
        primaryPlayer,
        mergedPlayer,
        duplicatePlayers,
        totalPredictions: countPredictions(mergedPlayer),
      };
    });
}