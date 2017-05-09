var IDE_HOOK = false;
var VERSION = '2.3.0';

var gameWidth = 900;
var gameHeight = 650;

var game = new Phaser.Game(gameWidth, gameHeight, Phaser.AUTO, 'game-container', {
    preload: preload,
    create: create,
    update: update,
    render: render
});

function preload() {
    game.load.image('bulletPlayer', 'img/bullet.png');
    game.load.image('bulletRed', 'img/bullet_red.png');
    game.load.image('bulletDot', 'img/enemy-bullet.png');
    game.load.image('bulletMissle', 'img/bullet10.png');
    game.load.image('dnaBomb', 'img/dna_bomb64.png');
    //game.load.image('deathRay', 'img/death-ray.png');
    
    game.load.spritesheet('invader', 'img/4_0_personaj_joc.png', 32, 32);
    game.load.image('player', 'img/spaceship-a-72c.png');
    game.load.spritesheet('kaboom', 'img/explode.png', 128, 128);
    game.load.image('starfield', 'img/starfield.png');
    game.load.image('background', 'img/background2.png');
    game.load.image('bossPsd', 'img/6_1_personaj_joc_64px.png');
    game.load.spritesheet('olgutaBoss', 'img/olgutaBoss.png', 182, 182);
}

var player;
var aliens;
var bossesPsd;
var lives;
var bombs;
var bosstimer;
var bulletTime = 0;

var cursors;
var fireButton;
var restartButton;
var bombButton;

var explosions;
var starfield;
var stateText;
var livingEnemies = [];
var maxDescent = 100; // distance from the bottom
var gameOver = false;
var phase2 = false;


var bullets = {    
    getBulletGroup: function (groupSize, imageResource) {
        b = game.add.group();
        b.enableBody = true;
        b.physicsBodyType = Phaser.Physics.ARCADE;
        b.createMultiple(groupSize, imageResource);
        b.setAll('anchor.x', 0.5);
        b.setAll('anchor.y', 1);
        b.setAll('outOfBoundsKill', true);
        b.setAll('checkWorldBounds', true);

        return b;
    },
	
	initialized: false
};

function initBullets() {
    bullets.player = bullets.getBulletGroup(30, 'bulletPlayer');
    bullets.thief = bullets.getBulletGroup(30, 'bulletDot');
    bullets.psd = bullets.getBulletGroup(15, 'bulletRed');
    bullets.dragnea = bullets.getBulletGroup(15, 'bulletMissle');
    
	bullets.bombs = bullets.getBulletGroup(20, 'dnaBomb');
    bullets.bombs.interval = 2000;
    bullets.bombs.readyTime = 0;
    bullets.bombs.active = false;
	
	bullets.initialized = true;
}

function resetBullets() {
    bullets.player.removeAll();
    bullets.thief.removeAll();
    bullets.psd.removeAll();
    bullets.dragnea.removeAll();
    bullets.bombs.removeAll();
}

var score = {
    value: 0,
    display: null,
    label: 'Score: ',
    options: {
        font: '24px AlienGrad',
        fill: '#fff',
        backgroundColor: "#000"
    },
    init: function() {
        this.display = game.add.text(10, 10, this.label + this.value, this.options);
    },
    update: function(value) {
        this.value += value;
        this.updateText();
    },
    reset: function() {
        this.value = 0;
        this.updateText();
    },
    updateText: function() {
        this.display.text = this.label + this.value;
    }
};

var enemy = {
    
    items: [], // a cotainer for all the created enemies
    
    /**
     * Creates an enemy and adds it to the pool with a given name.
     * 
     * @name string The name of the enemy (to be used for future reference).
     * @image string The name assigned to the loaded enemy image.
     * @hitpoints int The number of hitpoints of the enemy.
     * @exists bool True if it should be active imediately, false for later activation.
     */
    create: function(name, image, hitpoints, exists) {
        var enemy = game.add.sprite(0, 0, image);
        enemy.anchor.setTo(0.5, 0.5);
        enemy.hitpoints = hitpoints;
        enemy.fireInterval = fireInterval;
        enemy.exists = exists;
        
        this.items[name] = enemy;
    },
    
    /**
     * Retunrs an enemy by name. Avoid if possible, use object methods instead.
     * 
     * @name string The name of the enemy to return.
     */
    get: function(name) {
        return this.items[name];
    },
    
    /**
     * Removes an enemy from the pool.
     * 
     * @name string The name of the enemy to remove.
     */
    remove: function(name) {
        this.items[name] = null; // There may be a better way to do this...
    }
  
};

