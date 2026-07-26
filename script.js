(function () {
  "use strict";

  var STORAGE_KEY = "iptv_player_playlist_url";
  var channels = [];
  var focusIndex = -1;
  var focusables = []; // elementos focaveis na tela atual (setup)
  var video = document.getElementById("video");
  var setupScreen = document.getElementById("setup");
  var playerScreen = document.getElementById("playerScreen");
  var statusEl = document.getElementById("status");
  var channelListEl = document.getElementById("channelList");
  var letterBarEl = document.getElementById("letterBar");
  var osd = document.getElementById("osd");
  var helpBar = document.getElementById("helpBar");
  var hlsInstance = null;
  var currentFilterLetter = null; // null = "Todos"; senao "A".."Z", "0-9" ou "#"

  /**
   * Atualiza a mensagem de status exibida na interface.
   * @param {string} msg Texto a ser exibido; limpa a mensagem quando vazio.
   */
  function setStatus(msg) {
    statusEl.textContent = msg || "";
  }

  // ---------- Parser de M3U simples (sem dependencias) ----------
  /**
   * Converte o texto de uma playlist M3U em um array de canais.
   * Extrai nome, URL e logo (tvg-logo) de cada canal.
   * @param {string} text Conteudo M3U completo.
   * @returns {Array<{name:string,url:string,logo:string}>} Lista de canais com logo.
   */
  function parseM3U(text) {
    var lines = text.split(/\r?\n/);
    var list = [];
    var currentName = null;
    var currentLogo = null;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (!line) { continue; }
      line = line.replace(/^\s+|\s+$/g, "");
      if (line.indexOf("#EXTINF") === 0) {
        // Extrai o nome (após a última vírgula)
        var commaIdx = line.lastIndexOf(",");
        currentName = commaIdx >= 0 ? line.substring(commaIdx + 1) : "Canal";
        
        // Extrai a logo (tvg-logo="URL")
        var logoMatch = line.match(/tvg-logo="([^"]+)"/);
        currentLogo = logoMatch ? logoMatch[1] : null;
      } else if (line.indexOf("#") === 0) {
        // outras tags M3U (ignoradas)
        continue;
      } else {
        // linha de URL
        list.push({
          name: currentName || line,
          url: line,
          logo: currentLogo
        });
        currentName = null;
        currentLogo = null;
      }
    }
    return list;
  }

  // ---------- Navegacao por letra ----------
  /**
   * Retorna o grupo de filtro correspondente ao primeiro caracter do nome.
   * Letras A-Z retornam a mesma letra, digitos retornam "0-9" e outros caracteres retornam "#".
   * @param {string} name Nome do canal.
   * @returns {string} Grupo de letra para filtragem.
   */
  function getLetterGroup(name) {
    if (!name) { return "#"; }
    var trimmed = name.replace(/^\s+/, "");
    var ch = trimmed.charAt(0).toUpperCase();
    if (ch >= "A" && ch <= "Z") { return ch; }
    if (ch >= "0" && ch <= "9") { return "0-9"; }
    return "#";
  }

  /**
   * Calcula os grupos de letra presentes na lista de canais.
   * Garante ordem alfabética e coloca "0-9" antes de "#".
   * @param {Array<{name:string}>} list Lista de canais.
   * @returns {string[]} Letras/agrupamentos disponíveis.
   */
  function computeLetterGroups(list) {
    var seen = {};
    var letters = [];
    for (var i = 0; i < list.length; i++) {
      var g = getLetterGroup(list[i].name);
      if (!seen[g]) { seen[g] = true; letters.push(g); }
    }
    letters.sort(function (a, b) {
      if (a === b) { return 0; }
      if (a === "#") { return 1; }
      if (b === "#") { return -1; }
      if (a === "0-9") { return 1; }
      if (b === "0-9") { return -1; }
      return a < b ? -1 : 1;
    });
    return letters;
  }

  /**
   * Define a letra de filtro ativa e atualiza a lista de canais exibida.
   * @param {string|null} letter Letra selecionada, ou null para mostrar todos.
   */
  function selectLetter(letter) {
    currentFilterLetter = letter;
    renderChannelList();
  }

  /**
   * Cria dinamicamente os botões de filtragem por letra na barra de letras.
   * Inclui o botão "Todos" e os botões para as letras presentes na playlist.
   */
  function renderLetterBar() {
    var letters = computeLetterGroups(channels);
    letterBarEl.innerHTML = "";

    var allBtn = document.createElement("button");
    allBtn.className = "btn letter-btn" + (currentFilterLetter === null ? " letter-active" : "");
    allBtn.textContent = "Todos";
    allBtn.setAttribute("tabindex", "0");
    allBtn.addEventListener("click", function () { selectLetter(null); });
    letterBarEl.appendChild(allBtn);

    for (var i = 0; i < letters.length; i++) {
      (function (letter) {
        var btn = document.createElement("button");
        btn.className = "btn letter-btn" + (currentFilterLetter === letter ? " letter-active" : "");
        btn.textContent = letter;
        btn.setAttribute("tabindex", "0");
        btn.addEventListener("click", function () { selectLetter(letter); });
        letterBarEl.appendChild(btn);
      })(letters[i]);
    }
  }

  /**
   * Atualiza a exibição da logo do canal na coluna ao lado.
   * @param {number} index Índice do canal na lista `channels`.
   */
  function updateChannelLogo(index) {
    var ch = channels[index];
    if (!ch) { return; }
    var logoImg = document.getElementById("logoImage");
    var logoPlaceholder = document.getElementById("logoPlaceholder");
    if (ch.logo) {
      logoImg.src = ch.logo;
      logoImg.style.display = "block";
      logoPlaceholder.style.display = "none";
    } else {
      logoImg.style.display = "none";
      logoPlaceholder.textContent = ch.name + " (sem logo)";
      logoPlaceholder.style.display = "block";
    }
  }

  /**
   * Renderiza a lista de canais filtrada de acordo com a letra selecionada.
   * Também atualiza a barra de letras antes de mostrar os canais.
   */
  function renderChannelList() {
    renderLetterBar();
    channelListEl.innerHTML = "";
    var firstFilteredIndex = -1;
    for (var i = 0; i < channels.length; i++) {
      if (currentFilterLetter !== null && getLetterGroup(channels[i].name) !== currentFilterLetter) {
        continue;
      }
      if (firstFilteredIndex === -1) { firstFilteredIndex = i; }
      var li = document.createElement("li");
      li.textContent = channels[i].name;
      li.setAttribute("data-index", i);
      li.setAttribute("tabindex", "0");
      (function (idx) {
        li.addEventListener("click", function () { playChannel(idx); });
        li.addEventListener("focus", function () { updateChannelLogo(idx); });
        li.addEventListener("mouseover", function () { updateChannelLogo(idx); });
      })(i);
      channelListEl.appendChild(li);
    }
    rebuildFocusables();
    if (firstFilteredIndex !== -1) {
      updateChannelLogo(firstFilteredIndex);
    }
  }

  // Dominios de servicos de streaming licenciados/comerciais que bloqueiam explicitamente
  // reproducao fora dos apps oficiais (via CORS restrito e/ou DRM). Nao adicionamos esses
  // links a lista de canais -- nao e um problema tecnico a "contornar", e uma restricao
  // proposital de licenciamento de conteudo.
  var BLOCKED_HOST_PATTERNS = [
    /(^|\.)pluto\.tv$/i,
    /(^|\.)tubitv\.com$/i,
    /(^|\.)plex\.tv$/i,
    /(^|\.)xumo\.com$/i,
    /(^|\.)therokuchannel\.roku\.com$/i,
    /(^|\.)sling\.com$/i,
    /(^|\.)fubo\.tv$/i,
    /(^|\.)philo\.com$/i,
    /(^|\.)hulu\.com$/i,
    /(^|\.)netflix\.com$/i,
    /(^|\.)disneyplus\.com$/i,
    /(^|\.)max\.com$/i,
    /(^|\.)peacocktv\.com$/i,
    /(^|\.)paramountplus\.com$/i,
    /(^|\.)primevideo\.com$/i,
    /(^|\.)crunchyroll\.com$/i,
    /(^|\.)globoplay\.globo\.com$/i
  ];

  function getHostname(url) {
    try {
      // new URL() e suficiente aqui: se a TV nao suportar, o catch abaixo lida com isso
      return new URL(url).hostname;
    } catch (e) {
      var m = url.match(/^https?:\/\/([^\/:]+)/i);
      return m ? m[1] : "";
    }
  }

  function isBlockedStreamingService(url) {
    var host = getHostname(url);
    if (!host) { return false; }
    for (var i = 0; i < BLOCKED_HOST_PATTERNS.length; i++) {
      if (BLOCKED_HOST_PATTERNS[i].test(host)) { return true; }
    }
    return false;
  }

  // Converte links do formato github.com/OWNER/REPO/raw|blob/BRANCH/PATH
  // (que nao enviam cabecalho CORS) para raw.githubusercontent.com (que envia).
  /**
   * Converte URLs de playlist do GitHub para raw.githubusercontent.com.
   * Isso aumenta a chance de funcionar com CORS em navegadores que exigem cabeçalhos permissivos.
   * @param {string} url URL da playlist no formato github.com.
   * @returns {string} URL convertida ou original se não for um repositório GitHub.
   */
  function normalizePlaylistUrl(url) {
    var re = /^https?:\/\/github\.com\/([^\/]+)\/([^\/]+)\/(?:raw|blob)\/(?:refs\/heads\/)?([^\/]+)\/(.+)$/i;
    var m = url.match(re);
    if (m) {
      return "https://raw.githubusercontent.com/" + m[1] + "/" + m[2] + "/" + m[3] + "/" + m[4];
    }
    return url;
  }

  /**
   * Filtra canais cuja URL pertence a serviços licenciados/comerciais bloqueados.
   * Retorna uma lista de canais permitidos e a contagem dos canais ignorados.
   * @param {Array<{name:string,url:string}>} list Lista de canais parseados.
   * @returns {{kept:Array, skipped:number}} Resultado com canais mantidos e ignorados.
   */
  function filterBlockedChannels(list) {
    var kept = [];
    var skipped = 0;
    for (var i = 0; i < list.length; i++) {
      if (isBlockedStreamingService(list[i].url)) {
        skipped++;
      } else {
        kept.push(list[i]);
      }
    }
    return { kept: kept, skipped: skipped };
  }

  // Ao trocar toda a lista de canais (playlist nova), comeca o filtro ja na primeira
  // letra disponivel em vez de "Todos" -- evita renderizar milhares de itens de uma
  // vez soh em listas grandes (como a padrao do iptv-org), o que travaria TVs antigas.
  /**
   * Seleciona automaticamente a primeira letra disponível ao carregar uma nova playlist.
   * Isso evita renderizar todos os canais de uma lista muito grande imediatamente.
   */
  function resetFilterForNewList() {
    var letters = computeLetterGroups(channels);
    currentFilterLetter = letters.length > 0 ? letters[0] : null;
    selectLetter(currentFilterLetter);
  }

  /**
   * Tenta carregar a playlist M3U a partir de uma URL.
   * Se a leitura falhar por CORS ou erro de rede, faz fallback para adicionar a URL como canal único.
   * @param {string} rawUrl URL informada pelo usuário.
   */
  function loadFromUrl(rawUrl) {
    if (!rawUrl) { setStatus("Informe uma URL valida."); return; }
    var url = normalizePlaylistUrl(rawUrl);
    if (url !== rawUrl) {
      setStatus("Link do GitHub convertido automaticamente para um formato compativel com CORS...");
    } else {
      setStatus("Carregando playlist...");
    }
    var fallbackDone = false;
    function fallbackToSingleChannel(msg) {
      if (fallbackDone) { return; } // evita duplicar o canal se onerror e onreadystatechange dispararem juntos
      fallbackDone = true;
      setStatus(msg);
      addSingleChannel(rawUrl);
    }
    var xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4) {
        if (xhr.status === 200 && xhr.responseText) {
          var parsed = parseM3U(xhr.responseText);
          var filtered = filterBlockedChannels(parsed);
          channels = filtered.kept;
          resetFilterForNewList();
          if (channels.length === 0 && filtered.skipped === 0) {
            setStatus("Nenhum canal encontrado nessa playlist.");
          } else {
            var msg = channels.length + " canal(is) carregado(s).";
            if (filtered.skipped > 0) {
              msg += " " + filtered.skipped + " canal(is) de servicos de streaming licenciado foram ignorados automaticamente (ex.: Pluto TV, Tubi).";
            }
            setStatus(msg);
            try { localStorage.setItem(STORAGE_KEY, rawUrl); } catch (e) {}
          }
          renderChannelList();
        } else {
          fallbackToSingleChannel("Nao foi possivel ler o conteudo dessa URL (status " + xhr.status + ", provavel bloqueio de CORS individual desse servidor). Adicionando automaticamente como canal unico, sem leitura do conteudo...");
        }
      }
    };
    xhr.onerror = function () {
      fallbackToSingleChannel("Erro de rede ao buscar a playlist (bloqueio de CORS/redirecionamento desse servidor especifico). Adicionando automaticamente como canal unico, sem leitura do conteudo...");
    };
    xhr.send();
  }

  // Adiciona a URL diretamente como um canal, SEM tentar ler/parsear o conteudo remoto.
  // Util quando a URL e o proprio stream (ou um encurtador que redireciona para ele),
  // e o servidor nao libera CORS para leitura via JavaScript -- mas a reproducao nativa
  // via <video> nao depende de CORS, entao isso continua funcionando.
  /**
   * Adiciona uma URL direta como canal na lista, sem tentar carregar ou parsear a playlist.
   * @param {string} rawUrl URL do stream ou playlist que sera tratada como canal unico.
   */
  function addSingleChannel(rawUrl) {
    if (!rawUrl) { setStatus("Informe uma URL valida."); return; }
    if (isBlockedStreamingService(rawUrl)) {
      setStatus("Este link pertence a um servico de streaming licenciado (ex.: Pluto TV, Tubi, etc.) que bloqueia intencionalmente reproducao fora do app oficial. Nao foi adicionado a lista.");
      return;
    }
    var url = normalizePlaylistUrl(rawUrl);
    channels.push({ name: "Canal " + (channels.length + 1) + " (URL direta)", url: url });
    renderChannelList();
    setStatus("Canal adicionado sem leitura do conteudo remoto. Selecione-o na lista abaixo para reproduzir. " +
      "Obs.: se o navegador precisar cair para o hls.js (sem HLS nativo), o servidor do stream ainda " +
      "precisara liberar CORS para os segmentos de video -- isso depende do provedor, nao do player.");
    try { localStorage.setItem(STORAGE_KEY, rawUrl); } catch (e) {}
  }

  /**
   * Carrega uma playlist M3U a partir do texto colado pelo usuario.
   * Parseia o conteudo, filtra canais bloqueados e exibe a lista de canais.
   * @param {string} text Conteudo bruto da playlist M3U.
   */
  function loadFromText(text) {
    if (!text || text.replace(/\s/g, "") === "") {
      setStatus("Cole o conteudo da playlist antes de carregar.");
      return;
    }
    var parsed = parseM3U(text);
    var filtered = filterBlockedChannels(parsed);
    channels = filtered.kept;
    resetFilterForNewList();
    if (channels.length === 0 && filtered.skipped === 0) {
      setStatus("Nenhum canal reconhecido no texto colado.");
    } else {
      var msg = channels.length + " canal(is) carregado(s).";
      if (filtered.skipped > 0) {
        msg += " " + filtered.skipped + " canal(is) de servicos de streaming licenciado foram ignorados automaticamente (ex.: Pluto TV, Tubi).";
      }
      setStatus(msg);
    }
    renderChannelList();
  }

  // Lista de exemplo com streams de teste publicos (uso livre para testes)
  /**
   * Carrega uma playlist de exemplo com streams públicos de teste.
   * Usa duas URLs conhecidas para demonstrar o funcionamento do player.
   */
  function loadDemo() {
    var demo = "#EXTM3U\n" +
      "#EXTINF:-1,Demo - Big Buck Bunny (HLS)\n" +
      "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8\n" +
      "#EXTINF:-1,Demo - Apple Basic Stream\n" +
      "https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_fmp4/master.m3u8\n";
    loadFromText(demo);
    setStatus("Lista de exemplo carregada (streams publicos de teste).");
  }

  // ---------- Reproducao ----------
  var currentChannelIndex = -1;

  /**
   * Alterna da tela de lista para a tela de player e inicia reproducao do canal selecionado.
   * @param {number} index Indice do canal na lista `channels`.
   */
  function playChannel(index) {
    var ch = channels[index];
    if (!ch) { return; }
    currentChannelIndex = index;
    setupScreen.style.display = "none";
    playerScreen.style.display = "block";
    helpBar.style.display = "block";
    showOsd(ch.name);
    startPlayback(ch.url);
  }

  /**
   * Troca para o proximo/anterior canal da lista completa, sem sair da tela de player.
   * @param {number} delta +1 para o proximo canal, -1 para o anterior.
   */
  function changeChannel(delta) {
    if (channels.length === 0 || currentChannelIndex === -1) { return; }
    var newIndex = currentChannelIndex + delta;
    if (newIndex < 0) { newIndex = 0; }
    if (newIndex > channels.length - 1) { newIndex = channels.length - 1; }
    if (newIndex === currentChannelIndex) { return; }
    playChannel(newIndex);
  }

  var VOLUME_STEP = 0.1;

  /**
   * Ajusta o volume do video em incrementos, exibindo o novo nivel no OSD.
   * @param {number} delta Variacao do volume, de -1 a 1 (ex.: +-0.1).
   */
  function changeVolume(delta) {
    var vol = video.volume;
    if (video.muted) { video.muted = false; vol = 0; }
    vol = vol + delta;
    if (vol < 0) { vol = 0; }
    if (vol > 1) { vol = 1; }
    video.volume = vol;
    showOsd("Volume: " + Math.round(vol * 100) + "%");
  }

  /**
   * Limpa e destroi a instancia atual do hls.js, se existir.
   */
  function destroyHls() {
    if (hlsInstance) {
      try { hlsInstance.destroy(); } catch (e) {}
      hlsInstance = null;
    }
  }

  // Toca o video tratando o bloqueio de autoplay dos navegadores:
  // tenta com som; se for rejeitado, tenta mudo e avisa o usuario.
  /**
   * Tenta iniciar a reproducao do video e trata bloqueios de autoplay.
   * Em caso de bloqueio, silencia o video e tenta novamente, avisando o usuario.
   */
  function safePlay() {
    var p;
    try { p = video.play(); } catch (e) { p = null; }
    if (p && typeof p.then === "function") {
      p.catch(function () {
        if (!video.muted) {
          video.muted = true;
          showOsd("Som desativado pelo navegador. Pressione OK ou toque na tela para reativar o som.");
          var retry = video.play();
          if (retry && retry.catch) {
            retry.catch(function () {
              setStatus("O navegador bloqueou a reproducao automatica. Use o botao de play do proprio video.");
            });
          }
          armUnmuteOnInteraction();
        }
      });
    }
  }

  var unmuteArmed = false;
  /**
   * Arma um evento para remover o mute quando o usuario interagir novamente.
   * Isso melhora a experiencia depois que o autoplay for bloqueado e o video for silenciado.
   */
  function armUnmuteOnInteraction() {
    if (unmuteArmed) { return; }
    unmuteArmed = true;
    var unmute = function () {
      video.muted = false;
      unmuteArmed = false;
      document.removeEventListener("keydown", unmute);
      document.removeEventListener("click", unmute);
    };
    document.addEventListener("keydown", unmute);
    document.addEventListener("click", unmute);
  }

  // Carregamento do hls.js com fila de espera (evita tentar usar Hls antes do script terminar de carregar)
  var hlsLibStatus = "idle"; // idle | loading | ready | failed
  var hlsReadyQueue = [];

  // Alguns navegadores de Smart TV / apps hibridos ja trazem uma versao do hls.js
  // pre-carregada globalmente (window.Hls). Checamos isso primeiro, antes de tentar
  // baixar qualquer coisa da internet -- importante para TVs com acesso limitado a CDNs externos.
  /**
   * Verifica se o navegador/jogador ja possui hls.js embutido.
   * @returns {boolean} true se window.Hls estiver disponivel e suportado.
   */
  function hasBuiltInHls() {
    return !!(window.Hls && window.Hls.isSupported);
  }

  // Varios CDNs de fallback: uma TV antiga pode ter DNS/certificado que falha
  // com um CDN especifico mas funciona com outro.
  var HLS_CDN_URLS = [
    "https://cdnjs.cloudflare.com/ajax/libs/hls.js/1.5.13/hls.min.js",
    "https://cdn.jsdelivr.net/npm/hls.js@1.5.13/dist/hls.min.js",
    "https://unpkg.com/hls.js@1.5.13/dist/hls.min.js"
  ];

  /**
   * Carrega um script externo de forma assíncrona e notifica quando termina.
   * Usa timeout para tratar falhas de rede ou CDN indisponível.
   * @param {string} src URL do script a ser carregado.
   * @param {function(boolean)} onDone Callback chamado com true em caso de sucesso.
   */
  function tryLoadScript(src, onDone) {
    var settled = false;
    var script = document.createElement("script");
    script.src = src;
    script.async = true;
    var timer = setTimeout(function () {
      if (!settled) { settled = true; onDone(false); }
    }, 8000);
    script.onload = function () {
      if (settled) { return; }
      settled = true;
      clearTimeout(timer);
      onDone(true);
    };
    script.onerror = function () {
      if (settled) { return; }
      settled = true;
      clearTimeout(timer);
      onDone(false);
    };
    document.head.appendChild(script);
  }

  /**
   * Resolve a fila de callbacks esperando o carregamento do hls.js.
   * @param {boolean} ok Indica se o hls.js foi carregado com sucesso.
   */
  function resolveHlsQueue(ok) {
    hlsLibStatus = ok ? "ready" : "failed";
    var q = hlsReadyQueue;
    hlsReadyQueue = [];
    for (var i = 0; i < q.length; i++) { q[i](ok); }
  }

  /**
   * Garante que hls.js esteja carregado antes de tentar usar o fallback HLS.
   * Se ja estiver disponível localmente, chama o callback imediatamente.
   * @param {function(boolean)} callback Recebe true se hls.js estiver pronto.
   */
  function ensureHlsJsLoaded(callback) {
    // 1) A TV ja tem hls.js embutido? Usa direto, sem baixar nada.
    if (hasBuiltInHls()) { hlsLibStatus = "ready"; callback(true); return; }
    if (hlsLibStatus === "failed") { callback(false); return; }
    hlsReadyQueue.push(callback);
    if (hlsLibStatus === "loading") { return; }
    hlsLibStatus = "loading";

    // 2) Nao tem embutido: tenta os CDNs em sequencia ate um funcionar.
    var idx = 0;
    function tryNextCdn() {
      if (hasBuiltInHls()) { resolveHlsQueue(true); return; }
      if (idx >= HLS_CDN_URLS.length) { resolveHlsQueue(false); return; }
      var url = HLS_CDN_URLS[idx];
      idx++;
      tryLoadScript(url, function (ok) {
        if (ok && hasBuiltInHls()) {
          resolveHlsQueue(true);
        } else {
          tryNextCdn();
        }
      });
    }
    tryNextCdn();
  }

  /**
   * Inicia a reprodução HLS usando hls.js após garantir que a biblioteca esteja carregada.
   * Exibe mensagens de status e trata erros fatais do player HLS.
   * @param {string} url URL do stream HLS.
   */
  function tryHlsJs(url) {
    setStatus("Carregando reprodutor HLS (hls.js)...");
    ensureHlsJsLoaded(function (ok) {
      if (ok && window.Hls && window.Hls.isSupported && window.Hls.isSupported()) {
        setStatus("");
        hlsInstance = new window.Hls();
        hlsInstance.loadSource(url);
        hlsInstance.attachMedia(video);
        hlsInstance.on(window.Hls.Events.MANIFEST_PARSED, function () {
          safePlay();
        });
        hlsInstance.on(window.Hls.Events.ERROR, function (event, data) {
          if (data && data.fatal) {
            setStatus("Erro ao reproduzir via hls.js (" + data.type + "). O canal pode estar fora do ar ou bloqueado.");
          }
        });
      } else {
        setStatus("Este navegador nao suporta HLS nativo nem MediaSource Extensions (hls.js). Nao e possivel reproduzir este canal aqui.");
        backToList();
      }
    });
  }

  /**
   * Tenta reproduzir o stream com suporte nativo a HLS e, se falhar, cai para hls.js.
   * @param {string} url URL do stream HLS.
   */
  function tryNativeThenFallback(url) {
    var canNative = video.canPlayType("application/vnd.apple.mpegurl") ||
                     video.canPlayType("application/x-mpegURL");
    if (!canNative) {
      tryHlsJs(url);
      return;
    }
    var fellBack = false;
    var onErr = function () {
      video.removeEventListener("error", onErr);
      if (!fellBack) {
        fellBack = true;
        tryHlsJs(url);
      }
    };
    video.addEventListener("error", onErr);
    video.src = url;
    safePlay();
  }

  /**
   * Prepara o elemento <video> para reproduzir uma URL e escolhe o modo correto.
   * Usa HTML5 para arquivos directos e HLS/nativo/hls.js para playlists/streams.
   * @param {string} url URL do canal a ser reproduzido.
   */
  function startPlayback(url) {
    destroyHls();
    video.muted = false;
    video.pause();
    video.removeAttribute("src");
    video.load();

    var cleanUrl = url.split("?")[0];
    var ext = cleanUrl.substring(cleanUrl.lastIndexOf(".") + 1).toLowerCase();
    var directExts = ["mp4", "webm", "ogg", "ogv", "mov", "mkv"];

    if (directExts.indexOf(ext) !== -1) {
      // arquivo de video direto -- HTML5 nativo
      video.src = url;
      safePlay();
      return;
    }

    // trata como HLS (extensao .m3u8 ou desconhecida): tenta nativo, cai para hls.js se falhar
    tryNativeThenFallback(url);
  }

  /**
   * Volta da tela de player para a tela de configuração/lista de canais.
   * Para e limpa o video, oculta o player e exibe a interface de listas.
   */
  function backToList() {
    destroyHls();
    video.pause();
    video.removeAttribute("src");
    video.load();
    playerScreen.style.display = "none";
    helpBar.style.display = "none";
    osd.style.display = "none";
    setupScreen.style.display = "block";
  }

  var osdTimer = null;
  /**
   * Exibe uma mensagem OSD (on-screen display) temporária sobre o video.
   * @param {string} text Texto a ser exibido na sobreposição.
   */
  function showOsd(text) {
    osd.textContent = text;
    osd.style.display = "block";
    if (osdTimer) { clearTimeout(osdTimer); }
    osdTimer = setTimeout(function () { osd.style.display = "none"; }, 4000);
  }

  // ---------- Navegacao por controle remoto / teclado ----------
  /**
   * Reconstrói a lista de elementos focáveis na tela atual.
   * Considera apenas elementos visíveis, para navegação com setas.
   */
  function rebuildFocusables() {
    focusables = [];
    var btns = setupScreen.querySelectorAll(".btn, #playlistUrl, #playlistText, #channelList li");
    for (var i = 0; i < btns.length; i++) {
      // ignora elementos ocultos (ex.: dentro de #pasteRow quando display:none)
      if (btns[i].offsetParent !== null) {
        focusables.push(btns[i]);
      }
    }
    if (focusIndex >= focusables.length) { focusIndex = focusables.length - 1; }
    if (focusIndex < 0 && focusables.length > 0) { focusIndex = 0; }
    applyFocusClass();
  }

  /**
   * Atualiza a classe CSS do elemento atualmente focado.
   * Também move o foco real do navegador para o elemento ativo.
   */
  function applyFocusClass() {
    for (var i = 0; i < focusables.length; i++) {
      if (i === focusIndex) {
        focusables[i].className = focusables[i].className.replace(/\s*focused/, "") + " focused";
        try { focusables[i].focus(); } catch (e) {}
      } else {
        focusables[i].className = focusables[i].className.replace(/\s*focused/, "");
      }
    }
  }

  /**
   * Move o foco entre os elementos navegaveis usando as setas.</n   * @param {number} delta Incremento de posicao (+1 ou -1).
   */
  function moveFocus(delta, minIndex, maxIndex) {
    if (focusables.length === 0) { return; }
    var lo = (typeof minIndex === "number") ? minIndex : 0;
    var hi = (typeof maxIndex === "number") ? maxIndex : (focusables.length - 1);
    focusIndex = focusIndex + delta;
    if (focusIndex < lo) { focusIndex = lo; }
    if (focusIndex > hi) { focusIndex = hi; }
    applyFocusClass();
    var el = focusables[focusIndex];
    if (el && el.scrollIntoView) { el.scrollIntoView({ block: "nearest" }); }
  }

  /**
   * Retorna [primeiroIndice, ultimoIndice] dos itens de canal dentro de
   * `focusables`, para limitar os saltos de pagina (setas esquerda/direita)
   * a essa faixa e nao invadir os botoes do topo.
   */
  function getChannelFocusRange() {
    var first = -1, last = -1;
    for (var i = 0; i < focusables.length; i++) {
      if (focusables[i].hasAttribute && focusables[i].hasAttribute("data-index")) {
        if (first === -1) { first = i; }
        last = i;
      }
    }
    return [first, last];
  }

  /**
   * Ativa o elemento atualmente focado, simulando o botao OK/Enter.
   * Se for um canal, inicia a reproducao; caso contrario, dispara o clique.
   */
  function activateFocused() {
    var el = focusables[focusIndex];
    if (!el) { return; }
    var tag = el.tagName.toLowerCase();
    if (tag === "input" || tag === "textarea") {
      // em campos de texto, Enter nao ativa; usuario digita normalmente
      return;
    }
    if (el.hasAttribute("data-index")) {
      playChannel(parseInt(el.getAttribute("data-index"), 10));
    } else {
      el.click();
    }
  }

  // Codigos de tecla comuns: setas, Enter/OK, Voltar (varia por fabricante de TV)
  var KEY_UP = [38];
  var KEY_DOWN = [40];
  var KEY_LEFT = [37];
  var KEY_RIGHT = [39];
  var KEY_OK = [13];
  // backspace, esc, samsung back, lg back, 4 (comum em back de Android TV -- mantido
  // como fallback inofensivo, mas TVs Multilaser com SO Linux proprio (nao Android TV)
  // costumam usar codigos diferentes; use o modo ?debug=1 abaixo para descobrir o real)
  var KEY_BACK = [8, 27, 10009, 461, 4];

  // Quantidade de posicoes que as setas esquerda/direita pulam quando o foco
  // esta sobre um item da lista de canais (navegacao rapida em listas grandes).
  var PAGE_JUMP = 10;

  // ---------- Modo de depuracao de teclas (?debug=1 na URL) ----------
  // Os keyCodes reais do controle variam por modelo de Smart TV. Se algum botao
  // nao estiver respondendo como esperado (ex.: Voltar na TV Multilaser), abra
  // o player com "?debug=1" no final da URL, aperte o botao na TV e o codigo
  // aparecera na tela de status -- ai e so adicionar esse numero no array
  // correspondente (KEY_BACK, KEY_LEFT, etc.) acima.
  var DEBUG_KEYS = /[?&]debug=1/.test(window.location.search);
  if (DEBUG_KEYS) {
    document.addEventListener("keydown", function (e) {
      var code = e.keyCode || e.which;
      setStatus("[debug] Tecla pressionada -- keyCode: " + code + " (key: " + (e.key || "?") + ")");
    });
  }

  document.addEventListener("keydown", function (e) {
    var code = e.keyCode || e.which;

    if (playerScreen.style.display === "block") {
      if (KEY_BACK.indexOf(code) !== -1) {
        e.preventDefault();
        backToList();
      } else if (KEY_UP.indexOf(code) !== -1) {
        e.preventDefault();
        changeChannel(-1);
      } else if (KEY_DOWN.indexOf(code) !== -1) {
        e.preventDefault();
        changeChannel(1);
      } else if (KEY_RIGHT.indexOf(code) !== -1) {
        e.preventDefault();
        changeVolume(VOLUME_STEP);
      } else if (KEY_LEFT.indexOf(code) !== -1) {
        e.preventDefault();
        changeVolume(-VOLUME_STEP);
      }
      return; // demais teclas (ex.: OK p/ play/pause) ficam a cargo dos controles nativos do <video controls>
    }

    // Se o foco atual for um campo de texto, nao interceptamos setas/Enter (para permitir digitacao)
    var active = document.activeElement;
    var isTyping = active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA");

    // O foco esta sobre um item de canal (tem data-index)? So nesse caso as
    // setas esquerda/direita fazem sentido como "salto" de N canais.
    var focusedIsChannel = !isTyping && active && active.hasAttribute && active.hasAttribute("data-index");

    if (KEY_DOWN.indexOf(code) !== -1 && !isTyping) {
      e.preventDefault(); moveFocus(1);
    } else if (KEY_UP.indexOf(code) !== -1 && !isTyping) {
      e.preventDefault(); moveFocus(-1);
    } else if (KEY_RIGHT.indexOf(code) !== -1 && focusedIsChannel) {
      e.preventDefault();
      var rangeR = getChannelFocusRange();
      moveFocus(PAGE_JUMP, rangeR[0], rangeR[1]);
    } else if (KEY_LEFT.indexOf(code) !== -1 && focusedIsChannel) {
      e.preventDefault();
      var rangeL = getChannelFocusRange();
      moveFocus(-PAGE_JUMP, rangeL[0], rangeL[1]);
    } else if (KEY_OK.indexOf(code) !== -1 && !isTyping) {
      e.preventDefault(); activateFocused();
    } else if (KEY_DOWN.indexOf(code) !== -1 && isTyping && active.tagName === "INPUT") {
      moveFocus(1);
    }
  });

  // ---------- Ligacoes de botoes ----------
  document.getElementById("btnLoadUrl").addEventListener("click", function () {
    loadFromUrl(document.getElementById("playlistUrl").value.replace(/^\s+|\s+$/g, ""));
  });

  document.getElementById("btnAddSingle").addEventListener("click", function () {
    addSingleChannel(document.getElementById("playlistUrl").value.replace(/^\s+|\s+$/g, ""));
  });

  document.getElementById("btnPasteToggle").addEventListener("click", function () {
    var row = document.getElementById("pasteRow");
    row.style.display = (row.style.display === "none") ? "block" : "none";
    rebuildFocusables();
  });

  document.getElementById("btnLoadText").addEventListener("click", function () {
    loadFromText(document.getElementById("playlistText").value);
  });

  document.getElementById("btnDemo").addEventListener("click", loadDemo);

  // Pre-carrega hls.js em segundo plano (nao bloqueia a pagina); quando o usuario
  // selecionar um canal, tryNativeThenFallback/tryHlsJs vao reaproveitar esse carregamento.
  if (window.MediaSource) {
    ensureHlsJsLoaded(function () {});
  }

  // Playlist padrao: catalogo publico do projeto iptv-org (milhares de canais,
  // hospedado no GitHub Pages, que libera CORS por padrao).
  var DEFAULT_PLAYLIST_URL = "https://iptv-org.github.io/iptv/index.m3u";

  // Restaura ultima URL usada (se o usuario ja carregou algo antes, respeita a escolha dele)
  var savedUrl = null;
  try { savedUrl = localStorage.getItem(STORAGE_KEY); } catch (e) {}

  var initialUrl = savedUrl || DEFAULT_PLAYLIST_URL;
  document.getElementById("playlistUrl").value = initialUrl;

  // Carrega automaticamente ao abrir a pagina
  loadFromUrl(initialUrl);

  rebuildFocusables();
})();

