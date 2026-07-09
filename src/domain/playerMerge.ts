import { Player, Prediction } from '../types';

export interface MergePlayerOptions {
  fallbackAvatar?: string;
}

export interface DuplicatePlayerPlan {
  email: string;
  primaryPlayer: Player;
  mergedPlayer: Player;
  duplicatePlayers: Player[];
  totalPredictions: number;
}

export function getNormalizedEmail(email?: string | null) {
  return email?.trim().toLowerCase() || '';
}

function getPredictionTime(prediction?: Prediction) {
  const rawDate = prediction?.updatedAt || prediction?.createdAt || '';
  const timestamp = Date.parse(rawDate);

  return Number.isFinite(timestamp) ? timestamp : 0;
}

function shouldUseNextPrediction(
  currentPrediction?: Prediction,
  nextPrediction?: Prediction
) {
  if (!nextPrediction) return false;
  if (!currentPrediction) return true;

  return getPredictionTime(nextPrediction) > getPredictionTime(currentPrediction);
}

export function mergePredictionMaps(
  primaryPredictions: Record<string, Prediction> = {},
  secondaryPredictions: Record<string, Prediction> = {}
) {
  const mergedPredictions: Record<string, Prediction> = {
    ...primaryPredictions,
  };

  //object.entries retorna um array de pares [chave, valor] do objeto.
  for (const [matchId, secondaryPrediction] of Object.entries(
    secondaryPredictions
  )) {
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

export function predictionMapsAreEqual(
  firstPredictions: Record<string, Prediction> = {},
  secondPredictions: Record<string, Prediction> = {}
) {
  const firstKeys = Object.keys(firstPredictions);
  const secondKeys = Object.keys(secondPredictions);

  if (firstKeys.length !== secondKeys.length) return false;

  return firstKeys.every((matchId) => {
    const first = firstPredictions[matchId];
    const second = secondPredictions[matchId];

    return (
      second &&
      first.scoreA === second.scoreA &&
      first.scoreB === second.scoreB &&
      (first.createdAt || '') === (second.createdAt || '') &&
      (first.updatedAt || '') === (second.updatedAt || '')
    );
  });
}

export function mergePlayersKeepingPrimary(
  primaryPlayer: Player,
  secondaryPlayer: Player,
  options: MergePlayerOptions = {}
): Player {
  return {
    ...primaryPlayer,
    name: primaryPlayer.name || secondaryPlayer.name,
    avatar:
      primaryPlayer.avatar ||
      secondaryPlayer.avatar ||
      options.fallbackAvatar ||
      '',
    email: primaryPlayer.email || secondaryPlayer.email || '',
    isAdmin: Boolean(primaryPlayer.isAdmin || secondaryPlayer.isAdmin),
    predictions: mergePredictionMaps(
      primaryPlayer.predictions,
      secondaryPlayer.predictions
    ),
    manualPointsAdjustment:
      typeof primaryPlayer.manualPointsAdjustment === 'number'
        ? primaryPlayer.manualPointsAdjustment
        : secondaryPlayer.manualPointsAdjustment ?? 0,
    manualPointsAdjustmentUpdatedAt:
      primaryPlayer.manualPointsAdjustmentUpdatedAt ||
      secondaryPlayer.manualPointsAdjustmentUpdatedAt ||
      '',
    lastPredictionMatchId:
      primaryPlayer.lastPredictionMatchId ||
      secondaryPlayer.lastPredictionMatchId ||
      '',
  };
}

export function mergePlayersByEmail(
  players: Player[],
  options: MergePlayerOptions = {}
): Player[] {
  const mergedPlayers: Player[] = [];
  const emailIndexMap = new Map<string, number>();

  for (const player of players) {
    const email = getNormalizedEmail(player.email);

    if (!email) {
      mergedPlayers.push(player);
      continue;
    }

    const existingIndex = emailIndexMap.get(email);

    if (existingIndex === undefined) {
      emailIndexMap.set(email, mergedPlayers.length);
      mergedPlayers.push(player);
      continue;
    }

    const existingPlayer = mergedPlayers[existingIndex];

    const primaryPlayer =
      existingPlayer.isAdmin || !player.isAdmin ? existingPlayer : player;

    const secondaryPlayer =
      primaryPlayer.id === existingPlayer.id ? player : existingPlayer;

    mergedPlayers[existingIndex] = mergePlayersKeepingPrimary(
      primaryPlayer,
      secondaryPlayer,
      options
    );
  }

  return mergedPlayers;
}

function countPredictions(player: Player) {
  return Object.keys(player.predictions || {}).length;
}

function choosePrimaryPlayer(
  duplicatedPlayers: Player[],
  preferredPlayerId?: string
) {
  const preferredPlayer = duplicatedPlayers.find(
    (player) => player.id === preferredPlayerId
  );

  if (preferredPlayer) {
    return preferredPlayer;
  }

  return [...duplicatedPlayers].sort((firstPlayer, secondPlayer) => {
    if (Boolean(firstPlayer.isAdmin) !== Boolean(secondPlayer.isAdmin)) {
      return Number(secondPlayer.isAdmin) - Number(firstPlayer.isAdmin);
    }

    return countPredictions(secondPlayer) - countPredictions(firstPlayer);
  })[0];
}

export function buildDuplicatePlayerPlans(
  players: Player[],
  preferredPlayerId?: string,
  options: MergePlayerOptions = {}
): DuplicatePlayerPlan[] {
  const playersByEmail = new Map<string, Player[]>();

  for (const player of players) {
    const email = getNormalizedEmail(player.email);

    if (!email) continue;

    const currentPlayers = playersByEmail.get(email) || [];

    playersByEmail.set(email, [...currentPlayers, player]);
  }

  return Array.from(playersByEmail.entries())
    .filter(([, duplicatedPlayers]) => duplicatedPlayers.length > 1)
    .map(([email, duplicatedPlayers]) => {
      const primaryPlayer = choosePrimaryPlayer(
        duplicatedPlayers,
        preferredPlayerId
      );

      const mergedPlayer = duplicatedPlayers.reduce<Player>(
        (currentMergedPlayer, duplicatedPlayer) => {
          if (duplicatedPlayer.id === currentMergedPlayer.id) {
            return currentMergedPlayer;
          }

          return mergePlayersKeepingPrimary(
            currentMergedPlayer,
            duplicatedPlayer,
            options
          );
        },
        primaryPlayer
      );

      const duplicatePlayers = duplicatedPlayers.filter(
        (player) => player.id !== primaryPlayer.id
      );

      return {
        email,
        primaryPlayer,
        mergedPlayer,
        duplicatePlayers,
        totalPredictions: countPredictions(mergedPlayer),
      };
    });
}
