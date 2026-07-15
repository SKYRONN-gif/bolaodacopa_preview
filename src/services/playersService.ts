import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Player, Prediction } from '../types';
import { normalizePlayerDocument } from './firestoreNormalizers';

// Parâmetros (Callbacks) para a inscrição em tempo real na lista de jogadores
interface SubscribeToPlayersParams {

  // Chamado sempre que o Firebase retorna uma lista válida de jogadores
  // metadata.fromCache = true  -> Dados rápidos locais (offline/temporário)
  // metadata.fromCache = false -> Dados reais confirmados pelo servidor do Google
  onData: (players: Player[], metadata: { fromCache: boolean }) => void;
  
  // Chamado quando a consulta funciona perfeitamente, mas a coleção está vazia (0 jogadores)
  onEmpty: (metadata: { fromCache: boolean }) => void;
  
  // Chamado quando a inscrição não consegue continuar,
// por exemplo por falta de permissão ou falha no listener.
//
// A ausência temporária de internet nem sempre gera esse callback,
// pois o Firestore pode continuar usando o cache local.
  onError: (error: unknown) => void;
}


export function subscribeToPlayers({
  onData,
  onEmpty,
  onError,
}: SubscribeToPlayersParams) {

  //aponta para a coleção players lá do banco de dados
  const playersCol = collection(db, 'players');

  // O onSnapshot abre a conexão em tempo real.
  // O 'return' garante que estamos devolvendo a função de "desligar a antena" (unsubscribe) para o React
  return onSnapshot(
    playersCol,

    // Força o Firebase a disparar o evento mesmo se só a origem mudar (ex: Cache -> Servidor)
    { includeMetadataChanges: true },
    (snapshot) => {

      //recebe os players do nav ou server
      // Pega o "selo de origem" (Veio rápido do cache offline ou confirmou no Google?)
      const metadata = { fromCache: snapshot.metadata.fromCache };

      // Se não tiver nenhum documento salvo lá no banco, avisa o app e encerra por aqui
      if (snapshot.empty) {
        onEmpty(metadata);
        return;
      }

      // Prepara a gaveta para guardar os jogadores válidos
      const loadedPlayers: Player[] = [];

      // Passa por cada documento bruto que desceu do Firebase
      snapshot.forEach((document) => {
        
        // Pega o dado cru e converte no formato certinho do nosso app (remove lixo, campos faltando, etc)
        const player = normalizePlayerDocument(document.id, document.data());

        // Se o documento estava inteiro e foi normalizado com sucesso, entra 
        if (player) {
          loadedPlayers.push(player);
        }
      });

      // O "Caminho Feliz": Liga no telefone do onData e entrega a lista prontinha pro App!
      onData(loadedPlayers, metadata);
    },
    // Se cair a rede, ele joga o erro já configurado
    (error) => {
      onError(error);
    }
  );
}

// Salva de forma definitiva o documento completo de um jogador no banco.
// 
// Usa { merge: true } para fazer um "Upsert": 
// - Se o jogador não existir, cria um novo documento.
// - Se o jogador já existir, atualiza (funde) os dados sem apagar informações que já estavam lá.
export async function savePlayer(player: Player): Promise<void> {
  await setDoc(doc(db, 'players', player.id), player, { merge: true });
}

// Atualiza cirurgicamente apenas o palpite de uma partida específica no banco.
// 
// Usa updateDoc (que falha com 'not-found' se o jogador não existir no banco)
// e "Dot Notation" (notação de ponto) para não esmagar os outros palpites.
export async function savePlayerPrediction(
  playerId: string,
  matchId: string,
  prediction: Prediction
): Promise<void> {
  await updateDoc(doc(db, 'players', playerId), {
    
    // O pulo do gato: A chave dinâmica entre colchetes com um ponto no meio.
    // Isso diz ao Firebase: "Entre no objeto predictions, e altere APENAS a chave com esse matchId".
    [`predictions.${matchId}`]: prediction,
    
    // Atualiza o rastreador de qual foi o último jogo que o cara palpitou.
    lastPredictionMatchId: matchId,
  });
}

