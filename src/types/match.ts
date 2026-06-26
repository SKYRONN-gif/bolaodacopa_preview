//vem do firesotore, da api dos jogos, e o cadastro manual do admin, aparece na tela dos jogos, ranking, usado nos components e representa uma partida
export interface Match {
  id: string;
  teamA: string;
  teamB: string;

  // Para jogos vindos da API, preencher com siglas tipo BRA, ARG, FRA.
  flagA: string;
  flagB: string;

  date: string; // exemplo: "13/06/2026", mostra na tela
  time: string; // HH:MM ex: 16:00 mostra na tela

  startsAt: string; // data ISO usada pelo React/JavaScript
  startsAtMs: number; // horário em milissegundos usado para comparações seguras nas Rules

  status: 'scheduled' | 'finished';

  scoreA?: number; // placar real, apenas se finalizado
  scoreB?: number; // placar real, apenas se finalizado

  group: string;
  venue?: string;
  city?: string;

  // Campos vindos da API
  apiFixtureId?: string; // identificador do jogo na fonte externa
  logoA?: string | null; // URL da logo, null ou campo ausente
  logoB?: string | null;
  source?: 'espn' | 'openfootball' | string; //origem dos dados, como ESPN ou OpenFootball.
}
