import { useCallback, useMemo } from 'react';

import type { User as FirebaseUser } from 'firebase/auth';

import { getNormalizedEmail } from '../domain/playerMerge';
import { isPredictionLocked } from '../domain/rules';
import {
  savePlayer,
  savePlayerPrediction,
} from '../services/playersService';
import type {
  Match,
  Player,
  Prediction,
} from '../types';

interface UsePredictionsOptions {
  // Usuário atualmente autenticado pelo Firebase Auth.
  currentUser: FirebaseUser | null;

  // Player vinculado ao usuário autenticado.
  userPlayer: Player | null;

  // Lista de partidas carregadas pelo useMatches.
  matches: Match[];

  // Indica se o Firestore já confirmou um snapshot real
  // da coleção de jogadores.
  hasPlayersSnapshotResolved: boolean;

  // Atualiza o Player autenticado dentro do useAuthPlayer.
  updateCurrentPlayer: (player: Player) => void;

  // Atualiza ou adiciona o Player na lista local do usePlayers.
  upsertLocalPlayer: (player: Player) => void;

  // Informa ao App que ocorreu uma falha de conexão.
  onOffline: () => void;
}

// Controla a criação e o salvamento dos palpites.
//
// O hook concentra:
// - validação do usuário e do Player;
// - confirmação dos dados do Firestore;
// - bloqueio pelo horário/status da partida;
// - preservação da data original do palpite;
// - salvamento no Firestore;
// - atualização dos estados locais.
export function usePredictions({
  currentUser,
  userPlayer,
  matches,
  hasPlayersSnapshotResolved,
  updateCurrentPlayer,
  upsertLocalPlayer,
  onOffline,
}: UsePredictionsOptions) {
  // Permite editar palpites somente quando:
  // - existe usuário autenticado;
  // - existe Player vinculado;
  // - o Firestore confirmou os dados reais dos jogadores.
  const canEditPredictions = useMemo(
    () =>
      Boolean(
        currentUser &&
          userPlayer &&
          hasPlayersSnapshotResolved
      ),
    [
      currentUser,
      hasPlayersSnapshotResolved,
      userPlayer,
    ]
  );

  // Salva ou atualiza o palpite do jogador
  // para uma partida específica.
  const updatePrediction = useCallback(
    async (
      matchId: string,
      scoreA: number,
      scoreB: number
    ) => {
      if (!currentUser || !userPlayer) {
        alert(
          'Faça login com sua conta Google para salvar seus palpites.'
        );
        return;
      }

      // Impede gravações enquanto o App ainda não recebeu
      // uma confirmação real da coleção de jogadores.
      if (!hasPlayersSnapshotResolved) {
        alert(
          'Ainda estamos confirmando seus dados no banco. Aguarde alguns segundos ou toque em Reconectar banco antes de salvar.'
        );
        return;
      }

      // Procura a partida correspondente ao id recebido.
      const targetMatch = matches.find(
        (match) => match.id === matchId
      );

      if (!targetMatch) {
        alert('Partida não encontrada.');
        return;
      }

      // Impede alterações quando a partida já começou
      // ou foi marcada como finalizada.
      if (isPredictionLocked(targetMatch)) {
        alert(
          'Esse palpite já está travado porque a partida começou ou foi finalizada.'
        );
        return;
      }

      // Preserva a data original de criação
      // quando o jogador está editando um palpite existente.
      const existingPrediction =
        userPlayer.predictions[matchId];

      const savedAt = new Date().toISOString();

      const prediction: Prediction = {
        scoreA,
        scoreB,
        createdAt:
          existingPrediction?.createdAt || savedAt,
        updatedAt: savedAt,
      };

      // Cria uma nova versão do Player mantendo todos
      // os palpites anteriores e substituindo apenas
      // o palpite da partida atual.
      const updatedPlayer: Player = {
        ...userPlayer,
        predictions: {
          ...userPlayer.predictions,
          [matchId]: prediction,
        },
        lastPredictionMatchId: matchId,
        email:
          userPlayer.email ||
          getNormalizedEmail(currentUser.email),
        isAdmin: userPlayer.isAdmin || false,
      };

      try {
        // Primeiro tenta salvar somente o palpite específico.
        //
        // Se o documento do Player ainda não existir,
        // cria o documento completo como fallback.
        await savePlayerPrediction(
          updatedPlayer.id,
          matchId,
          prediction
        ).catch(async (error) => {
          const code =
            typeof error === 'object' &&
            error !== null &&
            'code' in error
              ? String(error.code)
              : '';

          if (code === 'not-found') {
            await savePlayer(updatedPlayer);
            return;
          }

          throw error;
        });

        // Atualiza o Player autenticado e a lista local
        // somente depois que o salvamento for confirmado.
        updateCurrentPlayer(updatedPlayer);
        upsertLocalPlayer(updatedPlayer);
      } catch (error) {
        console.warn(
          'Erro ao salvar palpite no Firestore:',
          error
        );

        onOffline();

        alert(
          'Não consegui confirmar esse palpite no banco. Ele não foi marcado como salvo; confira sua conexão e tente novamente.'
        );

        throw error;
      }
    },
    [
      currentUser,
      hasPlayersSnapshotResolved,
      matches,
      onOffline,
      updateCurrentPlayer,
      upsertLocalPlayer,
      userPlayer,
    ]
  );

  return {
    canEditPredictions,
    updatePrediction,
  };
}