import { Match, Player } from '../../types';

type EditedPredictions = Record<
  string,
  {
    scoreA: string;
    scoreB: string;
  }
>;

interface ShareTextParams {
  matches: Match[];
  userPlayer: Player;
  editedPreds: EditedPredictions;
}

interface SingleShareTextParams {
  match: Match;
  userPlayer: Player;
  editedPreds: EditedPredictions;
}

interface WhatsAppShareTextParams extends ShareTextParams {
  pageUrl: string;
}

function getPredictionScore({
  match,
  userPlayer,
  editedPreds,
}: SingleShareTextParams) {
  const prediction = userPlayer.predictions[match.id];

  const scoreA =
    editedPreds[match.id]?.scoreA ?? prediction?.scoreA?.toString() ?? '0';

  const scoreB =
    editedPreds[match.id]?.scoreB ?? prediction?.scoreB?.toString() ?? '0';

  return {
    scoreA,
    scoreB,
  };
}

export function buildSinglePredictionWhatsAppText({
  match,
  userPlayer,
  editedPreds,
}: SingleShareTextParams): string {
  const { scoreA, scoreB } = getPredictionScore({
    match,
    userPlayer,
    editedPreds,
  });

  return (
    `⚽ *MEU PALPITE NO BOLÃO* ⚽\n\n` +
    `📅 *Jogo:* ${match.date} às ${match.time}\n` +
    `${match.flagA} ${match.teamA} *${scoreA}* x *${scoreB}* ${match.teamB} ${match.flagB}\n\n` +
    `Enviado pelo App *Bolão da Copa 2026*`
  );
}

export function buildAllPredictionsWhatsAppText({
  matches,
  userPlayer,
  editedPreds,
  pageUrl,
}: WhatsAppShareTextParams): string {
  let text = `🏆 *MEUS PALPITES - BOLÃO DA COPA 2026* 🏆\n\n`;

  text += `*Entrada:* R$10,00 | *Prêmios:* 80% (1º) e 20% (2º)\n`;
  text += `------------------------------------\n\n`;

  matches.forEach((match) => {
    const { scoreA, scoreB } = getPredictionScore({
      match,
      userPlayer,
      editedPreds,
    });

    text += `${match.flagA} ${match.teamA} *${scoreA}* x *${scoreB}* ${match.teamB} ${match.flagB}\n`;
    text += `📅 _${match.date} às ${match.time}_\n\n`;
  });

  text += `👉 Faça seus palpites e acompanhe o ranking: ${pageUrl}`;

  return text;
}

export function buildAllPredictionsClipboardText({
  matches,
  userPlayer,
  editedPreds,
}: ShareTextParams): string {
  let text = `MEUS PALPITES - BOLÃO DA COPA 2026\n\n`;

  text += `Entrada: R$10,00 | Prêmios: 80% (1º) e 20% (2º)\n`;
  text += `------------------------------------\n\n`;

  matches.forEach((match, index) => {
    const { scoreA, scoreB } = getPredictionScore({
      match,
      userPlayer,
      editedPreds,
    });

    text += `${index + 1}. ${match.flagA} ${match.teamA} ${scoreA} x ${scoreB} ${match.teamB} ${match.flagB}\n`;
  });

  return text;
}
