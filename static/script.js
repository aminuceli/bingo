const socket = io();

// --- CONFIGURAÇÃO DE ÁUDIO ---
// Caminhos dos arquivos (certifique-se que eles existem na pasta static/sounds)
const audioSpin = new Audio('/static/sounds/spin.mp3');
const audioPop = new Audio('/static/sounds/pop.mp3');
const audioWin = new Audio('/static/sounds/win.mp3');
const audioClick = new Audio('/static/sounds/click.mp3');

// Configurações de volume (0.0 a 1.0)
audioSpin.volume = 0.5;
audioSpin.loop = true; // O som do giro fica repetindo até parar
audioWin.volume = 1.0;


// NOVO: Música de Fundo
const bgMusic = new Audio('/static/sounds/music.mp3');
bgMusic.loop = true;   // Toca para sempre
bgMusic.volume = 0.2;  // Volume baixo (20%) para não atrapalhar a voz

// Configurações de volume dos efeitos
audioSpin.volume = 0.5;
audioWin.volume = 1.0;

// Função para Ligar/Desligar Música
function toggleMusic() {
    const btn = document.getElementById('btn-music');
    
    if (bgMusic.paused) {
        bgMusic.play().catch(e => console.log("Erro auto-play"));
        btn.innerHTML = "🎵 ON";
        btn.classList.remove('music-off');
    } else {
        bgMusic.pause();
        btn.innerHTML = "🔇 OFF";
        btn.classList.add('music-off');
    }
}

// Função para o Computador FALAR o número
function narrarNumero(num) {
    if ('speechSynthesis' in window) {
        const msg = new SpeechSynthesisUtterance();
        msg.text = `Número ${num}`;
        msg.lang = 'pt-BR'; // Português do Brasil
        msg.rate = 1.1; // Velocidade um pouco mais rápida
        msg.pitch = 1;  // Tom de voz normal
        window.speechSynthesis.speak(msg);
    }
}

// --- VARIÁVEIS DO JOGO ---
let curRoom = "", myName = "", myCard = [], marked = new Set(), drawnHist = [], timerInt;

// --- LOBBY ---
socket.on('room_list_update', (data) => {
    const list = document.getElementById('rooms-list');
    list.innerHTML = "";
    if (!data.rooms.length) list.innerHTML = "<p style='text-align:center;color:#666'>Sem salas ativas.</p>";
    
    data.rooms.forEach(r => {
        const div = document.createElement('div');
        const isFull = r.count >= r.limit;
        
        div.className = isFull ? 'room-btn full' : 'room-btn';
        div.innerHTML = `
            <span><strong style="color:#ffd700">${r.id}</strong> <small>${r.active ? '(JOGANDO)' : ''}</small></span>
            <span>👤 ${r.count}/${r.limit}</span>
        `;
        
        if (!isFull && !r.active) {
            div.onclick = () => { 
                document.getElementById('room_id').value = r.id;
                joinRoom(); 
            };
        }
        list.appendChild(div);
    });
});

function joinRoom() {
    myName = document.getElementById('username').value.trim();
    const rid = document.getElementById('room_id').value.trim();
    const limit = document.getElementById('max_players').value;

    if (!myName || !rid) return alert("Preencha nome e sala!");
    
    // Tocar som de clique
    audioClick.play().catch(e => {});

    // INICIAR MÚSICA DE FUNDO AQUI
    // (Navegadores só deixam tocar som após um clique do usuário, então aqui é o lugar perfeito)
    bgMusic.play().catch(e => console.log("Navegador bloqueou música automática"));

    socket.emit('create_join_room', { 
        username: myName, 
        room_id: rid,
        limit: limit 
    });
}
socket.on('error_msg', (d) => document.getElementById('error-msg').innerText = d.msg);

socket.on('room_joined', (d) => {
    curRoom = d.room_id; myCard = d.card;
    
    document.getElementById('lobby-screen').classList.remove('active');
    document.getElementById('game-screen').classList.add('active');
    document.getElementById('display-room').innerText = curRoom;
    document.getElementById('room-limit').innerText = d.limit;
    
    if (d.is_admin) {
        document.getElementById('btn-start').classList.remove('hidden');
    }
    
    document.getElementById('waiting-msg').classList.remove('hidden');
    renderCard();
});

// --- JOGO ---
function startGame() { 
    audioClick.play();
    socket.emit('start_game_cmd', { room_id: curRoom }); 
}

