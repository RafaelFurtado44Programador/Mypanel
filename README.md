# MyPanel

Painel web pessoal para centralizar, em um só lugar, os links das aplicações, sites e ferramentas que uso com frequência, além de blocos de anotação.

Feito com HTML, CSS e JavaScript puros, sem dependências nem etapa de build.

## Funcionalidades

- **Blocos de link**: clique e vá direto para o destino (nova aba ou mesma aba).
- **Blocos de nota**: abrem um editor com salvamento automático.
- **Criar, editar e excluir blocos** pelo botão "Novo bloco" ou com o botão direito sobre um bloco.
- **Personalização** de cada bloco:
  - 10 cores prontas ou qualquer cor personalizada;
  - 40 ícones, emoji, iniciais do nome ou o logo do próprio site;
  - tamanho normal ou largo;
  - nome, descrição e categoria.
- **Categorias** com filtros, criação, remoção e reordenação.
- **Modo Organizar**: arraste os blocos para mudar a ordem (soltar sobre um bloco de outra categoria move o bloco para ela).
- **Busca** por nome, descrição, endereço ou texto das notas.
- **Tema** claro, escuro ou do sistema.
- **Backup**: exportar e importar todos os dados em `.json`.
- Atalhos de teclado: `/` busca, `N` novo bloco, `Esc` fecha.

## Como usar

### Opção 1: abrir direto
Dê dois cliques em `index.html`.

### Opção 2: servidor local (recomendado)
No Windows, dê dois cliques em `iniciar.bat`. Ele sobe um servidor em `http://localhost:5500` e abre o navegador.

Ou, pelo terminal, dentro da pasta do projeto:

```bash
python -m http.server 5500
```

e acesse `http://localhost:5500`.

> Os dados ficam salvos no `localStorage` do navegador, separados por endereço. Se você abrir pelo arquivo e depois pelo servidor, cada um terá seus próprios blocos. Use **⋮ → Exportar backup** e **Importar backup** para levar os dados de um para o outro.

## Estrutura

```
Mypanel/
├── index.html   # estrutura da página e diálogos
├── style.css    # visual, temas claro/escuro e responsividade
├── icons.js     # biblioteca de ícones SVG
├── app.js       # lógica: blocos, notas, categorias, busca, backup
└── iniciar.bat  # sobe um servidor local no Windows
```

## Adicionar novos ícones

Em `icons.js`, inclua uma nova chave com um rótulo e o conteúdo SVG (grade 24×24, traço):

```js
meuIcone: { label: "Meu ícone", d: '<circle cx="12" cy="12" r="8"/>' },
```