var weapon = {
    
    /**
     * Adds a weapon to an enemy.
     * 
     * @interval int The time between shots.
     * @bullet string The name assigned to the loaded bullet image.
     * @count int The number of bullets to fire in each shot.
     */
    create: function(interval, bullet, count) {
        count = count || 1; 
        var weapon = {
            interval: interval,
            bullets: bullets.getBulletGroup(count, bullet),
            nextShot: game.time.now + interval // @note need to look into this
        }
        return weapon;
    },
    
    fire: function(shooter, bullets, count) {
        count = count || 1;
        var spreadAngle = 25; // the angular spread between bullets

        for (i = 0; i < count; i++) {
            var bullet = bullets.getFirstExists(false);
            if (bullet && shooter) {
                // Make bullet come out of tip of ship with right angle
                // var bulletOffset = 20 * Math.sin(game.math.degToRad(0));
                bullet.reset(shooter.body.x + shooter.body.width / 2, shooter.body.y + shooter.body.height);
                //  "Spread" angle of 1st and 3rd bullets
                var angle = Phaser.Point.angle(player, bullet);
                angle = game.math.radToDeg(angle) + spreadAngle * (i - (count - 1) / 2);
                bullet.angle = angle;
                game.physics.arcade.velocityFromAngle(angle, 200, bullet.body.velocity);
            }
        }
    }
    
}

function create() {
    game.physics.startSystem(Phaser.Physics.ARCADE);

    //  The scrolling starfield background
    starfield = game.add.tileSprite(0, 0, gameWidth, gameHeight, 'starfield');

    olgutaBoss = game.add.sprite(0, 0, 'olgutaBoss');
    olgutaBoss.exists = false;
    olgutaBoss.anchor.setTo(0.5, 0.5);
    
    olgutaBoss.hitpoints = 20;
    olgutaBoss.fireInterval = 2700;
    olgutaBoss.nextShot = game.time.now + olgutaBoss.fireInterval;
    game.physics.enable(olgutaBoss, Phaser.Physics.ARCADE);
	
    initBullets();
    createDnaBombs();
	
    createHero();

    //  The baddies!
    aliens = game.add.group();
    aliens.enableBody = true;
    aliens.physicsBodyType = Phaser.Physics.ARCADE;
    aliens.fireInterval = 500;
    aliens.nextShot = game.time.now;

    // The bosses!
    bossesPsd = game.add.group();
    bossesPsd.enableBody = true;
    bossesPsd.physicsBodyType = Phaser.Physics.ARCADE;
    bossesPsd.fireInterval = 1200;
    bossesPsd.nextShot = game.time.now;

    createAliens();

    score.init();

    //  Text
    stateText = game.add.text(game.world.centerX, game.world.centerY, ' ', {
        font: '42px AlienGrad',
        fill: '#fff',
        backgroundColor: "#000"
    });
    stateText.anchor.setTo(0.5, 0.5);
    stateText.visible = false;

    //  An explosion pool
    explosions = game.add.group();
    explosions.createMultiple(50, 'kaboom');
    explosions.forEach(setupInvader, this);

    //  And some controls to play the game with
    cursors = game.input.keyboard.createCursorKeys();
    fireButton = game.input.keyboard.addKey(Phaser.Keyboard.SPACEBAR);
    bombButton = game.input.keyboard.addKey(Phaser.Keyboard.D);
    restartButton = game.input.keyboard.addKey(Phaser.Keyboard.ENTER);
	
    start();
}

