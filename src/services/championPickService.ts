import { doc, getDoc, setDoc } from 'firebase/firestore';

import { db } from '../firebase';
import type { ChampionPickSettings, ChampionPickTeam } from '../types';

const CHAMPION_PICK_SETTINGS_REF = doc(db, 'settings', 'championPick');

export const DEFAULT_CHAMPION_PICK_SETTINGS: ChampionPickSettings = {
  enabled: false,
  locked: false,
  bonusPoints: 30,
  championTeamCode: '',
  eligibleTeams: [],
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

  return {
    enabled: value.enabled === true,
    locked: value.locked === true,
    bonusPoints,
    championTeamCode: cleanString(value.championTeamCode, '', 20).toUpperCase(),
    eligibleTeams: cleanEligibleTeams(value.eligibleTeams),
    updatedAt: cleanString(value.updatedAt, '', 40),
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
  await setDoc(
    CHAMPION_PICK_SETTINGS_REF,
    {
      enabled: settings.enabled,
      locked: settings.locked,
      bonusPoints: settings.bonusPoints,
      championTeamCode: settings.championTeamCode,
      eligibleTeams: settings.eligibleTeams,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
}