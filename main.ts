/**
 * Sprite Walls: make sprites act like walls, or like boxes that can be pushed.
 */
//% color="#a349a4" weight=80 icon="" block="Sprite Walls"
namespace CollisionHandler {

    export enum PushDirection {
        //% block="left and right"
        X_Axis,
        //% block="up and down"
        Y_Axis,
        //% block="any direction"
        Omnidirectional
    }

    class Rule {
        constructor(
            public a: Sprite | number,
            public b: Sprite | number,
            public pushable: boolean,
            public direction: PushDirection,
            public pushSpeed: number // 0 = as fast as the pusher moves
        ) { }
    }

    // Set up lazily: in the extension's own test run, test.ts can run
    // before this file's top-level code, so these may still be undefined.
    let rules: Rule[];
    let scenesWithHandler: scene.Scene[];

    /**
     * Stop a sprite (or every sprite of a kind) when it runs into another sprite or kind.
     * Use once, in "on start".
     */
    //% block="stop $spriteA when colliding with $spriteB"
    //% group="Solid Collisions"
    //% spriteA.shadow=variables_get
    //% spriteA.defl=mySprite
    //% spriteB.shadow=spritekind
    export function handleSolidCollision(spriteA: Sprite | number, spriteB: Sprite | number) {
        addRule(spriteA, spriteB, false, PushDirection.Omnidirectional, 0);
    }

    /**
     * Let a sprite (or every sprite of a kind) push another sprite or kind.
     * Pushed sprites stop at walls, at the edge of the tilemap and at each other.
     * Works for players too: use the same kind twice (e.g. Player pushes Player)
     * and whoever walks into the other one does the pushing.
     * Click + to set a push speed (pixels per second): heavy things get pushed slowly
     * and slow the pusher down. Without it, things move as fast as the pusher.
     * Use once, in "on start".
     */
    //% block="allow $spriteA to push $spriteB in $direction||at speed $speed"
    //% group="Pushable Collisions"
    //% spriteA.shadow=variables_get
    //% spriteA.defl=mySprite
    //% spriteB.shadow=spritekind
    //% direction.defl=CollisionHandler.PushDirection.Omnidirectional
    //% speed.defl=30 speed.min=1 speed.max=200
    //% expandableArgumentMode="toggle"
    export function handlePushableCollision(spriteA: Sprite | number, spriteB: Sprite | number, direction: PushDirection, speed?: number) {
        addRule(spriteA, spriteB, true, direction, speed > 0 ? speed : 0);
    }

    function addRule(a: Sprite | number, b: Sprite | number, pushable: boolean, direction: PushDirection, pushSpeed: number) {
        if (!rules) rules = [];
        if (!scenesWithHandler) scenesWithHandler = [];
        // Same pair added again (e.g. block inside a loop): update it instead of stacking
        let existing: Rule = null;
        for (const r of rules) {
            if (r.a === a && r.b === b) existing = r;
        }
        if (existing) {
            existing.pushable = pushable;
            existing.direction = direction;
            existing.pushSpeed = pushSpeed;
        } else {
            rules.push(new Rule(a, b, pushable, direction, pushSpeed));
        }

        // One update handler per scene, no matter how many rules
        const current = game.currentScene();
        if (scenesWithHandler.indexOf(current) < 0) {
            scenesWithHandler.push(current);
            game.onUpdate(step);
        }
    }

    function resolveList(target: Sprite | number): Sprite[] {
        if (typeof target === "number") return sprites.allOfKind(target as number);
        const s = target as Sprite;
        return s ? [s] : [];
    }

    function isAlive(s: Sprite): boolean {
        return s && !(s.flags & sprites.Flag.Destroyed);
    }

    // A few passes per frame, so stacks and chains (box on box on player...)
    // settle in one frame instead of sinking into each other.
    const MAX_PASSES = 4;
    // Contacts with this much (or less) vertical overlap count as standing / landing /
    // stepping up, so walking over a row of sprites never catches on their corners.
    const STEP_UP = 3;

    // Sprite lists for each rule, looked up once per frame (sprites.allOfKind is not free)
    let listsA: Sprite[][] = [];
    let listsB: Sprite[][] = [];

