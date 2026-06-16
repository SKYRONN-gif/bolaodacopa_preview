const ESPN_URL =
  "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?limit=200&dates=20260611-20260719&lang=pt-BR&region=br";

const OPENFOOTBALL_URL =
  "https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json";

function getParam(value: any): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function formatDateBR(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

function formatTimeBR(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function numberOrNull(value: any) {
  if (value === undefined || value === null || value === "") return null;

  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function normalizeEspnStatus(event: any) {
  const type = event?.status?.type;

  if (type?.completed) return "finished";
  if (type?.state === "in") return "live";

  return "scheduled";
}

function mapEspnEvent(event: any) {
  const competition = event?.competitions?.[0];
  const competitors = competition?.competitors || [];

  const home =
    competitors.find((item: any) => item.homeAway === "home") ||
    competitors[0];

  const away =
    competitors.find((item: any) => item.homeAway === "away") ||
    competitors[1];

  if (!home || !away) return null;

  const kickoff = new Date(event.date);

  return {
    id: String(event.id),
    apiFixtureId: String(event.id),

    dateISO: event.date,
    date: formatDateBR(kickoff),
    time: formatTimeBR(kickoff),

    group: event?.season?.slug || event?.week?.text || "Copa do Mundo 2026",

    teamA: home?.team?.displayName || home?.team?.name,
    teamB: away?.team?.displayName || away?.team?.name,

    shortTeamA: home?.team?.abbreviation || null,
    shortTeamB: away?.team?.abbreviation || null,

    logoA: home?.team?.logo || null,
    logoB: away?.team?.logo || null,

    scoreA: numberOrNull(home?.score),
    scoreB: numberOrNull(away?.score),

    status: normalizeEspnStatus(event),
    statusShort: event?.status?.type?.name || null,
    statusLong:
      event?.status?.type?.description ||
      event?.status?.type?.shortDetail ||
      event?.status?.type?.detail ||
      null,

    venue: competition?.venue?.fullName || null,
    city: competition?.venue?.address?.city || null,
    country: competition?.venue?.address?.country || null,

    source: "espn",
  };
}

function parseOpenFootballDate(match: any) {
  const rawDate = match?.date;
  const rawTime = match?.time;

  if (!rawDate || !rawTime) return null;

  const timeText = String(rawTime);

  const matchTimeWithUtc = timeText.match(
    /^(\d{1,2}):(\d{2})\s*UTC([+-]\d{1,2})$/
  );

  if (matchTimeWithUtc) {
    const hour = matchTimeWithUtc[1].padStart(2, "0");
    const minute = matchTimeWithUtc[2];
    const offsetNumber = Number(matchTimeWithUtc[3]);

    const sign = offsetNumber >= 0 ? "+" : "-";
    const offsetHour = String(Math.abs(offsetNumber)).padStart(2, "0");

    return new Date(`${rawDate}T${hour}:${minute}:00${sign}${offsetHour}:00`);
  }

  const simpleTime = timeText.match(/^(\d{1,2}):(\d{2})$/);

  if (simpleTime) {
    const hour = simpleTime[1].padStart(2, "0");
    const minute = simpleTime[2];

    return new Date(`${rawDate}T${hour}:${minute}:00Z`);
  }

  return null;
}

function getOpenFootballTeamName(team: any) {
  if (!team) return null;

  if (typeof team === "string") return team;

  return (
    team.name ||
    team.title ||
    team.code ||
    team.key ||
    JSON.stringify(team)
  );
}

function mapOpenFootballMatch(match: any, index: number) {
  const kickoff = parseOpenFootballDate(match);

  const score = match?.score?.ft || match?.score;
  const hasScore = Array.isArray(score) && score.length === 2;

  return {
    id: String(match?.num || match?.id || `wc2026-${index + 1}`),
    apiFixtureId: String(match?.num || match?.id || `openfootball-${index + 1}`),

    dateISO: kickoff?.toISOString() || match?.date || null,
    date: kickoff ? formatDateBR(kickoff) : match?.date || null,
    time: kickoff ? formatTimeBR(kickoff) : match?.time || null,

    group: match?.group || match?.round || "Copa do Mundo 2026",

    teamA: getOpenFootballTeamName(match?.team1),
    teamB: getOpenFootballTeamName(match?.team2),

    shortTeamA: null,
    shortTeamB: null,

    logoA: null,
    logoB: null,

    scoreA: hasScore ? numberOrNull(score[0]) : null,
    scoreB: hasScore ? numberOrNull(score[1]) : null,

    status: hasScore ? "finished" : "scheduled",
    statusShort: hasScore ? "FT" : "SCHEDULED",
    statusLong: hasScore ? "Finalizado" : "Agendado",

    venue: null,
    city: match?.ground || null,
    country: null,

    source: "openfootball",
  };
}

async function fetchJson(url: string) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0",
    },
  });

  if (!response.ok) {
    throw new Error(`Erro HTTP ${response.status} ao buscar ${url}`);
  }

  return response.json();
}

async function fetchFromEspn() {
  const data = await fetchJson(ESPN_URL);

  if (!Array.isArray(data?.events)) {
    throw new Error("Formato inesperado da ESPN: events não encontrado.");
  }

  const matches = data.events.map(mapEspnEvent).filter(Boolean);

  if (matches.length === 0) {
    throw new Error("ESPN respondeu sem partidas.");
  }

  return {
    source: "espn",
    matches,
    rawCount: data.events.length,
  };
}

async function fetchFromOpenFootball() {
  const data = await fetchJson(OPENFOOTBALL_URL);

  if (!Array.isArray(data?.matches)) {
    throw new Error("Formato inesperado do OpenFootball: matches não encontrado.");
  }

  const matches = data.matches.map(mapOpenFootballMatch).filter(Boolean);

  if (matches.length === 0) {
    throw new Error("OpenFootball respondeu sem partidas.");
  }

  return {
    source: "openfootball",
    matches,
    rawCount: data.matches.length,
  };
}

export default async function handler(req: any, res: any) {
  try {
    const source = getParam(req.query.source) || "auto";
    const debug = getParam(req.query.debug) === "1";

    let result: any;
    let espnError: string | null = null;

    if (source === "openfootball") {
      result = await fetchFromOpenFootball();
    } else if (source === "espn") {
      result = await fetchFromEspn();
    } else {
      try {
        result = await fetchFromEspn();
      } catch (error: any) {
        espnError = error?.message || String(error);
        result = await fetchFromOpenFootball();
        result.fallbackFrom = "espn";
      }
    }

    return res.status(200).json({
      matches: result.matches,
      total: result.matches.length,
      source: result.source,
      fallbackFrom: result.fallbackFrom || null,
      rawCount: result.rawCount,
      syncedAt: new Date().toISOString(),
      ...(debug
        ? {
            debug: {
              espnError,
              firstMatches: result.matches.slice(0, 3),
            },
          }
        : {}),
    });
  } catch (error: any) {
    console.error("Erro na rota /api/worldcup-fixtures:", error);

    return res.status(500).json({
      message: "Erro ao buscar jogos da Copa 2026.",
      error: error?.message || String(error),
      syncedAt: new Date().toISOString(),
    });
  }
}