// Atualiza de forma "cirúrgica" apenas o nome e a foto do jogador.
//
// Diferente do savePlayer (que envia o objeto inteiro), o updateDoc aqui
// economiza banda de internet e garante que não vamos sobrescrever
// acidentalmente os pontos ou palpites do usuário enquanto ele troca a foto.
// Obs: Por usar updateDoc, dispara o erro 'not-found' se o documento não existir.
export async function savePlayerProfile(
  playerId: string,
  name: string,
  avatar: string
): Promise<void> {
  await updateDoc(doc(db, 'players', playerId), {
    name,
    avatar,
  });
}

// Atualiza de forma "cirúrgica" apenas o e-mail do jogador.
//
// Usa updateDoc para modificar apenas um campo num documento que JÁ EXISTE.
// Se o jogador não estiver no banco, dispara o erro 'not-found' em vez de criar um documento incompleto.
export async function savePlayerEmail(
  playerId: string,
  email: string
): Promise<void> {
  await updateDoc(doc(db, 'players', playerId), {
    email,
  });
}

// Atualiza o ajuste manual de pontos do jogador e registra o momento exato da alteração.
//
// Segue o padrão de Atualização Parcial (updateDoc) em um documento existente.
// O diferencial aqui é a criação de um "Rastro de Auditoria" (Audit Trail),
// salvando a data/hora exata (ISOString) para sabermos QUANDO o Admin mexeu nos pontos.
export async function savePlayerManualAdjustment(
  playerId: string,
  manualPointsAdjustment: number
): Promise<void> {
  await updateDoc(doc(db, 'players', playerId), {
    manualPointsAdjustment,
    manualPointsAdjustmentUpdatedAt: new Date().toISOString(),
  });
}

// Faz o "povoamento" (seed) inicial do banco de dados com uma lista de jogadores.
//
// Ideal para testes ou migração de dados. 
// O uso do `for...of` com `await` garante que os salvamentos ocorram de forma SEQUENCIAL 
// (um de cada vez), evitando sobrecarregar o Firebase com muitas requisições simultâneas.
export async function seedPlayers(players: Player[]): Promise<void> {
  for (const player of players) {
    // Usa a nossa função segura que faz o "Upsert" (cria ou funde sem apagar dados velhos)
    await savePlayer(player);
  }
}

// Consolida perfis duplicados no banco usando uma Operação Atômica (Batch).
//
// Garante o "Tudo ou Nada": Ou ele salva o perfil principal E apaga os clones ao mesmo tempo,
// ou, se der erro no meio, ele cancela tudo. Isso evita que clones "fantasmas" fiquem no banco.
export async function consolidatePlayerDuplicates({
  mergedPlayer,
  duplicatePlayerIds,
}: {
  mergedPlayer: Player;
  duplicatePlayerIds: string[];
}): Promise<void> {
  
  // Abre a "prancheta" (lote/batch) para agrupar várias ordens de gravação e exclusão.
  const batch = writeBatch(db);

  // ORDEM 1: Salva (Upsert) o jogador principal já com os dados fundidos.
  batch.set(doc(db, 'players', mergedPlayer.id), mergedPlayer, {
    merge: true,
  });

  // ORDEM 2: Varre a lista de IDs duplicados. Se o ID for de um clone 
  // (diferente do ID principal), anota a ordem de "Deletar" na prancheta.
  for (const duplicatePlayerId of duplicatePlayerIds) {
    if (duplicatePlayerId !== mergedPlayer.id) {
      batch.delete(doc(db, 'players', duplicatePlayerId));
    }
  }

  // Executa todas as ordens da prancheta de uma vez só no banco de dados!
  await batch.commit();
}