    function step() {
        listsA = [];
        listsB = [];
        for (const rule of rules) {
            const la = resolveList(rule.a);
            const lb = resolveList(rule.b);
            listsA.push(la);
            listsB.push(lb);
            // Remember speeds before anything is corrected this frame, so later passes
            // still know who was moving (and don't shove sprites that stood still).
            for (const s of la) snapshot(s);
            for (const s of lb) snapshot(s);
        }
        tracked = [];
        for (let r = 0; r < listsA.length; r++) {
            for (const s of listsA[r]) if (tracked.indexOf(s) < 0) tracked.push(s);
            for (const s of listsB[r]) if (tracked.indexOf(s) < 0) tracked.push(s);
        }

        applyCarry();

        for (let pass = 0; pass < MAX_PASSES; pass++) {
            // Side hits first (sprites at the same height), then landing/standing.
            // Otherwise a sprite pressed against a stack could "stand" on the corner below.
            const sides = runPhase(true);
            const rest = runPhase(false);
            if (!sides && !rest) break;
        }

        rememberStanding();
    }

    // ---------- Carrying: whatever stands on a sprite moves along with it ----------
    let tracked: Sprite[] = [];
    let frameNo = 0;
    const MAX_CARRY_STEP = 8; // bigger jumps are teleports (setPosition), not walking

    function applyCarry() {
        frameNo++;
        const dt = game.eventContext().deltaTime;
        for (const s of tracked) {
            if (!isAlive(s)) continue;
            const moved = totalMove(s, 0);
            // A carried sprite has no speed of its own, but it IS moving: use its real
            // movement as its speed, so bumping into things counts as a side hit.
            if (dt > 0 && s.data["__swon"]) s.data["__swvx"] = moved / dt;
        }
        // Remember where everything is now, to measure next frame's movement
        for (const s of tracked) s.data["__swlx"] = s.x;
    }

    // How far s moved sideways this frame: its own movement plus what carried it.
    // Works up a stack: a rider on a rider on a walker moves with the walker.
    function totalMove(s: Sprite, depth: number): number {
        if (s.data["__swfr"] === frameNo) return s.data["__swmv"];
        s.data["__swfr"] = frameNo;
        s.data["__swmv"] = 0; // guards against loops

        const lx = s.data["__swlx"];
        let own = lx === undefined ? 0 : s.x - lx;
        if (Math.abs(own) > MAX_CARRY_STEP) own = 0;

        let carry = 0;
        const on: Sprite = s.data["__swon"];
        if (on && isAlive(on) && depth < 16) {
            carry = totalMove(on, depth + 1);
            // ride along, unless a wall is in the way (then slide off)
            if (carry != 0 && canMoveTo(s, carry, 0, on, [])) s.x += carry;
            else carry = 0;
        }
        s.data["__swmv"] = own + carry;
        return own + carry;
    }

    // After everything is settled: who is standing on whom?
    function rememberStanding() {
        for (const s of tracked) {
            if (!isAlive(s)) continue;
            let best: Sprite = null;
            let bestOverlap = 0;
            for (const o of blockersFor(s)) {
                if (o === s || !isAlive(o)) continue;
                if (Math.abs(s.bottom - o.top) > 1) continue;
                const ov = Math.min(s.right, o.right) - Math.max(s.left, o.left);
                if (ov > bestOverlap) { bestOverlap = ov; best = o; }
            }
            s.data["__swon"] = best;
        }
    }

    function runPhase(sideHitsOnly: boolean): boolean {
        let changed = false;
        for (let r = 0; r < rules.length; r++) {
            const rule = rules[r];
            const listA = listsA[r];
            const listB = listsB[r];
            for (const a of listA) {
                if (!isAlive(a)) continue;
                for (const b of listB) {
                    if (a === b || !isAlive(b)) continue;
                    if (resolve(rule, a, b, listA, listB, sideHitsOnly)) changed = true;
                }
            }
        }
        return changed;
    }

    function snapshot(s: Sprite) {
        if (!s) return;
        s.data["__swvx"] = s.vx;
        s.data["__swvy"] = s.vy;
    }
    // Speed at the start of this frame's collision step
    function svx(s: Sprite): number {
        const v = s.data["__swvx"];
        return v === undefined ? s.vx : v;
    }
    function svy(s: Sprite): number {
        const v = s.data["__swvy"];
        return v === undefined ? s.vy : v;
    }

