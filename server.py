"""Мухоморные нарды — локальный сервер.

Отдаёт файлы игры по HTTP (порт 8000) и держит комнаты для игры по сети
через WebSocket (порт 8001).

Запуск:  python server.py [http_port] [ws_port]
"""

import asyncio
import json
import os
import random
import socket
import string
import sys
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

from websockets.asyncio.server import serve

ROOT = os.path.dirname(os.path.abspath(__file__))
HTTP_PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
WS_PORT = int(sys.argv[2]) if len(sys.argv) > 2 else 8001

LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ"
ROOMS = {}


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, *args):
        pass


def other(color):
    return "b" if color == "w" else "w"


def new_code():
    while True:
        code = "".join(random.choice(LETTERS) for _ in range(4))
        if code not in ROOMS:
            return code


async def send(ws, payload):
    try:
        await ws.send(json.dumps(payload, ensure_ascii=False))
    except Exception:
        pass


async def broadcast(room, payload, skip=None):
    for ws in list(room["players"].values()):
        if ws is not None and ws is not skip:
            await send(ws, payload)


def color_of(room, ws):
    for color, player in room["players"].items():
        if player is ws:
            return color
    return None


async def handler(ws):
    room = None
    try:
        async for raw in ws:
            try:
                message = json.loads(raw)
            except Exception:
                continue
            kind = message.get("type")

            if kind == "create":
                if room is not None:
                    continue
                code = new_code()
                room = {"code": code, "players": {"w": ws, "b": None}, "turn": "w"}
                ROOMS[code] = room
                await send(ws, {"type": "room", "code": code, "color": "w"})

            elif kind == "join":
                if room is not None:
                    continue
                code = str(message.get("code", "")).upper().strip()
                target = ROOMS.get(code)
                if not target or target["players"]["b"] is not None:
                    await send(ws, {"type": "error", "message": "Комната не найдена или уже занята."})
                    continue
                target["players"]["b"] = ws
                target["turn"] = "w"
                room = target
                await send(ws, {"type": "room", "code": code, "color": "b"})
                await send(ws, {"type": "start", "turn": "w"})
                await send(target["players"]["w"], {"type": "start", "turn": "w"})

            elif room is None:
                await send(ws, {"type": "error", "message": "Сначала создайте комнату или войдите по коду."})

            elif kind == "roll":
                if color_of(room, ws) != room["turn"]:
                    continue
                first = random.randint(1, 6)
                second = random.randint(1, 6)
                dice = [first] * 4 if first == second else [first, second]
                room["dice"] = len(dice)
                await broadcast(room, {"type": "rolled", "dice": dice, "turn": room["turn"]})

            elif kind == "move":
                if color_of(room, ws) != room["turn"]:
                    continue
                if room.get("dice", 0) <= 0:
                    continue
                move = message.get("move") or {}
                if move.get("from") is None or move.get("to") is None or move.get("die") is None:
                    continue
                room["dice"] -= 1
                await broadcast(room, {
                    "type": "moved",
                    "move": {"from": move["from"], "to": move["to"], "die": move["die"]},
                    "turn": room["turn"],
                })

            elif kind == "endturn":
                if color_of(room, ws) != room["turn"]:
                    continue
                room["turn"] = other(room["turn"])
                room["dice"] = 0
                await broadcast(room, {"type": "turn", "turn": room["turn"]})

            elif kind == "newgame":
                if room["players"]["b"] is None:
                    continue
                room["turn"] = "w"
                room["dice"] = 0
                await broadcast(room, {"type": "newgame", "turn": "w"})
    except Exception:
        pass
    finally:
        if room is not None:
            code = room["code"]
            leaving = color_of(room, ws)
            if room["players"].get(leaving) is ws:
                room["players"][leaving] = None
            remaining = room["players"]["b" if leaving == "w" else "w"]
            if remaining is None:
                ROOMS.pop(code, None)
            else:
                await send(remaining, {"type": "peer-left"})
                ROOMS.pop(code, None)


def local_ip():
    try:
        probe = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        probe.connect(("8.8.8.8", 80))
        ip = probe.getsockname()[0]
        probe.close()
        return ip
    except Exception:
        return "127.0.0.1"


def main():
    httpd = ThreadingHTTPServer(("0.0.0.0", HTTP_PORT), Handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()

    ip = local_ip()
    print("Мухоморные нарды")
    print(f"  игра:      http://127.0.0.1:{HTTP_PORT}/")
    if ip != "127.0.0.1":
        print(f"  в сети:    http://{ip}:{HTTP_PORT}/")
    print(f"  комнаты:   ws://127.0.0.1:{WS_PORT}")
    print("Остановить: Ctrl+C")

    async def run():
        async with serve(handler, "0.0.0.0", WS_PORT):
            await asyncio.Future()

    try:
        asyncio.run(run())
    except KeyboardInterrupt:
        pass
    finally:
        httpd.shutdown()


if __name__ == "__main__":
    main()
