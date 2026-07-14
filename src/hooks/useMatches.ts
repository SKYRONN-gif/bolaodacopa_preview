import { useCallback, useEffect, useState } from 'react';

import { INITIAL_MATCHES } from '../data';
import {
  preserveFinishedResults,
  sortMatchesBySchedule,
  upsertMatch,
} from '../domain/matches';
import {
  saveMatch,
  subscribeToMatches,
  syncDefaultMatches as syncDefaultMatchesInFirestore,
} from '../services/matchesService';
import type { Match } from '../types';

// Define se o app pode usar os jogos locais quando
// não conseguir carregar os dados do Firestore.
//
// Em desenvolvimento, o fallback é permitido automaticamente.
// Em produção, depende da variável VITE_ENABLE_LOCAL_FALLBACK.
const CAN_USE_LOCAL_FALLBACK =
  import.meta.env.DEV ||
  import.meta.env.VITE_ENABLE_LOCAL_FALLBACK === 'true';

interface UseMatchesOptions {
  // Informa ao App que ocorreu uma falha de conexão
  // e que o modo offline deve ser ativado.
  onOffline: () => void;
}

// Controla o carregamento, salvamento e sincronização das partidas.
//
// O hook concentra toda a comunicação entre:
// - estado React das partidas;
// - serviço do Firestore;
// - fallback local;
// - ações do painel administrativo.
export function useMatches({ onOffline }: UseMatchesOptions) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [isLoadingMatches, setIsLoadingMatches] = useState(true);

  // Carrega as partidas e mantém a lista sincronizada
  // com as alterações recebidas do Firestore.
  useEffect(() => {
    const unsubscribeMatches = subscribeToMatches({
      onData: (loadedMatches) => {
        setMatches(loadedMatches);
        setIsLoadingMatches(false);
      },

      onEmpty: () => {
        console.warn(
          'Coleção de jogos vazia. Use o Painel ADM para recriar os jogos iniciais.'
        );

        setMatches([]);
        setIsLoadingMatches(false);
      },

      onError: (error) => {
        console.warn(
          'Erro ao conectar ao Firestore para jogos. Ativando modo local:',
          error
        );

        onOffline();
        setMatches(CAN_USE_LOCAL_FALLBACK ? INITIAL_MATCHES : []);
        setIsLoadingMatches(false);
      },
    });

    // Cancela a inscrição quando o componente que usa o hook
    // for desmontado ou quando onOffline mudar.
    return () => unsubscribeMatches();
  }, [onOffline]);

  // Libera o carregamento das partidas quando a conexão
  // demora além do limite controlado pelo App.
  //
  // Se alguma partida já tiver sido carregada, preserva a lista atual.
  // Caso contrário, usa os dados locais quando permitido.
  const activateLocalFallback = useCallback(() => {
    onOffline();
    setIsLoadingMatches(false);

    setMatches((currentMatches) => {
      if (currentMatches.length > 0) {
        return currentMatches;
      }

      return CAN_USE_LOCAL_FALLBACK ? INITIAL_MATCHES : [];
    });
  }, [onOffline]);

  // Atualiza o placar e o status de uma partida existente.
  const updateMatchResult = useCallback(
    async (
      matchId: string,
      scoreA: number,
      scoreB: number,
      status: 'scheduled' | 'finished'
    ) => {
      const targetMatch = matches.find((match) => match.id === matchId);

      if (!targetMatch) {
        return;
      }

      const updatedMatch: Match = {
        ...targetMatch,
        scoreA,
        scoreB,
        status,
      };

      try {
        await saveMatch(updatedMatch);

        // Atualiza apenas a partida correspondente
        // dentro da lista mantida pelo hook.
        setMatches((currentMatches) =>
          currentMatches.map((match) =>
            match.id === matchId ? updatedMatch : match
          )
        );
      } catch (error) {
        console.warn('Erro ao atualizar partida no Firestore:', error);
        onOffline();
        throw error;
      }
    },
    [matches, onOffline]
  );

  // Salva uma partida nova ou edita uma partida existente.
  const saveMatchDetails = useCallback(
    async (match: Match) => {
      try {
        await saveMatch(match);

        // Adiciona ou substitui a partida e mantém
        // a lista ordenada por data e horário.
        setMatches((currentMatches) =>
          upsertMatch(currentMatches, match)
        );
      } catch (error) {
        console.warn('Erro ao salvar partida no Firestore:', error);
        onOffline();
        throw error;
      }
    },
    [onOffline]
  );

  // Sincroniza os jogos padrão do projeto com o Firestore.
//
// Durante a sincronização:
// - mantém partidas que não pertencem à lista padrão;
// - atualiza as partidas padrão;
// - preserva placares já finalizados.
  const syncDefaultMatches = useCallback(async () => {
    try {
      setIsLoadingMatches(true);

      await syncDefaultMatchesInFirestore(INITIAL_MATCHES);

      setMatches((currentMatches) =>
        sortMatchesBySchedule([
          // Mantém partidas criadas manualmente ou vindas
          // de outras fontes que não estão em INITIAL_MATCHES.
          ...currentMatches.filter(
            (currentMatch) =>
              !INITIAL_MATCHES.some(
                (defaultMatch) => defaultMatch.id === currentMatch.id
              )
          ),

          // Reinsere os jogos padrão preservando resultados finalizados.
          ...preserveFinishedResults(INITIAL_MATCHES, currentMatches),
        ])
      );

      setIsLoadingMatches(false);
    } catch (error) {
      console.error('Erro ao sincronizar jogos padrão:', error);
      setIsLoadingMatches(false);
      onOffline();
      throw error;
    }
  }, [onOffline]);

  return {
    matches,
    isLoadingMatches,
    activateLocalFallback,
    updateMatchResult,
    saveMatchDetails,
    syncDefaultMatches,
  };
}