    function overlaps(l1: number, t1: number, r1: number, b1: number,
        l2: number, t2: number, r2: number, b2: number): boolean {
        return l1 < r2 && r1 > l2 && t1 < b2 && b1 > t2;
    }

    function resolve(rule: Rule, a: Sprite, b: Sprite, listA: Sprite[], listB: Sprite[], sideHitsOnly: boolean): boolean {
        if (!overlaps(a.left, a.top, a.right, a.bottom, b.left, b.top, b.right, b.bottom)) return false;

        const overlapX = Math.min(a.right - b.left, b.right - a.left);
        const overlapY = Math.min(a.bottom - b.top, b.bottom - a.top);
        const shallow = overlapY <= STEP_UP;
        if (sideHitsOnly && shallow) return false;

        let alongX: boolean;
        if (shallow && overlapX > overlapY) {
            // One is just on top of the other: standing, landing or stepping up
            alongX = false;
        } else {
            // Which side did they hit? The axis crossed most recently:
            // overlap / closing speed = time since that edge was crossed.
            const tX = timeSince(overlapX, svx(a) - svx(b));
            const tY = timeSince(overlapY, svy(a) - svy(b));
            alongX = tX != tY ? tX < tY : overlapX < overlapY;
        }

        // Direction from a towards b (+1 or -1). Same centre: use a's movement.
        const sx = a.x < b.x ? 1 : a.x > b.x ? -1 : (svx(a) >= 0 ? 1 : -1);
        const sy = a.y < b.y ? 1 : a.y > b.y ? -1 : (svy(a) >= 0 ? 1 : -1);

        if (rule.pushable && pushAllowed(rule.direction, alongX)) {
            // Both can push each other (e.g. Player pushes Player): only the one
            // walking into the other pushes. The pair is also checked the other
            // way round, so skip it here if b is the pusher.
            if (listA.indexOf(b) >= 0) {
                const aClosing = alongX ? svx(a) * sx : svy(a) * sy;
                const bClosing = alongX ? -svx(b) * sx : -svy(b) * sy;
                if (bClosing > aClosing) return false;
            }
            const overlap = alongX ? overlapX : overlapY;
            // Push speed: b moves at most pushSpeed px/s, the rest pushes a back
            // (so the pusher slows down to the push speed).
            let amount = overlap;
            if (rule.pushSpeed > 0) {
                amount = Math.min(overlap, rule.pushSpeed * game.eventContext().deltaTime);
            }
            const dx = alongX ? sx * amount : 0;
            const dy = alongX ? 0 : sy * amount;
            // b may push the next one in line, and so on (a row of players or boxes)
            const chain: Sprite[] = [];
            if (collectPush(b, dx, dy, a, chain, 0)) {
                for (const c of chain) {
                    c.x += dx;
                    c.y += dy;
                }
                const rest = overlap - amount;
                if (rest > 0) {
                    // pusher backs off the rest (position only, keeps its speed)
                    if (alongX) a.x -= sx * rest;
                    else a.y -= sy * rest;
                }
                return true;
            }
        }

        // Solid (or push blocked). Correction for a is (ax, ay); for b it's the opposite.
        const ax = alongX ? -sx * overlapX : 0;
        const ay = alongX ? 0 : -sy * overlapY;

        // Who moves? b can only be the one stopped if the rule lets it be
        // (player vs player, or a pushable box).
        const bStoppable = rule.pushable || listA.indexOf(b) >= 0;
        let moveB = false;
        if (bStoppable) {
            if (alongX) {
                // the one walking into the other stops; one standing still is never shoved
                moveB = -svx(b) * sx > svx(a) * sx;
            } else {
                // stacked: the upper one moves up, the lower one is never pushed down
                moveB = b.y < a.y;
            }
        }

        const first = moveB ? b : a;
        const second = moveB ? a : b;
        const fx = moveB ? -ax : ax;
        const fy = moveB ? -ay : ay;

        if (!alongX) {
            // Up/down: move the whole column. Lifting a sprite also lifts everything
            // stacked on it; if the top of the column hits a ceiling, the column can't
            // move, so the one below is pushed down instead (and stops jumping).
            const chain1: Sprite[] = [];
            if (collectLift(first, fy, second, chain1, 0)) {
                for (const c of chain1) moveBy(c, 0, fy);
                return true;
            }
            const chain2: Sprite[] = [];
            if (collectLift(second, -fy, first, chain2, 0)) {
                for (const c of chain2) moveBy(c, 0, -fy);
                return true;
            }
            // Squeezed between floor and ceiling: stop them moving into each other
            if (a.vy * sy > 0) a.vy = 0;
            if (b.vy * sy < 0) b.vy = 0;
            return true;
        }

        // Sideways: never shove a sprite into a wall or into another solid sprite
        // (that's how boxes tunnelled through players).
        const firstBlockers = alongX ? blockersFor(first) : [];
        const secondBlockers = alongX ? blockersFor(second) : [];
        if (canMoveTo(first, fx, fy, second, firstBlockers)) {
            moveBy(first, fx, fy);
            return true;
        }
        // A wall is in the way (e.g. a box landing on a player standing on the floor):
        // move the other one instead.
        if (canMoveTo(second, -fx, -fy, first, secondBlockers)) {
            moveBy(second, -fx, -fy);
            return true;
        }
        if (alongX) {
            // Squeezed between sprites on both sides: allow a sprite overlap
            // (fixed in the next pass) rather than letting them sink into each other.
            if (canMoveTo(first, fx, fy, second, [])) { moveBy(first, fx, fy); return true; }
            if (canMoveTo(second, -fx, -fy, first, [])) { moveBy(second, -fx, -fy); return true; }
        }
        // Both are against walls: try the other axis, otherwise leave them
        // overlapping rather than shove a sprite into a wall (it would fall through).
        const ox = alongX ? 0 : -sx * overlapX;
        const oy = alongX ? -sy * overlapY : 0;
        if (canMoveTo(a, ox, oy, b, blockersFor(a))) {
            moveBy(a, ox, oy);
        } else {
            // Stuck for now: at least stop them moving further into each other
            if (alongX) {
                if (a.vx * sx > 0) a.vx = 0;
                if (b.vx * sx < 0) b.vx = 0;
            } else {
                if (a.vy * sy > 0) a.vy = 0;
                if (b.vy * sy < 0) b.vy = 0;
            }
        }
        return true;
    }

