import {
  doc,
  getDoc,
  onSnapshot,
  setDoc,
} from 'firebase/firestore';

import { db } from '../firebase';
import type {
  ChampionPick,
  ChampionPickSettings,
  ChampionPickTeam,
  Player,
} from '../types';

// Referência para o documento que guarda
// as configurações gerais da Bolsa Campeão.
//
// doc() apenas monta o endereço settings/championPick.
// A leitura ou gravação acontece somente quando essa referência
// é usada por getDoc, setDoc ou onSnapshot.
const CHAMPION_PICK_SETTINGS_REF = doc(
  db,
  'settings',
  'championPick'
);

// Configuração utilizada quando o documento ainda não existe
// ou quando os dados recebidos não possuem um formato válido.
export const DEFAULT_CHAMPION_PICK_SETTINGS: ChampionPickSettings = {
  enabled: false,
  locked: false,
  bonusPoints: 30,
  championTeamCode: '',
  eligibleTeams: [],
  eligibleTeamCodes: [],
};

// Verifica se um valor desconhecido é um objeto comum.
//
// A função rejeita null e arrays. Quando retorna true,
// o TypeScript passa a permitir o acesso às propriedades do objeto.
function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}

// Recebe um valor desconhecido e tenta produzir
// uma string limpa e limitada.
//
// Se o valor não for uma string ou ficar vazio depois do trim,
// a função retorna o fallback informado.
function cleanString(
  value: unknown,
  fallback = '',
  maxLength = 128
) {
  if (typeof value !== 'string') {
    return fallback;
  }

  const trimmed = value.trim();

  return trimmed
    ? trimmed.slice(0, maxLength)
    : fallback;
}

// Recebe um número ou uma string numérica
// e tenta produzir um número válido.
//
// Strings com vírgula são convertidas para o formato com ponto.
// Quando a conversão falha, retorna o fallback.
function cleanNumber(
  value: unknown,
  fallback = 0
) {
  const parsedValue =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value.replace(',', '.'))
        : Number.NaN;

  return Number.isFinite(parsedValue)
    ? parsedValue
    : fallback;
}

// Normaliza o e-mail para utilizá-lo como ID
// do documento em championPicks/{email}.
//
// O optional chaining evita chamar trim()
// quando o e-mail for null ou undefined.
//
// Caso o resultado fique vazio, a função lança um erro
// e impede a criação de um documento sem identificação.
function getChampionPickDocumentId(
  playerEmail?: string | null
) {
  const normalizedEmail =
    playerEmail?.trim().toLowerCase() || '';

  if (!normalizedEmail) {
    throw new Error(
      'champion-pick-email-required'
    );
  }

  return normalizedEmail;
}

// Tenta transformar um valor desconhecido
// em uma seleção válida para a Bolsa Campeão.
//
// Código e nome são obrigatórios.
// O logo é opcional e fica como null quando não existir.
function cleanChampionPickTeam(
  value: unknown
): ChampionPickTeam | null {
  if (!isRecord(value)) {
    return null;
  }

  const code = cleanString(
    value.code,
    '',
    20
  ).toUpperCase();

  const name = cleanString(
    value.name,
    '',
    100
  );

  const logo = cleanString(
    value.logo,
    '',
    500
  );

  if (!code || !name) {
    return null;
  }

  return {
    code,
    name,
    logo: logo || null,
  };
}

// Normaliza uma lista de seleções.
//
// O map tenta converter cada item em ChampionPickTeam.
// Os itens inválidos retornam null e são removidos pelo filter.
//
// O type guard do filter informa ao TypeScript
// que o array final possui apenas seleções válidas.
//
// Por fim, a lista é limitada a 64 itens.
function cleanEligibleTeams(
  value: unknown
): ChampionPickTeam[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(cleanChampionPickTeam)
    .filter(
      (team): team is ChampionPickTeam =>
        Boolean(team)
    )
    .slice(0, 64);
}

