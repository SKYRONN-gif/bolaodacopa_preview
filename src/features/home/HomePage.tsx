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
import type { ChampionPickSettings } from '../../types';

interface HomePageProps {
  totalPrizePool: number;
  firstPrize: number;
  secondPrize: number;
  participantsCount: number;
  championPickSettings: ChampionPickSettings;
  onGoToMatches: () => void;
  onGoToRanking: () => void;
}

export function HomePage({
  totalPrizePool,
  firstPrize,
  secondPrize,
  participantsCount,
  championPickSettings,
  onGoToMatches,
  onGoToRanking,
}: HomePageProps) {
  return (
    <div className="space-y-6" id="home-view">
      <section className="app-card app-card-padding">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          {/* Coluna da esquerda */}
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-800">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Bolão sincronizado em tempo real</span>
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-black leading-tight tracking-tight text-slate-900 md:text-3xl">
                Faça seus palpites com calma e acompanhe a disputa da Copa.
              </h2>

              <p className="max-w-2xl text-sm leading-relaxed text-slate-600">
                O app salva os palpites, calcula a pontuação automaticamente e
                ajuda a compartilhar tudo no WhatsApp sem planilhas soltas.
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-1 sm:flex-row">
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

            {/* Mini cards: agora ficam dentro da coluna esquerda */}
            <div className="grid max-w-3xl grid-cols-1 gap-3 pt-4 sm:grid-cols-3">
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
          </div>

          {/* Coluna da direita */}
          <div className="space-y-4">
            <aside className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    Prêmio total
                  </p>

                  <p className="text-2xl font-black text-emerald-700">
                    R$ {totalPrizePool.toFixed(2)}
                  </p>
                </div>

                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                  <Trophy className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-4 space-y-3">
                <div>
                  <div className="flex justify-between text-sm font-bold text-slate-800">
                    <span>1º lugar</span>
                    <span>R$ {firstPrize.toFixed(2)}</span>
                  </div>

                  <p className="mt-0.5 text-xs text-slate-500">
                    Recebe 80% do valor arrecadado.
                  </p>

                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full bg-emerald-700"
                      style={{ width: '80%' }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-sm font-bold text-slate-800">
                    <span>2º lugar</span>
                    <span>R$ {secondPrize.toFixed(2)}</span>
                  </div>

                  <p className="mt-0.5 text-xs text-slate-500">
                    Recebe 20% do valor arrecadado.
                  </p>

                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full bg-slate-500"
                      style={{ width: '20%' }}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-3 text-xs text-slate-600">
                <span>Participantes pagantes</span>
                <strong className="text-slate-900">{participantsCount}</strong>
              </div>

              <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
                <span>Entrada por pessoa</span>
                <strong className="text-slate-900">R$ 10,00</strong>
              </div>
            </aside>

            <ChampionPickCard
  bonusPoints={championPickSettings.bonusPoints}
  isOpen={championPickSettings.enabled && !championPickSettings.locked}
  eligibleTeamsCount={championPickSettings.eligibleTeams.length}
/>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <article className="app-card space-y-3 p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-xs font-black text-amber-700">
            3
          </div>

          <div>
            <h3 className="text-base font-bold text-slate-900">
              Acerto exato
            </h3>

            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Você acerta o placar certinho dos dois times. Exemplo: palpite
              2x1 e resultado 2x1.
            </p>
          </div>
        </article>

        <article className="app-card space-y-3 p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-xs font-black text-blue-700">
            1
          </div>

          <div>
            <h3 className="text-base font-bold text-slate-900">
              Acerto parcial
            </h3>

            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Você acerta o vencedor ou o empate, mas erra o placar exato.
              Exemplo: palpite 3x1 e resultado 1x0.
            </p>
          </div>
        </article>

        <article className="app-card space-y-3 p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-xs font-black text-slate-700">
            0
          </div>

          <div>
            <h3 className="text-base font-bold text-slate-900">
              Erro
            </h3>

            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Quando o resultado do jogo não bate com o seu palpite. Nesse caso,
              a partida não soma pontos.
            </p>
          </div>
        </article>
      </section>

      <section className="app-card p-5 md:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-emerald-100 bg-emerald-50 text-emerald-700">
            <MessageSquare className="h-5 w-5" />
          </div>

          <div className="space-y-3">
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                Como o bolão funciona?
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                A ideia é deixar tudo simples no celular e transparente para
                quem administra.
              </p>
            </div>

            <ol className="list-inside list-decimal space-y-2 text-sm leading-relaxed text-slate-600">
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

      <section className="flex items-start gap-3 rounded-xl border border-emerald-100 bg-emerald-50 p-5">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />

        <div>
          <h3 className="text-sm font-bold text-emerald-950">
            Regra importante
          </h3>

          <p className="mt-1 text-xs leading-relaxed text-emerald-800">
            Os palpites devem ser enviados antes da partida começar. Depois do
            horário do jogo, o sistema bloqueia alterações.
          </p>
        </div>
      </section>
    </div>
  );
}