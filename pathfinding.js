class MinHeap {
  constructor() {
    this.heap = [];
  }

  push(item) {
    this.heap.push(item);
    this.up(this.heap.length - 1);
  }

  pop() {
    if (!this.heap.length) return null;

    const root = this.heap[0];
    const last = this.heap.pop();

    if (this.heap.length) {
      this.heap[0] = last;
      this.down(0);
    }

    return root;
  }

  up(i) {
    while (i > 0) {
      const p = (i - 1) >> 1;

      if (this.heap[p].f <= this.heap[i].f) break;

      [this.heap[p], this.heap[i]] = [this.heap[i], this.heap[p]];

      i = p;
    }
  }

  down(i) {
    while (true) {
      let s = i;

      const l = i * 2 + 1;
      const r = l + 1;

      if (l < this.heap.length && this.heap[l].f < this.heap[s].f) {
        s = l;
      }

      if (r < this.heap.length && this.heap[r].f < this.heap[s].f) {
        s = r;
      }

      if (s === i) break;

      [this.heap[s], this.heap[i]] = [this.heap[i], this.heap[s]];

      i = s;
    }
  }

  get size() {
    return this.heap.length;
  }
}

class Pathfinder {
  constructor(grid, ferries = [], width = 4098) {
    this.width = width;

    /*
     * Todas as células do mapa.
     *
     * key = y * width + x
     */
    this.cells = new Map();

    /*
     * Vizinhos de cada área navegável
     *
     * key = id da área
     *
     * value = Set de áreas vizinhas
     */
    this.areaNeighbors = new Map();

    for (const c of grid) {
      this.cells.set(this.idx(c.x, c.y), c);
    }

    /*
     * Ferries no formato:
     *
     * [
     *   {
     *     id,
     *     name,
     *     location: {x, y},
     *     landings: [...]
     *   }
     * ]
     */
    this.ferries = ferries;

    /**
     *
     * Ferries disponíveis em cada coordenada.
     *
     * key = coordenada de saída
     *
     * value = array de ferries
     *
     * @type {Map<string, Array<{ferryId: string, ferryName: string, landingIndex: number, from: {x: number, y: number, area: number}, to: {x: number, y: number, area: number}, movementCost: number, moneyCost: number, distance: number, type: string}>>}
     */
    this.ferryMap = new Map();

    this.buildFerryMap();

    /*
     * Cache de custos locais.
     */
    this.cache = new Map();
  }

  // -------------------------------------------------------
  // Coordenadas
  // -------------------------------------------------------

  idx(x, y) {
    return y * this.width + x;
  }

  getCell(x, y) {
    return this.cells.get(this.idx(x, y));
  }

  key(x, y) {
    return `${x},${y}`;
  }

  // -------------------------------------------------------
  // Heurística
  // -------------------------------------------------------

  heuristic(a, b) {
    const dx = Math.abs(a.x - b.x);
    const dy = Math.abs(a.y - b.y);

    const diag = Math.min(dx, dy);

    return Math.max(dx, dy) - diag + diag * 1.414;
  }

  // -------------------------------------------------------
  // Custo de movimento terrestre
  // -------------------------------------------------------

  moveCost(a, b, diag) {
    const l = diag ? 1.414 : 1;

    if (a.data.type != null || b.data.type != null)
      return {
        cost: l,
        length: l,
      };

    let c = 1;

    if (a.data.forest > 0 && b.data.forest > 0) {
      c = 2;
    } else if (a.data.forest > 0 || b.data.forest > 0) {
      c = 1.5;
    }

    const altitudeDifference = Math.abs(a.data.alt - b.data.alt);

    let p = 0;

    if (altitudeDifference >= 125) {
      p = 20;
    } else if (altitudeDifference >= 75) {
      p = 5;
    } else if (altitudeDifference >= 25) {
      p = 2;
    }

    return {
      cost: l * c + p,

      length: l,

      forestCost: c,

      altitudePenalty: p,

      altitudeDifference,
    };
  }

  // -------------------------------------------------------
  // Constrói mapa de ferries
  // -------------------------------------------------------

