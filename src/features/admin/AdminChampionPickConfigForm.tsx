import { LockKeyhole, Save, Trophy } from 'lucide-react';
import { useEffect, useState } from 'react';

import {
  DEFAULT_CHAMPION_PICK_SETTINGS,
  getChampionPickSettings,
  saveChampionPickSettings,
} from '../../services/championPickService';
import type { ChampionPickSettings } from '../../types';

interface AdminChampionPickConfigFormProps {
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export function AdminChampionPickConfigForm({
  onSuccess,
  onError,
}: AdminChampionPickConfigFormProps) {
  const [settings, setSettings] = useState<ChampionPickSettings>(
    DEFAULT_CHAMPION_PICK_SETTINGS
  );
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

  const handleSave = async () => {
    setIsSaving(true);

    try {
      await saveChampionPickSettings(settings);

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
            Deixe a função preparada agora e libere apenas quando chegar a fase
            de mata-mata.
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

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="font-bold text-slate-700">
            Seleções disponíveis
          </span>

          <strong className="text-slate-950">
            {settings.eligibleTeams.length}
          </strong>
        </div>

        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          Nesta primeira versão, a lista ainda fica vazia. Na próxima etapa,
          vamos criar a edição das seleções classificadas para o mata-mata.
        </p>
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