function createHero() {
    //  The hero!
    player = game.add.sprite(400, 600, 'player');
    player.anchor.setTo(0.5, 0.5);
    game.physics.enable(player, Phaser.Physics.ARCADE);
    
    // The hero's lives
    lives = game.add.group();
    game.add.text(game.world.width - 160, 10, 'Lives ', {font: '24px AlienGrad', fill: '#fff'});
    
    for (var i = 0; i < 3; i++) {
        var ship = lives.create(game.world.width - 100 + (40 * i), 22, 'player');
        ship.anchor.setTo(0.5, 0.5);
        ship.alpha = 0.5;
        ship.angle += 90;
        ship.scale.x = .6;
        ship.scale.y = .6;
    }
}


function createDnaBombs() {
    // Setup counter
    bombs = game.add.group();
    game.add.text(game.world.width - 150, 45, 'Dna ', {font: '24px AlienGrad', fill: '#fff'});
    
    for (var i = 0; i < 3; i++) {
        var bomb = bombs.create(game.world.width - 100 + (40 * i), 58, 'dnaBomb');
        bomb.anchor.setTo(0.5, 0.5);
        bomb.alpha = 0.8;
        bomb.scale.x = .6;
        bomb.scale.y = .6;
    }
}

function triggerDnaBombs() {
    if (bullets.bombs.readyTime > game.time.now) {
        return;
    }
    bullets.bombs.readyTime = game.time.now + bullets.bombs.interval;
    var bomb = bombs.getFirstAlive();
    if (bomb) {
        bomb.kill();
        bullets.bombs.stop = game.time.now + bullets.bombs.interval;
        bullets.bombs.next = game.time.now;
    }
}

function fireDnaBomb() {
    if (bullets.bombs.stop > game.time.now && bullets.bombs.next < game.time.now) {
        var bomb = bullets.bombs.getFirstExists(false);
        if (bomb) {
            //  And fire it
            bomb.reset(player.x, player.y + 16);
            var angle = -1 * (60 + Math.floor((Math.random() * 60) + 1));
            game.physics.arcade.velocityFromAngle(angle, 200, bomb.body.velocity);
            bullets.bombs.next = game.time.now + 250;
        }
    }
}

function createBossPsd() {
    if (!phase2) {
        for (var x = 0; x < 5; x++) {
            var boss = bossesPsd.create(x * 80, 0, 'bossPsd');
            boss.anchor.setTo(0.5, 0.5);
            boss.body.moves = false;
            boss.hitpoints = 5;
        }
        bossesPsd.x = 25;
        bossesPsd.y = 200;
        game.add.tween(bossesPsd).to({x: 550}, 2000, Phaser.Easing.Linear.None, true, 0, 200, true);

        olgutaBoss.reset(200, 75);
        olgutaBoss.animations.add('blink', [ 0, 1, 2 ], 2, true);
        olgutaBoss.play('blink');
        game.add.tween(olgutaBoss).to({x: 500}, 4000, Phaser.Easing.Linear.None, true, 0, 1000, true);
    }
    phase2 = true;
}

function createAliens() {
    phase2 = false;

    for (var y = 0; y < 5; y++) {
        for (var x = 0; x < 12; x++) {
            var alien = aliens.create(x * 48, y * 50, 'invader');
            alien.anchor.setTo(0.5, 0.5);
            alien.body.moves = false;
            alien.hitpoints = 1;
        }
    }

    aliens.x = 100;
    aliens.y = 50;

    if (!gameOver) {
        // HACK to make sure this does not happen on restart();
        var tween = game.add.tween(aliens).to({x: 200}, 2000, Phaser.Easing.Linear.None, true, 0, 1000, true);
        tween.onLoop.add(descend, this);
    }
    
}

function setupInvader(invader) {
    invader.anchor.x = 0.5;
    invader.anchor.y = 0.5;
    invader.animations.add('kaboom');
}

function descend() {
    if (phase2) {
        bossesPsd.y += 10;
        olgutaBoss.y += 10;
    } else {
        aliens.y += 10;
    }
}

