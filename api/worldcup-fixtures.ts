type ApiRequest = {
  method?: string;
};

type ApiResponse = {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
};

type ApiFootballFixture = {
  fixture: {
    id: number;
    date: string;
    timestamp: number;
    status: {
      short: string;
      long: string;
    };
    venue?: {
      name?: string;
      city?: string;
    };
  };
  league: {
    round?: string;
  };
  teams: {
    home: {
      name: string;
      logo?: string;
    };
    away: {
      name: string;
      logo?: string;
    };
  };
  goals: {
    home: number | null;
    away: number | null;
  };
};

type ApiFootballResponse = {
  response?: ApiFootballFixture[];
  errors?: unknown;
};

type NormalizedWorldCupMatch = {
  id: string;
  externalFixtureId: number;
  teamA: string;
  teamB: string;
  flagA: string;
  flagB: string;
  date: string;
  time: string;
  startsAt: string;
  startsAtMs: number;
  status: "scheduled" | "finished";
  scoreA?: number;
  scoreB?: number;
  group: string;
  venue?: string;
  city?: string;
  externalStatus: string;
};

const API_FOOTBALL_BASE_URL = "https://v3.football.api-sports.io";

function formatDateBR(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatTimeBR(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function normalizeStatus(apiStatus: string): "scheduled" | "finished" {
  const finishedStatuses = ["FT", "AET", "PEN"];

  if (finishedStatuses.includes(apiStatus)) {
    return "finished";
  }

  return "scheduled";
}

function normalizeFixture(fixture: ApiFootballFixture): NormalizedWorldCupMatch {
  const startsAtDate = new Date(fixture.fixture.date);

  const status = normalizeStatus(fixture.fixture.status.short);

  const match: NormalizedWorldCupMatch = {
    id: `wc2026-${fixture.fixture.id}`,
    externalFixtureId: fixture.fixture.id,

    teamA: fixture.teams.home.name,
    teamB: fixture.teams.away.name,

    // Por enquanto usamos o logo da API como imagem/flag.
    // Depois, se seu front espera emoji/código de país, a gente ajusta aqui.
    flagA: fixture.teams.home.logo ?? "🏳️",
    flagB: fixture.teams.away.logo ?? "🏳️",

    date: formatDateBR(startsAtDate),
    time: formatTimeBR(startsAtDate),

    startsAt: startsAtDate.toISOString(),
    startsAtMs: startsAtDate.getTime(),

    status,

    group: fixture.league.round ?? "Copa do Mundo 2026",

    venue: fixture.fixture.venue?.name,
    city: fixture.fixture.venue?.city,

    externalStatus: fixture.fixture.status.short,
  };

  if (
    status === "finished" &&
    typeof fixture.goals.home === "number" &&
    typeof fixture.goals.away === "number"
  ) {
    match.scoreA = fixture.goals.home;
    match.scoreB = fixture.goals.away;
  }

  return match;
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader("Access-Control-Allow-Methods", "GET");

  if (req.method !== "GET") {
    return res.status(405).json({
      message: "Método não permitido. Use GET.",
    });
  }

  const apiKey = process.env.API_FOOTBALL_KEY;

if (!apiKey) {
  return res.status(500).json({
    message: "API_FOOTBALL_KEY não configurada no ambiente.",
    availableEnvKeys: Object.keys(process.env).filter((key) =>
      key.includes("API") || key.includes("FOOTBALL") || key.includes("VERCEL")
    ),
  });
}
  try {
    const url = new URL(`${API_FOOTBALL_BASE_URL}/fixtures`);

    url.searchParams.set("league", "1");
    url.searchParams.set("season", "2026");
    url.searchParams.set("timezone", "America/Sao_Paulo");

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "x-apisports-key": apiKey,
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({
        message: "Erro ao buscar jogos na API externa.",
        status: response.status,
      });
    }

    const data = (await response.json()) as ApiFootballResponse;

    if (!Array.isArray(data.response)) {
      return res.status(502).json({
        message: "Resposta inválida da API externa.",
        errors: data.errors,
      });
    }

    const matches = data.response.map(normalizeFixture);

    return res.status(200).json({
      matches,
      total: matches.length,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Erro em /api/worldcup-fixtures:", error);

    return res.status(500).json({
      message: "Erro interno ao buscar jogos da Copa.",
    });
  }
}