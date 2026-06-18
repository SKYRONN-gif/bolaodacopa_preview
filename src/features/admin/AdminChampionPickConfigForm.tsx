import { LockKeyhole, Plus, Save, Trash2, Trophy } from 'lucide-react';
import { useEffect, useState } from 'react';

import {
  DEFAULT_CHAMPION_PICK_SETTINGS,
  getChampionPickSettings,
  saveChampionPickSettings,
} from '../../services/championPickService';
import type { ChampionPickSettings, ChampionPickTeam } from '../../types';

interface AdminChampionPickConfigFormProps {
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

const EMPTY_TEAM_DRAFT: ChampionPickTeam = {
  code: '',
  name: '',
  logo: '',
};

function normalizeTeamDraft(team: ChampionPickTeam): ChampionPickTeam {
  return {
    code: team.code.trim().toUpperCase(),
    name: team.name.trim(),
    logo: team.logo?.trim() || null,
  };
}

function teamAlreadyExists(
  eligibleTeams: ChampionPickTeam[],
  teamCode: string
) {
  return eligibleTeams.some(
    (team) => team.code.trim().toUpperCase() === teamCode.trim().toUpperCase()
  );
}

export function AdminChampionPickConfigForm({
  onSuccess,
  onError,
}: AdminChampionPickConfigFormProps) {
  const [settings, setSettings] = useState<ChampionPickSettings>(
    DEFAULT_CHAMPION_PICK_SETTINGS
  );

  const [teamDraft, setTeamDraft] =
    useState<ChampionPickTeam>(EMPTY_TEAM_DRAFT);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadSettings() {
      try {
        const loadedSettings = await getChampionPickSettings();

        if (isMounted) {
          setSettings(loadedSettings);
        }
      } catch (error) {
        onError(
          error instanceof Error
            ? error.message
            : 'Erro ao carregar configuração da Bolsa Campeão.'
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadSettings();

    return () => {
      isMounted = false;
    };
  }, [onError]);

  const handleAddTeam = () => {
    const normalizedTeam = normalizeTeamDraft(teamDraft);

    if (!normalizedTeam.code || !normalizedTeam.name) {
      onError('Informe pelo menos o código e o nome da seleção.');
      return;
    }

    if (normalizedTeam.code.length > 20) {
      onError('O código da seleção deve ter no máximo 20 caracteres.');
      return;
    }

    if (normalizedTeam.name.length > 100) {
      onError('O nome da seleção deve ter no máximo 100 caracteres.');
      return;
    }

    if (normalizedTeam.logo && normalizedTeam.logo.length > 500) {
      onError('A URL do logo deve ter no máximo 500 caracteres.');
      return;
    }

    if (teamAlreadyExists(settings.eligibleTeams, normalizedTeam.code)) {
      onError('Essa seleção já está na lista.');
      return;
    }

    setSettings((currentSettings) => ({
      ...currentSettings,
      eligibleTeams: [...currentSettings.eligibleTeams, normalizedTeam],
    }));

    setTeamDraft(EMPTY_TEAM_DRAFT);
  };

  const handleRemoveTeam = (teamCode: string) => {
    setSettings((currentSettings) => ({
      ...currentSettings,
      eligibleTeams: currentSettings.eligibleTeams.filter(
        (team) => team.code !== teamCode
      ),
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);

    try {
      await saveChampionPickSettings({
        ...settings,
        eligibleTeams: settings.eligibleTeams.map(normalizeTeamDraft),
        championTeamCode: settings.championTeamCode.trim().toUpperCase(),
      });

      onSuccess('Configuração da Bolsa Campeão salva com sucesso.');
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : 'Erro ao salvar configuração da Bolsa Campeão.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-amber-800">
            <Trophy className="h-3.5 w-3.5" />
            Bolsa Campeão
          </div>

          <h3 className="mt-3 text-lg font-bold text-slate-900">
            Configuração da Bolsa Campeão
          </h3>

          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            Cadastre manualmente as seleções que poderão ser escolhidas quando o
            mata-mata chegar.
          </p>
        </div>

        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
          <LockKeyhole className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
        <label className="space-y-1">
          <span className="text-sm font-semibold text-slate-700">
            Bônus total
          </span>

          <input
            type="number"
            min={0}
            value={settings.bonusPoints}
            onChange={(event) =>
              setSettings((currentSettings) => ({
                ...currentSettings,
                bonusPoints: Number(event.target.value),
              }))
            }
            disabled={isLoading || isSaving}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold"
          />

          <p className="text-xs text-slate-500">
            Esse valor será dividido entre quem escolher o campeão.
          </p>
        </label>

        <label className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(event) =>
                setSettings((currentSettings) => ({
                  ...currentSettings,
                  enabled: event.target.checked,
                }))
              }
              disabled={isLoading || isSaving}
              className="h-4 w-4"
            />

            <div>
              <span className="text-sm font-bold text-slate-900">
                Liberar escolhas
              </span>

              <p className="mt-1 text-xs text-slate-500">
                Deixe desligado até o mata-mata.
              </p>
            </div>
          </div>
        </label>

        <label className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={settings.locked}
              onChange={(event) =>
                setSettings((currentSettings) => ({
                  ...currentSettings,
                  locked: event.target.checked,
                }))
              }
              disabled={isLoading || isSaving}
              className="h-4 w-4"
            />

            <div>
              <span className="text-sm font-bold text-slate-900">
                Travar escolhas
              </span>

              <p className="mt-1 text-xs text-slate-500">
                Use quando o prazo acabar.
              </p>
            </div>
          </div>
        </label>
      </div>

      <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-black text-slate-900">
              Seleções disponíveis
            </h4>

            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Adicione somente as seleções que poderão ser escolhidas pelos
              participantes.
            </p>
          </div>

          <strong className="rounded-lg bg-white px-3 py-1 text-sm font-black text-slate-900 shadow-sm">
            {settings.eligibleTeams.length}
          </strong>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[120px_1fr_1.5fr_auto]">
          <label className="space-y-1">
            <span className="text-xs font-bold text-slate-600">
              Código
            </span>

            <input
              type="text"
              value={teamDraft.code}
              onChange={(event) =>
                setTeamDraft((currentDraft) => ({
                  ...currentDraft,
                  code: event.target.value.toUpperCase(),
                }))
              }
              disabled={isLoading || isSaving}
              placeholder="BRA"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold uppercase"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs font-bold text-slate-600">
              Nome
            </span>

            <input
              type="text"
              value={teamDraft.name}
              onChange={(event) =>
                setTeamDraft((currentDraft) => ({
                  ...currentDraft,
                  name: event.target.value,
                }))
              }
              disabled={isLoading || isSaving}
              placeholder="Brasil"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs font-bold text-slate-600">
              Logo opcional
            </span>

            <input
              type="text"
              value={teamDraft.logo || ''}
              onChange={(event) =>
                setTeamDraft((currentDraft) => ({
                  ...currentDraft,
                  logo: event.target.value,
                }))
              }
              disabled={isLoading || isSaving}
              placeholder="https://..."
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold"
            />
          </label>

          <div className="flex items-end">
            <button
              type="button"
              onClick={handleAddTeam}
              disabled={isLoading || isSaving}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-800 disabled:bg-slate-400 md:w-auto"
            >
              <Plus className="h-4 w-4" />
              Adicionar
            </button>
          </div>
        </div>

        {settings.eligibleTeams.length > 0 ? (
          <div className="mt-4 space-y-2">
            {settings.eligibleTeams.map((team) => (
              <div
                key={team.code}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-3">
                  {team.logo ? (
                    <img
                      src={team.logo}
                      alt={team.name}
                      className="h-8 w-8 shrink-0 object-contain"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[10px] font-black text-slate-700">
                      {team.code}
                    </div>
                  )}

                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-900">
                      {team.name}
                    </p>

                    <p className="text-xs font-semibold text-slate-500">
                      {team.code}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleRemoveTeam(team.code)}
                  disabled={isLoading || isSaving}
                  className="rounded-lg p-2 text-red-600 transition hover:bg-red-50 disabled:text-slate-400"
                  title="Remover seleção"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-5 text-center">
            <p className="text-sm font-bold text-slate-700">
              Nenhuma seleção cadastrada ainda.
            </p>

            <p className="mt-1 text-xs text-slate-500">
              Cadastre as seleções manualmente quando chegar o mata-mata.
            </p>
          </div>
        )}
      </div>

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={isLoading || isSaving}
          className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-amber-700 disabled:bg-slate-400"
        >
          <Save className="h-4 w-4" />
          {isSaving ? 'Salvando...' : 'Salvar configuração'}
        </button>
      </div>
    </div>
  );
}