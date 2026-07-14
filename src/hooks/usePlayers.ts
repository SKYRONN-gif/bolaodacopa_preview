import { useCallback, useEffect, useState } from 'react';

import { upsertPlayer } from '../domain/players';
import {
  savePlayer,
  savePlayerManualAdjustment,
  subscribeToPlayers,
} from '../services/playersService';
import type { Player, Prediction } from '../types';

interface UsePlayersOptions {
  // Informa ao App que ocorreu uma falha de conexão
  // e que o modo offline deve ser ativado.
  onOffline: () => void;
}

// Controla o carregamento e as alterações da lista de jogadores.
//
// O hook mantém os dados brutos recebidos do Firestore.
// Isso inclui possíveis jogadores duplicados, necessários
// para as ferramentas de consolidação do painel admin.
export function usePlayers({ onOffline }: UsePlayersOptions) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [isLoadingPlayers, setIsLoadingPlayers] = useState(true);

  // Indica se o Firestore já confirmou os dados diretamente
  // do servidor, e não apenas do cache local.
  const [hasPlayersSnapshotResolved, setHasPlayersSnapshotResolved] =
    useState(false);

  // Carrega os jogadores e mantém a lista sincronizada
  // com as alterações recebidas do Firestore.
  useEffect(() => {
    const unsubscribePlayers = subscribeToPlayers({
      onData: (loadedPlayers, metadata) => {
        setPlayers(loadedPlayers);

        // Um snapshot vindo do servidor confirma que já podemos
        // criar ou atualizar documentos com segurança.
        if (!metadata.fromCache) {
          setHasPlayersSnapshotResolved(true);
        }

        setIsLoadingPlayers(false);
      },

      onEmpty: (metadata) => {
        setPlayers([]);

        // Mesmo uma coleção vazia é considerada uma resposta válida
        // quando confirmada diretamente pelo servidor.
        if (!metadata.fromCache) {
          setHasPlayersSnapshotResolved(true);
        }

        setIsLoadingPlayers(false);
      },

      onError: (error) => {
        console.warn(
          'Erro ao conectar ao Firestore para participantes. Ativando modo local:',
          error
        );

        onOffline();
        setPlayers([]);
        setHasPlayersSnapshotResolved(false);
        setIsLoadingPlayers(false);
      },
    });

    // Cancela a inscrição quando o componente que usa o hook
    // for desmontado ou quando onOffline mudar.
    return () => unsubscribePlayers();
  }, [onOffline]);

  // Libera a tela quando o carregamento demora além do limite.
  //
  // O snapshot continua marcado como não confirmado,
  // impedindo gravações enquanto não houver resposta real do servidor.
  const activateLocalFallback = useCallback(() => {
    onOffline();
    setIsLoadingPlayers(false);
    setHasPlayersSnapshotResolved(false);
  }, [onOffline]);

  // Adiciona ou substitui um player apenas no estado local.
  //
  // Essa função é usada por outros fluxos, como:
  // - atualização de perfil;
  // - salvamento de palpites;
  // - criação de participante;
  // - vínculo entre login e player.
  const upsertLocalPlayer = useCallback((player: Player) => {
    setPlayers((currentPlayers) =>
      upsertPlayer(currentPlayers, player)
    );
  }, []);

  // Adiciona um participante manualmente pelo painel admin.
//
// O participante manual não possui vínculo inicial com Firebase Auth
// e recebe um id baseado no horário de criação.
  const addPlayer = useCallback(
    async (
      name: string,
      avatar: string,
      predictions: Record<string, Prediction>
    ) => {
      const newPlayer: Player = {
        id: `manual-${Date.now()}`,
        name,
        avatar,
        predictions,
        points: 0,
        exactHits: 0,
        partialHits: 0,
        errorHits: 0,
        manualPointsAdjustment: 0,
        manualPointsAdjustmentUpdatedAt: '',
        lastPredictionMatchId: '',
        isAdmin: false,
        email: '',
      };

      try {
        await savePlayer(newPlayer);

        // Atualiza a lista local depois que o Firestore
        // confirma a criação do participante.
        upsertLocalPlayer(newPlayer);
      } catch (error) {
        console.warn(
          'Erro ao adicionar participante no Firestore:',
          error
        );

        onOffline();
        throw error;
      }
    },
    [onOffline, upsertLocalPlayer]
  );

  // Atualiza o ajuste manual de pontos de um jogador.
//
// Esse valor é somado à pontuação calculada normalmente,
// sem alterar seus palpites.
  const updateManualAdjustment = useCallback(
    async (
      playerId: string,
      manualPointsAdjustment: number
    ) => {
      const targetPlayer = players.find(
        (player) => player.id === playerId
      );

      if (!targetPlayer) {
        throw new Error('player-not-found');
      }

      try {
        await savePlayerManualAdjustment(
          playerId,
          manualPointsAdjustment
        );

        const updatedAt = new Date().toISOString();

        // Atualiza localmente apenas o participante alterado.
        setPlayers((currentPlayers) =>
          currentPlayers.map((player) =>
            player.id === playerId
              ? {
                  ...player,
                  manualPointsAdjustment,
                  manualPointsAdjustmentUpdatedAt: updatedAt,
                }
              : player
          )
        );
      } catch (error) {
        console.warn(
          'Erro ao salvar ajuste manual no Firestore:',
          error
        );

        onOffline();
        throw error;
      }
    },
    [onOffline, players]
  );

  return {
    players,
    isLoadingPlayers,
    hasPlayersSnapshotResolved,
    activateLocalFallback,
    upsertLocalPlayer,
    addPlayer,
    updateManualAdjustment,
  };
}