    // Move a sprite and stop its speed only on the axis it was pushed back along
    function moveBy(s: Sprite, dx: number, dy: number) {
        s.x += dx;
        s.y += dy;
        if (dx != 0 && s.vx * dx < 0) s.vx = 0;
        if (dy != 0 && s.vy * dy < 0) s.vy = 0;
    }

    function timeSince(overlap: number, relSpeed: number): number {
        const speed = Math.abs(relSpeed);
        return speed < 1 ? 999999 : overlap / speed;
    }

    function pushAllowed(direction: PushDirection, alongX: boolean): boolean {
        if (direction === PushDirection.X_Axis) return alongX;
        if (direction === PushDirection.Y_Axis) return !alongX;
        return true;
    }

    // Every sprite that b collides with under any rule (players, other boxes, gates...)
    function blockersFor(b: Sprite): Sprite[] {
        let result: Sprite[] = [];
        for (let r = 0; r < listsA.length; r++) {
            const la = listsA[r];
            const lb = listsB[r];
            if (la.indexOf(b) >= 0) result = result.concat(lb);
            if (lb.indexOf(b) >= 0) result = result.concat(la);
        }
        return result;
    }

    // Can s move by (dx, dy)? Anything in the way that s is allowed to push (by any
    // push rule) gets pushed too and is added to chain: a player pushing a row of
    // players pushes the box at the end as well. Walls and other sprites block.
    function collectPush(s: Sprite, dx: number, dy: number, pusher: Sprite, chain: Sprite[], depth: number): boolean {
        if (!canMoveTo(s, dx, dy, pusher, [])) return false; // walls
        const l = s.left + dx, t = s.top + dy, r = s.right + dx, btm = s.bottom + dy;
        for (const o of blockersFor(s)) {
            if (o === s || o === pusher || !isAlive(o) || chain.indexOf(o) >= 0) continue;
            if (overlaps(s.left, s.top, s.right, s.bottom, o.left, o.top, o.right, o.bottom)) continue;
            if (!overlaps(l, t, r, btm, o.left, o.top, o.right, o.bottom)) continue;
            if (depth < 8 && canPush(s, o, dx != 0)
                && collectPush(o, dx, dy, s, chain, depth + 1)) continue;
            return false;
        }
        if (chain.indexOf(s) < 0) chain.push(s);
        return true;
    }

