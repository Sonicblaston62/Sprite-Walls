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
            let spritesToCheck: Sprite[] = [];

            if (typeof spriteB === "number") {
                spritesToCheck = sprites.allOfKind(spriteB);
            } else {
                spritesToCheck = [spriteB];
            }

            for (let otherSprite of spritesToCheck) {
                if (spriteA instanceof Sprite) {
                    let boxA = getBoundingBox(spriteA, false);
                    let boxB = getBoundingBox(otherSprite, false);

                    if (isAABBOverlapping(boxA, boxB)) {
                        let overlapX = Math.min(boxA.right - boxB.left, boxB.right - boxA.left);
                        let overlapY = Math.min(boxA.bottom - boxB.top, boxB.bottom - boxA.top);

                        if (overlapX < overlapY) {
                            if (spriteA.x > otherSprite.x) {
                                if (pushable) otherSprite.x -= overlapX;
                                else spriteA.x += overlapX;
                            } else {
                                if (pushable) otherSprite.x += overlapX;
                                else spriteA.x -= overlapX;
                            }
                        } else {
                            if (spriteA.y > otherSprite.y) {
                                if (pushable) otherSprite.y -= overlapY;
                                else spriteA.y += overlapY;
                            } else {
                                if (pushable) otherSprite.y += overlapY;
                                else spriteA.y -= overlapY;
                            }
                        }

                        if (!pushable) {
                            spriteA.vx = 0;
                            spriteA.vy = 0;
                        }
                        break;
                    }
                }
            }
        });
    }

    // =========================
    // Generate Exact Bounding Box (No Extra Padding)
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
