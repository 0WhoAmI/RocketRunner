class Game {
  OBSTACLE_PREFAB = new THREE.BoxGeometry(1, 1, 1);
  OBSTACLE_MATERIAL = new THREE.MeshBasicMaterial({ color: 0xccdeee });
  BONUS_PREFAB = new THREE.SphereGeometry(1, 12, 12);
  COLLISION_THRESHOLD = 0.2;

  constructor(scene, camera) {
    this.divScore = document.getElementById("score");
    this.divDistance = document.getElementById("distance");
    this.divHealth = document.getElementById("health");

    this.divGameOverPanel = document.getElementById("game-over-panel");
    this.divGameOverScore = document.getElementById("game-over-score");
    this.divGameOverDistance = document.getElementById("game-over-distance");

    document.getElementById("start-button").onclick = () => {
      this.running = true;
      document.getElementById("intro-panel").classList.add("hidden");
    };
    document.getElementById("replay-button").onclick = () => {
      this.running = true;
      this.divGameOverPanel.classList.add("hidden");
    };

    this.scene = scene;
    this.camera = camera;
    this._reset(false);

    // bind event callbacks
    document.addEventListener("keydown", this._keydown.bind(this));
    document.addEventListener("keyup", this._keyup.bind(this));
  }

  update() {
    if (!this.running) {
      return;
    }

    const timeDelta = this.clock.getDelta();
    this.time += timeDelta;

    if (this.rotationLerp !== null) {
      this.rotationLerp.update(timeDelta);
    }
    if (this.cameraLerp !== null) {
      this.cameraLerp.update(timeDelta);
    }

    this.translateX += this.speedX * this.shipMovementXSpeed;

    this._updateGrid();
    this._checkCollisions();
    this._updateInfoPanel();
  }

  _reset(replay) {
    // initialize variables
    this.running = false;

    this.numberOfObstacles = 50;
    this.numberOfBonuses = 10;

    this.speedZ = 20;
    this.speedX = 0; // -1: left, 0: straight, 1: right
    this.rotationLerpSpeed = 25; // how fast shipp rotate
    this.shipMovementXSpeed = -0.1; // how fast ship go left or right (less value = go faster)
    this.translateX = 0;

    this.time = 0;
    this.clock = new THREE.Clock();

    this.health = 100;
    this.score = 0;

    this.rotationLerp = null;
    this.cameraLerp = null;

    // show initial values
    this.divScore.innerText = this.score;
    this.divDistance.innerText = 0;
    this.divHealth.style.width = this.health + "%";

    // prepare 3D scene
    this._initializeScene(this.scene, this.camera, replay);
  }

  _keydown(event) {
    let newSpeedX;
    switch (event.key) {
      case "ArrowLeft":
        newSpeedX = -1.0;
        break;
      case "ArrowRight":
        newSpeedX = 1.0;
        break;
      default:
        return;
    }

    if (this.speedX !== newSpeedX) {
      this.speedX = newSpeedX;
      this._rotateShip(
        (-this.speedX * this.rotationLerpSpeed * Math.PI) / 180,
        0.8
      );
    }
  }

  _keyup() {
    this.speedX = 0;
    this._rotateShip(0, 0.5);
  }

  _rotateShip(targetRotation, delay) {
    const $this = this;
    this.rotationLerp = new Lerp(this.ship.rotation.z, targetRotation, delay)
      .onUpdate((value) => {
        $this.ship.rotation.z = value;
      })
      .onFinish(() => {
        $this.rotationLerp = null;
      });
  }

  _updateGrid() {
    this.speedZ += 0.002;
    this.grid.material.uniforms.speedZ.value = this.speedZ;
    this.grid.material.uniforms.time.value = this.time;
    this.objectsParent.position.z = this.speedZ * this.time;
    this.grid.material.uniforms.translateX.value = this.translateX;
    this.objectsParent.position.x = this.translateX;

    this.objectsParent.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        // pos in world space
        const childZpos = child.position.z + this.objectsParent.position.z;
        if (childZpos > 0) {
          // reset the object
          const params = [
            child,
            -this.translateX,
            -this.objectsParent.position.z,
          ];

          if (child.userData.type === "obstacle") {
            this._setupObstacle(...params);
          } else {
            const price = this._setupBonus(...params);
            child.userData.price = price;
          }
        }
      }
    });
  }

  _checkCollisions() {
    this.objectsParent.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        // pos in world space
        const childZPos = child.position.z + this.objectsParent.position.z;

        // threshold distance
        const thresholdX = this.COLLISION_THRESHOLD + child.scale.x / 2;
        const thresholdZ = this.COLLISION_THRESHOLD + child.scale.z / 2;

        if (
          childZPos > -thresholdZ &&
          Math.abs(child.position.x + this.translateX) < thresholdX
        ) {
          // collision!
          const params = [
            child,
            -this.translateX,
            -this.objectsParent.position.z,
          ];
          if (child.userData.type === "obstacle") {
            this.health -= 20;
            this.divHealth.style.width = this.health + "%";
            this._setupObstacle(...params);
            this._shakeCamera({
              x: this.camera.position.x,
              y: this.camera.position.y,
              z: this.camera.position.z,
            });

            if (soundCrashAudio && this.health > 0) {
              soundCrashAudio.play();
            }
            if (this.health <= 0) {
              if (soundLastCrashAudio) {
                soundLastCrashAudio.play();
              }
              this._gameOver();
            }
          } else {
            if (soundBonusAudio) {
              soundBonusAudio.play();
            }

            this._createScorePopup(child.userData.price);
            this.score += child.userData.price;
            this.divScore.innerText = this.score;
            child.userData.price = this._setupBonus(...params);
          }
        }
      }
    });
  }

  _updateInfoPanel() {
    this.divDistance.innerText = this.objectsParent.position.z.toFixed(0);
  }

  _gameOver() {
    // prepare end state
    this.running = false;

    // showu UI
    this.divGameOverScore.innerText = this.score;
    this.divGameOverDistance.innerText =
      this.objectsParent.position.z.toFixed(0);
    this.divGameOverPanel.classList.remove("hidden");

    //reset variables
    this._reset(true);
  }

  _createShip(scene) {
    const shipBody = new THREE.Mesh(
      new THREE.TetrahedronGeometry(0.4),
      new THREE.MeshBasicMaterial({ color: 0xbbccdd })
    );
    shipBody.rotateX((45 * Math.PI) / 180);
    shipBody.rotateY((45 * Math.PI) / 180);

    this.ship = new THREE.Group();
    this.ship.add(shipBody);

    scene.add(this.ship);

    const reactorSocketGeometry = new THREE.CylinderGeometry(
      0.08,
      0.08,
      0.1,
      16
    );
    const reactorSocketMaterial = new THREE.MeshBasicMaterial({
      color: 0x99aacc,
    });
    const reactorSocket1 = new THREE.Mesh(
      reactorSocketGeometry,
      reactorSocketMaterial
    );
    const reactorSocket2 = new THREE.Mesh(
      reactorSocketGeometry,
      reactorSocketMaterial
    );
    const reactorSocket3 = new THREE.Mesh(
      reactorSocketGeometry,
      reactorSocketMaterial
    );

    this.ship.add(reactorSocket1);
    this.ship.add(reactorSocket2);
    this.ship.add(reactorSocket3);
    reactorSocket1.rotateX((90 * Math.PI) / 180);
    reactorSocket1.position.set(-0.15, 0, 0.1);
    reactorSocket2.rotateX((90 * Math.PI) / 180);
    reactorSocket2.position.set(0.15, 0, 0.1);
    reactorSocket3.rotateX((90 * Math.PI) / 180);
    reactorSocket3.position.set(0, -0.15, 0.1);

    const reactorLightGeometry = new THREE.CylinderGeometry(
      0.055,
      0.055,
      0.1,
      16
    );
    const reactorLightMaterial = new THREE.MeshBasicMaterial({
      color: 0xaadeff,
    });
    const reactorLight1 = new THREE.Mesh(
      reactorLightGeometry,
      reactorLightMaterial
    );
    const reactorLight2 = new THREE.Mesh(
      reactorLightGeometry,
      reactorLightMaterial
    );
    const reactorLight3 = new THREE.Mesh(
      reactorLightGeometry,
      reactorLightMaterial
    );

    this.ship.add(reactorLight1);
    this.ship.add(reactorLight2);
    this.ship.add(reactorLight3);
    reactorLight1.rotateX((90 * Math.PI) / 180);
    reactorLight1.position.set(-0.15, 0, 0.11);
    reactorLight2.rotateX((90 * Math.PI) / 180);
    reactorLight2.position.set(0.15, 0, 0.11);
    reactorLight3.rotateX((90 * Math.PI) / 180);
    reactorLight3.position.set(0, -0.15, 0.11);
  }

  _createGrid(scene) {
    let divisions = 50; //30;
    let gridLimit = 200;
    this.grid = new THREE.GridHelper(
      gridLimit * 2,
      divisions,
      0xccddee,
      0xccddee
    );

    const moveableX = [];
    const moveableZ = [];
    for (let i = 0; i <= divisions; i++) {
      moveableX.push(0, 0, 1, 1); // move vertical lines only (1 - point is moveableX)
      moveableZ.push(1, 1, 0, 0); // move horizontal lines only (1 - point is moveableZ)
    }

    this.grid.geometry.addAttribute(
      "moveableX",
      new THREE.BufferAttribute(new Uint8Array(moveableX), 1)
    );
    this.grid.geometry.addAttribute(
      "moveableZ",
      new THREE.BufferAttribute(new Uint8Array(moveableZ), 1)
    );

    this.grid.material = new THREE.ShaderMaterial({
      uniforms: {
        time: {
          value: 0,
        },
        gridLimits: {
          value: new THREE.Vector2(-gridLimit, gridLimit),
        },
        speedZ: {
          value: this.speedZ,
        },
        translateX: {
          value: this.translateX,
        },
      },
      vertexShader: `
        uniform float time;
        uniform vec2 gridLimits;
        uniform float speedZ;
        uniform float translateX;
        
        attribute float moveableZ;
        attribute float moveableX;
        
        varying vec3 vColor;
      
        void main() {
          float limLen = gridLimits.y - gridLimits.x;
          vec3 pos = position;
          if (floor(moveableX + 0.5) > 0.5){ // if a point has "moveableX" attribute = 1 
            float xDist = translateX;
            float curXPos = mod((pos.x + xDist) - gridLimits.x, limLen) + gridLimits.x;
            pos.x = curXPos;
          }
          if (floor(moveableZ + 0.5) > 0.5){ // if a point has "moveableZ" attribute = 1 
            float zDist = speedZ * time;
            float curZPos = mod((pos.z + zDist) - gridLimits.x, limLen) + gridLimits.x;
            pos.z = curZPos;
          } 
          float k = 1.0 - (-pos.z / 200.0);
          vColor = color * k;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos,1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
      
        void main() {
          gl_FragColor = vec4(vColor, 1.);
        }
      `,
      vertexColors: THREE.VertexColors,
    });

    scene.add(this.grid);
  }

  _initializeScene(scene, camera, replay) {
    if (!replay) {
      // first load
      this._createShip(scene);
      this._createGrid(scene);

      this.objectsParent = new THREE.Group();
      scene.add(this.objectsParent);

      for (let i = 0; i < this.numberOfObstacles; i++) {
        this._spawnObstacle();
      }
      for (let i = 0; i < this.numberOfBonuses; i++) {
        this._spawnBonus();
      }

      camera.rotateX((-20 * Math.PI) / 180);
      camera.position.set(0, 1.5, 2);
    } else {
      // replay
      this.objectsParent.traverse((item) => {
        if (item instanceof THREE.Mesh) {
          // child item
          if (item.userData.type === "obstacle") {
            this._setupObstacle(item);
          } else {
            item.userData.price = this._setupBonus(item);
          }
        } else {
          // the anchor itself
          item.position.set(0, 0, 0);
        }
      });
    }
  }

  _spawnObstacle() {
    // create geometry
    const obj = new THREE.Mesh(this.OBSTACLE_PREFAB, this.OBSTACLE_MATERIAL);

    this._setupObstacle(obj);
    obj.userData = { type: "obstacle" };
    this.objectsParent.add(obj);
  }

  _setupObstacle(obj, refXPos = 0, refZPos = 0) {
    //random scale
    obj.scale.set(
      this._randomFloat(0.5, 2),
      this._randomFloat(0.5, 2),
      this._randomFloat(0.5, 2)
    );

    //random position
    obj.position.set(
      refXPos + this._randomFloat(-30, 30),
      obj.scale.y * 0.5,
      refZPos - 100 - this._randomFloat(0, 100)
    );
  }

  _spawnBonus() {
    const obj = new THREE.Mesh(
      this.BONUS_PREFAB,
      new THREE.MeshBasicMaterial({ color: 0x000000 })
    );

    const price = this._setupBonus(obj);
    obj.userData = { type: "bonus", price };
    this.objectsParent.add(obj);
  }

  _setupBonus(obj, refXPos = 0, refZPos = 0) {
    const price = this._randomInt(5, 20);
    const ratio = price / 20;

    const size = ratio * 0.5;
    obj.scale.set(size, size, size);

    const hue = 0.5 + 0.5 * ratio;
    obj.material.color.setHSL(hue, 1, 0.5);

    //random position
    obj.position.set(
      refXPos + this._randomFloat(-30, 30),
      obj.scale.y * 0.5,
      refZPos - 100 - this._randomFloat(0, 100)
    );

    return price;
  }

  _shakeCamera(initialPosition, remainingShakes = 3) {
    const $this = this;

    const startPosition = {
      x: this.camera.position.x,
      y: this.camera.position.y,
      z: this.camera.position.z,
    };

    const startOffset = { x: 0, y: 0 };
    const endOffset = {
      x: this._randomFloat(-0.25, 0.25),
      y: this._randomFloat(-0.25, 0.25),
    };

    this.cameraLerp = new Lerp(
      startOffset,
      endOffset,
      this._randomFloat(0.1, 0.22)
    )
      .onUpdate((value) => {
        this.camera.position.set(
          startPosition.x + value.x,
          startPosition.y + value.y,
          startPosition.z
        );
      })
      .onFinish(() => {
        if (remainingShakes > 0) {
          $this._shakeCamera(initialPosition, remainingShakes - 1);
        } else {
          $this.cameraLerp = null;
          $this.camera.position.set(
            initialPosition.x,
            initialPosition.y,
            initialPosition.z
          );
        }
      });
  }

  _createScorePopup(score) {
    const scorePopup = document.createElement("div");
    scorePopup.innerText = `+${score}`;
    scorePopup.className = "score-popup";
    document.body.appendChild(scorePopup);
    setTimeout(() => {
      scorePopup.remove();
    }, 1000);
  }

  _randomFloat(min, max) {
    return Math.random() * (max - min) + min;
  }

  _randomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1) + min);
  }
}