socket.on('game_started', () => {
    document.getElementById('btn-start').classList.add('hidden');
    document.getElementById('waiting-msg').classList.add('hidden');
    
    drawnHist = []; marked.clear();
    document.querySelectorAll('.grid-item').forEach(e => e.classList.remove('marked'));
    document.getElementById('score-text').innerText = "0/20";
    document.getElementById('progress-fill').style.width = "0%";
    
    document.getElementById('ticker-content').innerHTML = "🎲 O SORTEIO COMEÇOU! BOA SORTE! 🎲";
    startTimer(20);
});

// 1. EVENTO GIRAR
socket.on('spinning_start', () => {
    // Visual
    document.getElementById('globe-img').classList.add('shaking');
    document.getElementById('current-ball').classList.add('hidden');
    const t = document.getElementById('timer'); 
    t.innerText = "GIRANDO"; 
    t.classList.add('timer-active');

    // Áudio: Toca o som de giro em loop
    audioSpin.currentTime = 0;
    audioSpin.play().catch(e => console.log("Áudio bloqueado navegador"));
});

// 2. EVENTO BOLA SAIU
socket.on('number_drawn', (d) => {
    // Visual
    document.getElementById('globe-img').classList.remove('shaking');
    document.getElementById('timer').classList.remove('timer-active');
    
    const b = document.getElementById('current-ball');
    document.getElementById('ball-number').innerText = d.number;
    
    // Áudio: Para o giro e toca o POP
    audioSpin.pause();
    audioPop.currentTime = 0;
    audioPop.play();
    
    // FALAR O NÚMERO (Voz do Navegador)
    // Pequeno delay para não sobrepor o som de "Pop"
    setTimeout(() => narrarNumero(d.number), 500);

    // Animação CSS
    b.classList.remove('hidden'); 
    b.classList.remove('ball-enter'); 
    void b.offsetWidth; 
    b.classList.add('ball-enter');
    
    // Ticker
    drawnHist.push(`<div class="ticker-ball">${d.number}</div>`);
    document.getElementById('ticker-content').innerHTML = drawnHist.join("");
    startTimer(16);
});

// 3. EVENTO FIM DE JOGO
socket.on('game_over', (d) => {
    // Áudio de Vitória
    audioSpin.pause(); // Garante que parou
    audioWin.currentTime = 0;
    audioWin.play();

    // Visual
    document.getElementById('winner-name').innerText = d.winner;
    document.getElementById('winner-modal').style.display = 'flex';
    clearInterval(timerInt);
});

// --- AUXILIARES ---
function renderCard() {
    const g = document.getElementById('bingo-card'); g.innerHTML = "";
    myCard.forEach(n => {
        const d = document.createElement('div'); 
        d.className = 'grid-item'; 
        d.innerText = n; 
        d.id = `n-${n}`;
        
        d.onclick = () => {
            // Som de clique satisfatório
            audioClick.currentTime = 0;
            audioClick.play();

            if(marked.has(n)) { 
                marked.delete(n); 
                d.classList.remove('marked'); 
            } else { 
                marked.add(n); 
                d.classList.add('marked'); 
            }
            
            document.getElementById('score-text').innerText = `${marked.size}/20`;
            document.getElementById('progress-fill').style.width = `${(marked.size/20)*100}%`;
            
            if(marked.size === 20) socket.emit('bingo_shout', { room_id: curRoom, marked: Array.from(marked) });
        };
        g.appendChild(d);
    });
}

function startTimer(s) {
    clearInterval(timerInt);
    let t = s; document.getElementById('timer').innerText = t + "s";
    timerInt = setInterval(() => { 
        t--; 
        if(t>=0) document.getElementById('timer').innerText = t + "s"; 
        else clearInterval(timerInt); 
    }, 1000);
}

socket.on('update_players', (d) => {
    document.getElementById('player-count').innerText = d.count;
    document.getElementById('room-limit').innerText = d.limit;
    const ul = document.getElementById('players-ul'); ul.innerHTML = "";
    d.players.forEach(p => ul.innerHTML += `<li style="padding:10px;border-bottom:1px solid #333;color:${p===myName?'#ffd700':'#fff'}">${p}</li>`);
});

function togglePlayerList() { 
    audioClick.play();
    const e = document.getElementById('player-dropdown'); 
    e.style.display = e.style.display==='block'?'none':'block'; 
}

window.onclick = (e) => { if(!e.target.closest('.players-info')) document.getElementById('player-dropdown').style.display = 'none'; }