  buildFerryMap() {
    for (const ferry of this.ferries) {
      if (!ferry.landings) continue;

      const fromX = ferry.location.x;
      const fromY = ferry.location.y;

      for (let i = 0; i < ferry.landings.length; i++) {
        const landing = ferry.landings[i];

        const toX = landing.location.x;
        const toY = landing.location.y;

        const fee = Number.parseFloat(landing.fee) || 0;

        // --------------------------------------------
        // ID da conexão
        // --------------------------------------------

        const forwardKey = this.key(fromX, fromY);

        const backwardKey = this.key(toX, toY);

        if (!this.ferryMap.has(forwardKey)) {
          this.ferryMap.set(forwardKey, []);
        }

        if (!this.ferryMap.has(backwardKey)) {
          this.ferryMap.set(backwardKey, []);
        }

        // --------------------------------------------
        // Ida
        // --------------------------------------------

        this.ferryMap.get(forwardKey).push({
          ferryId: ferry.ferryId,

          townId: ferry.id,

          townName: ferry.name,

          landingIndex: i,

          landingId: landing.id,

          from: {
            x: fromX,
            y: fromY,
            area: ferry.area,
          },

          to: {
            x: toX,
            y: toY,
            area: landing.area,
          },

          movementCost: 0,

          moneyCost: fee,

          distance: landing.distance,

          type: "ferry",
        });

        // --------------------------------------------
        // Volta
        // --------------------------------------------

        this.ferryMap.get(backwardKey).push({
          ferryId: ferry.ferryId,

          townId: ferry.id,

          townName: ferry.name,

          landingIndex: i,

          landingId: landing.id,

          from: {
            x: toX,
            y: toY,
            area: landing.area,
          },

          to: {
            x: fromX,
            y: fromY,
            area: ferry.area,
          },

          movementCost: 0,

          moneyCost: fee,

          distance: landing.distance,

          type: "ferry",
        });
      }
    }
  }

  // -------------------------------------------------------
  // Ferries disponíveis nesta célula
  // -------------------------------------------------------

  getFerries(x, y) {
    return this.ferryMap.get(this.key(x, y)) || [];
  }

  // -------------------------------------------------------
  // A* local dentro de uma única área
  //
  //
  // Ele serve para calcular distância terrestre entre
  // pontos da mesma área.
  // -------------------------------------------------------

