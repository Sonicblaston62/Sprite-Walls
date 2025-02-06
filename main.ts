//% color="#a349a4" weight=90
namespace CollisionHandler {

    /**
     * Stops spriteA when colliding with spriteB (acts like a wall).
     * @param spriteA The first sprite (the one that moves).
     * @param spriteB The second sprite or a SpriteKind (stationary object).
     */
    //% block="stop $spriteA when colliding with $spriteB"
    //% group="Solid Collisions"
    //% spriteA.shadow=variables_get
    //% spriteA.defl=mySprite
    //% spriteB.shadow=variables_get
    //% spriteB.shadow=spritekind
    export function handleSolidCollision(spriteA: Sprite | number, spriteB: Sprite | number) {
        handleAABBCollision(spriteA, spriteB, false);
    }

    /**
     * Allows spriteA to push spriteB (pushable object).
     * @param spriteA The first sprite (the one that moves).
     * @param spriteB The second sprite or a SpriteKind (pushable object).
     */
    //% block="allow $spriteA to push $spriteB"
    //% group="Pushable Collisions"
    //% spriteA.shadow=variables_get
    //% spriteA.defl=mySprite
    //% spriteB.shadow=variables_get
    //% spriteB.shadow=spritekind
    //% color="#a349a4" weight=80
    export function handlePushableCollision(spriteA: Sprite | number, spriteB: Sprite | number) {
        handleAABBCollision(spriteA, spriteB, true);
    }

    // =========================
    // AABB Collision Handling
    // =========================
function handleAABBCollision(spriteA: Sprite | number, spriteB: Sprite | number, pushable: boolean = false) {
    game.onUpdate(function () {
        let spritesA: Sprite[] = [];
        let spritesB: Sprite[] = [];

        // If spriteA is a number, get all sprites of that kind
        if (typeof spriteA === "number") {
            spritesA = sprites.allOfKind(spriteA);
        } else {
            spritesA = [spriteA];
        }

        // If spriteB is a number, get all sprites of that kind
        if (typeof spriteB === "number") {
            spritesB = sprites.allOfKind(spriteB);
        } else {
            spritesB = [spriteB];
        }

        // Check collisions between all sprites in both groups
        for (let a of spritesA) {
            for (let b of spritesB) {
                if (a === b) continue; // **🛠 Fix: Ignore self-collision**

                let boxA = getBoundingBox(a, false);
                let boxB = getBoundingBox(b, false);

                if (isAABBOverlapping(boxA, boxB)) {
                    let overlapX = Math.min(boxA.right - boxB.left, boxB.right - boxA.left);
                    let overlapY = Math.min(boxA.bottom - boxB.top, boxB.bottom - boxA.top);

                    if (overlapX < overlapY) {
                        if (a.x > b.x) {
                            if (pushable) b.x -= overlapX;
                            else a.x += overlapX;
                        } else {
                            if (pushable) b.x += overlapX;
                            else a.x -= overlapX;
                        }
                    } else {
                        if (a.y > b.y) {
                            if (pushable) b.y -= overlapY;
                            else a.y += overlapY;
                        } else {
                            if (pushable) b.y += overlapY;
                            else a.y -= overlapY;
                        }
                    }

                    if (!pushable) {
                        a.vx = 0;
                        a.vy = 0;
                    }
                    break;
                }
            }
        }
    });
}


    // =========================
    // Generate Exact Bounding Box
    // =========================
    function getBoundingBox(sprite: Sprite, addPadding: boolean = false): { left: number, right: number, top: number, bottom: number } {
        let padding = addPadding ? Math.max(sprite.width, sprite.height) * 0.1 : 0;

        return {
            left: sprite.left - padding,
            right: sprite.right + padding,
            top: sprite.top - padding,
            bottom: sprite.bottom + padding
        };
    }

    // =========================
    // AABB Overlap Check
    // =========================
    function isAABBOverlapping(boxA: { left: number, right: number, top: number, bottom: number },
        boxB: { left: number, right: number, top: number, bottom: number }): boolean {
        return (
            boxA.left < boxB.right &&
            boxA.right > boxB.left &&
            boxA.top < boxB.bottom &&
            boxA.bottom > boxB.top
        );
    }
}
