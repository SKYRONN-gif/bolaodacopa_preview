import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';

import type { User as FirebaseUser } from 'firebase/auth';

import { isAdminEmail } from '../config/admins';
import { DEFAULT_AVATAR } from '../config/avatars';
import {
  getNormalizedEmail,
  mergePlayersKeepingPrimary,
  predictionMapsAreEqual,
} from '../domain/playerMerge';
import { auth, googleProvider } from '../firebase';
import {
  savePlayer,
  savePlayerProfile,
} from '../services/playersService';
import type { Player } from '../types';

interface UseAuthPlayerOptions {
  // Lista bruta de jogadores carregada pelo usePlayers.
  players: Player[];

  // Indica se a lista de jogadores ainda está sendo carregada.
  isLoadingPlayers: boolean;

  // Indica se o Firestore já confirmou um snapshot real do servidor.
  hasPlayersSnapshotResolved: boolean;

  // Atualiza ou adiciona um jogador na lista local do usePlayers.
  upsertLocalPlayer: (player: Player) => void;

  // Informa ao App que ocorreu uma falha de conexão.
  onOffline: () => void;
}

// Cria um Player inicial a partir do usuário autenticado.
//
// Essa função é usada quando existe uma conta autenticada,
// mas ainda não existe um documento Player vinculado ao seu uid.
function createPlayerFromFirebaseUser(user: FirebaseUser): Player {
  return {
    id: user.uid,
    name: user.displayName || 'Novo jogador',
    avatar: DEFAULT_AVATAR,
    predictions: {},
    points: 0,
    exactHits: 0,
    partialHits: 0,
    errorHits: 0,
    manualPointsAdjustment: 0,
    manualPointsAdjustmentUpdatedAt: '',
    lastPredictionMatchId: '',
    email: getNormalizedEmail(user.email),
    isAdmin: false,
  };
}

// Compara dois e-mails depois de normalizá-los.
//
// Retorna false quando pelo menos um dos e-mails
// não estiver disponível.
function emailsMatch(
  first?: string | null,
  second?: string | null
): boolean {
  const normalizedFirst = getNormalizedEmail(first);
  const normalizedSecond = getNormalizedEmail(second);

  return Boolean(
    normalizedFirst &&
      normalizedSecond &&
      normalizedFirst === normalizedSecond
  );
}

// Verifica se o Player marcado como admin realmente pertence
// ao usuário autenticado.
//
// Além da flag isAdmin, os e-mails precisam ser iguais.
function isAdminProfileForUser(
  player: Player | null,
  user: FirebaseUser | null
): boolean {
  return Boolean(
    player?.isAdmin &&
      emailsMatch(player.email, user?.email)
  );
}

