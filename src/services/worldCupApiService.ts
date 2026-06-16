import { Match } from "../types";

export type WorldCupApiMatch = Match & {
  externalFixtureId: number;
  externalStatus: string;
};

type WorldCupFixturesResponse = {
  matches: WorldCupApiMatch[];
  total: number;
  syncedAt: string;
};

export async function fetchWorldCupFixtures(): Promise<WorldCupApiMatch[]> {
  const response = await fetch("/api/worldcup-fixtures", {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorBody = await safeReadError(response);

    throw new Error(
      errorBody?.message ??
        `Erro ao buscar jogos da Copa. Status: ${response.status}`
    );
  }

  const data = (await response.json()) as WorldCupFixturesResponse;

  if (!Array.isArray(data.matches)) {
    throw new Error("Resposta inválida ao buscar jogos da Copa.");
  }

  return data.matches;
}

async function safeReadError(response: Response): Promise<{ message?: string } | null> {
  try {
    return (await response.json()) as { message?: string };
  } catch {
    return null;
  }
}