function update() {
    //  Scroll the background
    starfield.tilePosition.y += 2;
	
	if (gameOver && restartButton.isDown) {
		restart();
	}
    
    if (player.alive) {
        //  Reset the player, then check for movement keys
        player.body.velocity.setTo(0, 0);
        
        if (isPlayerOutOfBounds()) {
			gameOverLoss("Drag_ne-a fost de tine. Nu iesi din peisaj\ncand lucrurile devin grele.\n\nClick sau ENTER pentru un joc nou");
			ga('send', {
			  hitType: 'event',
			  eventCategory: 'Game',
			  eventAction: 'play',
			  eventLabel: 'loss',
			  eventValue: 3 // outOfBounds
			});
        }

        if (cursors.left.isDown) {
            player.body.velocity.x = -200;
        }
        else if (cursors.right.isDown) {
            player.body.velocity.x = 200;
        }

        //  Firing?
        if (fireButton.isDown) {
            fireBullet();
        }
        
        if (bombButton.isDown) {
            triggerDnaBombs();
        }
        fireDnaBomb();

        if (gameOver) return;
        // win condition
        if (phase2 && bossesPsd.getFirstAlive() === null && !olgutaBoss.alive) {
            gameOverWin();
        }

        if (!phase2 && game.time.now > aliens.nextShot) {
            enemyFires(aliens, bullets.thief);
        }
        if (phase2) {
            if (bossesPsd.getFirstAlive() && game.time.now > bossesPsd.nextShot) {
                enemyFires(bossesPsd, bullets.psd, 3);
            }
            if (olgutaBoss.alive && game.time.now > olgutaBoss.nextShot) {
                olgutaBoss.nextShot = game.time.now + olgutaBoss.fireInterval;
                shooterShoot(olgutaBoss, bullets.dragnea, 5);
            }
        }

        if (aliens.countLiving() === 0) {
            createBossPsd();
        }

        //  Run collision
        game.physics.arcade.overlap(aliens, bullets.player, collisionHandler, null, this);
        game.physics.arcade.overlap(bossesPsd, bullets.player, collisionHandler, null, this);
        game.physics.arcade.overlap(olgutaBoss, bullets.player, collisionHandler, null, this);
        game.physics.arcade.overlap(aliens, bullets.bombs, collisionHandler, null, this);
        game.physics.arcade.overlap(bossesPsd, bullets.bombs, collisionHandler, null, this);
        game.physics.arcade.overlap(olgutaBoss, bullets.bombs, collisionHandler, null, this);
        game.physics.arcade.overlap(bullets.thief, player, enemyHitsPlayer, null, this);
        game.physics.arcade.overlap(bullets.psd, player, enemyHitsPlayer, null, this);
        game.physics.arcade.overlap(bullets.dragnea, player, enemyHitsPlayer, null, this);

        var enemyGroup = phase2 ? bossesPsd : aliens;
        if (gameHeight - enemyGroup.position.y - enemyGroup.height <= maxDescent) {
            gameOverLoss("Coruptia ucide!\nMai incearca o data si salveaza Romania!\n\nClick sau ENTER pentru un joc nou");
			ga('send', {
			  hitType: 'event',
			  eventCategory: 'Game',
			  eventAction: 'play',
			  eventLabel: 'loss',
			  eventValue: 2
			});
        }
    }

}

function render() {
  // ???
}

function collisionHandler(alien, bullet) {
    score.update(10);
    
    var explosion = explosions.getFirstExists(false);
    explosion.reset(bullet.body.x, bullet.body.y);
    bullet.kill();
    alien.hitpoints--;
    explosion.play('kaboom', 30, false, true);
    if (alien.hitpoints === 0) {
        alien.kill();
    }
}

function gameOverWin() {
    score.update(1000);
    stateText.text = "Felicitari!\nAi invins coruptia si ai salvat Romania de PSD_isti!\n\nClick sau ENTER pentru un joc nou";
    stateText.visible = true;

    //the "click to restart" handler
    game.input.onTap.addOnce(restart, this);

    gameOver = true;
	
	ga('send', {
	  hitType: 'event',
	  eventCategory: 'Game',
	  eventAction: 'play',
	  eventLabel: 'win'
	});
}

function isPlayerOutOfBounds() {
    if (player.x < 0 || player.x > gameWidth) {
        return true;
    }
    else {
        return false;
    }
}

