import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';

import { db } from '../firebase';
import type {
  ChampionPick,
  ChampionPickSettings,
  ChampionPickTeam,
  Player,
} from '../types';

const CHAMPION_PICK_SETTINGS_REF = doc(db, 'settings', 'championPick');

export const DEFAULT_CHAMPION_PICK_SETTINGS: ChampionPickSettings = {
  enabled: false,
  locked: false,
  bonusPoints: 30,
  championTeamCode: '',
  eligibleTeams: [],
  eligibleTeamCodes: [],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cleanString(value: unknown, fallback = '', maxLength = 128) {
  if (typeof value !== 'string') return fallback;

  const trimmed = value.trim();

  return trimmed ? trimmed.slice(0, maxLength) : fallback;
}

function cleanNumber(value: unknown, fallback = 0) {
  const parsedValue =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value.replace(',', '.'))
        : Number.NaN;

  return Number.isFinite(parsedValue) ? parsedValue : fallback;
}

function cleanChampionPickTeam(value: unknown): ChampionPickTeam | null {
  if (!isRecord(value)) return null;

  const code = cleanString(value.code, '', 20).toUpperCase();
  const name = cleanString(value.name, '', 100);
  const logo = cleanString(value.logo, '', 500);

  if (!code || !name) return null;

  return {
    code,
    name,
    logo: logo || null,
  };
}

function cleanEligibleTeams(value: unknown): ChampionPickTeam[] {
  if (!Array.isArray(value)) return [];

  return value
    .map(cleanChampionPickTeam)
    .filter((team): team is ChampionPickTeam => Boolean(team))
    .slice(0, 64);
}

function normalizeChampionPickSettings(value: unknown): ChampionPickSettings {
  if (!isRecord(value)) {
    return DEFAULT_CHAMPION_PICK_SETTINGS;
  }

  const bonusPoints = Math.max(0, cleanNumber(value.bonusPoints, 30));
  const eligibleTeams = cleanEligibleTeams(value.eligibleTeams);

  const eligibleTeamCodes = Array.isArray(value.eligibleTeamCodes)
    ? value.eligibleTeamCodes
        .map((code) => cleanString(code, '', 20).toUpperCase())
        .filter(Boolean)
    : eligibleTeams.map((team) => team.code);

  return {
    enabled: value.enabled === true,
    locked: value.locked === true,
    bonusPoints,
    championTeamCode: cleanString(value.championTeamCode, '', 20).toUpperCase(),
    eligibleTeams,
    eligibleTeamCodes,
    updatedAt: cleanString(value.updatedAt, '', 40),
  };
}

function normalizeChampionPick(value: unknown): ChampionPick | null {
  if (!isRecord(value)) return null;

  const playerId = cleanString(value.playerId, '', 128);
  const playerName = cleanString(value.playerName, '', 128);
  const teamCode = cleanString(value.teamCode, '', 20).toUpperCase();
  const teamName = cleanString(value.teamName, '', 100);
  const teamLogo = cleanString(value.teamLogo, '', 500);
  const createdAt = cleanString(value.createdAt, '', 40);

  if (!playerId || !playerName || !teamCode || !teamName || !createdAt) {
    return null;
  }

  return {
    playerId,
    playerName,
    teamCode,
    teamName,
    teamLogo: teamLogo || null,
    createdAt,
  };
}

export async function getChampionPickSettings() {
  const snapshot = await getDoc(CHAMPION_PICK_SETTINGS_REF);

  if (!snapshot.exists()) {
    return DEFAULT_CHAMPION_PICK_SETTINGS;
  }

  return normalizeChampionPickSettings(snapshot.data());
}

export async function saveChampionPickSettings(
  settings: ChampionPickSettings
): Promise<void> {
  const eligibleTeams = settings.eligibleTeams.map((team) => ({
    code: team.code.trim().toUpperCase(),
    name: team.name.trim(),
    logo: team.logo?.trim() || null,
  }));

  const eligibleTeamCodes = eligibleTeams.map((team) => team.code);

  await setDoc(
    CHAMPION_PICK_SETTINGS_REF,
    {
      enabled: settings.enabled,
      locked: settings.locked,
      bonusPoints: settings.bonusPoints,
      championTeamCode: settings.championTeamCode.trim().toUpperCase(),
      eligibleTeams,
      eligibleTeamCodes,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
}

export function subscribeToChampionPickSettings({
  onData,
  onError,
}: {
  onData: (settings: ChampionPickSettings) => void;
  onError: (error: unknown) => void;
}) {
  return onSnapshot(
    CHAMPION_PICK_SETTINGS_REF,
    (snapshot) => {
      if (!snapshot.exists()) {
        onData(DEFAULT_CHAMPION_PICK_SETTINGS);
        return;
      }

      onData(normalizeChampionPickSettings(snapshot.data()));
    },
    (error) => {
      onError(error);
    }
  );
}

export function subscribeToChampionPick({
  playerId,
  onData,
  onError,
}: {
  playerId: string;
  onData: (pick: ChampionPick | null) => void;
  onError: (error: unknown) => void;
}) {
  return onSnapshot(
    doc(db, 'championPicks', playerId),
    (snapshot) => {
      if (!snapshot.exists()) {
        onData(null);
        return;
      }

      onData(normalizeChampionPick(snapshot.data()));
    },
    (error) => {
      onError(error);
    }
  );
}

export async function saveChampionPick(
  player: Player,
  team: ChampionPickTeam
): Promise<ChampionPick> {
  const pick: ChampionPick = {
    playerId: player.id,
    playerName: player.name,
    teamCode: team.code.trim().toUpperCase(),
    teamName: team.name.trim(),
    teamLogo: team.logo?.trim() || null,
    createdAt: new Date().toISOString(),
  };

  await setDoc(doc(db, 'championPicks', player.id), pick);

  return pick;
}