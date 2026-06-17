import {
  CalendarClock,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
  Zap,
} from 'lucide-react';
import { ChampionPickCard } from '../championPick/ChampionPickCard';

interface HomePageProps {
  totalPrizePool: number;
  firstPrize: number;
  secondPrize: number;
  participantsCount: number;
  onGoToMatches: () => void;
  onGoToRanking: () => void;
}

export function HomePage({
  totalPrizePool,
  firstPrize,
  secondPrize,
  participantsCount,
  onGoToMatches,
  onGoToRanking,
}: HomePageProps) {
  return (
    <div className="space-y-6" id="home-view">
      <section className="app-card app-card-padding">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-800 font-bold text-[11px] px-3 py-1.5 rounded-lg border border-emerald-100">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Bolão sincronizado em tempo real</span>
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900 leading-tight">
                Faça seus palpites com calma e acompanhe a disputa da Copa.
              </h2>

              <p className="text-sm text-slate-600 leading-relaxed max-w-2xl">
                O app salva os palpites, calcula a pontuação automaticamente e
                ajuda a compartilhar tudo no WhatsApp sem planilhas soltas.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <button
                type="button"
                onClick={onGoToMatches}
                className="app-button-primary py-2.5"
              >
                Fazer meus palpites
              </button>

              <button
                type="button"
                onClick={onGoToRanking}
                className="app-button-secondary"
              >
                Ver classificação
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 max-w-3xl">
  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
    <div className="flex items-center gap-2 text-emerald-700">
      <Users className="h-4 w-4" />
      <span className="text-[11px] font-black uppercase tracking-wide">
        Participantes
      </span>
    </div>

    <p className="mt-2 text-xl font-black text-slate-950">
      {participantsCount}
    </p>

    <p className="mt-1 text-xs font-semibold text-slate-500">
      Entraram no prêmio total.
    </p>
  </div>

  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
    <div className="flex items-center gap-2 text-amber-700">
      <CalendarClock className="h-4 w-4" />
      <span className="text-[11px] font-black uppercase tracking-wide">
        Bloqueio
      </span>
    </div>

    <p className="mt-2 text-xl font-black text-slate-950">
      No horário
    </p>

    <p className="mt-1 text-xs font-semibold text-slate-500">
      Começou o jogo, o palpite trava.
    </p>
  </div>

  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
    <div className="flex items-center gap-2 text-blue-700">
      <Zap className="h-4 w-4" />
      <span className="text-[11px] font-black uppercase tracking-wide">
        Ranking
      </span>
    </div>

    <p className="mt-2 text-xl font-black text-slate-950">
      Auto
    </p>

    <p className="mt-1 text-xs font-semibold text-slate-500">
      Pontuação recalculada após resultado.
    </p>
  </div>
</div>

          <div className="space-y-4">
  <aside className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-200">
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                  Prêmio total
                </p>

                <p className="text-2xl font-black text-emerald-700">
                  R$ {totalPrizePool.toFixed(2)}
                </p>
              </div>

              <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <Trophy className="w-5 h-5" />
              </div>
            </div>

            <div className="space-y-3 mt-4">
              <div>
                <div className="flex justify-between text-sm font-bold text-slate-800">
                  <span>1º lugar</span>
                  <span>R$ {firstPrize.toFixed(2)}</span>
                </div>

                <p className="text-xs text-slate-500 mt-0.5">
                  Recebe 80% do valor arrecadado.
                </p>

                <div className="w-full bg-slate-200 h-2 rounded-full mt-2 overflow-hidden">
                  <div className="bg-emerald-700 h-full" style={{ width: '80%' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm font-bold text-slate-800">
                  <span>2º lugar</span>
                  <span>R$ {secondPrize.toFixed(2)}</span>
                </div>

                <p className="text-xs text-slate-500 mt-0.5">
                  Recebe 20% do valor arrecadado.
                </p>

                <div className="w-full bg-slate-200 h-2 rounded-full mt-2 overflow-hidden">
                  <div className="bg-slate-500 h-full" style={{ width: '20%' }} />
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
              <span>Participantes pagantes</span>
              <strong className="text-slate-900">{participantsCount}</strong>
            </div>

            <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
              <span>Entrada por pessoa</span>
              <strong className="text-slate-900">R$ 10,00</strong>
            </div>
            </aside>

  <ChampionPickCard bonusPoints={30} isOpen={false} />
</div>
 </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <article className="app-card p-5 space-y-3">
          <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700 font-black text-xs">
            3
          </div>

          <div>
            <h3 className="font-bold text-base text-slate-900">
              Acerto exato
            </h3>

            <p className="text-xs text-slate-500 leading-relaxed mt-1">
              Você acerta o placar certinho dos dois times. Exemplo: palpite
              2x1 e resultado 2x1.
            </p>
          </div>
        </article>

        <article className="app-card p-5 space-y-3">
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700 font-black text-xs">
            1
          </div>

          <div>
            <h3 className="font-bold text-base text-slate-900">
              Acerto parcial
            </h3>

            <p className="text-xs text-slate-500 leading-relaxed mt-1">
              Você acerta o vencedor ou o empate, mas erra o placar exato.
              Exemplo: palpite 3x1 e resultado 1x0.
            </p>
          </div>
        </article>

        <article className="app-card p-5 space-y-3">
          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700 font-black text-xs">
            0
          </div>

          <div>
            <h3 className="font-bold text-base text-slate-900">
              Erro
            </h3>

            <p className="text-xs text-slate-500 leading-relaxed mt-1">
              Quando o resultado do jogo não bate com o seu palpite. Nesse
              caso, a partida não soma pontos.
            </p>
          </div>
        </article>
      </section>

      <section className="app-card p-5 md:p-6">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-100">
            <MessageSquare className="w-5 h-5" />
          </div>

          <div className="space-y-3">
            <div>
              <h3 className="font-bold text-lg text-slate-900">
                Como o bolão funciona?
              </h3>

              <p className="text-sm text-slate-500 mt-1">
                A ideia é deixar tudo simples no celular e transparente para
                quem administra.
              </p>
            </div>

            <ol className="space-y-2 text-sm text-slate-600 leading-relaxed list-decimal list-inside">
              <li>Entre com sua conta Google para criar seu perfil.</li>
              <li>Faça seus palpites antes do início das partidas.</li>
              <li>
                Depois que o admin lançar o resultado oficial, o ranking é
                recalculado automaticamente.
              </li>
              <li>
                Use os botões de compartilhamento para mandar seus palpites no
                WhatsApp.
              </li>
            </ol>
          </div>
        </div>
      </section>

      <section className="bg-emerald-50 border border-emerald-100 rounded-xl p-5 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />

        <div>
          <h3 className="font-bold text-sm text-emerald-950">
            Regra importante
          </h3>

          <p className="text-xs text-emerald-800 leading-relaxed mt-1">
            Os palpites devem ser enviados antes da partida começar. Depois do
            horário do jogo, o sistema bloqueia alterações.
          </p>
        </div>
      </section>
    </div>
  );
}
