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
    // Settings are left undefined until set: a game's code can run before this
    // file's top-level code (in the extension's own test), which would reset them.
    let maxPasses: number; // default 4, "set collision passes"
    // Contacts with this much (or less) vertical overlap count as standing / landing /
    // stepping up, so walking over a row of sprites never catches on their corners.
    let stepUp: number; // default 3, "set step up height"

    // Sprite lists for each rule, looked up once per frame (sprites.allOfKind is not free)
    let listsA: Sprite[][] = [];
    let listsB: Sprite[][] = [];

    // Per-frame lookup tables, so nothing has to search through lists:
    // every tracked sprite gets a number (sprite.data.__swi) for this frame.
    let inA: number[][] = [];        // inA[rule][spriteNo] = 1 if in that rule's A side
    let inB: number[][] = [];
    let blockerLists: number[][] = []; // everything a sprite collides with (as numbers)
    let idxA: number[][] = [];         // each rule's sprites as numbers
    let idxB: number[][] = [];
    let movable: boolean[] = [];

    function step() {
        frameNo++;
        listsA = [];
        listsB = [];
        tracked = [];
        for (const rule of rules) {
            const la = resolveList(rule.a);
            const lb = resolveList(rule.b);
            listsA.push(la);
            listsB.push(lb);
            for (const s of la) track(s);
            for (const s of lb) track(s);
        }
        // Remember speeds before anything is corrected this frame, so later passes
        // still know who was moving (and don't shove sprites that stood still).
        for (const s of tracked) snapshot(s);

        const n = tracked.length;
        inA = [];
        inB = [];
        idxA = [];
        idxB = [];
        blockerLists = [];
        movable = [];
        for (let i = 0; i < n; i++) {
            blockerLists.push([]);
            movable.push(false);
        }
        for (let r = 0; r < rules.length; r++) {
            const ma: number[] = [];
            const mb: number[] = [];
            for (let i = 0; i < n; i++) { ma.push(0); mb.push(0); }
            const ia: number[] = [];
            const ib: number[] = [];
            for (const s of listsA[r]) ia.push(spriteNo(s));
            for (const s of listsB[r]) ib.push(spriteNo(s));
            idxA.push(ia);
            idxB.push(ib);
            for (const i of ia) ma[i] = 1;
            for (const i of ib) mb[i] = 1;
            inA.push(ma);
            inB.push(mb);
            for (const i of ia) {
                const list = blockerLists[i];
                for (const j of ib) if (j != i) list.push(j);
            }
            for (const i of ib) {
                const list = blockerLists[i];
                for (const j of ia) if (j != i) list.push(j);
            }
        }
        for (let i = 0; i < n; i++) {
            const s = tracked[i];
            let m = false;
            for (let r = 0; r < rules.length && !m; r++) {
                if (inA[r][i] || (rules[r].pushable && inB[r][i])) m = true;
            }
            movable[i] = m && getFor(s, "pushable", 1) != 0;
        }

        applyCarry();

        const passes = maxPasses === undefined ? 4 : maxPasses;
        for (let pass = 0; pass < passes; pass++) {
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

    function track(s: Sprite) {
        if (s.data["__swst"] === frameNo) return; // already listed this frame
        s.data["__swst"] = frameNo;
        s.data["__swi"] = tracked.length;
        tracked.push(s);
    }

    // This frame's number for a sprite, or -1 if no rule covers it
    function spriteNo(s: Sprite): number {
        return s.data["__swst"] === frameNo ? s.data["__swi"] : -1;
    }

    function isIn(table: number[][], r: number, s: Sprite): boolean {
        const i = spriteNo(s);
        return i >= 0 && table[r][i] == 1;
    }
    const MAX_CARRY_STEP = 8; // bigger jumps are teleports (setPosition), not walking

    function applyCarry() {
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
        if (on && isAlive(on) && depth < 16 && getFor(on, "carries", 1) != 0) {
            carry = totalMove(on, depth + 1);
            // ride along, unless a wall is in the way (then slide off)
            if (carry != 0 && canMoveTo(s, carry, 0, on, NONE)) s.x += carry;
            else carry = 0;
        }
        s.data["__swmv"] = own + carry;
        return own + carry;
    }

    // After everything is settled: who is standing on whom?
    function rememberStanding() {
        refreshBounds();
        for (let i = 0; i < tracked.length; i++) {
            const s = tracked[i];
            if (!isAlive(s)) continue;
            const prev: Sprite = s.data["__swon"];
            let best: Sprite = null;
            let bestOverlap = 0;
            for (const j of blockerLists[i]) {
                if (Math.abs(bB[i] - bT[j]) > 1) continue;
                const o = tracked[j];
                // Something jumping up into s doesn't become what s stands on (that would
                // let it lift s onto its head). What s already stood on still counts,
                // so a stack can still jump together.
                if (o !== prev && svy(o) < -1) continue;
                const ov = Math.min(bR[i], bR[j]) - Math.max(bL[i], bL[j]);
                if (ov > bestOverlap && isAlive(o)) { bestOverlap = ov; best = o; }
            }
            s.data["__swon"] = best;
        }
    }

    // Cached edges of every tracked sprite (sprite.left etc. are function calls,
    // which adds up over hundreds of pairs). Refreshed each phase and after moves.
    let bL: number[] = [];
    let bT: number[] = [];
    let bR: number[] = [];
    let bB: number[] = [];

    function refreshBounds() {
        bL = []; bT = []; bR = []; bB = [];
        for (const s of tracked) {
            bL.push(s.left); bT.push(s.top); bR.push(s.right); bB.push(s.bottom);
        }
    }

    function refreshOne(s: Sprite) {
        const i = spriteNo(s);
        if (i < 0) return;
        bL[i] = s.left; bT[i] = s.top; bR[i] = s.right; bB[i] = s.bottom;
    }

    function runPhase(sideHitsOnly: boolean): boolean {
        refreshBounds();
        let changed = false;
        for (let r = 0; r < rules.length; r++) {
            const rule = rules[r];
            const nA = idxA[r];
            const nB = idxB[r];
            for (const ia of nA) {
                const a = tracked[ia];
                if (!isAlive(a)) continue;
                for (const ib of nB) {
                    if (ia == ib) continue;
                    // quick reject from the cached edges: too far apart to touch
                    if (bL[ia] >= bR[ib] || bL[ib] >= bR[ia] || bT[ia] >= bB[ib] || bT[ib] >= bB[ia]) continue;
                    const b = tracked[ib];
                    if (!isAlive(b)) continue;
                    if (resolve(r, rule, a, b, sideHitsOnly)) {
                        changed = true;
                        refreshOne(a);
                        refreshOne(b);
                    }
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

    function resolve(r: number, rule: Rule, a: Sprite, b: Sprite, sideHitsOnly: boolean): boolean {
        if (!overlaps(a.left, a.top, a.right, a.bottom, b.left, b.top, b.right, b.bottom)) return false;

        const overlapX = Math.min(a.right - b.left, b.right - a.left);
        const overlapY = Math.min(a.bottom - b.top, b.bottom - a.top);
        const shallow = overlapY <= (stepUp === undefined ? 3 : stepUp);
        if (sideHitsOnly && shallow) return false;

        let alongX: boolean;
        if (shallow && overlapX > overlapY) {
            // One is just on top of the other: standing, landing or stepping up
            alongX = false;
        } else if (overlapX <= 2 && overlapY > overlapX) {
            // Only just touching sideways but deep vertically: a side bump
            // (e.g. a carried player nudging a box), never a climb onto its corner
            alongX = true;
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

        if (rule.pushable && pushAllowed(rule.direction, alongX) && getFor(b, "pushable", 1) != 0) {
            // Both can push each other (e.g. Player pushes Player): only the one
            // walking into the other pushes. The pair is also checked the other
            // way round, so skip it here if b is the pusher.
            if (isIn(inA, r, b)) {
                const aClosing = alongX ? svx(a) * sx : svy(a) * sy;
                const bClosing = alongX ? -svx(b) * sx : -svy(b) * sy;
                if (bClosing > aClosing) return false;
            }
            const overlap = alongX ? overlapX : overlapY;
            // b may push the next one in line, and so on (a row of players or boxes)
            const chain: Sprite[] = [];
            const fullX = alongX ? sx * overlap : 0;
            const fullY = alongX ? 0 : sy * overlap;
            if (collectPush(b, fullX, fullY, a, chain, 0)) {
                // Push speed: the row moves at most as fast as its slowest member
                // (its own push speed, else the push block's speed; 0 = no limit).
                // The rest pushes the pusher back, so it slows down to that speed.
                let speed = 0;
                for (const c of chain) {
                    const cs = getFor(c, "speed", rule.pushSpeed);
                    if (cs > 0 && (speed == 0 || cs < speed)) speed = cs;
                }
                let amount = overlap;
                if (speed > 0) amount = Math.min(overlap, speed * game.eventContext().deltaTime);
                const dx = alongX ? sx * amount : 0;
                const dy = alongX ? 0 : sy * amount;
                for (const c of chain) {
                    c.x += dx;
                    c.y += dy;
                    refreshOne(c);
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
        const bStoppable = rule.pushable || isIn(inA, r, b);
        let moveB = false;
        if (alongX) {
            // the one walking into the other stops; one standing still is never shoved
            if (bStoppable) moveB = -svx(b) * sx > svx(a) * sx;
        } else {
            // Stacked: normally the upper one moves up and the lower one is never pushed down.
            // But a sprite jumping up into someone who isn't standing on it bumps its head:
            // it gets stopped, instead of lifting them on top of itself.
            const bIsUpper = b.y < a.y;
            const upper = bIsUpper ? b : a;
            const lower = bIsUpper ? a : b;
            const lowerJumpingIn = svy(lower) < svy(upper) - 1;
            const riding = upper.data["__swon"] === lower;
            const moveUpper = !lowerJumpingIn || riding;
            moveB = moveUpper ? bIsUpper : !bIsUpper;
            if (moveB && !bStoppable) moveB = false;
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
        const firstBlockers = alongX ? blockersFor(first) : NONE;
        const secondBlockers = alongX ? blockersFor(second) : NONE;
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
            // Only the one doing the moving: shoving the other one would push a whole
            // row along even when chain pushing is limited.
            if (canMoveTo(first, fx, fy, second, NONE)) { moveBy(first, fx, fy); return true; }
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
        refreshOne(s);
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
    // (built once per frame in step)
    const NONE: number[] = [];
    function blockersFor(b: Sprite): number[] {
        const i = spriteNo(b);
        return i >= 0 ? blockerLists[i] : NONE;
    }

    // Can s move by (dx, dy)? Anything in the way that s is allowed to push (by any
    // push rule) gets pushed too and is added to chain: a player pushing a row of
    // players pushes the box at the end as well. Walls and other sprites block.
    function collectPush(s: Sprite, dx: number, dy: number, pusher: Sprite, chain: Sprite[], depth: number): boolean {
        if (!canMoveTo(s, dx, dy, pusher, NONE)) return false; // walls
        const sl = s.left, st = s.top, sr = s.right, sb = s.bottom;
        const l = sl + dx, t = st + dy, r = sr + dx, btm = sb + dy;
        for (const j of blockersFor(s)) {
            const o = tracked[j];
            if (o === pusher) continue;
            if (overlaps(sl, st, sr, sb, bL[j], bT[j], bR[j], bB[j])) continue;
            if (!overlaps(l, t, r, btm, bL[j], bT[j], bR[j], bB[j])) continue;
            if (!isAlive(o) || chain.indexOf(o) >= 0) continue;
            if (depth < (chainLimit === undefined ? 8 : chainLimit) && canPush(s, o, dx != 0)
                && collectPush(o, dx, dy, s, chain, depth + 1)) continue;
            return false;
        }
        if (chain.indexOf(s) < 0) chain.push(s);
        return true;
    }

    // Can s move up/down by dy? Sprites in the way that can move (not walls or
    // fixed sprites like gates) are moved too and added to chain.
    function collectLift(s: Sprite, dy: number, from: Sprite, chain: Sprite[], depth: number): boolean {
        if (!canMoveTo(s, 0, dy, from, NONE)) return false; // walls / ceiling / floor
        const sl = s.left, st = s.top, sr = s.right, sb = s.bottom;
        const sMid = (st + sb) / 2;
        const t = st + dy, btm = sb + dy;
        for (const j of blockersFor(s)) {
            // only what's on the side we're moving towards
            const oMid = (bT[j] + bB[j]) / 2;
            if (dy < 0 ? oMid >= sMid : oMid <= sMid) continue;
            if (!overlaps(sl, t, sr, btm, bL[j], bT[j], bR[j], bB[j])) continue;
            const o = tracked[j];
            if (o === from || !isAlive(o) || chain.indexOf(o) >= 0) continue;
            if (!isMovable(o)) {
                // fixed sprite: only blocks if we'd newly run into it
                if (overlaps(sl, st, sr, sb, bL[j], bT[j], bR[j], bB[j])) continue;
                return false;
            }
            // move o just enough to clear s's new position
            const need = dy < 0 ? bB[j] - t : btm - bT[j];
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
    // (worked out once per frame in step; "can be pushed off" = bolted in place)
    function isMovable(o: Sprite): boolean {
        const i = spriteNo(o);
        return i >= 0 && movable[i];
    }

    function canPush(s: Sprite, o: Sprite, alongX: boolean): boolean {
        if (getFor(o, "pushable", 1) == 0) return false;
        for (let r = 0; r < rules.length; r++) {
            const rule = rules[r];
            if (!rule.pushable || !pushAllowed(rule.direction, alongX)) continue;
            if (isIn(inA, r, s) && isIn(inB, r, o)) return true;
        }
        return false;
    }

    // Can b move by (dx, dy) without hitting a wall tile, the tilemap edge or one of `others`?
    // (`pusher` is ignored: it's the sprite b is being separated from.)
    function canMoveTo(b: Sprite, dx: number, dy: number, pusher: Sprite, others: number[]): boolean {
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

        if (others.length == 0) return true;
        const bl = b.left, bt = b.top, br = b.right, bb = b.bottom;
        for (const j of others) {
            // Already overlapping it? That contact gets sorted out on its own,
            // so it doesn't block (lets whole stacks push apart bottom-up).
            if (overlaps(bl, bt, br, bb, bL[j], bT[j], bR[j], bB[j])) continue;
            if (!overlaps(l, t, r, btm, bL[j], bT[j], bR[j], bB[j])) continue;
            const o = tracked[j];
            if (o === b || o === pusher || !isAlive(o)) continue;
            return false;
        }
        return true;
    }

    // =====================================================================
    // Settings: per sprite or per kind, and global
    // =====================================================================

    // Per-kind values; per-sprite values live in sprite.data. Sprite beats kind.
    class KindSetting {
        constructor(public kind: number, public key: string, public value: number) { }
    }
    let kindSettings: KindSetting[];

    function setFor(target: Sprite | number, key: string, value: number) {
        if (typeof target === "number") {
            if (!kindSettings) kindSettings = [];
            const kind = target as number;
            for (const k of kindSettings) {
                if (k.kind === kind && k.key === key) { k.value = value; return; }
            }
            kindSettings.push(new KindSetting(kind, key, value));
        } else if (target) {
            (target as Sprite).data["__sws_" + key] = value;
        }
    }

    function getFor(s: Sprite, key: string, fallback: number): number {
        const v = s.data["__sws_" + key];
        if (v !== undefined) return v;
        if (kindSettings) {
            const kind = s.kind();
            for (const k of kindSettings) {
                if (k.kind === kind && k.key === key) return k.value;
            }
        }
        return fallback;
    }

    /**
     * How fast a sprite (or every sprite of a kind) can be pushed, in pixels per second.
     * Overrides the speed in the push block. 0 = as fast as the pusher walks.
     * A row of things being pushed moves at the speed of the slowest one.
     */
    //% block="set push speed of $target to $speed"
    //% group="Settings" weight=100
    //% target.shadow=spritekind
    //% speed.defl=30 speed.min=0 speed.max=200
    export function setPushSpeed(target: Sprite | number, speed: number) {
        setFor(target, "speed", Math.max(0, speed));
    }

    /**
     * Turn pushing on or off for a sprite (or kind), e.g. to bolt a box in place.
     * When off it acts like a wall for everyone that could push it.
     */
    //% block="set $target can be pushed $on"
    //% group="Settings" weight=90
    //% target.shadow=spritekind
    //% on.shadow=toggleOnOff on.defl=true
    export function setCanBePushed(target: Sprite | number, on: boolean) {
        setFor(target, "pushable", on ? 1 : 0);
    }

    /**
     * Should sprites standing on this sprite (or kind) move along with it?
     * On by default.
     */
    //% block="set $target carries what stands on it $on"
    //% group="Settings" weight=80
    //% target.shadow=spritekind
    //% on.shadow=toggleOnOff on.defl=true
    export function setCarries(target: Sprite | number, on: boolean) {
        setFor(target, "carries", on ? 1 : 0);
    }

    let chainLimit: number; // default 8

    /**
     * How many things can be pushed in a row (player pushes player pushes box...).
     * 0 = only the one you walk into. Default 8.
     */
    //% block="set chain push limit to $count"
    //% group="Settings" weight=70
    //% count.defl=8 count.min=0 count.max=20
    export function setChainLimit(count: number) {
        chainLimit = Math.max(0, Math.floor(count));
    }

    /**
     * How many pixels a sprite can step up onto another sprite when walking
     * (so walking over a row of players or boxes doesn't snag). Default 3.
     */
    //% block="set step up height to $pixels"
    //% group="Settings" weight=60
    //% pixels.defl=3 pixels.min=0 pixels.max=8
    export function setStepUpHeight(pixels: number) {
        stepUp = Math.max(0, pixels);
    }

    /**
     * How many times per frame collisions are checked. More = big stacks settle
     * better, fewer = faster game. Default 4.
     */
    //% block="set collision passes to $passes"
    //% group="Settings" weight=50 advanced=true
    //% passes.defl=4 passes.min=1 passes.max=8
    export function setCollisionPasses(passes: number) {
        maxPasses = Math.max(1, Math.floor(passes));
    }
}