(function (global) {
  "use strict";

  var TOTAL_CHECKERS = 15;

  var PLAYERS = {
    w: {
      key: "w",
      name: "Красные мухоморы",
      genitive: "красных мухоморов"
    },
    b: {
      key: "b",
      name: "Пантерные мухоморы",
      genitive: "пантерных мухоморов"
    }
  };

  function other(player) {
    return player === "w" ? "b" : "w";
  }

  function distanceToOff(player, point) {
    return player === "w" ? point : 25 - point;
  }

  function isHome(player, point) {
    return player === "w"
      ? point >= 1 && point <= 6
      : point >= 19 && point <= 24;
  }

  /* ---------- position and moves ---------- */

  function createPosition() {
    var pts = [{ w: 0, b: 0 }];
    for (var i = 1; i <= 24; i += 1) pts.push({ w: 0, b: 0 });

    pts[24].w = 2;
    pts[13].w = 5;
    pts[8].w = 3;
    pts[6].w = 5;

    pts[1].b = 2;
    pts[12].b = 5;
    pts[17].b = 3;
    pts[19].b = 5;

    return {
      pts: pts,
      bar: { w: 0, b: 0 },
      off: { w: 0, b: 0 }
    };
  }

  function clonePosition(pos) {
    return {
      pts: pos.pts.map(function (point) {
        return { w: point.w, b: point.b };
      }),
      bar: { w: pos.bar.w, b: pos.bar.b },
      off: { w: pos.off.w, b: pos.off.b }
    };
  }

  function countCheckers(pos, player) {
    var total = pos.bar[player] + pos.off[player];
    for (var i = 1; i <= 24; i += 1) total += pos.pts[i][player];
    return total;
  }

  function allInHome(pos, player) {
    if (pos.bar[player] > 0) return false;
    for (var i = 1; i <= 24; i += 1) {
      if (pos.pts[i][player] > 0 && !isHome(player, i)) return false;
    }
    return true;
  }

  function farthestHomeDistance(pos, player) {
    var farthest = -1;
    for (var i = 1; i <= 24; i += 1) {
      if (pos.pts[i][player] > 0 && isHome(player, i)) {
        var d = distanceToOff(player, i);
        if (d > farthest) farthest = d;
      }
    }
    return farthest;
  }

  function legalMovesFor(pos, player, die) {
    var moves = [];
    var opponent = other(player);

    if (pos.bar[player] > 0) {
      var entry = player === "w" ? 25 - die : die;
      if (entry >= 1 && entry <= 24 && pos.pts[entry][opponent] < 2) {
        moves.push({ from: "bar", to: entry, die: die });
      }
      return moves;
    }

    var canBearOff = allInHome(pos, player);
    var farthest = canBearOff ? farthestHomeDistance(pos, player) : -1;

    for (var from = 1; from <= 24; from += 1) {
      if (pos.pts[from][player] === 0) continue;

      var to = player === "w" ? from - die : from + die;

      if (to >= 1 && to <= 24) {
        if (pos.pts[to][opponent] < 2) {
          moves.push({ from: from, to: to, die: die });
        }
      } else if (canBearOff) {
        var distance = distanceToOff(player, from);
        if (die === distance || (die > distance && distance === farthest)) {
          moves.push({ from: from, to: "off", die: die });
        }
      }
    }

    return moves;
  }

  function applyMove(pos, player, move) {
    var next = clonePosition(pos);
    var opponent = other(player);

    if (move.from === "bar") {
      next.bar[player] -= 1;
    } else {
      next.pts[move.from][player] -= 1;
    }

    if (move.to === "off") {
      next.off[player] += 1;
    } else {
      if (next.pts[move.to][opponent] === 1) {
        next.pts[move.to][opponent] = 0;
        next.bar[opponent] += 1;
      }
      next.pts[move.to][player] += 1;
    }

    return next;
  }

  function removeOneDie(dice, die) {
    var index = dice.indexOf(die);
    if (index === -1) return dice.slice();
    var copy = dice.slice();
    copy.splice(index, 1);
    return copy;
  }

  function positionKey(pos) {
    var parts = [];
    for (var i = 1; i <= 24; i += 1) {
      parts.push(pos.pts[i].w + "," + pos.pts[i].b);
    }
    parts.push("bar:" + pos.bar.w + "," + pos.bar.b);
    return parts.join(";");
  }

  function maxMovesWithMemo(pos, player, dice, memo) {
    if (!dice.length) return 0;

    var sorted = dice.slice().sort(function (a, b) { return a - b; });
    var key = positionKey(pos) + "|" + player + "|" + sorted.join(",");
    if (memo.has(key)) return memo.get(key);

    var best = 0;
    var tried = {};
    var nextPosition;
    var rest;
    var score;

    for (var i = 0; i < dice.length; i += 1) {
      var die = dice[i];
      if (tried[die]) continue;
      tried[die] = true;

      var moves = legalMovesFor(pos, player, die);
      for (var j = 0; j < moves.length; j += 1) {
        nextPosition = applyMove(pos, player, moves[j]);
        rest = removeOneDie(dice, die);
        score = 1 + maxMovesWithMemo(nextPosition, player, rest, memo);
        if (score > best) best = score;
      }
    }

    memo.set(key, best);
    return best;
  }

  function maxMoves(pos, player, dice) {
    return maxMovesWithMemo(pos, player, dice, new Map());
  }

  function optimalSequences(pos, player, dice) {
    var memo = new Map();
    var maxLen = maxMovesWithMemo(pos, player, dice, memo);
    var sequences = [];

    if (maxLen === 0) {
      return { maxLen: maxLen, sequences: sequences };
    }

    var sorted = dice.slice().sort(function (a, b) { return a - b; });

    function walk(current, remaining, moves) {
      if (moves.length === maxLen) {
        sequences.push(moves.slice());
        return;
      }

      var tried = {};
      for (var i = 0; i < remaining.length; i += 1) {
        var die = remaining[i];
        if (tried[die]) continue;
        tried[die] = true;

        var branch = legalMovesFor(current, player, die);
        for (var j = 0; j < branch.length; j += 1) {
          var nextPosition = applyMove(current, player, branch[j]);
          var rest = removeOneDie(remaining, die);
          if (maxMovesWithMemo(nextPosition, player, rest, memo) === maxLen - moves.length - 1) {
            moves.push(branch[j]);
            walk(nextPosition, rest, moves);
            moves.pop();
          }
        }
      }
    }

    walk(pos, sorted, []);
    return { maxLen: maxLen, sequences: sequences };
  }

  function allowedMovesFor(pos, player, dice) {
    if (!dice.length) return [];

    var result = optimalSequences(pos, player, dice);
    if (result.maxLen === 0) return [];

    var firsts = result.sequences.map(function (sequence) {
      return sequence[0];
    });

    if (result.maxLen === 1 && dice.length > 1) {
      var highest = Math.max.apply(null, dice);
      var usingHighest = firsts.filter(function (move) {
        return move.die === highest;
      });
      if (usingHighest.length) firsts = usingHighest;
    }

    var unique = new Map();
    objForEach(firsts, function (move) {
      var key = move.from + ">" + move.to + "#" + move.die;
      if (!unique.has(key)) unique.set(key, move);
    });

    return Array.from(unique.values());
  }

  function objForEach(list, callback) {
    for (var i = 0; i < list.length; i += 1) callback(list[i], i);
  }

  /* ---------- mushroom artwork ---------- */

  function mushroomSvg(player) {
    var id = player === "w" ? "#mush-w" : "#mush-b";
    return '<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false"><use href="' + id + '"></use></svg>';
  }

  var PIPS = {
    1: [[2, 2]],
    2: [[1, 1], [3, 3]],
    3: [[1, 1], [2, 2], [3, 3]],
    4: [[1, 1], [1, 3], [3, 1], [3, 3]],
    5: [[1, 1], [1, 3], [2, 2], [3, 1], [3, 3]],
    6: [[1, 1], [1, 3], [2, 1], [2, 3], [3, 1], [3, 3]]
  };

  /* ---------- AI ---------- */

  var DICE_OUTCOMES = (function () {
    var list = [];
    for (var a = 1; a <= 6; a += 1) {
      for (var b = a; b <= 6; b += 1) {
        list.push(a === b ? [a, a, a, a] : [a, b]);
      }
    }
    return list;
  })();

  function pipsFor(pos, player) {
    var sum = pos.bar[player] * 25;
    for (var i = 1; i <= 24; i += 1) {
      sum += pos.pts[i][player] * distanceToOff(player, i);
    }
    return sum;
  }

  function blotExposure(pos, player, point) {
    var opponent = other(player);
    var exposure = 0;
    if (pos.bar[opponent] > 0) exposure += 1;
    for (var d = 1; d <= 6; d += 1) {
      var from = player === "w" ? point - d : point + d;
      if (from >= 1 && from <= 24 && pos.pts[from][opponent] > 0) exposure += 1;
    }
    return exposure;
  }

  function evaluatePosition(pos, player) {
    var opponent = other(player);
    var score = (pos.off[player] - pos.off[opponent]) * 76;
    score += (pipsFor(pos, opponent) - pipsFor(pos, player)) * 1.15;
    score -= pos.bar[player] * 30;
    score += pos.bar[opponent] * 24;

    for (var i = 1; i <= 24; i += 1) {
      var mine = pos.pts[i][player];
      var theirs = pos.pts[i][opponent];

      if (mine >= 2) {
        score += 5;
        if (isHome(player, i)) score += 4;
        if (isHome(opponent, i)) score += 3;
        if (mine > 5) score -= (mine - 5) * 2.4;
      } else if (mine === 1) {
        score -= 4 + blotExposure(pos, player, i) * 1.9;
        if (isHome(opponent, i)) score -= 2;
      }

      if (theirs === 1) {
        score += 2.5 + blotExposure(pos, opponent, i) * 0.9;
      }
    }

    return score;
  }

  function applySequence(pos, player, sequence) {
    var current = pos;
    for (var i = 0; i < sequence.length; i += 1) {
      current = applyMove(current, player, sequence[i]);
    }
    return current;
  }

  function uniqueSequences(pos, player, dice) {
    var result = optimalSequences(pos, player, dice);
    var seen = new Set();
    var list = [];

    for (var i = 0; i < result.sequences.length; i += 1) {
      var sequence = result.sequences[i];
      var after = applySequence(pos, player, sequence);
      var key = positionKey(after) + "|off" + after.off[player];
      if (seen.has(key)) continue;
      seen.add(key);
      list.push({ sequence: sequence, pos: after, score: evaluatePosition(after, player) });
    }

    list.sort(function (a, b) { return b.score - a.score; });
    return list;
  }

  function bestReplyValue(pos, player, budget) {
    var best = Infinity;
    for (var i = 0; i < DICE_OUTCOMES.length; i += 1) {
      var options = uniqueSequences(pos, other(player), DICE_OUTCOMES[i]);
      var worst = Infinity;
      var limit = Math.min(options.length, 10);
      for (var j = 0; j < limit; j += 1) {
        var value = evaluatePosition(options[j].pos, player);
        if (value < worst) worst = value;
      }
      if (worst === Infinity) worst = evaluatePosition(pos, player);
      if (worst < best) best = worst;
      if (budget && Date.now() > budget) break;
    }
    return best === Infinity ? evaluatePosition(pos, player) : best;
  }

  function pickNearBest(list, spread) {
    if (!list.length) return null;
    var best = list[0].score;
    var near = list.filter(function (item) { return item.score >= best - spread; });
    return near[Math.floor(Math.random() * Math.min(near.length, 3))];
  }

  function chooseSequence(pos, player, dice, options) {
    var level = (options && options.level) || "medium";
    var budget = Date.now() + ((options && options.timeBudget) || 1600);
    var list = uniqueSequences(pos, player, dice);

    if (!list.length) return null;
    if (level === "easy") {
      return list[Math.floor(Math.random() * list.length)];
    }
    if (level !== "hard" || list.length === 1) {
      return pickNearBest(list, level === "hard" ? 0 : 1.5);
    }

    var candidates = list.slice(0, 6);
    var bestItem = candidates[0];
    var bestValue = -Infinity;

    for (var i = 0; i < candidates.length; i += 1) {
      if (Date.now() > budget) break;
      var item = candidates[i];
      var reply = bestReplyValue(item.pos, player, budget);
      var value = item.score * 0.55 + reply * 0.45;
      if (value > bestValue) {
        bestValue = value;
        bestItem = item;
      }
    }

    return bestItem;
  }

  /* ---------- app ---------- */

  function boot() {
    if (typeof document === "undefined") return;

    var boardGrid = document.getElementById("boardGrid");
    if (!boardGrid) return;

    var boardFrame = document.getElementById("boardFrame");
    var barEl = null;
    var pointEls = new Map();

    var rollBtn = document.getElementById("rollBtn");
    var undoBtn = document.getElementById("undoBtn");
    var newGameBtn = document.getElementById("newGameBtn");
    var rulesBtn = document.getElementById("rulesBtn");
    var winNewGameBtn = document.getElementById("winNewGame");
    var diceRow = document.getElementById("diceRow");
    var statusEl = document.getElementById("status");
    var turnCard = document.getElementById("turnCard");
    var turnName = document.getElementById("turnName");
    var turnAvatar = document.getElementById("turnAvatar");
    var rulesModal = document.getElementById("rulesModal");
    var winModal = document.getElementById("winModal");
    var modeModal = document.getElementById("modeModal");
    var winTitle = document.getElementById("winTitle");
    var winText = document.getElementById("winText");
    var winAvatar = document.getElementById("winAvatar");
    var modeBtn = document.getElementById("modeBtn");
    var modeBadge = document.getElementById("modeBadge");
    var modeBadgeText = document.getElementById("modeBadgeText");
    var aiOptions = document.getElementById("aiOptions");
    var onlineOptions = document.getElementById("onlineOptions");
    var aiColorSeg = document.getElementById("aiColorSeg");
    var aiLevelSeg = document.getElementById("aiLevelSeg");
    var aiHint = document.getElementById("aiHint");
    var serverInput = document.getElementById("serverInput");
    var roomInput = document.getElementById("roomInput");
    var joinRoomBtn = document.getElementById("joinRoomBtn");
    var createRoomBtn = document.getElementById("createRoomBtn");
    var onlineHint = document.getElementById("onlineHint");
    var roomBox = document.getElementById("roomBox");
    var roomCodeEl = document.getElementById("roomCode");
    var roomLink = document.getElementById("roomLink");
    var copyLinkBtn = document.getElementById("copyLinkBtn");
    var applyModeBtn = document.getElementById("applyMode");
    var modeOptions = Array.prototype.slice.call(document.querySelectorAll(".mode-option"));

    var cardEls = {
      w: document.getElementById("card-w"),
      b: document.getElementById("card-b")
    };

    var state = null;
    var passTimer = null;
    var turnToken = 0;
    var layoutFrame = 0;

    var SETTINGS_KEY = "mush-nardy-settings";
    var LEVEL_NAMES = { easy: "лёгкий", medium: "средний", hard: "сильный" };
    var settings = loadSettings();
    var online = null;
    var aiTimer = null;
    var aiPlan = null;
    var draft = null;

    function loadSettings() {
      var base = { mode: "hotseat", aiColor: "b", aiLevel: "medium", server: "" };
      try {
        var raw = localStorage.getItem(SETTINGS_KEY);
        if (raw) {
          var saved = JSON.parse(raw);
          if (saved && typeof saved === "object") {
            if (saved.mode === "ai" || saved.mode === "online" || saved.mode === "hotseat") base.mode = saved.mode;
            if (saved.aiColor === "w" || saved.aiColor === "b") base.aiColor = saved.aiColor;
            if (LEVEL_NAMES[saved.aiLevel]) base.aiLevel = saved.aiLevel;
            if (typeof saved.server === "string") base.server = saved.server;
          }
        }
      } catch (err) { /* private mode */ }
      return base;
    }

    function saveSettings() {
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify({
          mode: settings.mode === "online" ? "hotseat" : settings.mode,
          aiColor: settings.aiColor,
          aiLevel: settings.aiLevel,
          server: settings.server
        }));
      } catch (err) { /* ignore */ }
    }

    function isOnline() {
      return settings.mode === "online" && !!online;
    }

    function isAiTurn() {
      return settings.mode === "ai" && state.turn === settings.aiColor && state.phase !== "over";
    }

    function humanCanAct() {
      if (state.phase === "over") return false;
      if (settings.mode === "ai") return state.turn !== settings.aiColor;
      if (settings.mode === "online") {
        return !!(online && online.started && online.color === state.turn && !online.pending);
      }
      return true;
    }

    function modeLabel() {
      if (settings.mode === "ai") {
        var side = settings.aiColor === "w" ? "вы пантерные" : "вы красные";
        return "Против ИИ · " + side + " · " + LEVEL_NAMES[settings.aiLevel];
      }
      if (settings.mode === "online") {
        if (!online) return "По сети";
        if (!online.started) return "По сети · комната " + (online.code || "…") + " · ждём соперника";
        return "По сети · комната " + online.code;
      }
      return "Двое за одним экраном";
    }

    function renderModeBadge() {
      modeBadge.dataset.mode = settings.mode;
      modeBadgeText.textContent = modeLabel();
    }

    function makeState() {
      var pos = createPosition();
      return {
        pts: pos.pts,
        bar: pos.bar,
        off: pos.off,
        turn: "w",
        phase: "roll",
        dice: [],
        roll: [],
        usedDice: [],
        selected: null,
        options: [],
        history: [],
        winner: null,
        notice: null,
        animateDice: false
      };
    }

    function makePieceEl(player, mini) {
      var el = document.createElement("div");
      el.className = "piece " + player + (mini ? " mini" : "");
      el.innerHTML = mushroomSvg(player);
      return el;
    }

    function buildBoard() {
      var topRow = [13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24];
      var bottomRow = [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];

      function addPoint(point, side, index) {
        var column = index < 6 ? index + 1 : index + 2;
        var el = document.createElement("div");
        el.className = "point " + side + (index % 2 === 1 ? " alt" : "");
        el.dataset.point = String(point);
        el.style.gridColumn = String(column);
        el.style.gridRow = side === "top" ? "1" : "2";

        var stack = document.createElement("div");
        stack.className = "stack";
        el.appendChild(stack);

        pointEls.set(point, el);
        boardGrid.appendChild(el);
      }

      topRow.forEach(function (point, index) {
        addPoint(point, "top", index);
      });

      barEl = document.createElement("div");
      barEl.className = "bar";
      barEl.dataset.bar = "1";
      barEl.innerHTML = '<div class="bar-stack bar-b"></div><div class="bar-stack bar-w"></div>';
      boardGrid.appendChild(barEl);

      bottomRow.forEach(function (point, index) {
        addPoint(point, "bottom", index);
      });
    }

    function renderBoard() {
      pointEls.forEach(function (el, point) {
        var stack = el.querySelector(".stack");
        var white = state.pts[point].w;
        var black = state.pts[point].b;
        var total = white + black;
        var owner = white > 0 ? "w" : black > 0 ? "b" : null;

        while (stack.firstChild) stack.removeChild(stack.firstChild);
        for (var i = 0; i < total; i += 1) {
          stack.appendChild(makePieceEl(owner));
        }

        var pill = el.querySelector(".count-pill");
        if (total > 5) {
          if (!pill) {
            pill = document.createElement("span");
            pill.className = "count-pill";
            el.appendChild(pill);
          }
          pill.textContent = String(total);
        } else if (pill) {
          pill.remove();
        }
      });

      var barBlack = barEl.querySelector(".bar-b");
      var barWhite = barEl.querySelector(".bar-w");
      while (barBlack.firstChild) barBlack.removeChild(barBlack.firstChild);
      while (barWhite.firstChild) barWhite.removeChild(barWhite.firstChild);

      for (var b = 0; b < state.bar.b; b += 1) {
        barBlack.appendChild(makePieceEl("b"));
      }
      for (var w = 0; w < state.bar.w; w += 1) {
        barWhite.appendChild(makePieceEl("w"));
      }

      document.querySelectorAll(".tray").forEach(function (tray) {
        var player = tray.dataset.tray;
        var box = tray.querySelector(".tray-pieces");
        while (box.firstChild) box.removeChild(box.firstChild);
        for (var i = 0; i < state.off[player]; i += 1) {
          box.appendChild(makePieceEl(player, true));
        }
        tray.querySelector(".tray-count").textContent = String(state.off[player]);
      });
    }

    function layoutStacks(pieceSize) {
      pointEls.forEach(function (el) {
        var pieces = el.querySelectorAll(".piece");
        if (!pieces.length) return;

        var isTop = el.classList.contains("top");
        var height = el.clientHeight;
        var size = pieces[0].offsetHeight || pieceSize;
        var edge = Math.max(3, size * 0.14);
        var available = height - size - edge * 2;
        var gap = pieces.length > 1
          ? Math.min(size * 0.64, Math.max(1, available / (pieces.length - 1)))
          : 0;

        for (var i = 0; i < pieces.length; i += 1) {
          var offset = edge + i * gap;
          if (isTop) {
            pieces[i].style.top = offset + "px";
            pieces[i].style.bottom = "";
          } else {
            pieces[i].style.bottom = offset + "px";
            pieces[i].style.top = "";
          }
        }
      });
    }

    function scheduleLayout() {
      if (layoutFrame) cancelAnimationFrame(layoutFrame);
      layoutFrame = requestAnimationFrame(function () {
        layoutFrame = 0;
        var sample = pointEls.get(6);
        if (!sample) return;
        var width = sample.clientWidth;
        var size = Math.round(Math.max(15, Math.min(48, width * 0.78)));
        boardFrame.style.setProperty("--piece", size + "px");
        layoutStacks(size);
      });
    }

    function renderHighlights() {
      pointEls.forEach(function (el) {
        el.classList.remove("source", "target", "selected");
      });
      document.querySelectorAll(".tray.target").forEach(function (tray) {
        tray.classList.remove("target");
      });
      barEl.classList.remove("source", "selected");

      if (state.phase !== "move" || !state.options.length) return;

      var sources = new Set(state.options.map(function (move) {
        return move.from;
      }));

      sources.forEach(function (source) {
        if (source === "bar") {
          barEl.classList.add("source");
        } else {
          var el = pointEls.get(source);
          if (el) el.classList.add("source");
        }
      });

      if (state.selected === null) return;

      if (state.selected === "bar") {
        barEl.classList.add("selected");
      } else {
        var selectedEl = pointEls.get(state.selected);
        if (selectedEl) selectedEl.classList.add("selected");
      }

      state.options.forEach(function (move) {
        if (move.from !== state.selected) return;
        if (move.to === "off") {
          var tray = document.querySelector('.tray[data-tray="' + state.turn + '"]');
          if (tray) tray.classList.add("target");
        } else {
          var targetEl = pointEls.get(move.to);
          if (targetEl) targetEl.classList.add("target");
        }
      });
    }

    function renderDice() {
      while (diceRow.firstChild) diceRow.removeChild(diceRow.firstChild);

      if (!state.roll.length) {
        var hint = document.createElement("span");
        hint.className = "dice-hint";
        hint.textContent = "кости ждут броска";
        diceRow.appendChild(hint);
        return;
      }

      var used = state.usedDice.slice();
      state.roll.forEach(function (value) {
        var die = makeDieEl(value);
        if (state.animateDice) die.classList.add("rolling");
        var index = used.indexOf(value);
        if (index !== -1) {
          used.splice(index, 1);
          die.classList.add("used");
        }
        diceRow.appendChild(die);
      });
      state.animateDice = false;
    }

    function makeDieEl(value) {
      var die = document.createElement("div");
      die.className = "die";
      die.dataset.value = String(value);
      var cells = PIPS[value] || [];
      cells.forEach(function (cell) {
        var pip = document.createElement("span");
        pip.className = "pip";
        pip.style.gridRow = String(cell[0]);
        pip.style.gridColumn = String(cell[1]);
        die.appendChild(pip);
      });
      return die;
    }

    function pipCount(player) {
      var sum = state.bar[player] * 25;
      for (var i = 1; i <= 24; i += 1) {
        sum += state.pts[i][player] * distanceToOff(player, i);
      }
      return sum;
    }

    function statusText() {
      if (state.phase === "over" && state.winner) {
        return "Победа " + PLAYERS[state.winner].genitive + ".";
      }
      if (state.notice) return state.notice;
      if (state.phase === "roll") {
        return "Ход " + PLAYERS[state.turn].genitive + ". Бросайте кости.";
      }
      if (state.bar[state.turn] > 0) {
        return state.selected === "bar"
          ? "Введите шапку на открытую точку в доме соперника."
          : "Сначала верните шапки с бара.";
      }
      if (state.selected !== null) return "Выберите точку, куда поставить шапку.";
      return "Выберите шапку, которой хотите ходить.";
    }

    function renderSide() {
      var player = PLAYERS[state.turn];
      turnName.textContent = player.name;
      turnAvatar.innerHTML = mushroomSvg(state.turn);
      turnCard.dataset.player = state.turn;
      statusEl.textContent = statusText();

      ["w", "b"].forEach(function (key) {
        var card = cardEls[key];
        card.classList.toggle("active", state.turn === key && state.phase !== "over");
        card.querySelector("[data-off]").textContent = String(state.off[key]);
        card.querySelector("[data-bar]").textContent = String(state.bar[key]);
        card.querySelector("[data-pips]").textContent = String(pipCount(key));
      });
    }

    function renderButtons() {
      var canAct = humanCanAct();
      rollBtn.disabled = state.phase !== "roll" || !canAct;
      var canUndo = state.phase === "move" && state.history.length > 0 && canAct;
      if (settings.mode === "online") canUndo = false;
      undoBtn.disabled = !canUndo;
      rollBtn.classList.toggle("ready", state.phase === "roll" && canAct);
    }

    function render() {
      renderBoard();
      renderHighlights();
      renderDice();
      renderSide();
      renderButtons();
      renderModeBadge();
      scheduleLayout();
      driveAi();
    }

    function clearPassTimer() {
      if (passTimer) {
        clearTimeout(passTimer);
        passTimer = null;
      }
    }

    function schedulePass(delay) {
      clearPassTimer();
      var token = turnToken;
      passTimer = setTimeout(function () {
        if (token !== turnToken) return;
        passTimer = null;
        if (isOnline()) {
          netSend({ type: "endturn" });
        } else {
          passTurn();
        }
      }, delay);
    }

    function makeSnapshot() {
      return {
        pts: state.pts.map(function (point) {
          return { w: point.w, b: point.b };
        }),
        bar: { w: state.bar.w, b: state.bar.b },
        off: { w: state.off.w, b: state.off.b },
        dice: state.dice.slice(),
        roll: state.roll.slice(),
        usedDice: state.usedDice.slice()
      };
    }

    function handleRoll() {
      if (state.phase !== "roll" || !humanCanAct()) return;

      if (isOnline()) {
        netSend({ type: "roll" });
        return;
      }

      performRoll(null);
    }

    function performRoll(serverDice) {
      clearPassTimer();
      clearAiTimer();
      turnToken += 1;

      var dice;
      if (serverDice && serverDice.length) {
        dice = serverDice.slice();
      } else {
        var first = 1 + Math.floor(Math.random() * 6);
        var second = 1 + Math.floor(Math.random() * 6);
        dice = first === second ? [first, first, first, first] : [first, second];
      }

      state.roll = dice.slice();
      state.dice = dice.slice();
      state.usedDice = [];
      state.history = [];
      state.selected = null;
      state.notice = null;
      state.phase = "move";
      state.animateDice = true;
      state.options = allowedMovesFor(state, state.turn, state.dice);

      if (!state.options.length) {
        state.notice = "Нет допустимых ходов — очередь переходит.";
        render();
        schedulePass(isOnline() ? 1700 : 1600);
        return;
      }

      render();
    }

    function passTurn() {
      clearPassTimer();
      clearAiTimer();
      turnToken += 1;
      if (state.phase === "over") return;

      state.turn = other(state.turn);
      state.phase = "roll";
      state.dice = [];
      state.roll = [];
      state.usedDice = [];
      state.selected = null;
      state.options = [];
      state.history = [];
      state.notice = null;
      state.animateDice = false;
      aiPlan = null;
      render();
    }

    function applyRemoteTurn(turn) {
      clearPassTimer();
      clearAiTimer();
      turnToken += 1;
      if (state.phase === "over") return;

      state.turn = turn;
      state.phase = "roll";
      state.dice = [];
      state.roll = [];
      state.usedDice = [];
      state.selected = null;
      state.options = [];
      state.history = [];
      state.notice = null;
      state.animateDice = false;
      render();
    }

    function finishGame(player) {
      clearPassTimer();
      clearAiTimer();
      aiPlan = null;
      turnToken += 1;
      if (online) online.pending = false;
      state.phase = "over";
      state.winner = player;
      state.options = [];
      state.selected = null;
      state.notice = null;
      render();

      var loser = other(player);
      winAvatar.innerHTML = mushroomSvg(player);
      winTitle.textContent = "Победа " + PLAYERS[player].genitive;
      winText.textContent = state.off[loser] === 0
        ? "Сухая победа: соперник не снял ни одной шапки с доски."
        : "Соперник успел снять " + state.off[loser] + " из 15 шапок.";
      openModal(winModal);
    }

    function commitMove(move) {
      if (isOnline()) {
        if (!humanCanAct()) return;
        online.pending = true;
        netSend({ type: "move", move: { from: move.from, to: move.to, die: move.die } });
        render();
        return;
      }
      applyMoveLocal(move);
    }

    function applyMoveLocal(move) {
      var player = state.turn;
      state.history.push(makeSnapshot());

      var next = applyMove(state, player, move);
      state.pts = next.pts;
      state.bar = next.bar;
      state.off = next.off;
      state.dice = removeOneDie(state.dice, move.die);
      state.usedDice.push(move.die);
      state.selected = null;
      state.notice = null;

      if (state.off[player] >= TOTAL_CHECKERS) {
        finishGame(player);
        return;
      }

      if (!state.dice.length) {
        state.options = [];
        state.notice = "Кости сыграны — ход переходит.";
        render();
        schedulePass(650);
        return;
      }

      state.options = allowedMovesFor(state, player, state.dice);
      if (!state.options.length) {
        state.notice = "Больше нечем ходить — очередь переходит.";
        render();
        schedulePass(1400);
        return;
      }

      render();
    }

    function attemptMove(destination) {
      if (state.phase !== "move" || state.selected === null) return;
      var candidates = state.options.filter(function (move) {
        return move.from === state.selected && move.to === destination;
      });
      if (!candidates.length) return;
      commitMove(candidates[0]);
    }

    function handleUndo() {
      if (settings.mode === "online") return;
      if (state.phase !== "move" || !state.history.length) return;

      clearPassTimer();
      turnToken += 1;

      var snapshot = state.history.pop();
      state.pts = snapshot.pts;
      state.bar = snapshot.bar;
      state.off = snapshot.off;
      state.dice = snapshot.dice;
      state.roll = snapshot.roll;
      state.usedDice = snapshot.usedDice;
      state.selected = null;
      state.notice = null;
      state.options = allowedMovesFor(state, state.turn, state.dice);
      render();
    }

    function selectSource(source) {
      state.selected = source;
      render();
    }

    function deselect() {
      state.selected = null;
      render();
    }

    function handleBoardClick(event) {
      if (state.phase !== "move" || !state.options.length) return;
      if (!humanCanAct()) return;

      var tray = event.target.closest(".tray");
      if (tray) {
        if (tray.dataset.tray !== state.turn) return;
        if (state.selected !== null && state.options.some(function (move) {
          return move.from === state.selected && move.to === "off";
        })) {
          attemptMove("off");
        }
        return;
      }

      var bar = event.target.closest(".bar");
      if (bar) {
        if (state.selected === "bar") {
          deselect();
          return;
        }
        if (state.options.some(function (move) { return move.from === "bar"; })) {
          selectSource("bar");
        }
        return;
      }

      var pointEl = event.target.closest(".point");
      if (!pointEl) return;
      var point = Number(pointEl.dataset.point);

      if (state.selected !== null && state.options.some(function (move) {
        return move.from === state.selected && move.to === point;
      })) {
        attemptMove(point);
        return;
      }

      if (state.selected === point) {
        deselect();
        return;
      }

      if (state.options.some(function (move) { return move.from === point; })) {
        selectSource(point);
        return;
      }

      if (state.selected !== null) deselect();
    }

    function openModal(modal) {
      if (!modal) return;
      modal.hidden = false;
      document.body.classList.add("modal-open");
      var closeButton = modal.querySelector("[data-close]");
      if (closeButton) closeButton.focus({ preventScroll: true });
    }

    function closeModal(modal) {
      if (!modal || modal.hidden) return;
      modal.hidden = true;
      if (modal === modeModal && online && !online.started) {
        netClose();
        setOnlineHint("Запустите server.py, создайте комнату и отправьте другу ссылку.");
      }
      if (!document.querySelector(".modal:not([hidden])")) {
        document.body.classList.remove("modal-open");
      }
    }

    function clearAiTimer() {
      if (aiTimer) {
        clearTimeout(aiTimer);
        aiTimer = null;
      }
    }

    function driveAi() {
      if (settings.mode !== "ai" || state.phase === "over") return;
      if (state.turn !== settings.aiColor || aiTimer) return;

      if (state.phase === "roll") {
        aiTimer = setTimeout(function () {
          aiTimer = null;
          if (settings.mode !== "ai" || state.phase !== "roll" || state.turn !== settings.aiColor) return;
          performRoll(null);
        }, 520);
        return;
      }

      if (state.phase === "move" && state.options.length) {
        aiTimer = setTimeout(aiStep, aiPlan && aiPlan.length ? 360 : 240);
      }
    }

    function aiStep() {
      aiTimer = null;
      if (settings.mode !== "ai" || state.phase !== "move" || state.turn !== settings.aiColor) {
        aiPlan = null;
        return;
      }
      if (!state.options.length) {
        aiPlan = null;
        return;
      }

      if (!aiPlan || !aiPlan.length) {
        var choice = chooseSequence(state, state.turn, state.dice, {
          level: settings.aiLevel,
          timeBudget: 1400
        });
        aiPlan = choice ? choice.sequence.slice() : null;
      }

      if (!aiPlan || !aiPlan.length) {
        aiPlan = null;
        return;
      }

      var move = aiPlan.shift();
      var legal = state.options.some(function (option) {
        return option.from === move.from && option.to === move.to && option.die === move.die;
      });

      if (!legal) {
        aiPlan = null;
        driveAi();
        return;
      }

      applyMoveLocal(move);
    }

    /* ---------- online ---------- */

    function netUrl() {
      var manual = (settings.server || "").trim();
      if (manual) {
        return /^wss?:\/\//i.test(manual) ? manual : "ws://" + manual;
      }
      if (typeof location !== "undefined" && /^https?:$/.test(location.protocol)) {
        return (location.protocol === "https:" ? "wss://" : "ws://") + location.hostname + ":8001";
      }
      return "ws://127.0.0.1:8001";
    }

    function shareLink(code) {
      if (typeof location !== "undefined" && /^https?:$/.test(location.protocol)) {
        return location.origin + location.pathname + "?room=" + code;
      }
      var host = (typeof location !== "undefined" && location.hostname) ? location.hostname : "127.0.0.1";
      return "http://" + host + ":8000/?room=" + code;
    }

    function setOnlineHint(text, tone) {
      if (!onlineHint) return;
      onlineHint.textContent = text;
      if (tone) onlineHint.setAttribute("data-tone", tone);
      else onlineHint.removeAttribute("data-tone");
    }

    function updateRoomUI() {
      if (!roomBox) return;
      var code = online && online.code;
      roomBox.hidden = !code;
      if (!code) return;
      roomCodeEl.textContent = code;
      roomLink.value = shareLink(code);
    }

    function netSend(payload) {
      if (!online || !online.ws || online.ws.readyState !== 1) return false;
      try {
        online.ws.send(JSON.stringify(payload));
        return true;
      } catch (err) {
        return false;
      }
    }

    function netClose() {
      if (online && online.ws) {
        try { online.ws.close(); } catch (err) { /* ignore */ }
      }
      online = null;
      updateRoomUI();
      renderModeBadge();
    }

    function netConnect(onOpen) {
      netClose();
      var ws;
      try {
        ws = new WebSocket(netUrl());
      } catch (err) {
        setOnlineHint("Не удалось открыть соединение. Проверьте адрес сервера.", "error");
        return;
      }

      online = { ws: ws, code: "", color: null, pending: false, connected: false, started: false };
      setOnlineHint("Подключаемся к " + netUrl().replace(/^wss?:\/\//, "") + "…");

      ws.onopen = function () {
        if (!online) return;
        online.connected = true;
        if (onOpen) onOpen();
      };

      ws.onmessage = function (event) {
        var message;
        try { message = JSON.parse(event.data); } catch (err) { return; }
        handleNetMessage(message);
      };

      ws.onerror = function () {
        setOnlineHint("Сервер недоступен. Запустите server.py и проверьте адрес.", "error");
      };

      ws.onclose = function () {
        if (!online) return;
        online.connected = false;
        online.started = false;
        online.pending = false;
        if (settings.mode === "online") {
          state.notice = "Соединение потеряно — откройте «Режим» и подключитесь снова.";
          render();
        }
        renderModeBadge();
      };
    }

    function handleNetMessage(message) {
      if (!message || !message.type) return;

      if (message.type === "room") {
        online.code = message.code;
        online.color = message.color;
        roomInput.value = message.code;
        updateRoomUI();
        setOnlineHint("Комната " + message.code + " готова. Ждём соперника…", "ok");
        renderModeBadge();
        return;
      }

      if (message.type === "start") {
        online.started = true;
        settings.mode = "online";
        saveSettings();
        setOnlineHint("Соперник на связи.", "ok");
        closeModal(modeModal);
        resetGame(message.turn || "w");
        renderModeBadge();
        return;
      }

      if (message.type === "rolled") {
        online.pending = false;
        performRoll(message.dice);
        return;
      }

      if (message.type === "moved") {
        online.pending = false;
        applyIncomingMove(message.move);
        return;
      }

      if (message.type === "turn") {
        online.pending = false;
        applyRemoteTurn(message.turn);
        return;
      }

      if (message.type === "newgame") {
        resetGame(message.turn || "w");
        return;
      }

      if (message.type === "peer-left") {
        if (online) online.started = false;
        state.notice = "Соперник отключился.";
        setOnlineHint("Соперник отключился. Ждём нового игрока…", "error");
        render();
        return;
      }

      if (message.type === "error") {
        setOnlineHint(message.message || "Ошибка сети.", "error");
      }
    }

    function applyIncomingMove(move) {
      if (state.phase !== "move" || !move) return;
      var legal = state.options.some(function (option) {
        return option.from === move.from && option.to === move.to && option.die === move.die;
      });
      if (!legal) {
        state.notice = "Ходы разошлись — начните новую партию.";
        render();
        return;
      }
      applyMoveLocal({ from: move.from, to: move.to, die: move.die });
    }

    function resetGame(turn) {
      clearPassTimer();
      clearAiTimer();
      turnToken += 1;
      aiPlan = null;
      if (online) online.pending = false;
      state = makeState();
      if (turn) state.turn = turn;
      closeModal(rulesModal);
      closeModal(winModal);
      render();
    }

    /* ---------- mode dialog ---------- */

    function openModeModal() {
      draft = {
        mode: settings.mode,
        userColor: other(settings.aiColor),
        aiLevel: settings.aiLevel
      };
      serverInput.value = settings.server || "";
      if (online && online.code) roomInput.value = online.code;
      if (settings.mode !== "online") setOnlineHint("Запустите server.py, создайте комнату и отправьте другу ссылку.");
      syncModeUI();
      openModal(modeModal);
    }

    function syncModeUI() {
      if (!draft) return;
      modeOptions.forEach(function (button) {
        button.setAttribute("aria-checked", button.dataset.mode === draft.mode ? "true" : "false");
      });
      aiOptions.hidden = draft.mode !== "ai";
      onlineOptions.hidden = draft.mode !== "online";
      Array.prototype.forEach.call(aiColorSeg.querySelectorAll("[data-color]"), function (button) {
        button.setAttribute("aria-pressed", button.dataset.color === draft.userColor ? "true" : "false");
      });
      Array.prototype.forEach.call(aiLevelSeg.querySelectorAll("[data-level]"), function (button) {
        button.setAttribute("aria-pressed", button.dataset.level === draft.aiLevel ? "true" : "false");
      });
      if (draft.mode === "ai") {
        aiHint.textContent = settings.mode === "ai" && aiTimer
          ? "ИИ обдумывает ход…"
          : "Соперник подумает над броском и сыграет сам.";
      }
      updateRoomUI();
    }

    function applyDraft() {
      if (!draft) return;

      if (draft.mode === "online") {
        if (!online || !online.started) {
          setOnlineHint("Сначала создайте комнату или войдите по коду.", "error");
          return;
        }
        closeModal(modeModal);
        return;
      }

      settings.mode = draft.mode;
      settings.aiColor = other(draft.userColor);
      settings.aiLevel = draft.aiLevel;
      settings.server = (serverInput.value || "").trim();
      saveSettings();
      if (online) netClose();
      closeModal(modeModal);
      resetGame("w");
      renderModeBadge();
    }

    function createRoom() {
      settings.server = (serverInput.value || "").trim();
      saveSettings();
      if (roomInput) roomInput.value = "";
      netConnect(function () {
        netSend({ type: "create" });
      });
    }

    function joinRoom() {
      var code = (roomInput.value || "").trim().toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);
      if (code.length !== 4) {
        setOnlineHint("Введите четырёхбуквенный код комнаты.", "error");
        return;
      }
      roomInput.value = code;
      settings.server = (serverInput.value || "").trim();
      saveSettings();
      netConnect(function () {
        netSend({ type: "join", code: code });
      });
    }

    function copyRoomLink() {
      if (!roomLink.value) return;
      var done = function () {
        copyLinkBtn.textContent = "Скопировано";
        setTimeout(function () { copyLinkBtn.textContent = "Скопировать ссылку"; }, 1600);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(roomLink.value).then(done, done);
      } else {
        roomLink.select();
        try { document.execCommand("copy"); } catch (err) { /* ignore */ }
        done();
      }
    }

    function newGame() {
      clearPassTimer();
      clearAiTimer();
      turnToken += 1;
      if (settings.mode === "online" && online && online.started) {
        netSend({ type: "newgame" });
        return;
      }
      resetGame("w");
    }

    function bindEvents() {
      rollBtn.addEventListener("click", handleRoll);
      undoBtn.addEventListener("click", handleUndo);
      newGameBtn.addEventListener("click", newGame);
      rulesBtn.addEventListener("click", function () { openModal(rulesModal); });
      winNewGameBtn.addEventListener("click", newGame);
      boardFrame.addEventListener("click", handleBoardClick);

      modeBtn.addEventListener("click", openModeModal);
      modeBadge.addEventListener("click", openModeModal);
      applyModeBtn.addEventListener("click", applyDraft);
      createRoomBtn.addEventListener("click", createRoom);
      joinRoomBtn.addEventListener("click", joinRoom);
      copyLinkBtn.addEventListener("click", copyRoomLink);

      modeOptions.forEach(function (button) {
        button.addEventListener("click", function () {
          draft.mode = button.dataset.mode;
          syncModeUI();
        });
      });

      Array.prototype.forEach.call(aiColorSeg.querySelectorAll("[data-color]"), function (button) {
        button.addEventListener("click", function () {
          draft.userColor = button.dataset.color;
          syncModeUI();
        });
      });

      Array.prototype.forEach.call(aiLevelSeg.querySelectorAll("[data-level]"), function (button) {
        button.addEventListener("click", function () {
          draft.aiLevel = button.dataset.level;
          syncModeUI();
        });
      });

      roomInput.addEventListener("keydown", function (event) {
        if (event.key === "Enter") joinRoom();
      });

      serverInput.addEventListener("change", function () {
        settings.server = serverInput.value.trim();
        saveSettings();
      });

      document.querySelectorAll("[data-close]").forEach(function (button) {
        button.addEventListener("click", function () {
          closeModal(button.closest(".modal"));
        });
      });

      [rulesModal, winModal, modeModal].forEach(function (modal) {
        modal.addEventListener("click", function (event) {
          if (event.target === modal) closeModal(modal);
        });
      });

      document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
          closeModal(rulesModal);
          closeModal(winModal);
          closeModal(modeModal);
        }
      });
    }

    Array.prototype.forEach.call(document.querySelectorAll(".seg-mush"), function (el) {
      el.innerHTML = mushroomSvg(el.dataset.mush);
    });

    state = makeState();
    buildBoard();
    document.getElementById("avatar-w").innerHTML = mushroomSvg("w");
    document.getElementById("avatar-b").innerHTML = mushroomSvg("b");
    bindEvents();
    renderModeBadge();
    render();

    var roomParam = null;
    try {
      roomParam = new URLSearchParams(location.search).get("room");
    } catch (err) { /* old browser */ }

    if (roomParam) {
      var codeParam = roomParam.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);
      draft = { mode: "online", userColor: other(settings.aiColor), aiLevel: settings.aiLevel };
      syncModeUI();
      openModal(modeModal);
      roomInput.value = codeParam;
      setTimeout(joinRoom, 350);
    }

    if (typeof ResizeObserver !== "undefined") {
      new ResizeObserver(scheduleLayout).observe(boardFrame);
    }
    window.addEventListener("resize", scheduleLayout);
  }

  var Engine = {
    createPosition: createPosition,
    clonePosition: clonePosition,
    countCheckers: countCheckers,
    legalMovesFor: legalMovesFor,
    applyMove: applyMove,
    removeOneDie: removeOneDie,
    maxMoves: maxMoves,
    optimalSequences: optimalSequences,
    allowedMovesFor: allowedMovesFor,
    distanceToOff: distanceToOff,
    isHome: isHome,
    allInHome: allInHome,
    other: other,
    pipsFor: pipsFor,
    evaluatePosition: evaluatePosition,
    applySequence: applySequence,
    chooseSequence: chooseSequence,
    DICE_OUTCOMES: DICE_OUTCOMES,
    TOTAL_CHECKERS: TOTAL_CHECKERS,
    PLAYERS: PLAYERS
  };

  global.NardyEngine = Engine;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = Engine;
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", boot);
    } else {
      boot();
    }
  }
})(typeof window !== "undefined" ? window : globalThis);
