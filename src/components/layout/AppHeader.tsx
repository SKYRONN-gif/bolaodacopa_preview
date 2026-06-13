import { FormEvent, useEffect, useState } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { Check, Loader2, LogOut, Pencil, Trophy, X } from 'lucide-react';
import { AVAILABLE_AVATARS, DEFAULT_AVATAR } from '../../config/avatars';

interface AppHeaderProps {
  currentUser: FirebaseUser | null;
  displayName?: string;
  avatar?: string;
  points: number;
  totalPrizePool: number;
  canEditProfile: boolean;
  onLogin: () => void;
  onLogout: () => void;
  onUpdateProfile: (name: string, avatar: string) => Promise<void>;
}

export function AppHeader({
  currentUser,
  displayName,
  avatar,
  points,
  totalPrizePool,
  canEditProfile,
  onLogin,
  onLogout,
  onUpdateProfile,
}: AppHeaderProps) {
  const resolvedName = displayName || currentUser?.displayName || 'Jogador';
  const resolvedAvatar = avatar || DEFAULT_AVATAR;
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [draftName, setDraftName] = useState(resolvedName);
  const [draftAvatar, setDraftAvatar] = useState(resolvedAvatar);
  const [profileError, setProfileError] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  useEffect(() => {
    if (isEditingProfile) return;

    setDraftName(resolvedName);
    setDraftAvatar(resolvedAvatar);
    setProfileError('');
  }, [isEditingProfile, resolvedAvatar, resolvedName]);

  const closeProfileEditor = () => {
    if (isSavingProfile) return;

    setIsEditingProfile(false);
    setDraftName(resolvedName);
    setDraftAvatar(resolvedAvatar);
    setProfileError('');
  };

  const handleSubmitProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedName = draftName.trim();

    if (!trimmedName) {
      setProfileError('Digite um nome para aparecer no ranking.');
      return;
    }

    if (trimmedName.length > 128) {
      setProfileError('Use um nome com ate 128 caracteres.');
      return;
    }

    if (draftAvatar.length > 10) {
      setProfileError('Escolha uma foto de perfil da lista.');
      return;
    }

    try {
      setIsSavingProfile(true);
      setProfileError('');
      await onUpdateProfile(trimmedName, draftAvatar);
      setIsEditingProfile(false);
    } catch (error) {
      console.warn('Erro ao atualizar perfil:', error);
      setProfileError(
        'Nao consegui salvar no banco agora. Confira a conexao e tente novamente.'
      );
    } finally {
      setIsSavingProfile(false);
    }
  };

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

        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between md:justify-end">
          <div className="text-left md:text-right">
            <p className="text-[11px] text-emerald-100/80 uppercase font-bold tracking-wide">
              Prêmio estimado
            </p>

            <p className="text-xl font-black text-white">
              R$ {totalPrizePool.toFixed(2)}
            </p>
          </div>

          {currentUser ? (
            <div className="flex w-full items-center gap-2 rounded-lg border border-white/10 bg-white/10 px-3 py-2 sm:w-auto sm:gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/20 bg-white text-xl">
                {resolvedAvatar}
              </span>

              <div className="min-w-0 flex-1 sm:flex-none">
                <p className="text-[10px] text-emerald-100/70 uppercase font-bold">
                  Logado
                </p>

                <div className="flex items-center gap-2">
                  <span className="block max-w-[110px] truncate text-xs font-bold text-white sm:max-w-[120px]">
                    {resolvedName}
                  </span>

                  <span className="text-[10px] font-bold text-emerald-950 bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-200">
                    {points} pts
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsEditingProfile(true)}
                disabled={!canEditProfile}
                title={
                  canEditProfile
                    ? 'Editar nome e foto'
                    : 'Aguarde sincronizar seu perfil'
                }
                className="shrink-0 p-1.5 rounded-lg text-emerald-50/70 hover:text-white hover:bg-white/10 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Pencil className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={onLogout}
                title="Sair da conta"
                className="shrink-0 p-1.5 rounded-lg text-emerald-50/70 hover:text-white hover:bg-white/10 transition"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onLogin}
              className="app-button-primary flex w-full items-center justify-center gap-2 text-xs sm:w-auto"
            >
              <span className="font-black">G</span>
              <span>Entrar com Google</span>
            </button>
          )}
        </div>
      </div>

      {currentUser && isEditingProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6 backdrop-blur-sm">
          <form
            onSubmit={handleSubmitProfile}
            className="w-full max-w-sm rounded-xl border border-emerald-900/10 bg-white p-5 shadow-2xl"
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">
                  Meu perfil
                </p>

                <h2 className="text-lg font-black text-slate-950 font-display">
                  Editar nome e foto
                </h2>
              </div>

              <button
                type="button"
                onClick={closeProfileEditor}
                disabled={isSavingProfile}
                title="Fechar"
                className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <label className="block">
              <span className="app-label">Nome no ranking</span>
              <input
                type="text"
                value={draftName}
                maxLength={128}
                onChange={(event) => setDraftName(event.target.value)}
                className="app-input"
                placeholder="Seu nome"
                disabled={isSavingProfile}
              />
            </label>

            <div className="mt-4">
              <p className="app-label">Foto de perfil</p>

              <div className="grid grid-cols-5 gap-2">
                {AVAILABLE_AVATARS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setDraftAvatar(option)}
                    disabled={isSavingProfile}
                    title={`Usar ${option}`}
                    className={`flex aspect-square items-center justify-center rounded-lg border text-xl transition ${
                      draftAvatar === option
                        ? 'border-[#087a4b] bg-emerald-50 ring-2 ring-[#087a4b]/20'
                        : 'border-slate-200 bg-slate-50 hover:border-emerald-300 hover:bg-emerald-50'
                    } disabled:opacity-60`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            {profileError && (
              <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                {profileError}
              </p>
            )}

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeProfileEditor}
                disabled={isSavingProfile}
                className="app-button-secondary text-xs"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={isSavingProfile}
                className="app-button-primary flex items-center gap-2 text-xs disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSavingProfile ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                <span>Salvar</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </header>
  );
}