// Converte os dados brutos do Firestore
// para o formato ChampionPickSettings.
//
// Quando o valor não é um objeto, utiliza a configuração padrão.
// Os campos restantes são limpos e recebem valores seguros.
function normalizeChampionPickSettings(
  value: unknown
): ChampionPickSettings {
  if (!isRecord(value)) {
    return DEFAULT_CHAMPION_PICK_SETTINGS;
  }

  // cleanNumber tenta obter o bônus.
  // Math.max impede que o resultado fique negativo.
  const bonusPoints = Math.max(
    0,
    cleanNumber(value.bonusPoints, 30)
  );

  const eligibleTeams =
    cleanEligibleTeams(value.eligibleTeams);

  // Quando eligibleTeamCodes existe como array,
  // cada código é limpo e transformado em maiúsculas.
  //
  // Caso o campo não exista, os códigos são criados
  // a partir das seleções já normalizadas.
  const eligibleTeamCodes =
    Array.isArray(value.eligibleTeamCodes)
      ? value.eligibleTeamCodes
          .map((code) =>
            cleanString(
              code,
              '',
              20
            ).toUpperCase()
          )
          .filter(Boolean)
      : eligibleTeams.map(
          (team) => team.code
        );

  return {
    // Somente o booleano true é aceito.
    // Valores como "true" ou 1 resultam em false.
    enabled: value.enabled === true,
    locked: value.locked === true,

    bonusPoints,

    championTeamCode: cleanString(
      value.championTeamCode,
      '',
      20
    ).toUpperCase(),

    eligibleTeams,
    eligibleTeamCodes,

    updatedAt: cleanString(
      value.updatedAt,
      '',
      40
    ),
  };
}

// Converte um documento bruto do Firestore
// em uma escolha válida da Bolsa Campeão.
//
// Se qualquer campo obrigatório estiver vazio,
// o documento é rejeitado e a função retorna null.
function normalizeChampionPick(
  value: unknown
): ChampionPick | null {
  if (!isRecord(value)) {
    return null;
  }

  const playerId = cleanString(
    value.playerId,
    '',
    128
  );

  const playerEmail = cleanString(
    value.playerEmail,
    '',
    160
  ).toLowerCase();

  const playerName = cleanString(
    value.playerName,
    '',
    128
  );

  const teamCode = cleanString(
    value.teamCode,
    '',
    20
  ).toUpperCase();

  const teamName = cleanString(
    value.teamName,
    '',
    100
  );

  const teamLogo = cleanString(
    value.teamLogo,
    '',
    500
  );

  const createdAt = cleanString(
    value.createdAt,
    '',
    40
  );

  if (
    !playerId ||
    !playerEmail ||
    !playerName ||
    !teamCode ||
    !teamName ||
    !createdAt
  ) {
    return null;
  }

  return {
    playerId,
    playerEmail,
    playerName,
    teamCode,
    teamName,
    teamLogo: teamLogo || null,
    createdAt,
  };
}

// Faz uma leitura única das configurações.
//
// O await pausa somente a execução desta função
// até que o Firestore responda.
//
// Se o documento não existir, retorna o padrão.
// Caso exista, os dados passam pelo normalizador.
export async function getChampionPickSettings() {
  const snapshot = await getDoc(
    CHAMPION_PICK_SETTINGS_REF
  );

  if (!snapshot.exists()) {
    return DEFAULT_CHAMPION_PICK_SETTINGS;
  }

  return normalizeChampionPickSettings(
    snapshot.data()
  );
}

