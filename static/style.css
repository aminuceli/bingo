const socket = io();

// --- 1. CONFIGURAÇÃO DE ÁUDIO E MÚSICA ---

// Efeitos Sonoros
const audioSpin = new Audio('/static/sounds/spin.mp3');
const audioPop = new Audio('/static/sounds/pop.mp3');
const audioWin = new Audio('/static/sounds/win.mp3');
const audioClick = new Audio('/static/sounds/click.mp3');

// Música de Fundo (Jazz/Lounge)
const bgMusic = new Audio('/static/sounds/music.mp3');
bgMusic.loop = true;   // Repetir para sempre
bgMusic.volume = 0.2;  // Volume baixo (20%) para não atrapalhar

// Configuração dos Efeitos
audioSpin.loop = true; // O barulho do globo girando deve ser contínuo
audioSpin.volume = 0.5;
audioWin.volume = 1.0;

// Função: Ligar/Desligar Música (Botão no Topo)
function toggleMusic() {
    const btn = document.getElementById('btn-music');
    
    if (bgMusic.paused) {
        bgMusic.play().catch(e => console.log("Erro ao tocar música: ", e));
        btn.innerHTML = "🎵 ON";
        btn.classList.remove('music-off');
    } else {
        bgMusic.pause();
        btn.innerHTML = "🔇 OFF";
        btn.classList.add('music-off');
    }
}

// Função: Narrador (Voz do Navegador)
function narrarNumero(num) {
    if ('speechSynthesis' in window) {
        // Cancela falas anteriores para não acumular
        window.speechSynthesis.cancel();
        
        const msg = new SpeechSynthesisUtterance();
        msg.text = `Número ${num}`;
        msg.lang = 'pt-BR'; 
        msg.rate = 1.2; // Um pouco mais rápido
        window.speechSynthesis.speak(msg);
    }
}

// --- 2. VARIÁVEIS GLOBAIS ---
let curRoom = "";
let myName = "";
let myCard = [];
let marked = new Set();
let drawnHist = [];
let timerInt;


// --- 3. LOBBY E CONEXÃO ---

// Atualiza a lista de salas disponíveis
socket.on('room_list_update', (data) => {
    const list = document.getElementById('rooms-list');
    list.innerHTML = "";
    
    if (!data.rooms.length) {
        list.innerHTML = "<p style='text-align:center;color:#666'>Sem salas ativas.</p>";
        return;
    }
    
    data.rooms.forEach(r => {
        const div = document.createElement('div');
        const isFull = r.count >= r.limit;
        
        div.className = isFull ? 'room-btn full' : 'room-btn';
        div.innerHTML = `
            <span><strong style="color:#ffd700">${r.id}</strong> <small>${r.active ? '(JOGANDO)' : ''}</small></span>
            <span>👤 ${r.count}/${r.limit}</span>
        `;
        
        // Só permite clicar se não estiver cheia e o jogo não tiver começado
        if (!isFull && !r.active) {
            div.onclick = () => { 
                document.getElementById('room_id').value = r.id;
                joinRoom(); 
            };
        }
        list.appendChild(div);
    });
});

// Entrar na Sala
function joinRoom() {
    myName = document.getElementById('username').value.trim();
    const rid = document.getElementById('room_id').value.trim();
    const limit = document.getElementById('max_players').value;

    if (!myName || !rid) return alert("Preencha seu apelido e o nome da sala!");
    
    // Feedback sonoro
    audioClick.play().catch(e => {});

    // Tenta iniciar a música caso o usuário tenha pulado o modal
    if (bgMusic.paused) {
        bgMusic.play().catch(e => console.log("Aguardando interação para música"));
    }

    // Envia comando para o servidor
    socket.emit('create_join_room', { 
        username: myName, 
        room_id: rid,
        limit: limit 
    });
}

// Resposta: Erro ao entrar
socket.on('error_msg', (d) => {
    document.getElementById('error-msg').innerText = d.msg;
    // Limpa a mensagem de erro depois de 3 segundos
    setTimeout(() => document.getElementById('error-msg').innerText = "", 3000);
});

// Resposta: Sucesso ao entrar
socket.on('room_joined', (d) => {
    curRoom = d.room_id; 
    myCard = d.card;
    
    // Troca a tela (Esconde Lobby -> Mostra Jogo)
    document.getElementById('lobby-screen').classList.remove('active');
    document.getElementById('game-screen').classList.add('active');
    
    // Preenche informações do topo
    document.getElementById('display-room').innerText = curRoom;
    document.getElementById('room-limit').innerText = d.limit;
    
    // Se for o Admin (primeiro a entrar), mostra botão de iniciar
    if (d.is_admin) {
        document.getElementById('btn-start').classList.remove('hidden');
    }
    
    document.getElementById('waiting-msg').classList.remove('hidden');
    renderCard(); // Desenha a cartela
});


// --- 4. LÓGICA DO JOGO ---

function startGame() { 
    audioClick.play();
    socket.emit('start_game_cmd', { room_id: curRoom }); 
}

