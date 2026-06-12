import { User as FirebaseUser } from 'firebase/auth';
import { LogOut, Trophy } from 'lucide-react';

interface AppHeaderProps {
  currentUser: FirebaseUser | null;
  avatar?: string;
  points: number;
  totalPrizePool: number;
  onLogin: () => void;
  onLogout: () => void;
}

export function AppHeader({
  currentUser,
  avatar,
  points,
  totalPrizePool,
  onLogin,
  onLogout,
}: AppHeaderProps) {
  return (
    <header className="bg-[#063f2d] border-b border-[#0a5a40] px-4 py-4 md:px-6 shrink-0 shadow-sm">
      <div className="max-w-6xl mx-auto flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="bg-[#0a8f5a] p-2 rounded-lg text-white shadow-sm shrink-0">
            <Trophy className="w-6 h-6" />
          </div>

          <div className="text-left">
            <p className="text-xs font-semibold text-emerald-200 uppercase tracking-wide">
              Bolão da Copa 2026
            </p>

            <h1 className="text-xl md:text-2xl font-black tracking-tight text-white leading-tight">
              Acompanhe seus palpites
            </h1>

            <p className="text-sm text-emerald-50/80 mt-1 max-w-xl">
              Veja os jogos, salve seus palpites e acompanhe a classificação do
              bolão.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 md:justify-end">
          <div className="text-left md:text-right">
            <p className="text-[11px] text-emerald-100/80 uppercase font-bold tracking-wide">
              Prêmio estimado
            </p>

            <p className="text-xl font-black text-white">
              R$ {totalPrizePool.toFixed(2)}
            </p>
          </div>

          {currentUser ? (
            <div className="flex items-center gap-3 border border-white/10 rounded-lg px-3 py-2 bg-white/10">
              <span className="text-xl h-9 w-9 bg-white rounded-lg flex items-center justify-center border border-white/20">
                {avatar || '⚽'}
              </span>

              <div className="min-w-0">
                <p className="text-[10px] text-emerald-100/70 uppercase font-bold">
                  Logado
                </p>

                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs text-white max-w-[120px] truncate block">
                    {currentUser.displayName || 'Jogador'}
                  </span>

                  <span className="text-[10px] font-bold text-emerald-950 bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-200">
                    {points} pts
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={onLogout}
                title="Sair da conta"
                className="p-1.5 rounded-lg text-emerald-50/70 hover:text-white hover:bg-white/10 transition"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onLogin}
              className="app-button-primary text-xs flex items-center gap-2"
            >
              <span className="font-black">G</span>
              <span>Entrar com Google</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
