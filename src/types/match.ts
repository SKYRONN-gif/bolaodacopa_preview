/**
 * Representa uma partida do bolão.
 *
 * Os dados podem vir do Firestore, de uma API externa ou de um cadastro
 * manual feito pelo admin. Essa estrutura é usada para mostrar os jogos,
 * bloquear palpites no horário correto e calcular o ranking após o fim
 * da partida.
 */
export interface Match {
  // Identificador único usado para relacionar palpites a esta partida.
  id: string;

  // A ordem dos times precisa ser mantida no palpite e no placar final.
  teamA: string;
  teamB: string;

  // Campos mantidos por compatibilidade com o app atual.
  // Podem conter bandeiras, emojis ou siglas como BRA, ARG e FRA.
  flagA: string;
  flagB: string;

  // Campos voltados principalmente para exibição na tela.
  date: string; // Exemplo: "13/06/2026"
  time: string; // Exemplo: "16:00"

  /**
   * Representações completas do início da partida.
   *
   * startsAt é usado pelo React/JavaScript para trabalhar com data e hora.
   * startsAtMs é usado pelas Firestore Rules para bloquear palpites depois
   * que o horário da partida foi atingido.
   */
  startsAt: string;
  startsAtMs: number;

  // Define se o jogo ainda está agendado ou já possui resultado final.
  status: 'scheduled' | 'finished';

  // Só devem existir quando a partida estiver finalizada.
  scoreA?: number;
  scoreB?: number;

  group: string;
  venue?: string;
  city?: string;

  /**
   * Dados adicionais usados quando a partida veio de uma fonte externa.
   *
   * apiFixtureId ajuda a identificar o mesmo jogo na API e evita duplicações.
   * logoA e logoB são URLs usadas na interface.
   * source registra a origem dos dados.
   */
  apiFixtureId?: string;
  logoA?: string | null;
  logoB?: string | null;
  source?: 'espn' | 'openfootball' | string;
}