// O Jogo Começou (preparação)
socket.on('game_started', () => {
    document.getElementById('btn-start').classList.add('hidden');
    document.getElementById('waiting-msg').classList.add('hidden');
    
    // Reseta variáveis visuais
    drawnHist = []; 
    marked.clear();
    document.querySelectorAll('.grid-item').forEach(e => e.classList.remove('marked'));
    document.getElementById('score-text').innerText = "0/20";
    document.getElementById('progress-fill').style.width = "0%";
    
    document.getElementById('ticker-content').innerHTML = "🎲 O SORTEIO COMEÇOU! BOA SORTE! 🎲";
    
    // Contagem regressiva visual inicial
    startTimer(3); 
});

// FASE 1: Girando o Globo
socket.on('spinning_start', () => {
    // Visual
    document.getElementById('globe-img').classList.add('shaking');
    document.getElementById('current-ball').classList.add('hidden');
    
    const t = document.getElementById('timer'); 
    t.innerText = "GIRANDO..."; 
    t.classList.add('timer-active');

    // Áudio
    audioSpin.currentTime = 0;
    audioSpin.play().catch(e => {});
});

// FASE 2: Bola Sorteada
socket.on('number_drawn', (d) => {
    // Para o efeito de giro
    document.getElementById('globe-img').classList.remove('shaking');
    document.getElementById('timer').classList.remove('timer-active');
    audioSpin.pause();
    
    // Toca som POP e mostra bola
    audioPop.currentTime = 0;
    audioPop.play();
    
    const b = document.getElementById('current-ball');
    document.getElementById('ball-number').innerText = d.number;
    
    // Narração (com pequeno atraso para não cobrir o POP)
    setTimeout(() => narrarNumero(d.number), 600);

    // Animação CSS da bola aparecendo
    b.classList.remove('hidden'); 
    b.classList.remove('ball-enter'); 
    void b.offsetWidth; // Truque para reiniciar animação CSS
    b.classList.add('ball-enter');
    
    // Atualiza histórico no rodapé
    drawnHist.push(`<div class="ticker-ball">${d.number}</div>`);
    document.getElementById('ticker-content').innerHTML = drawnHist.join("");
    
    // Inicia timer para a próxima bola (8 segundos)
    startTimer(8);
});

// FASE 3: Fim de Jogo (Bingo!)
socket.on('game_over', (d) => {
    audioSpin.pause(); // Garante que o giro parou
    audioWin.currentTime = 0;
    audioWin.play();

    document.getElementById('winner-name').innerText = d.winner;
    document.getElementById('winner-modal').style.display = 'flex';
    
    clearInterval(timerInt);
});


// --- 5. FUNÇÕES AUXILIARES ---

// Renderiza a Cartela no HTML
function renderCard() {
    const g = document.getElementById('bingo-card'); 
    g.innerHTML = ""; // Limpa cartela anterior
    
    myCard.forEach(n => {
        const d = document.createElement('div'); 
        d.className = 'grid-item'; 
        d.innerText = n; 
        d.id = `n-${n}`;
        
        // Clique no número
        d.onclick = () => {
            audioClick.currentTime = 0;
            audioClick.play();

            if(marked.has(n)) { 
                marked.delete(n); 
                d.classList.remove('marked'); 
            } else { 
                marked.add(n); 
                d.classList.add('marked'); 
            }
            
            // Atualiza progresso
            document.getElementById('score-text').innerText = `${marked.size}/20`;
            document.getElementById('progress-fill').style.width = `${(marked.size/20)*100}%`;
            
            // Verifica vitória AUTOMATICAMENTE ao clicar
            if(marked.size === 20) {
                socket.emit('bingo_shout', { room_id: curRoom, marked: Array.from(marked) });
            }
        };
        g.appendChild(d);
    });
}

// Timer visual simples
function startTimer(s) {
    clearInterval(timerInt);
    let t = s; 
    const el = document.getElementById('timer');
    el.innerText = t + "s";
    
    timerInt = setInterval(() => { 
        t--; 
        if(t>=0) el.innerText = t + "s"; 
        else clearInterval(timerInt); 
    }, 1000);
}

// Atualiza lista de jogadores na sala
socket.on('update_players', (d) => {
    document.getElementById('player-count').innerText = d.count;
    document.getElementById('room-limit').innerText = d.limit;
    
    const ul = document.getElementById('players-ul'); 
    ul.innerHTML = "";
    
    d.players.forEach(p => {
        // Se for o meu nome, pinta de dourado
        const color = p === myName ? '#ffd700' : '#fff';
        ul.innerHTML += `<li style="padding:10px;border-bottom:1px solid #333;color:${color}">${p}</li>`;
    });
});

// Menu Dropdown de Jogadores
function togglePlayerList() { 
    audioClick.play();
    const e = document.getElementById('player-dropdown'); 
    e.style.display = e.style.display === 'block' ? 'none' : 'block'; 
}

// Fecha dropdown ao clicar fora
window.onclick = (e) => { 
    if(!e.target.closest('.players-info')) {
        document.getElementById('player-dropdown').style.display = 'none'; 
    }
}
