# MyPanel

Painel web pessoal para centralizar, em um só lugar, os links das aplicações, sites e ferramentas que uso com frequência, além de anotações e da agenda do dia.

Feito com HTML, CSS e JavaScript puros, sem etapa de build. O servidor local usa só a biblioteca padrão do Python.

## Funcionalidades

- **Topo do painel**: anotações fixadas lado a lado com a agenda de **hoje e amanhã** do Google Agenda.
- **Agenda**: mostra o que já passou, o que está acontecendo **agora** e quanto falta para o **próximo** compromisso. Atualiza sozinha a cada 10 minutos e na virada do dia. Clicar em um evento abre aquele dia no Google Agenda.
- **Blocos de link**: clique e vá direto para o destino (nova aba ou mesma aba).
- **Blocos de nota**: abrem um editor com salvamento automático. Podem ser fixados no topo.
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

No Windows, dê dois cliques em **`iniciar.bat`**. Ele sobe o servidor do painel em `http://localhost:5500` e abre o navegador. Para parar, feche a janela preta.

Pelo terminal, dentro da pasta do projeto:

```bash
python server.py
```

É preciso ter o [Python 3](https://www.python.org/downloads/) instalado (marque **Add python.exe to PATH** na instalação). Sem Python, o `iniciar.bat` abre o `index.html` direto: os blocos e as notas funcionam, mas a agenda não carrega.

> Os dados ficam salvos no `localStorage` do navegador, separados por endereço. Se você abrir pelo arquivo e depois pelo servidor, cada um terá seus próprios blocos. Use **⋮ → Exportar backup** e **Importar backup** para levar os dados de um para o outro.

## Conectar o Google Agenda

1. Abra o painel pelo `iniciar.bat`.
2. No topo, em **Agenda**, clique em **Conectar Google Agenda** (ou na engrenagem).
3. No Google Agenda, vá em **Configurações → Configurações das minhas agendas →** sua agenda **→ Integrar agenda** e copie o **Endereço secreto no formato iCal**.
4. Cole no painel e clique em **Conectar agenda**. Repita para outras agendas, se quiser.

O endereço secreto dá acesso de leitura à agenda, então ele **fica salvo só no navegador**: não vai para o código, para o backup nem para o GitHub. Se algum dia ele vazar, use **Redefinir** na mesma tela do Google para gerar outro.

Por que precisa do servidor? O Google não deixa o navegador baixar o arquivo da agenda direto de uma página (bloqueio de CORS). O `server.py` faz esse download pelo seu computador. Ele só aceita endereços do Google Agenda, só responde para a própria página do painel e só escuta em `127.0.0.1`.

## Estrutura

```
Mypanel/
├── index.html    # estrutura da página e diálogos
├── style.css     # visual, temas claro/escuro e responsividade
├── icons.js      # biblioteca de ícones SVG
├── app.js        # blocos, notas, categorias, busca, backup
├── agenda.js     # agenda do Google: leitura do iCal, hoje e amanhã
├── server.py     # servidor local (arquivos + download da agenda)
├── iniciar.bat   # atalho para iniciar o servidor no Windows
└── vendor/
    └── ical.min.js  # ical.js 1.5.0 (MPL-2.0), leitor de arquivos iCal
```

## Adicionar novos ícones

Em `icons.js`, inclua uma nova chave com um rótulo e o conteúdo SVG (grade 24×24, traço):

```js
meuIcone: { label: "Meu ícone", d: '<circle cx="12" cy="12" r="8"/>' },
```
