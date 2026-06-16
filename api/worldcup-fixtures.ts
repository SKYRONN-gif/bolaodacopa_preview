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

function normalizeEspnStatus(event: any) {
  const type = event?.status?.type;

  if (type?.completed) return "finished";
  if (type?.state === "in") return "live";

  return "scheduled";
}

function numberOrNull(value: any) {
  if (value === undefined || value === null || value === "") return null;

  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
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

    shortTeamA: home?.team?.abbreviation,
    shortTeamB: away?.team?.abbreviation,

    logoA: home?.team?.logo,
    logoB: away?.team?.logo,

    scoreA: numberOrNull(home?.score),
    scoreB: numberOrNull(away?.score),

    status: normalizeEspnStatus(event),
    statusShort: event?.status?.type?.name,
    statusLong:
      event?.status?.type?.description ||
      event?.status?.type?.shortDetail ||
      event?.status?.type?.detail,

    venue: competition?.venue?.fullName,
    city: competition?.venue?.address?.city,
    country: competition?.venue?.address?.country,

    source: "espn",
  };
}

function parseOpenFootballDate(match: any) {
  const rawDate = match?.date;
  const rawTime = match?.time;

  if (!rawDate || !rawTime) return null;

  const matchTime = String(rawTime).match(
    /^(\d{1,2}):(\d{2})\s*UTC([+-]\d{1,2})$/
  );

  if (!matchTime) return null;

  const hour = matchTime[1].padStart(2, "0");
  const minute = matchTime[2];
  const offsetNumber = Number(matchTime[3]);

  const sign = offsetNumber >= 0 ? "+" : "-";
  const offsetHour = String(Math.abs(offsetNumber)).padStart(2, "0");

  return new Date(`${rawDate}T${hour}:${minute}:00${sign}${offsetHour}:00`);
}

function mapOpenFootballMatch(match: any, index: number) {
  const kickoff = parseOpenFootballDate(match);

  const score = match?.score?.ft;
  const hasScore = Array.isArray(score) && score.length === 2;

  return {
    id: `wc2026-${index + 1}`,
    apiFixtureId: `openfootball-${index + 1}`,

    dateISO: kickoff?.toISOString() || match?.date || null,
    date: kickoff ? formatDateBR(kickoff) : match?.date,
    time: kickoff ? formatTimeBR(kickoff) : match?.time,

    group: match?.group || match?.round || "Copa do Mundo 2026",

    teamA: match?.team1,
    teamB: match?.team2,

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
    city: match?.ground,
    country: null,

    source: "openfootball",
  };
}

async function fetchFromEspn() {
  const response = await fetch(ESPN_URL, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0",
    },
  });

  if (!response.ok) {
    throw new Error(`ESPN respondeu com status ${response.status}`);
  }

  const data = await response.json();

  if (!Array.isArray(data.events)) {
    throw new Error("Formato inesperado da ESPN: events não encontrado.");
  }

  const matches = data.events.map(mapEspnEvent).filter(Boolean);

  return {
    source: "espn",
    matches,
    rawCount: data.events.length,
  };
}

async function fetchFromOpenFootball() {
  const response = await fetch(OPENFOOTBALL_URL, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0",
    },
  });

  if (!response.ok) {
    throw new Error(`OpenFootball respondeu com status ${response.status}`);
  }

  const data = await response.json();

  if (!Array.isArray(data.matches)) {
    throw new Error("Formato inesperado do OpenFootball: matches não encontrado.");
  }

  const matches = data.matches.map(mapOpenFootballMatch);

  return {
    source: "openfootball",
    matches,
    rawCount: data.matches.length,
  };
}

export default async function handler(req: any, res: any) {
  const source = getParam(req.query.source) || "espn";
  const debug = getParam(req.query.debug) === "1";

  try {
    let result;

    if (source === "openfootball") {
      result = await fetchFromOpenFootball();
    } else {
      try {
        result = await fetchFromEspn();
      } catch (espnError: any) {
        const fallback = await fetchFromOpenFootball();

        result = {
          ...fallback,
          fallbackFrom: "espn",
          espnError: espnError?.message || String(espnError),
        };
      }
    }

    return res.status(200).json({
      matches: result.matches,
      total: result.matches.length,
      source: result.source,
      rawCount: result.rawCount,
      syncedAt: new Date().toISOString(),
      ...(debug
        ? {
            debug: {
              fallbackFrom: (result as any).fallbackFrom || null,
              espnError: (result as any).espnError || null,
              firstMatches: result.matches.slice(0, 3),
            },
          }
        : {}),
    });
  } catch (error: any) {
    return res.status(500).json({
      message: "Erro ao buscar jogos da Copa 2026.",
      error: error?.message || String(error),
      syncedAt: new Date().toISOString(),
    });
  }
}