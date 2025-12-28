import eventlet
eventlet.monkey_patch() # <--- ISSO É ESSENCIAL PARA O RENDER NÃO TRAVAR

from flask import Flask, render_template, request
from flask_socketio import SocketIO, emit, join_room
import random
import threading

app = Flask(__name__)
app.config['SECRET_KEY'] = 'vegas_super_secret'

# Configuração correta para o Render + Eventlet
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

rooms = {}

def get_room_list():
    lista = []
    for r_id, r_data in rooms.items():
        if len(r_data['players']) > 0:
            lista.append({
                'id': r_id,
                'count': len(r_data['players']),
                'limit': r_data['limit'],
                'active': r_data['active']
            })
    return lista

def run_game_loop(room_id):
    """Motor do Jogo Otimizado"""
    print(f"--- [SALA {room_id}] JOGO INICIADO ---")
    
    with app.app_context():
        # Pausa inicial não bloqueante
        socketio.sleep(3)
        socketio.emit('game_started', room=room_id)
        socketio.emit('room_list_update', {'rooms': get_room_list()})

        while True:
            # Verifica se a sala ainda existe e está ativa
            if room_id not in rooms:
                break
            
            # Se já tem vencedor ou foi desativada manualmente
            if rooms[room_id]['winner'] or not rooms[room_id]['active']:
                break

            possible = set(range(1, 61))
            drawn = set(rooms[room_id]['drawn'])
            remaining = list(possible - drawn)

            # SE ACABARAM OS NÚMEROS E NINGUÉM GANHOU
            if not remaining:
                socketio.emit('game_over', {'winner': 'NINGUÉM (ACABARAM AS BOLAS)'}, room=room_id)
                rooms[room_id]['active'] = False
                break

            # 1. Sorteia
            number = random.choice(remaining)

            # 2. Gira (Avisa frontend)
            socketio.emit('spinning_start', room=room_id)
            
            # Pausa para o giro (Não bloqueante)
            socketio.sleep(4)

            # 3. Revela
            if room_id in rooms and rooms[room_id]['active'] and not rooms[room_id]['winner']:
                rooms[room_id]['drawn'].append(number)
                socketio.emit('number_drawn', {'number': number}, room=room_id)
            
            # 4. Intervalo entre bolas (DIMINUÍMOS PARA 8s PARA O TESTE NÃO FICAR CHATO)
            socketio.sleep(8)

@app.route('/')
def index():
    return render_template('index.html')

@socketio.on('connect')
def on_connect():
    emit('room_list_update', {'rooms': get_room_list()})

@socketio.on('create_join_room')
def handle_join(data):
    username = data['username']
    room_id = data['room_id']
    limit = int(data.get('limit', 20))
    
    if room_id not in rooms:
        rooms[room_id] = {
            'active': False, 
            'players': {}, 
            'drawn': [], 
            'winner': None, 
            'limit': limit
        }
    
    r = rooms[room_id]

    if len(r['players']) >= r['limit']:
        emit('error_msg', {'msg': 'Sala Lotada!'})
        return
    if r['active']:
        emit('error_msg', {'msg': 'Jogo em andamento!'})
        return

    join_room(room_id)
    
    # Gera cartela
    card = sorted(random.sample(range(1, 61), 20))
    r['players'][request.sid] = {'name': username, 'card': card}
    is_admin = list(r['players'].keys())[0] == request.sid

    emit('room_joined', {
        'room_id': room_id, 
        'card': card, 
        'is_admin': is_admin, 
        'limit': r['limit']
    })

    p_names = [p['name'] for p in r['players'].values()]
    socketio.emit('update_players', {'players': p_names, 'count': len(p_names), 'limit': r['limit']}, room=room_id)
    socketio.emit('room_list_update', {'rooms': get_room_list()})

    # AUTO-START
    if len(p_names) == r['limit'] and not r['active']:
        rooms[room_id]['active'] = True
        rooms[room_id]['drawn'] = []
        rooms[room_id]['winner'] = None
        socketio.start_background_task(run_game_loop, room_id)

@socketio.on('start_game_cmd')
def manual_start(data):
    room_id = data['room_id']
    if room_id in rooms and not rooms[room_id]['active']:
        rooms[room_id]['active'] = True
        rooms[room_id]['drawn'] = []
        rooms[room_id]['winner'] = None
        socketio.start_background_task(run_game_loop, room_id)

@socketio.on('bingo_shout')
def handle_bingo(data):
    room_id = data['room_id']
    if room_id in rooms and rooms[room_id]['active']:
        marked = set(data['marked'])
        drawn = set(rooms[room_id]['drawn'])
        
        # VERIFICAÇÃO DE SEGURANÇA
        # O jogador precisa ter marcado 20 números E todos eles precisam ter sido sorteados
        if marked.issubset(drawn) and len(marked) >= 20:
            winner = rooms[room_id]['players'][request.sid]['name']
            rooms[room_id]['winner'] = winner
            rooms[room_id]['active'] = False
            socketio.emit('game_over', {'winner': winner}, room=room_id)

@socketio.on('disconnect')
def on_disconnect():
    for rid, rdata in rooms.items():
        if request.sid in rdata['players']:
            del rdata['players'][request.sid]
            # Se a sala ficar vazia, apaga ela para economizar memória
            if len(rdata['players']) == 0:
                del rooms[rid]
            else:
                p_names = [p['name'] for p in rdata['players'].values()]
                socketio.emit('update_players', {'players': p_names, 'count': len(p_names), 'limit': rdata['limit']}, room=rid)
            socketio.emit('room_list_update', {'rooms': get_room_list()})
            break

if __name__ == '__main__':
    socketio.run(app, debug=True, port=5000)