function enemyHitsPlayer(player, bullet) {
    bullet.kill();
    live = lives.getFirstAlive();
    if (live) {
        live.kill();
    }

    //  And create an explosion :)
    var explosion = explosions.getFirstExists(false);
    explosion.reset(player.body.x, player.body.y);
    explosion.play('kaboom', 30, false, true);

    // When the player dies
    if (lives.countLiving() < 1) {
        gameOverLoss("Coruptia sta in Firea PSD!\nMai incearca o data si salveaza \nRomania de ciuma rosie!\n\nClick sau ENTER pentru un joc nou");
		
		ga('send', {
		  hitType: 'event',
		  eventCategory: 'Game',
		  eventAction: 'play',
		  eventLabel: 'loss',
		  eventValue: 1
		});
    }
}

function gameOverLoss(message) {
    player.kill();

    stateText.text = message;
    stateText.visible = true;

    //the "click to restart" handler
    game.input.onTap.addOnce(restart, this);

    gameOver = true;
}

function enemyFires(enemyGroup, enemyBullets, numberOfBullets) {
    livingEnemies.length = 0;
    enemyGroup.forEachAlive(function (alien) {
        livingEnemies.push(alien);
    });
    var random = game.rnd.integerInRange(0, livingEnemies.length - 1);
    var shooter = livingEnemies[random];
    shooterShoot(shooter, enemyBullets, numberOfBullets);
    enemyGroup.nextShot = game.time.now + enemyGroup.fireInterval;
}

function shooterShoot(shooter, enemyBullets, numberOfBullets) {
    numberOfBullets = numberOfBullets || 1;
    var spreadAngle = 25; // the angular spread between bullets

    for (i = 0; i < numberOfBullets; i++) {
        var bullet = enemyBullets.getFirstExists(false);
        if (bullet && shooter) {
            //  Make bullet come out of tip of ship with right angle
            // var bulletOffset = 20 * Math.sin(game.math.degToRad(0));
            bullet.reset(shooter.body.x + shooter.body.width / 2, shooter.body.y + shooter.body.height);
            //  "Spread" angle of 1st and 3rd bullets
            var angle = Phaser.Point.angle(player, bullet);
            angle = game.math.radToDeg(angle) + spreadAngle * (i - (numberOfBullets - 1) / 2);
            bullet.angle = angle;
            game.physics.arcade.velocityFromAngle(angle, 200, bullet.body.velocity);
        }
    }
}

function fireBullet() {
    //  To avoid them being allowed to fire too fast we set a time limit
    if (game.time.now > bulletTime) {
        //  Grab the first bullet we can from the pool
        bullet = bullets.player.getFirstExists(false);

        if (bullet) {
            //  And fire it
            bullet.reset(player.x, player.y + 8);
            bullet.body.velocity.y = -400;
            bulletTime = game.time.now + 200;
        }
    }
}

function resetBullet(bullet) {
    //  Called if the bullet goes out of the screen
    bullet.kill();
}

function restart() {
	
	if (bullets.initialized === true) {
		resetBullets();
	}
	
    initBullets();
	
    //  A new level starts
    //resets the life count
    lives.callAll('revive');
    bombs.callAll('revive');
    //  And brings the aliens back from the dead :)
    aliens.removeAll();
    bossesPsd.removeAll();
    olgutaBoss.kill();
    olgutaBoss.hitpoints = 20; // hack
    createAliens();

    //revives the player
    player.revive();
    
    //hides the text
    stateText.visible = false;
    
    score.reset();
    
    gameOver = false;
    phase2 = false;
    
    player.x = gameWidth/2;
	
	ga('send', {
	  hitType: 'event',
	  eventCategory: 'Game',
	  eventAction: 'play',
	  eventLabel: 'restart'
	});
}

function easyMode() {
    gameOverLoss("In lupta cu coruptia, nu exista cale usoara!\n\nClick sau ENTER pentru un joc nou");
	ga('send', {
	  hitType: 'event',
	  eventCategory: 'Game',
	  eventAction: 'play',
	  eventLabel: 'easyMode'
	});
}

function start() {
    gameOverLoss("Drag_ne_ar fi sa salvam Romania de invazia PSD\n\nFoloseste sagetile stanga-dreapta, tastele spatiu si \"D\"\n\nClick sau ENTER pentru a incepe");
}