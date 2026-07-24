# IPTV FREE — Player IPTV para Smart TV (HTML5)

Player de IPTV simples, sem frameworks e sem etapa de build — pensado para rodar em navegadores antigos embutidos em Smart TVs que ainda suportam HTML5.

## Arquivos

- `index.html` — estrutura da página
- `style.css` — estilos (cores, tamanhos, layout)
- `script.js` — toda a lógica do player

## Como funciona

- Ao abrir, o player já carrega automaticamente a playlist pública do projeto [iptv-org](https://github.com/iptv-org/iptv) (milhares de canais). Se você já tiver carregado outra playlist antes, a última URL usada é lembrada (via `localStorage`) e recarregada automaticamente.
- Você também pode:
  - Informar a URL de outra playlist M3U/M3U8 e clicar em **"Carregar por URL"**;
  - Clicar em **"Adicionar como canal único"** quando o link já é o próprio stream de vídeo (ex.: um encurtador ou uma URL `.m3u8`/`.mp4` direta) — nesse caso o navegador não precisa ler o conteúdo do link, só reproduzir;
  - Clicar em **"Colar lista manualmente"** e colar o conteúdo M3U diretamente na página;
  - Clicar em **"Carregar lista de exemplo"** para testar rapidamente com uma lista de demonstração.
- A lista de canais pode ser filtrada por uma **barra de letras** (A–Z / "Todos") para navegar rapidamente em listas grandes.
- Navegação por controle remoto: **setas** para mover o foco, **OK/Enter** para selecionar, e **Voltar/Back/Esc** para sair do player e voltar à lista. Os códigos de tecla cobrem controles genéricos e de fabricantes como Samsung e LG.
- Para reprodução de cada canal:
  1. Primeiro tenta o suporte **nativo** a HLS do navegador (muitas TVs mais antigas já suportam isso via `<video>`).
  2. Se não houver suporte nativo mas o navegador tiver **MediaSource Extensions**, carrega a biblioteca `hls.js` (pré-carregada em segundo plano assim que a página abre) como alternativa.
  3. Se nada disso estiver disponível, mostra uma mensagem avisando que aquele canal não pode ser reproduzido naquele navegador.

## Limitação importante: CORS

Se a playlist estiver hospedada num servidor que não libera CORS para leitura via JavaScript, o carregamento por URL pode falhar. Nesses casos o player tenta ajudar automaticamente:

- Links de listas hospedadas no GitHub são convertidos automaticamente para um formato compatível com CORS (de `github.com` para `raw.githubusercontent.com`);
- Se mesmo assim a leitura falhar (erro de rede ou status de bloqueio), o player cai automaticamente para o modo **canal único**, adicionando o link direto sem tentar ler seu conteúdo — a reprodução via `<video>` não depende de CORS, só a leitura da lista.
- Mesmo em modo canal único, se o navegador precisar usar o `hls.js` (por falta de suporte nativo a HLS), o **servidor do stream de vídeo** também precisará liberar CORS para os segmentos — isso depende do provedor da lista/stream, não do player.

O player também filtra automaticamente da lista alguns serviços de streaming conhecidos por bloquear reprodução fora de seus apps oficiais (por CORS restrito e/ou DRM).

## Testando localmente

Basta abrir o arquivo `index.html` em qualquer navegador. Não precisa de servidor, build, Node, nada — só tenha certeza de manter `style.css` e `script.js` na mesma pasta, já que `index.html` os referencia.

## Publicando no GitHub Pages

1. Crie uma conta no GitHub, se ainda não tiver: <https://github.com>
2. Crie um novo repositório (pode ser público), por exemplo `iptv-player`.
3. Envie estes três arquivos (`index.html`, `style.css`, `script.js`) e o `README.md` para o repositório. Duas formas:

   **Pelo site do GitHub (mais simples, sem usar terminal):**
   - Abra o repositório recém-criado.
   - Clique em "Add file" → "Upload files".
   - Arraste os arquivos (`index.html`, `style.css`, `script.js`, e o README, se quiser) e clique em "Commit changes".

   **Pelo terminal (se preferir git):**
   ```bash
   git init
   git add index.html style.css script.js README.md
   git commit -m "Player IPTV inicial"
   git branch -M main
   git remote add origin https://github.com/SEU_USUARIO/iptv-player.git
   git push -u origin main
   ```

4. No repositório, vá em **Settings → Pages**.
5. Em "Build and deployment", selecione **Deploy from a branch**, escolha a branch `main` e a pasta `/ (root)`, depois clique em **Save**.
6. Aguarde 1–2 minutos. O GitHub vai te mostrar o link, algo como:
   ```
   https://SEU_USUARIO.github.io/iptv-player/
   ```
7. Abra esse link na Smart TV (pelo navegador dela) e pronto — o player estará no ar.

Se quiser que o site fique na raiz do seu domínio `SEU_USUARIO.github.io` (sem o `/iptv-player/` no final), crie o repositório com o nome exato `SEU_USUARIO.github.io`.

## Personalizando

- Para trocar a playlist padrão carregada automaticamente ao abrir, edite a constante `DEFAULT_PLAYLIST_URL` em `script.js`.
- Para editar a lista de demonstração usada pelo botão "Carregar lista de exemplo", ajuste a função `loadDemo()` em `script.js`.
- As cores, tamanhos de fonte e espaçamentos ficam todos em `style.css`.