// Prepara e salva as configurações gerais.
//
// O map cria um novo array com os campos das seleções limpos.
// Depois, eligibleTeamCodes é reconstruído a partir desse array.
//
// merge: true atualiza os campos enviados sem apagar
// outros campos que possam existir no documento.
export async function saveChampionPickSettings(
  settings: ChampionPickSettings
): Promise<void> {
  const eligibleTeams =
    settings.eligibleTeams.map((team) => ({
      code: team.code
        .trim()
        .toUpperCase(),

      name: team.name.trim(),

      logo:
        team.logo?.trim() || null,
    }));

  const eligibleTeamCodes =
    eligibleTeams.map(
      (team) => team.code
    );

  await setDoc(
    CHAMPION_PICK_SETTINGS_REF,
    {
      enabled: settings.enabled,
      locked: settings.locked,
      bonusPoints: settings.bonusPoints,

      championTeamCode:
        settings.championTeamCode
          .trim()
          .toUpperCase(),

      eligibleTeams,
      eligibleTeamCodes,

      // Registra o momento do salvamento
      // como uma string no formato ISO.
      updatedAt:
        new Date().toISOString(),
    },
    {
      merge: true,
    }
  );
}

// Mantém as configurações sincronizadas em tempo real.
//
// O onSnapshot executa o callback sempre que o documento muda.
// Quando o documento não existe, entrega a configuração padrão.
//
// O retorno do onSnapshot é a função unsubscribe,
// utilizada pelo hook para encerrar a inscrição.
export function subscribeToChampionPickSettings({
  onData,
  onError,
}: {
  onData: (
    settings: ChampionPickSettings
  ) => void;

  onError: (error: unknown) => void;
}) {
  return onSnapshot(
    CHAMPION_PICK_SETTINGS_REF,

    (snapshot) => {
      if (!snapshot.exists()) {
        onData(
          DEFAULT_CHAMPION_PICK_SETTINGS
        );

        return;
      }

      const normalizedSettings =
        normalizeChampionPickSettings(
          snapshot.data()
        );

      onData(normalizedSettings);
    },

    (error) => {
      onError(error);
    }
  );
}

// Mantém sincronizada a escolha de um jogador específico.
//
// O e-mail é normalizado e utilizado para montar o caminho:
// championPicks/{email-normalizado}.
//
// Quando o e-mail é inválido, nenhum listener é aberto.
// Nesse caso, retorna uma função vazia para manter
// o mesmo formato de cleanup esperado pelo hook.
export function subscribeToChampionPick({
  playerEmail,
  onData,
  onError,
}: {
  playerEmail: string;

  onData: (
    pick: ChampionPick | null
  ) => void;

  onError: (error: unknown) => void;
}) {
  let pickDocumentId = '';

  try {
    pickDocumentId =
      getChampionPickDocumentId(
        playerEmail
      );
  } catch {
    onData(null);

    return () => {};
  }

  // Abre uma inscrição em tempo real
  // no documento da escolha do jogador.
  return onSnapshot(
    doc(
      db,
      'championPicks',
      pickDocumentId
    ),

    (snapshot) => {
      // Documento ausente significa que o jogador
      // ainda não possui uma escolha salva.
      if (!snapshot.exists()) {
        onData(null);
        return;
      }

      const normalizedPick =
        normalizeChampionPick(
          snapshot.data()
        );

      onData(normalizedPick);
    },

    (error) => {
      // O comportamento atual limpa a escolha local
      // quando o listener falha e depois repassa o erro.
      onData(null);
      onError(error);
    }
  );
}

// Monta e salva a escolha de um jogador.
//
// A função normaliza o e-mail e os dados da seleção,
// cria o objeto ChampionPick e grava em:
//
// championPicks/{email-normalizado}
//
// Como setDoc não utiliza merge: true,
// uma escolha anterior com o mesmo ID é substituída.
export async function saveChampionPick(
  player: Player,
  team: ChampionPickTeam
): Promise<ChampionPick> {
  const playerEmail =
    getChampionPickDocumentId(
      player.email
    );

  const pick: ChampionPick = {
    playerId: player.id,
    playerEmail,
    playerName: player.name,

    teamCode:
      team.code
        .trim()
        .toUpperCase(),

    teamName: team.name.trim(),

    teamLogo:
      team.logo?.trim() || null,

    createdAt:
      new Date().toISOString(),
  };

  await setDoc(
    doc(
      db,
      'championPicks',
      playerEmail
    ),
    pick
  );

  // Retorna o mesmo objeto salvo para que o hook
  // possa atualizar o estado local imediatamente.
  return pick;
}