  localAStar(start, goal, path = true) {
    const startCell = this.getCell(start.x, start.y);

    const goalCell = this.getCell(goal.x, goal.y);

    if (!startCell || !goalCell) {
      return null;
    }

    if (startCell.data.area !== goalCell.data.area) {
      return null;
    }

    const open = new MinHeap();

    const g = new Map();

    const came = new Map();

    const moveInfo = new Map();

    const closed = new Set();

    const startKey = this.idx(start.x, start.y);

    var landMovement = !startCell.data.type;

    open.push({
      x: start.x,
      y: start.y,
      f: this.heuristic(start, goal),
    });

    g.set(startKey, 0);

    while (open.size) {
      const current = open.pop();

      const currentKey = this.idx(current.x, current.y);

      if (closed.has(currentKey)) {
        continue;
      }

      closed.add(currentKey);

      // ---------------------------------------------------
      // Chegou ao destino
      // ---------------------------------------------------

      if (current.x === goal.x && current.y === goal.y) {
        if (!path) {
          return g.get(currentKey);
        }

        const result = [];

        let k = currentKey;

        while (k !== undefined) {
          const cell = this.cells.get(k);

          result.push({
            ...cell,

            type: "land",

            totalMovementCost: g.get(k),

            totalMoneyCost: 0,

            moveCost: moveInfo.get(k) || null,
          });

          k = came.get(k);
        }

        return result.reverse();
      }

      // ---------------------------------------------------
      // Movimentos terrestres
      // ---------------------------------------------------

      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (!dx && !dy) {
            continue;
          }

          const nx = current.x + dx;
          const ny = current.y + dy;

          const neighbor = this.getCell(nx, ny);

          if (!neighbor) {
            continue;
          }

          /*
           * O A* local só pode andar dentro da
           * mesma área.
           */
          if (neighbor.data.area !== startCell.data.area) {
            continue;
          }

          /*
           * Não permite cortar quinas através
           * de células inexistentes.
           */
          if (dx && dy && !landMovement) {
            if (!this.getCell(current.x + dx, current.y)) {
              continue;
            }

            if (!this.getCell(current.x, current.y + dy)) {
              continue;
            }
          }

          const neighborKey = this.idx(nx, ny);

          if (closed.has(neighborKey)) {
            continue;
          }

          const currentCell = this.cells.get(currentKey);

          const movement = this.moveCost(currentCell, neighbor, dx && dy);

          const newCost = g.get(currentKey) + movement.cost;

          if (!g.has(neighborKey) || newCost < g.get(neighborKey)) {
            g.set(neighborKey, newCost);

            came.set(neighborKey, currentKey);

            moveInfo.set(neighborKey, movement);

            open.push({
              x: nx,
              y: ny,

              f: newCost + this.heuristic(neighbor, goal),
            });
          }
        }
      }
    }

    return null;
  }

  // -------------------------------------------------------
  // Custo terrestre entre dois pontos
  // -------------------------------------------------------

  localCost(a, b) {
    const key = `${a.x},${a.y}|${b.x},${b.y}`;

    if (this.cache.has(key)) {
      return this.cache.get(key);
    }

    const cost = this.localAStar(a, b, false);

    this.cache.set(key, cost);

    return cost;
  }

  // Checa se é possível ir de uma cidade a outra, considerando somente as áreas e ferries
  reachable(start, goal, returnPath = false) {
    const startCell = this.getCell(start.x, start.y);
    const goalCell = this.getCell(goal.x, goal.y);

    if (!startCell || !goalCell) {
      if (returnPath) return [];
      return false;
    }

    const areaStart = startCell.data.area || undefined;
    const areaGoal = goalCell.data.area || undefined;

    if (areaStart === undefined || areaGoal === undefined) {
      if (returnPath) return [];
      return false;
    }

    if (
      startCell.data.type != null &&
      goalCell.data.type != null &&
      areaStart !== areaGoal
    ) {
      if (returnPath) return [];
      return false;
    }

    if (areaStart === areaGoal) {
      if (returnPath) return [areaStart];
      return true;
    }
    // Se as duas cidades estão em áreas diferentes, verifica se existe
    // um caminho entre as áreas, direta ou indiretamente.
    const visitedAreas = new Set();
    const areasToVisit = [areaStart];

    // Guarda de qual área viemos para chegar em cada área
    const parent = new Map();
    parent.set(areaStart, null);

    while (areasToVisit.length > 0) {
      const currentArea = areasToVisit.pop();

      visitedAreas.add(currentArea);

      // Chegamos à área de destino
      if (currentArea === areaGoal) {
        if (!returnPath) return true;

        // Reconstrói o caminho
        const areaPath = [];
        let area = areaGoal;

        while (area !== null) {
          areaPath.push(area);
          area = parent.get(area);
        }

        // Como reconstruímos do destino para a origem,
        // precisamos inverter
        areaPath.reverse();

        return areaPath;
      }

      // Áreas vizinhas
      const neighboringAreas = this.getNeighboringAreas(currentArea);

      for (const neighbor of neighboringAreas) {
        if (!visitedAreas.has(neighbor) && !parent.has(neighbor)) {
          parent.set(neighbor, currentArea);
          areasToVisit.push(neighbor);
        }
      }
    }

    if (returnPath) return [];
    return false;
  }

  getNeighboringAreas(area) {
    var neighboringAreas = new Set();

    if (this.areaNeighbors.has(area)) {
      neighboringAreas = this.areaNeighbors.get(area);
      return neighboringAreas;
    }

    for (const ferry of this.ferryMap.values()) {
      for (const connection of ferry) {
        if (connection.from.area === area) {
          neighboringAreas.add(connection.to.area);
          if (!this.areaNeighbors.has(connection.from.area)) {
            this.areaNeighbors.set(connection.from.area, new Set());
          }
          this.areaNeighbors.get(connection.from.area).add(connection.to.area);
        } else if (connection.to.area === area) {
          neighboringAreas.add(connection.from.area);
          if (!this.areaNeighbors.has(connection.to.area)) {
            this.areaNeighbors.set(connection.to.area, new Set());
          }
          this.areaNeighbors.get(connection.to.area).add(connection.from.area);
        }
      }
    }

    return neighboringAreas;
  }

  // -------------------------------------------------------
  // PATHFINDING GLOBAL
  //
  // Aqui entram:
  //
  // - movimento terrestre
  // - ferries
  // - ferries dentro da mesma área
  // - ferries entre áreas
  //
  // -------------------------------------------------------

  findPath(start, goal) {
    const startCell = this.getCell(start.x, start.y);

    const goalCell = this.getCell(goal.x, goal.y);

    if (!this.reachable(startCell, goalCell)) {
      return null;
    }

    if (!startCell || !goalCell) {
      return null;
    }

    const open = new MinHeap();

    const g = new Map();

    const came = new Map();

    const moveInfo = new Map();

    const closed = new Set();

    const startKey = this.idx(start.x, start.y);

    open.push({
      x: start.x,
      y: start.y,
      f: 0,
    });

    g.set(startKey, 0);

    while (open.size) {
      const current = open.pop();

      const currentKey = this.idx(current.x, current.y);

      if (closed.has(currentKey)) {
        continue;
      }

      closed.add(currentKey);

      // ---------------------------------------------------
      // Chegou ao destino
      // ---------------------------------------------------

      if (current.x === goal.x && current.y === goal.y) {
        return this.reconstructPath(currentKey, came, g, moveInfo);
      }

      const currentCell = this.cells.get(currentKey);

      // ---------------------------------------------------
      // 1. Movimento terrestre
      // ---------------------------------------------------

      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (!dx && !dy) {
            continue;
          }

          const nx = current.x + dx;
          const ny = current.y + dy;

          const neighbor = this.getCell(nx, ny);

          if (!neighbor) {
            continue;
          }

          /*
           * Não pode atravessar diretamente
           * entre áreas.
           *
           * Para mudar de área precisa usar ferry.
           */
          if (neighbor.data.area !== currentCell.data.area) {
            continue;
          }

          /*
           * Não corta quinas.
           *
          if (dx && dy) {
            if (!this.getCell(current.x + dx, current.y)) {
              continue;
            }

            if (!this.getCell(current.x, current.y + dy)) {
              continue;
            }
          }
          */

          const neighborKey = this.idx(nx, ny);

          if (closed.has(neighborKey)) {
            continue;
          }

          const movement = this.moveCost(currentCell, neighbor, dx && dy);

          const newMovementCost = g.get(currentKey) + movement.cost;

          if (!g.has(neighborKey) || newMovementCost < g.get(neighborKey)) {
            g.set(neighborKey, newMovementCost);

            came.set(neighborKey, currentKey);

            moveInfo.set(neighborKey, {
              type: currentCell.data.type != null ? "water" : "land",

              movementCost: movement.cost,

              moneyCost: 0,

              length: movement.length,

              forestCost: movement.forestCost,

              altitudePenalty: movement.altitudePenalty,

              altitudeDifference: movement.altitudeDifference,
            });

            open.push({
              x: nx,
              y: ny,

              /*
               * h = 0
               */
              f: newMovementCost,
            });
          }
        }
      }

      // ---------------------------------------------------
      // 2. Ferries
      // ---------------------------------------------------

      const ferries = this.getFerries(current.x, current.y);

      for (const ferry of ferries) {
        const nx = ferry.to.x;
        const ny = ferry.to.y;
        const landingArea = ferry.to.area;

        const landingCell = this.getCell(nx, ny);

        /*
         * O destino do ferry precisa existir
         * no mapa.
         */
        if (!landingCell) {
          continue;
        }

        const landingKey = this.idx(nx, ny);

        if (closed.has(landingKey)) {
          continue;
        }

        /*
         * Ferry possui custo de movimento ZERO.
         *
         * fee fica separado.
         */
        const newMovementCost = g.get(currentKey);

        if (!g.has(landingKey) || newMovementCost < g.get(landingKey)) {
          g.set(landingKey, newMovementCost);

          came.set(landingKey, currentKey);

          moveInfo.set(landingKey, {
            type: "ferry",

            ferryId: ferry.ferryId,

            ferryName: ferry.ferryName,

            landingIndex: ferry.landingIndex,

            from: {
              x: current.x,
              y: current.y,
              area: currentCell.data.area,
            },

            to: {
              x: nx,
              y: ny,
              area: landingArea,
            },

            movementCost: 0,

            moneyCost: ferry.moneyCost,

            distance: ferry.distance,
          });

          open.push({
            x: nx,
            y: ny,

            /*
             * Ferry = 0 movement cost
             *
             * h = 0
             */
            f: newMovementCost,
          });
        }
      }
    }

    return null;
  }

  // -------------------------------------------------------
  // Reconstrói resultado
  // -------------------------------------------------------

  reconstructPath(endKey, came, g, moveInfo) {
    const reversed = [];

    let k = endKey;

    while (k !== undefined) {
      const cell = this.cells.get(k);

      const movement = moveInfo.get(k);

      reversed.push({
        type: movement?.type || (cell.data.type != null ? "water" : "land"),

        x: cell.x,

        y: cell.y,

        area: cell.data.area,

        data: cell.data,

        /*
         * Custo total de movimento
         * até este ponto.
         */
        totalMovementCost: g.get(k),

        /*
         * Custo monetário acumulado.
         *
         * Calculado depois.
         */
        totalMoneyCost: 0,

        /*
         * Custo deste passo.
         */
        moveCost: movement?.movementCost || 0,

        /*
         * Dinheiro gasto neste passo.
         */
        moneyCost: movement?.moneyCost || 0,

        /*
         * Dados adicionais do passo.
         */
        details: movement || null,
      });

      k = came.get(k);
    }

    const path = reversed.reverse();

    // -----------------------------------------------------
    // Calcula dinheiro acumulado
    // -----------------------------------------------------

    let totalMoney = 0;

    for (const step of path) {
      totalMoney += step.moneyCost;

      step.totalMoneyCost = totalMoney;
    }

    // -----------------------------------------------------
    // Resultado
    // -----------------------------------------------------

    return {
      totalMovementCost: path.length
        ? Math.round(path[path.length - 1].totalMovementCost * 100) / 100
        : 0,
      totalMoneyCost: Math.round(totalMoney * 100) / 100,
      path,
    };
  }
}

module.exports = Pathfinder;
