import type { Match } from '../types';

// Representa uma partida recebida pela rota da Copa.
//
// O tipo possui todos os campos de Match
// e também mantém informações da fonte externa:
//
// externalFixtureId:
// ID original da partida na API externa.
//
// externalStatus:
// status original recebido da API,
// antes de ser convertido para o status usado pelo projeto.
export type WorldCupApiMatch =
  Match & {
    externalFixtureId: number;
    externalStatus: string;
  };

// Formato completo que o frontend espera
// receber da rota /api/worldcup-fixtures.
type WorldCupFixturesResponse = {
  matches: WorldCupApiMatch[];
  total: number;
  syncedAt: string;
};

// Verifica se um valor desconhecido
// é um objeto comum.
//
// Isso permite validar a resposta da API
// antes de acessar propriedades como matches.
function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}

// Verifica se a resposta possui
// a estrutura principal esperada.
//
// A função confirma que:
// - a resposta é um objeto;
// - matches é um array;
// - total é um número finito;
// - syncedAt é uma string.
//
// Essa validação acontece em tempo de execução,
// porque o TypeScript não controla os dados
// que chegam por uma requisição HTTP.
function isWorldCupFixturesResponse(
  value: unknown
): value is WorldCupFixturesResponse {
  if (!isRecord(value)) {
    return false;
  }

  return (
    Array.isArray(value.matches) &&
    typeof value.total === 'number' &&
    Number.isFinite(value.total) &&
    typeof value.syncedAt === 'string'
  );
}

// Busca as partidas da Copa através
// da rota interna /api/worldcup-fixtures.
//
// Como a função é async, ela retorna uma Promise.
// Quando a requisição terminar com sucesso,
// a Promise entregará uma lista de WorldCupApiMatch.
export async function fetchWorldCupFixtures():
  Promise<WorldCupApiMatch[]> {
  // fetch realiza uma requisição HTTP.
  //
  // Como o caminho começa com /,
  // a chamada utiliza o mesmo domínio do site.
  const response = await fetch(
    '/api/worldcup-fixtures',
    {
      method: 'GET',

      // Informa ao servidor que o frontend
      // espera receber uma resposta em JSON.
      headers: {
        Accept: 'application/json',
      },
    }
  );

  // response.ok é true para respostas HTTP
  // bem-sucedidas, normalmente entre 200 e 299.
  //
  // O ! inverte o valor:
  // se response.ok for false, entra neste bloco.
  if (!response.ok) {
    // Tenta recuperar uma mensagem enviada
    // pelo próprio servidor.
    const errorBody =
      await safeReadError(response);

    // O optional chaining ?. evita acessar message
    // caso errorBody seja null.
    //
    // O operador ?? utiliza a mensagem padrão
    // quando errorBody?.message for null ou undefined.
    const errorMessage =
      errorBody?.message ??
      `Erro ao buscar jogos da Copa. Status: ${response.status}`;

    // throw interrompe a função e devolve
    // o erro para quem chamou o service.
    throw new Error(errorMessage);
  }

  // response.json() lê o corpo da resposta
  // e transforma o JSON em um valor JavaScript.
  //
  // O resultado começa como unknown porque
  // ainda não validamos seu formato real.
  const data: unknown =
    await response.json();

  // Confirma que a resposta possui
  // a estrutura principal esperada.
  //
  // Se a rota devolver null, texto, HTML
  // ou um objeto diferente, a função termina com erro.
  if (
    !isWorldCupFixturesResponse(data)
  ) {
    throw new Error(
      'Resposta inválida ao buscar jogos da Copa.'
    );
  }

  // Depois da validação, o TypeScript entende
  // que data possui o formato WorldCupFixturesResponse.
  //
  // A função devolve apenas a lista de partidas.
  // total e syncedAt continuam disponíveis na resposta,
  // mas não são usados por este service.
  return data.matches;
}

// Tenta ler o corpo de uma resposta com erro.
//
// Algumas respostas possuem um JSON como:
//
// {
//   "message": "API indisponível"
// }
//
// Outras podem retornar texto, HTML ou nenhum corpo.
// Nesses casos, response.json() lança um erro
// e a função devolve null.
async function safeReadError(
  response: Response
): Promise<{
  message?: string;
} | null> {
  try {
    const data: unknown =
      await response.json();

    // O corpo precisa ser um objeto
    // para possuir a propriedade message.
    if (!isRecord(data)) {
      return null;
    }

    // A mensagem só é aproveitada
    // quando realmente é uma string.
    if (
      typeof data.message !== 'string'
    ) {
      return null;
    }

    const message =
      data.message.trim();

    // Mensagens vazias não são aproveitadas.
    if (!message) {
      return null;
    }

    return {
      message,
    };
  } catch {
    // Entra aqui quando o corpo da resposta
    // não pode ser interpretado como JSON.
    return null;
  }
}