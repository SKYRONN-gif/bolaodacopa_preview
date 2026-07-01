# PRD padronizado - ciclo frontend público do Bolão da Copa

## 1. Objetivo
Preparar um ciclo inicial de testes frontend para validar os fluxos públicos e somente leitura do app Bolão da Copa, sem autenticação, sem criação de palpites e sem gravação no Firestore.

## 2. Escopo do ciclo
- Porta local: 3000
- Tipo: frontend
- Escopo: codebase
- Ambiente: aplicação em execução localmente
- Foco: navegação pública e leitura de conteúdo

## 3. Fluxos priorizados
1. Carregamento da página inicial
2. Visibilidade do botão de login com Google
3. Exibição das regras do bolão
4. Exibição do ranking, quando acessível
5. Renderização dos cards de partidas e responsividade básica

## 4. Regras de teste
- Não realizar login com Google
- Não criar palpites
- Não escrever dados no Firestore
- Validar apenas conteúdo público, navegação e estados de leitura

## 5. Critérios de aceitação
- A página inicial carrega sem quebrar a interface
- O botão de login é visível para usuários não autenticados
- As regras do bolão estão acessíveis e legíveis
- O ranking aparece quando houver dados disponíveis
- Os cards de partidas são renderizados corretamente em desktop e mobile
- A interface permanece responsiva e sem overflow crítico

## 6. Premissas e riscos
- O app depende de variáveis de ambiente do Firebase para funcionar corretamente
- Sem configuração válida, o app pode entrar em modo local/fallback
- Alguns elementos podem depender de dados remotos ou de estado inicial do Firestore
- Testes públicos devem ser tolerantes a dados ausentes ou parcialmente carregados

## 7. Fora de escopo neste ciclo
- Login real com Google
- Salvamento de palpites
- Edição de partidas ou dados administrativos
- Escrita no Firestore
- Fluxos de pagamento ou prêmio avançado
