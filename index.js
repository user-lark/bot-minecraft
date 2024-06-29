const express = require("express");
const http = require("http");
const mineflayer = require('mineflayer');
const pvp = require('mineflayer-pvp').plugin;
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const armorManager = require('mineflayer-armor-manager');
const AutoAuth = require('mineflayer-auto-auth');
const app = express();
const fs = require('fs');
const { Webhook, MessageBuilder } = require('discord-webhook-node');

// Setup Discord webhook
const discordHook = new Webhook('https://discord.com/api/webhooks/1256142952431095808/7MbBIy6Fe96UQc0FhyVZhnAWYsIGNahPNCL1M62_kUpQGNMQxeitQ2xPFl2iX80nWLLs');

app.use(express.json());

app.get("/", (_, res) => res.sendFile(__dirname + "/index.html"));
app.listen(process.env.PORT || 3000, () => {
  console.log(`Server is running on port ${process.env.PORT || 3000}`);
});

// Uptime endpoint for Koyeb
app.get("/uptime", (_, res) => {
  res.sendStatus(200);
});

function createBot() {
  const bot = mineflayer.createBot({
    host: 'tirto.aternos.me',
    version: false, // U can replace with 1.16.5 for example, remember to use ', = '1.16.5'
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

  const config = {
    utils: {
      'chat-log': true
    }
  };

  const logger = {
    info: (msg) => {
      fs.appendFile('chat.log', `${new Date().toISOString()} - ${msg}\n`, (err) => {
        if (err) console.error('Error writing to chat.log', err);
      });
      console.log(`INFO: ${msg}`); // Print to console
      discordHook.send(`INFO: ${msg}`); // Send to Discord webhook
    },
    warn: (msg) => {
      fs.appendFile('chat.log', `${new Date().toISOString()} - WARN: ${msg}\n`, (err) => {
        if (err) console.error('Error writing to chat.log', err);
      });
      console.warn(`WARN: ${msg}`); // Print to console
      discordHook.send(`WARN: ${msg}`); // Send to Discord webhook
    },
    error: (msg) => {
      fs.appendFile('chat.log', `${new Date().toISOString()} - ERROR: ${msg}\n`, (err) => {
        if (err) console.error('Error writing to chat.log', err);
      });
      console.error(`ERROR: ${msg}`); // Print to console
      discordHook.send(`ERROR: ${msg}`); // Send to Discord webhook
    }
  };

  bot.once('spawn', () => {
    logger.info("Bot has joined the server!");
  });

  bot.on('chat', (username, message) => {
    if (config.utils['chat-log']) {
      logger.info(`<${username}> ${message}`);
    }

    if (message === 'guard') {
      const player = bot.players[username];

      if (player && player.entity) { // Memastikan player dan entity ada
        bot.chat('I will!');
        guardArea(player.entity.position);
      } else {
        bot.chat('I cannot see you!');
      }
    }

    if (message === 'stop') {
      bot.chat('I will stop!');
      stopGuarding();
    }
  });

  bot.on('death', () => {
    const killer = bot.lastAttackedBy;

    if (killer && (killer.type === 'mob' || killer.type === 'player')) {
      logger.warn(`Bot was killed by ${killer.type} and respawned at position: ${bot.entity.position}`);
      // Disini, bot tidak akan disconnect jika dibunuh oleh mob atau player
      // Anda bisa menambahkan logika lain jika diperlukan
    } else {
      logger.warn(`Bot died and respawned at position: ${bot.entity.position}`);
    }
  });

  bot.on('kicked', reason => {
    const reasonText = JSON.parse(reason).text || JSON.parse(reason).extra[0].text;
    const kickReason = reasonText.replace(/§./g, '');
    logger.warn(`Bot was kicked from the server. Reason: ${kickReason}`);

    // Cek apakah alasan kick adalah timeout atau idle
    if (kickReason.includes('Timed out') || kickReason.includes('Idle')) {
      // Jika alasan kick adalah timeout atau idle, coba reconnect setelah beberapa waktu
      setTimeout(() => {
        logger.info('Attempting to reconnect...');
        createBot();
      }, 10000); // Contoh: coba reconnect setelah 10 detik
    }
  });

  bot.on('error', err => {
    logger.error(err.message);
  });

  bot.on('end', () => {
    logger.error("Bot disconnected. Attempting to reconnect in 10 seconds...");
    setTimeout(createBot, 10000); // Retry connecting after 10 seconds
  });

  // Pesan-pesan acak yang akan dikirim oleh bot
  const randomMessages = [
    "Halo semua!",
    "Ada yang mau main?",
    "Lagi ngapain nih?",
    "Siapa yang sudah punya diamond?",
    "Ayo kita petualangan!"
  ];

  // Kirim pesan acak setiap 240 detik (4 menit)
  setInterval(() => {
    const randomIndex = Math.floor(Math.random() * randomMessages.length);
    const message = randomMessages[randomIndex];
    bot.chat(message);
  }, 240000); // 240000 milidetik = 240 detik = 4 menit
}

createBot();
