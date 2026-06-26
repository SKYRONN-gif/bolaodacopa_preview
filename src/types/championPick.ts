//conf da bolsa campeao, aparece na tela de escolha e no banco, vai para champpionpicksettings e nos palpites (qual o caminho disso no codigo?) representa uma seleção
export interface ChampionPickTeam {
  code: string; //'BRA'
  name: string; //'Brasil'
  logo?: string | null; //A logo 'https://...'
}

//vem do championpick (dentro do meu championpick tem 3 arquivos), aparece no home e admin, e controla se a bolsa estaá aberta
export interface ChampionPickSettings {
  enabled: boolean; //ativo ou desativo
  locked: boolean; //bloqueado ou nn
  bonusPoints: number; //quantidade de bonus
  championTeamCode: string; //código da seleção
  eligibleTeams: ChampionPickTeam[]; //usado pela interface para mostrar nome, código e logo.
  eligibleTeamCodes: string[]; //usado para validação simples e segura. pega só o code da championpickteam
  updatedAt?: string;
}

//é a escolha que o cliente faz, registra a seleção escolhida
export interface ChampionPick {
  playerId: string; //salva o id do player que selecionou a sleeção
  playerEmail: string; //email dele
  playerName: string; //nome dele
  //restante que tem no championpickteam e picksettings
  teamCode: string;
  teamName: string;
  teamLogo?: string | null;
  createdAt: string;
}