    // Can s move up/down by dy? Sprites in the way that can move (not walls or
    // fixed sprites like gates) are moved too and added to chain.
    function collectLift(s: Sprite, dy: number, from: Sprite, chain: Sprite[], depth: number): boolean {
        if (!canMoveTo(s, 0, dy, from, [])) return false; // walls / ceiling / floor
        const t = s.top + dy, btm = s.bottom + dy;
        for (const o of blockersFor(s)) {
            if (o === s || o === from || !isAlive(o) || chain.indexOf(o) >= 0) continue;
            // only what's on the side we're moving towards
            if (dy < 0 ? o.y >= s.y : o.y <= s.y) continue;
            if (!overlaps(s.left, t, s.right, btm, o.left, o.top, o.right, o.bottom)) continue;
            if (!isMovable(o)) {
                // fixed sprite: only blocks if we'd newly run into it
                if (overlaps(s.left, s.top, s.right, s.bottom, o.left, o.top, o.right, o.bottom)) continue;
                return false;
            }
            // move o just enough to clear s's new position
            const need = dy < 0 ? o.bottom - t : btm - o.top;
            if (need <= 0) continue;
            if (depth >= 8) return false;
            const sub: Sprite[] = [];
            if (!collectLift(o, dy < 0 ? -need : need, s, sub, depth + 1)) return false;
            // o and its column move by their own amount right away
            for (const c of sub) if (chain.indexOf(c) < 0) moveBy(c, 0, dy < 0 ? -need : need);
        }
        if (chain.indexOf(s) < 0) chain.push(s);
        return true;
    }

    // Can this sprite be moved by collisions? (Sprites only ever named as the
    // "wall" side of solid rules, like a gate, can't.)
    function isMovable(o: Sprite): boolean {
        for (let r = 0; r < rules.length; r++) {
            if (listsA[r].indexOf(o) >= 0) return true;
            if (rules[r].pushable && listsB[r].indexOf(o) >= 0) return true;
        }
        return false;
    }

    function canPush(s: Sprite, o: Sprite, alongX: boolean): boolean {
        for (let r = 0; r < rules.length; r++) {
            const rule = rules[r];
            if (!rule.pushable || !pushAllowed(rule.direction, alongX)) continue;
            if (listsA[r].indexOf(s) >= 0 && listsB[r].indexOf(o) >= 0) return true;
        }
        return false;
    }

    // Can b move by (dx, dy) without hitting a wall tile, the tilemap edge or one of `others`?
    // (`pusher` is ignored: it's the sprite b is being separated from.)
    function canMoveTo(b: Sprite, dx: number, dy: number, pusher: Sprite, others: Sprite[]): boolean {
        const l = b.left + dx;
        const t = b.top + dy;
        const r = b.right + dx;
        const btm = b.bottom + dy;

        const tm = game.currentScene().tileMap;
        if (tm && tm.enabled) {
            const size = 1 << tm.scale;
            const c0 = Math.floor(l / size);
            const c1 = Math.floor((r - 1) / size);
            const r0 = Math.floor(t / size);
            const r1 = Math.floor((btm - 1) / size);
            for (let c = c0; c <= c1; c++) {
                for (let row = r0; row <= r1; row++) {
                    // isObstacle is also true outside the map, so this covers the edges
                    if (tm.isObstacle(c, row)) return false;
                }
            }
        }

        for (const o of others) {
            if (o === b || o === pusher || !isAlive(o)) continue;
            // Already overlapping it? That contact gets sorted out on its own,
            // so it doesn't block (lets whole stacks push apart bottom-up).
            if (overlaps(b.left, b.top, b.right, b.bottom, o.left, o.top, o.right, o.bottom)) continue;
            if (overlaps(l, t, r, btm, o.left, o.top, o.right, o.bottom)) return false;
        }
        return true;
    }
}