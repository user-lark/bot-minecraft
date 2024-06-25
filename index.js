const express = require("express");
const http = require("http");
const mineflayer = require('mineflayer')
const pvp = require('mineflayer-pvp').plugin
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder')
const armorManager = require('mineflayer-armor-manager')
const mc = require('minecraft-protocol');
const AutoAuth = require('mineflayer-auto-auth');
const app = express();

app.use(express.json());

app.get("/", (_, res) => res.sendFile(__dirname + "/index.html"));
app.listen(process.env.PORT);

setInterval(() => {
  http.get(`http://${process.env.PROJECT_DOMAIN}.repl.co/`);
}, 224000);

// U CAN ONLY EDIT THIS SECTION!!
function createBot () {
  const bot = mineflayer.createBot({
    host: 'tirto.aternos.me', 
    version: false, // U can replace with 1.16.5 for example, remember to use ', = '1.16.5'
    username: 'Tirtobot', 
    port: 23621, 
    plugins: [AutoAuth],
    AutoAuth: 'bot112022'
  })
  /// DONT TOUCH ANYTHING MORE!
  bot.loadPlugin(pvp)
  bot.loadPlugin(armorManager)
  bot.loadPlugin(pathfinder)

  bot.on('playerCollect', (collector, itemDrop) => {
    if (collector !== bot.entity) return

    setTimeout(() => {
      const sword = bot.inventory.items().find(item => item.name.includes('sword'))
      if (sword) bot.equip(sword, 'hand')
    }, 150)
  })

  bot.on('playerCollect', (collector, itemDrop) => {
    if (collector !== bot.entity) return

    setTimeout(() => {
      const shield = bot.inventory.items().find(item => item.name.includes('shield'))
      if (shield) bot.equip(shield, 'off-hand')
    }, 250)
  })

  let guardPos = null

  function guardArea (pos) {
    guardPos = pos.clone()

    if (!bot.pvp.target) {
      moveToGuardPos()
    }
  }

  function stopGuarding () {
    guardPos = null
    bot.pvp.stop()
    bot.pathfinder.setGoal(null)
  }

  function moveToGuardPos () {
    const mcData = require('minecraft-data')(bot.version)
    bot.pathfinder.setMovements(new Movements(bot, mcData))
    bot.pathfinder.setGoal(new goals.GoalBlock(guardPos.x, guardPos.y, guardPos.z))
  }

  bot.on('stoppedAttacking', () => {
    if (guardPos) {
      moveToGuardPos()
    }
  })

  bot.on('physicTick', () => {
    if (bot.pvp.target) return
    if (bot.pathfinder.isMoving()) return

    const entity = bot.nearestEntity()
    if (entity) bot.lookAt(entity.position.offset(0, entity.height, 0))
  })
  bot.on('physicTick', () => {
    if (!guardPos) return
    const filter = e => e.type === 'mob' && e.position.distanceTo(bot.entity.position) < 16 &&
                        e.mobType !== 'Armor Stand' 
    const entity = bot.nearestEntity(filter)
    if (entity) {
      bot.pvp.attack(entity)
    }
  })

  let isFishing = false
  let isStationary = false

  bot.on('chat', (username, message) => {
    if (message === 'guard') {
      const player = bot.players[username]

      if (player) {
        bot.chat('I will!')
        guardArea(player.entity.position)
      }

    }
    if (message === 'stop') {
      bot.chat('I will stop!')
      stopGuarding()
    }
    if (message === 'mancing') {
      bot.chat('Fishing time!')
      isFishing = true
      startFishing()
    }
    if (message === 'stop mancing') {
      bot.chat('I will stop fishing!')
      isFishing = false
    }
    if (message === 'bagi hasil') {
      const player = bot.players[username]
      if (player) {
        bot.chat('I will share my catch!')
        shareFishingLoot(player)
      } else {
        bot.chat('I cannot see you!')
      }
    }
    if (message === 'diam') {
      bot.chat('I will stay here!')
      isStationary = true
      stayStill()
    }
    if (message === 'gerak') {
      bot.chat('I will start moving again!')
      isStationary = false
    }
  })
  
  bot.on('kicked', (reason, loggedIn) => {
    if (loggedIn) {
      console.log('Kicked from server. Reconnecting...')
      setTimeout(createBot, 5000); // Reconnect after 5 seconds
    }
  });
  
  bot.on('error', (err) => {
    console.error('Bot error:', err);
  });

  bot.on('end', () => {
    console.log('Disconnected from server. Reconnecting...')
    setTimeout(createBot, 5000); // Reconnect after 5 seconds
  });

  // Add action commands handling
  const actions = {
    commands: ["forward", "back", "left", "right", "jump"],
    holdDuration: 5000,
    retryDelay: 15000
  }

  function performAction() {
    if (isStationary) return
    const command = actions.commands[Math.floor(Math.random() * actions.commands.length)];
    bot.setControlState(command, true)
    setTimeout(() => {
      bot.setControlState(command, false)
    }, actions.holdDuration)
  }

  bot.on('physicTick', () => {
    if (Math.random() < 0.01) { // roughly every 100 ticks
      performAction()
    }
  })

  // Fishing function
  function startFishing() {
    if (!isFishing) return
    const fishingRod = bot.inventory.items().find(item => item.name.includes('fishing_rod'))
    if (!fishingRod) {
      bot.chat('I do not have a fishing rod!')
      isFishing = false
      return
    }
    bot.equip(fishingRod, 'hand', (err) => {
      if (err) {
        bot.chat('Error equipping fishing rod')
        isFishing = false
        return
      }
      bot.activateItem()
      setTimeout(() => {
        bot.deactivateItem()
        if (isFishing) {
          setTimeout(startFishing, 3000) // Fish again after 3 seconds
        }
      }, 30000) // Fish for 30 seconds
    })
  }

  // Share fishing loot function
  function shareFishingLoot(player) {
    const fishTypes = ['cod', 'salmon', 'pufferfish', 'tropical_fish']
    const fish = bot.inventory.items().find(item => fishTypes.includes(item.name))
    
    if (fish) {
      bot.tossStack(fish, (err) => {
        if (err) {
          bot.chat('Failed to toss the item')
        } else {
          bot.chat('Here is some fish for you!')
        }
      })
    } else {
      bot.chat('I have no fish to share!')
    }
  }

  // Stay still function
  function stayStill() {
    bot.clearControlStates()
  }
}

createBot()