//exibe Informaçãoes do navegador.
function showFullDebugInfo() {
    var urlParams = new URLSearchParams(window.location.search);
    if (!urlParams.has('debug')) return;

    // 1. Coleta de dados profundos
    var gl = document.createElement('canvas').getContext('webgl');
    var dbgRender = gl ? gl.getExtension('WEBGL_debug_renderer_info') : null;
    
    var info = {
        "--- HARDWARE ---": "",
        "Plataforma": navigator.platform,
        "CPU (Nucleos)": navigator.hardwareConcurrency || "N/A",
        "Memoria RAM": navigator.deviceMemory ? "~" + navigator.deviceMemory + "GB" : "N/A",

        "--- TELA E VIDEO ---": "",
        "Resolucao Real": window.screen.width + "x" + window.screen.height,
        "Janela Atual": window.innerWidth + "x" + window.innerHeight,
        "Densidade Pixel": window.devicePixelRatio,
        "Profundidade Cor": window.screen.colorDepth + " bits",
        "Suporte HLS.js": (typeof Hls !== 'undefined' && Hls.isSupported()) ? "Sim" : "Nao",
        "HLS Nativo": document.createElement('video').canPlayType('application/vnd.apple.mpegurl') ? "Sim" : "Nao",
        "Suporte MSE": !!window.MediaSource ? "Sim" : "Nao",

        "--- REDE E NAVEGADOR ---": "",
        "Tipo Conexao": navigator.connection ? navigator.connection.effectiveType : "N/A",
        "Velocidade Est.": navigator.connection ? navigator.connection.downlink + " Mbps" : "N/A",
        "Latencia (RTT)": navigator.connection ? navigator.connection.rtt + " ms" : "N/A",
        "Online": navigator.onLine ? "Sim" : "Nao",
        "User Agent": navigator.userAgent
    };

    // 2. Estilizacao do Painel
    var debugDiv = document.createElement('div');
    debugDiv.id = 'full-debug-panel';
    debugDiv.style.cssText = 'position: fixed; top: 0; right: 0; width: 350px; height: 100vh; ' +
        'background: rgba(0, 0, 0, 0.92); color: #00ff00; ' +
        'font-family: "Consolas", monospace; font-size: 10px; ' +
        'padding: 15px; z-index: 100000; border-left: 2px solid #00ff00; ' +
        'overflow-y: auto; box-shadow: -5px 0 15px rgba(0,0,0,0.5);';

    // 3. Montagem do HTML
    var html = '<h3 style="color:#fff; border-bottom:1px solid #333; padding-bottom:5px;">DEBUG MASTER</h3>';
    for (var key in info) {
        if (key.indexOf("---") === 0) {
            html += '<div style="color:#ffcc00; margin-top:10px; font-weight:bold;">' + key + '</div>';
        } else {
            html += '<div style="display:flex; justify-content:space-between; margin-bottom:3px; border-bottom:1px solid #111;">' +
                        '<span style="color:#aaa;">' + key + ':</span>' +
                        '<span style="text-align:right; word-break:break-all; margin-left:10px;">' + info[key] + '</span>' +
                     '</div>';
        }
    }
    
    // 4. Botao de fechar
    html += '<button id="close-debug-btn" style="margin-top:20px; background:#f00; color:#fff; border:none; padding:5px; cursor:pointer; width:100%;">FECHAR DEBUG</button>';

    debugDiv.innerHTML = html;
    document.body.appendChild(debugDiv);

    // Listener para o botao de fechar (substituindo o onclick inline para maior seguranca)
    document.getElementById('close-debug-btn').addEventListener('click', function() {
        var el = document.getElementById('full-debug-panel');
        if (el) el.parentElement.removeChild(el);
    });
}

window.addEventListener('load', showFullDebugInfo);
