class StatsManager {
  constructor() {
    this.statsDiv = document.getElementById("stats");

    this.active = false;

    this.stats = [];
    // 0: FPS, 1: MS, 2: MB
    for (let i = 0; i <= 2; i++) {
      const stat = new Stats();
      stat.showPanel(i);
      this.statsDiv.appendChild(stat.dom);
      stat.dom.style.position = "relative";
      stat.dom.style.float = "left";
      this.stats.push(stat);
    }

    document.addEventListener("keydown", this._keydown.bind(this));
  }

  update() {
    if (!this.active) {
      return;
    }
    for (const stat of this.stats) {
      stat.update();
    }
  }

  _toogle() {
    this.active = !this.active;
    this.statsDiv.style.display = this.active ? "grid" : "none";
  }

  _keydown(event) {
    if (event.key === "F8") {
      this._toogle();
    }
  }
}
