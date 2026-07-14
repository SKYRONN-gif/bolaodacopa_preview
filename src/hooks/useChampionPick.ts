import { useCallback, useEffect, useState } from 'react';

import type { User as FirebaseUser } from 'firebase/auth';

import { getNormalizedEmail } from '../domain/playerMerge';
import {
  DEFAULT_CHAMPION_PICK_SETTINGS,
  saveChampionPick,
  subscribeToChampionPick,
  subscribeToChampionPickSettings,
} from '../services/championPickService';
import type {
  ChampionPick,
  ChampionPickSettings,
  ChampionPickTeam,
  Player,
} from '../types';

interface UseChampionPickOptions {
  // Usuário atualmente autenticado pelo Firebase Auth.
  currentUser: FirebaseUser | null;

  // Player vinculado ao usuário autenticado.
  userPlayer: Player | null;
}

// Controla todo o fluxo da Bolsa Campeão.
//
// O hook concentra:
// - carregamento das configurações;
// - carregamento da escolha do usuário;
// - validação das regras da Bolsa;
// - salvamento da seleção escolhida;
// - estado de processamento da escolha.
export function useChampionPick({
  currentUser,
  userPlayer,
}: UseChampionPickOptions) {
  const [championPickSettings, setChampionPickSettings] =
    useState<ChampionPickSettings>(
      DEFAULT_CHAMPION_PICK_SETTINGS
    );

  const [currentChampionPick, setCurrentChampionPick] =
    useState<ChampionPick | null>(null);

  const [isSavingChampionPick, setIsSavingChampionPick] =
    useState(false);

  // Carrega e mantém sincronizadas as configurações
  // gerais da Bolsa Campeão.
  //
  // Essas configurações informam:
  // - se a funcionalidade está habilitada;
  // - se as escolhas estão travadas;
  // - quais seleções estão liberadas.
  useEffect(() => {
    const unsubscribe = subscribeToChampionPickSettings({
      onData: setChampionPickSettings,

      onError: (error) => {
        console.error(
          'Erro ao carregar configuração da Bolsa Campeão:',
          error
        );
      },
    });

    return unsubscribe;
  }, []);

  // Valores usados para identificar a escolha
  // pertencente ao usuário atual.
  const currentUserId = currentUser?.uid || '';
  const userPlayerId = userPlayer?.id || '';

  const playerEmail = getNormalizedEmail(
    currentUser?.email || userPlayer?.email
  );

  // Carrega e mantém sincronizada a escolha da campeã
  // feita pelo usuário autenticado.
  //
  // A inscrição só começa quando existem:
  // - usuário autenticado;
  // - Player vinculado;
  // - e-mail disponível.
  useEffect(() => {
    // Limpa a escolha anterior ao trocar de usuário
    // ou enquanto os dados necessários não estão prontos.
    setCurrentChampionPick(null);

    if (!currentUserId || !userPlayerId || !playerEmail) {
      return;
    }

    const unsubscribe = subscribeToChampionPick({
      playerEmail,

      onData: setCurrentChampionPick,

      onError: (error) => {
        console.error(
          'Erro ao carregar escolha da Bolsa Campeão:',
          error
        );

        setCurrentChampionPick(null);
      },
    });

    return unsubscribe;
  }, [currentUserId, playerEmail, userPlayerId]);

  // Salva a escolha da seleção campeã do usuário.
  //
  // Antes de salvar, valida se:
  // - existe usuário autenticado;
  // - existe Player vinculado;
  // - a Bolsa está habilitada e aberta;
  // - o usuário ainda não escolheu;
  // - a seleção está na lista de elegíveis.
  const pickChampionTeam = useCallback(
    async (team: ChampionPickTeam) => {
      if (!currentUser || !userPlayer) {
        alert(
          'Faça login com sua conta Google para escolher sua campeã.'
        );
        return;
      }

      if (
        !championPickSettings.enabled ||
        championPickSettings.locked
      ) {
        alert(
          'A Bolsa Campeão ainda não está aberta para escolhas.'
        );
        return;
      }

      if (currentChampionPick) {
        alert(
          'Você já escolheu sua campeã. Essa escolha não pode ser alterada.'
        );
        return;
      }

      // Normaliza o código recebido antes de compará-lo
      // com a lista de seleções permitidas.
      const normalizedTeamCode = team.code
        .trim()
        .toUpperCase();

      if (
        !championPickSettings.eligibleTeamCodes.includes(
          normalizedTeamCode
        )
      ) {
        alert(
          'Essa seleção não está liberada na Bolsa Campeão.'
        );
        return;
      }

      // Garante que o Player enviado ao serviço
      // possua um e-mail normalizado.
      const normalizedPlayerEmail = getNormalizedEmail(
        userPlayer.email || currentUser.email
      );

      if (!normalizedPlayerEmail) {
        alert(
          'Não foi possível identificar o e-mail da sua conta.'
        );
        return;
      }

      const playerWithEmail: Player = {
        ...userPlayer,
        email: normalizedPlayerEmail,
      };

      setIsSavingChampionPick(true);

      try {
        const savedPick = await saveChampionPick(
          playerWithEmail,
          team
        );

        // Atualiza a tela imediatamente depois
        // que o Firestore confirma o salvamento.
        setCurrentChampionPick(savedPick);
      } catch (error) {
        console.error(
          'Erro ao salvar escolha da Bolsa Campeão:',
          error
        );

        alert(
          'Não consegui salvar sua escolha. Confira se a Bolsa está aberta e tente novamente.'
        );
      } finally {
        // Sempre libera o estado de salvamento,
        // tanto em caso de sucesso quanto de erro.
        setIsSavingChampionPick(false);
      }
    },
    [
      championPickSettings,
      currentChampionPick,
      currentUser,
      userPlayer,
    ]
  );

  return {
    championPickSettings,
    currentChampionPick,
    isSavingChampionPick,
    pickChampionTeam,
  };
}