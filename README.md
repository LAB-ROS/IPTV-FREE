# IPTV Player para Smart TV (HTML5)

Player de IPTV simples, em uma única página HTML, sem frameworks e sem etapa de build — pensado para rodar em navegadores antigos embutidos em Smart TVs que ainda suportam HTML5.

## Como funciona

- Você informa a URL de uma playlist M3U/M3U8, ou cola o conteúdo da playlist diretamente.
- O player lista os canais e você navega com as **setas** do controle remoto, confirma com **OK/Enter**, e volta com **Voltar/Back/Esc**.
- Para reprodução:
  1. Primeiro tenta o suporte **nativo** a HLS do navegador (muitas TVs mais antigas já suportam isso via `<video>`).
  2. Se não houver suporte nativo mas o navegador tiver **MediaSource Extensions**, carrega a biblioteca `hls.js` como alternativa.
  3. Se nada disso estiver disponível, mostra uma mensagem avisando que aquele canal não pode ser reproduzido naquele navegador.

## Limitação importante: CORS

Se a playlist ou os streams estiverem hospedados num servidor que não libera CORS, o carregamento por URL pode falhar. Nesse caso, use a opção "Colar lista manualmente" para colar o conteúdo M3U direto na página (isso não resolve CORS dos próprios streams de vídeo, só da playlist).

## Testando localmente

Basta abrir o arquivo `index.html` em qualquer navegador. Não precisa de servidor, build, Node, nada.

## Publicando no GitHub Pages

1. Crie uma conta no GitHub, se ainda não tiver: https://github.com
2. Crie um novo repositório (pode ser público), por exemplo `iptv-player`.
3. Envie estes arquivos (`index.html` e este `README.md`) para o repositório. Duas formas:

   **Pelo site do GitHub (mais simples, sem usar terminal):**
   - Abra o repositório recém-criado.
   - Clique em "Add file" → "Upload files".
   - Arraste o `index.html` (e o README, se quiser) e clique em "Commit changes".

   **Pelo terminal (se preferir git):**
   ```bash
   git init
   git add index.html README.md
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

- Para já abrir com uma playlist fixa, você pode editar a função `loadDemo()` no `index.html` e trocar as URLs de exemplo pelas suas.
- As cores, tamanhos de fonte e espaçamentos ficam todos no bloco `<style>` no topo do arquivo — fáceis de ajustar.
