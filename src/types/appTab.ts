/**
 * Define os nomes permitidos para a aba ativa da aplicação.
 *
 * É usado pelo estado local do React para controlar qual parte da tela
 * deve aparecer: início, partidas, ranking ou painel administrativo.
 */
export type AppTab = 'home' | 'matches' | 'ranking' | 'admin';