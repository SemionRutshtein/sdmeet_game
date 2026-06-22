const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const TOTAL_TURNS = parseInt(process.env.TOTAL_TURNS || '20');

function getLevelForTurn(turnNum) {
  const pct = turnNum / TOTAL_TURNS;
  if (pct < 0.3) return 1;
  if (pct < 0.7) return 2;
  return 3;
}

async function getUsedIds(roomId, field) {
  const rounds = await prisma.round.findMany({
    where: { roomId, [field]: { not: null } },
    select: { [field]: true }
  });
  return rounds.map(r => r[field]).filter(Boolean);
}

async function pickRandom(model, level, usedIds) {
  // Try exact level first, then adjacent
  for (const lvl of [level, level - 1, level + 1].filter(l => l >= 1 && l <= 3)) {
    const rows = await prisma[model].findMany({
      where: { level: lvl, id: { notIn: usedIds.length ? usedIds : [-1] } }
    });
    if (rows.length) return rows[Math.floor(Math.random() * rows.length)];
  }
  return null;
}

async function getActiveRound(roomId) {
  const round = await prisma.round.findFirst({
    where: { roomId, state: { notIn: ['APPROVED'] } },
    orderBy: { turnNum: 'desc' }
  });
  if (!round) throw new Error('No active round');
  return round;
}

async function startTurn(roomId) {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: { players: true }
  });

  if (room.turnNum >= TOTAL_TURNS) {
    await prisma.room.update({ where: { id: roomId }, data: { state: 'FINISHED' } });
    return { finished: true, players: room.players };
  }

  const level = getLevelForTurn(room.turnNum);
  const usedQuestionIds = await getUsedIds(roomId, 'questionId');
  const question = await pickRandom('question', level, usedQuestionIds);

  if (!question) {
    await prisma.room.update({ where: { id: roomId }, data: { state: 'FINISHED' } });
    return { finished: true, players: room.players };
  }

  const activePlayer = room.players.find(p => p.playerNum === room.activePlayerNum);

  await prisma.round.create({
    data: {
      roomId,
      playerId: activePlayer.id,
      questionId: question.id,
      turnNum: room.turnNum,
      state: 'QUESTION_SHOWN'
    }
  });

  return {
    question,
    activePlayer,
    players: room.players,
    turnNum: room.turnNum,
    totalTurns: TOTAL_TURNS,
    level
  };
}

async function playerAnswered(roomId) {
  const round = await getActiveRound(roomId);
  await prisma.round.update({ where: { id: round.id }, data: { state: 'PLAYER_ANSWERED' } });
}

async function skipToTask(roomId) {
  const round = await getActiveRound(roomId);
  const room = await prisma.room.findUnique({ where: { id: roomId } });
  const usedTaskIds = await getUsedIds(roomId, 'taskId');
  const level = getLevelForTurn(room.turnNum);
  const task = await pickRandom('task', level, usedTaskIds);

  if (!task) throw new Error('No tasks available');

  await prisma.round.update({
    where: { id: round.id },
    data: { taskId: task.id, usedTask: true, state: 'TASK_SHOWN' }
  });

  return { task };
}

async function taskDone(roomId) {
  const round = await getActiveRound(roomId);
  await prisma.round.update({ where: { id: round.id }, data: { state: 'TASK_DONE' } });
}

async function approve(roomId) {
  const round = await getActiveRound(roomId);
  await prisma.round.update({ where: { id: round.id }, data: { state: 'APPROVED' } });

  const room = await prisma.room.findUnique({ where: { id: roomId } });
  await prisma.room.update({
    where: { id: roomId },
    data: {
      turnNum: room.turnNum + 1,
      activePlayerNum: room.activePlayerNum === 1 ? 2 : 1
    }
  });

  return startTurn(roomId);
}

async function joinRoom(roomId, playerName) {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: { players: true }
  });

  if (!room) throw new Error('Комната не найдена');
  if (room.state !== 'WAITING_FOR_P2') throw new Error('Игра уже началась или комната занята');
  if (room.players.length >= 2) throw new Error('Комната заполнена');

  const player = await prisma.player.create({
    data: { name: playerName.trim(), roomId, playerNum: 2 }
  });

  await prisma.room.update({ where: { id: roomId }, data: { state: 'GAME_STARTED' } });

  const allPlayers = await prisma.player.findMany({ where: { roomId } });
  return { player, players: allPlayers };
}

async function getRoomState(roomId) {
  return prisma.room.findUnique({
    where: { id: roomId },
    include: {
      players: true,
      rounds: { orderBy: { turnNum: 'desc' }, take: 1 }
    }
  });
}

async function getRoundWithContent(roomId) {
  const round = await prisma.round.findFirst({
    where: { roomId, state: { notIn: ['APPROVED'] } },
    orderBy: { turnNum: 'desc' }
  });
  if (!round) return null;

  const question = round.questionId
    ? await prisma.question.findUnique({ where: { id: round.questionId } })
    : null;
  const task = round.taskId
    ? await prisma.task.findUnique({ where: { id: round.taskId } })
    : null;

  return { round, question, task };
}

module.exports = {
  startTurn,
  playerAnswered,
  skipToTask,
  taskDone,
  approve,
  joinRoom,
  getRoomState,
  getRoundWithContent,
  TOTAL_TURNS
};
