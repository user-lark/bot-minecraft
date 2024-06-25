const express = require("express");
const http = require("http");
const mineflayer = require('mineflayer');
const pvp = require('mineflayer-pvp').plugin;
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const armorManager = require('mineflayer-armor-manager');
const mc = require('minecraft-protocol');
const AutoAuth = require('mineflayer-auto-auth');
const app = express();

app.use(express.json());

app.get("/", (_, res) => res.sendFile(__dirname + "/index.html"));
app.listen(process.env.PORT);

setInterval(() => {
  http.get(`http://${process.env.PROJECT_DOMAIN}.repl.co/`);
}, 224000);

function createBot() {
  const bot = mineflayer.createBot({
    host: 'tirto.aternos.me',
    version: false,
    username: 'Tirtobot',
    port: 23621,
    plugins: [AutoAuth],
    AutoAuth: 'bot112022'
  });

  bot.loadPlugin(pvp);
  bot.loadPlugin(armorManager);
  bot.loadPlugin(pathfinder);

  bot.on('playerCollect', (collector, itemDrop) => {
    if (collector !== bot.entity) return;

    setTimeout(() => {
      const sword = bot.inventory.items().find(item => item.name.includes('sword'));
      if (sword) bot.equip(sword, 'hand');
    }, 150);
  });

  bot.on('playerCollect', (collector, itemDrop) => {
    if (collector !== bot.entity) return;

    setTimeout(() => {
      const shield = bot.inventory.items().find(item => item.name.includes('shield'));
      if (shield) bot.equip(shield, 'off-hand');
    }, 250);
  });

  let guardPos = null;

  function guardArea(pos) {
    guardPos = pos.clone();

    if (!bot.pvp.target) {
      moveToGuardPos();
    }
  }

  function stopGuarding() {
    guardPos = null;
    bot.pvp.stop();
    bot.pathfinder.setGoal(null);
  }

  function moveToGuardPos() {
    const mcData = require('minecraft-data')(bot.version);
    bot.pathfinder.setMovements(new Movements(bot, mcData));
    bot.pathfinder.setGoal(new goals.GoalBlock(guardPos.x, guardPos.y, guardPos.z));
  }

  bot.on('stoppedAttacking', () => {
    if (guardPos) {
      moveToGuardPos();
    }
  });

  bot.on('physicTick', () => {
    if (bot.pvp.target) return;
    if (bot.pathfinder.isMoving()) return;

    const entity = bot.nearestEntity();
    if (entity) bot.lookAt(entity.position.offset(0, entity.height, 0));
  });

  bot.on('physicTick', () => {
    if (!guardPos) return;
    const filter = e => e.type === 'mob' && e.position.distanceTo(bot.entity.position) < 16 &&
                        e.mobType !== 'Armor Stand';
    const entity = bot.nearestEntity(filter);
    if (entity) {
      bot.pvp.attack(entity);
    }
  });

  let playerToGiveFish = null;

  bot.on('chat', (username, message) => {
    if (message === 'guard') {
      const player = bot.players[username];

      if (player) {
        bot.chat('I will guard!');
        guardArea(player.entity.position);
      }
    }
    if (message === 'stop') {
      bot.chat('I will stop!');
      stopGuarding();
    }
    if (message === 'tebang pohon') {
      bot.chat('Baik, saya akan menebang pohon.');
      tebangPohon();
    }
    if (message === 'hasil tebang') {
      hasilTebang(username);
    }
    if (message === 'memancing') {
      bot.chat('Baik, saya akan memulai memancing.');
      playerToGiveFish = username;
      mulaiMemancing();
    }
    if (message === 'berhenti memancing') {
      bot.chat('Baik, saya akan berhenti memancing.');
      berhentiMemancing();
      playerToGiveFish = null;
    }
    if (message === 'beri ikan') {
      beriIkan(username);
    }
  });

  bot.on('kicked', console.log);
  bot.on('error', console.log);
  bot.on('end', createBot);

  // Action commands handling
  const actions = {
    commands: ["forward", "back", "left", "right", "jump"],
    holdDuration: 5000,
    retryDelay: 15000
  };

  function performAction() {
    const command = actions.commands[Math.floor(Math.random() * actions.commands.length)];
    bot.setControlState(command, true);
    setTimeout(() => {
      bot.setControlState(command, false);
    }, actions.holdDuration);
  }

  bot.on('physicTick', () => {
    if (Math.random() < 0.01) { // roughly every 100 ticks
      performAction();
    }
  });

  // Fishing action
  function mulaiMemancing() {
    bot.equip(bot.inventory.items().find(item => item.name.includes('fishing_rod')), 'hand', (err) => {
      if (err) {
        bot.chat('Maaf, saya tidak memiliki tongkat pancing.');
      } else {
        bot.fish();
      }
    });
  }

  function berhentiMemancing() {
    bot.activateItem();
  }

  bot.on('fishCaught', (ikan) => {
    if (playerToGiveFish) {
      const entitasPemain = bot.players[playerToGiveFish]?.entity;
      if (entitasPemain) {
        bot.lookAt(entitasPemain.position.offset(0, entitasPemain.height, 0));
        bot.tossStack(ikan);
        bot.chat(`Ini ikanmu, ${playerToGiveFish}!`);
      }
    }
  });

  bot.on('fishingStop', (alasan) => {
    bot.chat('Memancing selesai: ' + alasan);
    if (alasan === 'ikan tertangkap') {
      mulaiMemancing(); // lanjutkan memancing jika berhasil menangkap ikan
    }
  });

  function beriIkan(username) {
    const ikan = bot.inventory.items().find(item => item.name.includes('ikan'));
    if (ikan) {
      const entitasPemain = bot.players[username]?.entity;
      if (entitasPemain) {
        bot.lookAt(entitasPemain.position.offset(0, entitasPemain.height, 0));
        bot.tossStack(ikan);
        bot.chat(`Ini ikanmu, ${username}!`);
      } else {
        bot.chat(`Maaf, saya tidak bisa menemukanmu, ${username}.`);
      }
    } else {
      bot.chat('Maaf, saya tidak memiliki ikan untuk diberikan.');
    }
  }

  // Chop tree action
  function tebangPohon() {
    const mcData = require('minecraft-data')(bot.version);
    const tool = bot.pathfinder.bestHarvestTool(bot.blockAt(bot.entity.position.offset(0, -1, 0)));

    if (tool) {
      const treeFilter = (block) => mcData.blocksByState[block.stateId].name.includes('log');
      const blocks = bot.findBlocks({
        matching: treeFilter,
        maxDistance: 16,
        count: 100,
        height: 20
      });

      if (blocks.length > 0) {
        const treeTop = blocks[blocks.length - 1];
        const goal = new goals.GoalGetToBlock(treeTop.x, treeTop.y, treeTop.z);
        
        bot.pathfinder.setMovements(new Movements(bot, mcData));
        bot.pathfinder.setGoal(goal);

        bot.once('goal_reached', () => {
          bot.lookAt(treeTop.position);
          bot.activateItem();
          bot.once('blockUpdate', (oldBlock, newBlock) => {
            if (treeFilter(newBlock)) {
              tebangPohon();
            } else {
              bot.chat('Pohon berhasil ditebang!');
              bot.pathfinder.setGoal(null);
            }
          });
        });
      } else {
        bot.chat('Tidak ada pohon yang dapat ditebang di dekat sini.');
      }
    } else {
      bot.chat('Maaf, saya tidak memiliki alat yang sesuai untuk menebang pohon.');
    }
  }

  // Give chopped wood action
  function hasilTebang(username) {
    const kayu = bot.inventory.items().find(item => item.name.includes('kayu'));
    if (kayu) {
      const entitasPemain = bot.players[username]?.entity;
      if (entitasPemain) {
        bot.lookAt(entitasPemain.position.offset(0, entitasPemain.height, 0));
        bot.tossStack(kayu);
        bot.chat(`Ini hasil tebangan pohon untukmu, ${username}!`);
      } else {
        bot.chat(`Maaf, saya tidak bisa menemukanmu, ${username}.`);
      }
    } else {
      bot.chat('Maaf, saya tidak memiliki kayu untuk diberikan.');
    }
  }
}

createBot();