// Controla autenticação, vínculo com Player e atualização de perfil.
//
// O hook concentra:
// - login e logout pelo Firebase Auth;
// - observação do usuário autenticado;
// - busca do Player pelo uid;
// - merge de documentos com o mesmo e-mail;
// - criação do Player quando ele ainda não existe;
// - atualização de nome e avatar;
// - identificação do administrador.
export function useAuthPlayer({
  players,
  isLoadingPlayers,
  hasPlayersSnapshotResolved,
  upsertLocalPlayer,
  onOffline,
}: UseAuthPlayerOptions) {
  const [currentUser, setCurrentUser] =
    useState<FirebaseUser | null>(null);

  const [userPlayer, setUserPlayer] =
    useState<Player | null>(null);

  // Observa mudanças no estado de autenticação.
  //
  // O Firebase executa essa função tanto no login
  // quanto no logout do usuário.
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });

    return () => unsubscribeAuth();
  }, []);

  // Vincula o usuário autenticado ao documento Player correspondente.
  //
  // Primeiro procura pelo uid do Firebase Auth.
  // Depois procura possíveis documentos com o mesmo e-mail,
  // mescla os dados e salva o resultado quando necessário.
  useEffect(() => {
    // Quando não existe usuário autenticado,
    // limpa o Player atual.
    if (!currentUser) {
      setUserPlayer(null);
      return;
    }

    // Aguarda o carregamento inicial da lista de jogadores.
    if (isLoadingPlayers) {
      return;
    }

    // Aguarda uma resposta real do servidor antes de criar
    // ou atualizar documentos.
    //
    // Isso evita gravar dados sobre um snapshot incompleto
    // ou carregado apenas do cache local.
    if (!hasPlayersSnapshotResolved) {
      return;
    }

    const userEmail = getNormalizedEmail(currentUser.email);

    // Procura o documento vinculado diretamente ao uid
    // fornecido pelo Firebase Auth.
    const playerByUid = players.find(
      (player) => player.id === currentUser.uid
    );

    // Procura outros documentos que utilizam o mesmo e-mail.
    //
    // Esses documentos podem ter sido criados manualmente
    // ou importados antes do primeiro login do usuário.
    const playersWithSameEmail = players.filter((player) =>
      emailsMatch(player.email, userEmail)
    );

    // Usa o Player encontrado pelo uid como documento principal.
    //
    // Se ele ainda não existir, cria uma estrutura inicial.
    const basePlayer =
      playerByUid || createPlayerFromFirebaseUser(currentUser);

    // Garante que o Player principal tenha os campos
    // necessários para o restante do fluxo.
    const basePlayerWithEmail: Player = {
      ...basePlayer,
      email: basePlayer.email || userEmail,
      isAdmin: basePlayer.isAdmin || false,
    };

    // Mescla os documentos que possuem o mesmo e-mail,
    // mantendo o Player vinculado ao uid como principal.
    //
    // Os documentos duplicados não são apagados aqui.
    // A consolidação definitiva continua sendo feita pelo painel admin.
    const mergedPlayer = playersWithSameEmail.reduce<Player>(
      (currentPlayer, duplicatedPlayer) => {
        if (duplicatedPlayer.id === currentPlayer.id) {
          return currentPlayer;
        }

        return mergePlayersKeepingPrimary(
          currentPlayer,
          duplicatedPlayer,
          {
            fallbackAvatar: DEFAULT_AVATAR,
          }
        );
      },
      basePlayerWithEmail
    );

    setUserPlayer(mergedPlayer);

    // Verifica se ainda não existe um documento
    // vinculado ao uid do usuário autenticado.
    const shouldCreateCurrentPlayer = !playerByUid;

    // Verifica se o merge recuperou ou alterou palpites.
    const shouldUpdatePredictions =
      !playerByUid ||
      !predictionMapsAreEqual(
        playerByUid.predictions,
        mergedPlayer.predictions
      );

    // Verifica se a flag de administrador mudou durante o merge.
    const shouldUpdateAdminFlag =
      Boolean(playerByUid?.isAdmin) !==
      Boolean(mergedPlayer.isAdmin);

    // Verifica se o documento vinculado ao uid
    // ainda não possuía um e-mail.
    const shouldUpdateEmail =
      !playerByUid?.email && Boolean(userEmail);

    // Verifica se nome ou avatar foram recuperados
    // de outro documento durante o merge.
    const shouldUpdateProfile =
      !playerByUid ||
      playerByUid.name !== mergedPlayer.name ||
      playerByUid.avatar !== mergedPlayer.avatar;

    // Verifica se o ajuste manual foi alterado
    // durante a consolidação dos documentos.
    const shouldUpdateManualAdjustment =
      !playerByUid ||
      (playerByUid.manualPointsAdjustment ?? 0) !==
        (mergedPlayer.manualPointsAdjustment ?? 0) ||
      (playerByUid.manualPointsAdjustmentUpdatedAt || '') !==
        (mergedPlayer.manualPointsAdjustmentUpdatedAt || '');

    // Verifica se a referência ao último palpite mudou.
    const shouldUpdateLastPredictionMatchId =
      !playerByUid ||
      (playerByUid.lastPredictionMatchId || '') !==
        (mergedPlayer.lastPredictionMatchId || '');

    if (
      shouldCreateCurrentPlayer ||
      shouldUpdatePredictions ||
      shouldUpdateAdminFlag ||
      shouldUpdateEmail ||
      shouldUpdateProfile ||
      shouldUpdateManualAdjustment ||
      shouldUpdateLastPredictionMatchId
    ) {
      // Salva o documento principal consolidado.
      //
      // Não bloqueia a tela enquanto o salvamento ocorre,
      // mas registra a falha e ativa o modo offline.
      void savePlayer(mergedPlayer).catch((error) => {
        console.warn(
          'Erro ao mesclar perfil duplicado por e-mail:',
          error
        );

        onOffline();
      });
    }
  }, [
    currentUser,
    hasPlayersSnapshotResolved,
    isLoadingPlayers,
    onOffline,
    players,
  ]);

  // Inicia o login com a Conta Google.
  //
  // O currentUser não é atualizado diretamente aqui.
  // Quem atualiza é o observador onAuthStateChanged.
  const login = useCallback(async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Erro ao realizar login:', error);

      alert(
        'Não foi possível autenticar com sua Conta Google. Tente abrir o app fora de iframes ou pop-ups bloqueados.'
      );
    }
  }, []);

  // Encerra a sessão do usuário atual.
  //
  // Depois do logout, onAuthStateChanged recebe null
  // e limpa currentUser e userPlayer.
  const logout = useCallback(async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Erro ao sair:', error);
    }
  }, []);

  // Atualiza nome e avatar do jogador autenticado.
  //
  // Antes de salvar, confirma se o usuário está pronto
  // e se o snapshot real do Firestore já foi recebido.
  const updateProfile = useCallback(
    async (name: string, avatar: string) => {
      if (!currentUser || !userPlayer) {
        throw new Error('profile-user-not-ready');
      }

      if (!hasPlayersSnapshotResolved) {
        throw new Error('profile-snapshot-not-ready');
      }

      const trimmedName = name.trim();

      // Impede salvar nome vazio, nome grande demais
      // ou avatar acima do limite definido pelo app.
      if (
        !trimmedName ||
        trimmedName.length > 128 ||
        avatar.length > 10
      ) {
        throw new Error('profile-invalid-data');
      }

      const updatedPlayer: Player = {
        ...userPlayer,
        name: trimmedName,
        avatar,
        email:
          userPlayer.email ||
          getNormalizedEmail(currentUser.email),
        isAdmin: userPlayer.isAdmin || false,
      };

      try {
        // Primeiro tenta atualizar apenas nome e avatar.
        //
        // Se o documento ainda não existir,
        // cria o Player completo como fallback.
        await savePlayerProfile(
          updatedPlayer.id,
          trimmedName,
          avatar
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

        // Atualiza o Player atual e a lista local
        // depois que o Firestore confirma o salvamento.
        setUserPlayer(updatedPlayer);
        upsertLocalPlayer(updatedPlayer);
      } catch (error) {
        console.warn(
          'Erro ao salvar perfil no Firestore:',
          error
        );

        onOffline();
        throw error;
      }
    },
    [
      currentUser,
      hasPlayersSnapshotResolved,
      onOffline,
      upsertLocalPlayer,
      userPlayer,
    ]
  );

  // Permite que outros hooks atualizem o Player autenticado
  // sem acessar diretamente o setState interno deste hook.
  //
  // Será usado no próximo passo pelo usePredictions.
  const updateCurrentPlayer = useCallback(
    (player: Player) => {
      setUserPlayer(player);
    },
    []
  );

  // Reconhece o usuário como administrador quando:
  // - seu e-mail está na configuração de admins;
  // - ou seu Player possui isAdmin e pertence à conta atual.
  const isCurrentUserAdmin = useMemo(
    () =>
      isAdminEmail(currentUser?.email) ||
      isAdminProfileForUser(userPlayer, currentUser),
    [currentUser, userPlayer]
  );

  return {
    currentUser,
    userPlayer,
    isCurrentUserAdmin,
    login,
    logout,
    updateProfile,
    updateCurrentPlayer,
  };
}