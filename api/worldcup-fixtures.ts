const BASE_URL = "https://v3.football.api-sports.io";

function getParam(value: any): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function normalizeStatus(short?: string) {
  if (!short) return "scheduled";

  if (["FT", "AET", "PEN"].includes(short)) return "finished";
  if (["1H", "HT", "2H", "ET", "BT", "P", "LIVE", "INT"].includes(short)) return "live";
  if (["PST", "CANC", "ABD", "SUSP"].includes(short)) return "cancelled";

  return "scheduled";
}

export default async function handler(req: any, res: any) {
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
    const mode = getParam(req.query.mode);
    const debug = getParam(req.query.debug) === "1";

    const season = getParam(req.query.season) || "2026";

    /**
     * MODO 1:
     * Descobrir o ID correto da liga.
     *
     * Teste no navegador:
     * /api/worldcup-fixtures?mode=leagues
     */
    if (mode === "leagues") {
      const search = getParam(req.query.search) || "World Cup";

      const url = `${BASE_URL}/leagues?search=${encodeURIComponent(
        search
      )}&season=${season}`;

      const response = await fetch(url, {
        headers: {
          "x-apisports-key": apiKey,
        },
      });

      const data = await response.json();

      return res.status(200).json({
        mode: "leagues",
        search,
        season,
        apiStatus: response.status,
        results: data.results,
        errors: data.errors,
        parameters: data.parameters,
        leagues: Array.isArray(data.response)
          ? data.response.map((item: any) => ({
              id: item.league?.id,
              name: item.league?.name,
              type: item.league?.type,
              country: item.country?.name,
              logo: item.league?.logo,
              seasons: item.seasons?.map((s: any) => s.year),
            }))
          : [],
      });
    } 

    /**
     * MODO 2:
     * Buscar jogos da Copa.
     *
     * Se o ID da liga for diferente de 1, teste assim:
     * /api/worldcup-fixtures?debug=1&league=ID_CORRETO
     */
    const league = getParam(req.query.league) || "1";
    const from = getParam(req.query.from) || "2026-06-11";
    const to = getParam(req.query.to) || "2026-07-19";

    const url = `${BASE_URL}/fixtures?league=${league}&season=${season}&from=${from}&to=${to}&timezone=America/Sao_Paulo`;

    const response = await fetch(url, {
      headers: {
        "x-apisports-key": apiKey,
      },
    });

    const data = await response.json();

    if (debug) {
      return res.status(200).json({
        mode: "fixtures-debug",
        apiStatus: response.status,
        queryUsed: {
          league,
          season,
          from,
          to,
          timezone: "America/Sao_Paulo",
        },
        results: data.results,
        errors: data.errors,
        parameters: data.parameters,
        paging: data.paging,
        firstRawItems: Array.isArray(data.response)
          ? data.response.slice(0, 3)
          : [],
      });
    }

    const fixtures = Array.isArray(data.response) ? data.response : [];

    const matches = fixtures.map((item: any) => {
      const fixture = item.fixture;
      const leagueData = item.league;
      const teams = item.teams;
      const goals = item.goals;

      const dateObj = new Date(fixture.date);

      return {
        id: String(fixture.id),
        apiFixtureId: fixture.id,

        dateISO: fixture.date,
        date: new Intl.DateTimeFormat("pt-BR", {
          timeZone: "America/Sao_Paulo",
        }).format(dateObj),
        time: new Intl.DateTimeFormat("pt-BR", {
          timeZone: "America/Sao_Paulo",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).format(dateObj),

        group: leagueData?.round || "Copa do Mundo",

        teamA: teams?.home?.name,
        teamB: teams?.away?.name,

        logoA: teams?.home?.logo,
        logoB: teams?.away?.logo,

        scoreA: goals?.home,
        scoreB: goals?.away,

        status: normalizeStatus(fixture?.status?.short),
        statusShort: fixture?.status?.short,
        statusLong: fixture?.status?.long,

        venue: fixture?.venue?.name,
        city: fixture?.venue?.city,
      };
    });

    return res.status(200).json({
      matches,
      total: matches.length,
      syncedAt: new Date().toISOString(),
      queryUsed: {
        league,
        season,
        from,
        to,
      },
      apiInfo: {
        results: data.results,
        errors: data.errors,
        parameters: data.parameters,
      },
    });
  } catch (error: any) {
    return res.status(500).json({
      message: "Erro ao buscar jogos da API-Football.",
      error: error?.message || String(error),
    });
  }
}