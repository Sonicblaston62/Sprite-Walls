namespace CollisionHandler {

    export enum PushDirection {
        X_Axis,
        Y_Axis,
        Omnidirectional
    }

    // Stops spriteA when colliding with spriteB (acts like a wall)
    //% block="stop $spriteA when colliding with $spriteB"
    //% group="Solid Collisions"
    //% spriteA.shadow=variables_get
    //% spriteA.defl=mySprite
    //% spriteB.shadow=variables_get
    //% spriteB.shadow=spritekind
    export function handleSolidCollision(spriteA: Sprite | number, spriteB: Sprite | number) {
        handleAABBCollision(spriteA, spriteB, false, PushDirection.Omnidirectional);
    }

    // Allows spriteA to push spriteB
    //% block="allow $spriteA to push $spriteB in $direction"
    //% group="Pushable Collisions"
    //% spriteA.shadow=variables_get
    //% spriteA.defl=mySprite
    //% spriteB.shadow=variables_get
    //% spriteB.shadow=spritekind
    //% direction.defl=CollisionHandler.PushDirection.Omnidirectional
    //% color="#a349a4" weight=80
    export function handlePushableCollision(spriteA: Sprite | number, spriteB: Sprite | number, direction: PushDirection) {
        handleAABBCollision(spriteA, spriteB, true, direction);
    }

    function handleAABBCollision(spriteA: Sprite | number, spriteB: Sprite | number, pushable: boolean, direction: PushDirection) {
        game.onUpdate(function () {
            let spritesA: Sprite[] = typeof spriteA === "number" ? sprites.allOfKind(spriteA) : [spriteA];
            let spritesB: Sprite[] = typeof spriteB === "number" ? sprites.allOfKind(spriteB) : [spriteB];

            for (let a of spritesA) {
                for (let b of spritesB) {
                    if (a === b) continue;

                    let boxA = getBoundingBox(a);
                    let boxB = getBoundingBox(b);

                    if (isAABBOverlapping(boxA, boxB)) {
                        let overlapX = Math.min(boxA.right - boxB.left, boxB.right - boxA.left);
                        let overlapY = Math.min(boxA.bottom - boxB.top, boxB.bottom - boxA.top);

                        let moveX = 0;
                        let moveY = 0;

                        // Determine movement direction based on the smaller overlap
                        if (overlapX < overlapY) {
                            moveX = a.x > b.x ? -overlapX : overlapX;
                        } else {
                            moveY = a.y > b.y ? -overlapY : overlapY;
                        }

                        if (pushable) {
                            // Restrict movement based on push direction
                            if (direction === PushDirection.X_Axis) {
                                moveY = 0;
                            } else if (direction === PushDirection.Y_Axis) {
                                moveX = 0;
                            }

                            let newX = b.x + moveX;
                            let newY = b.y + moveY;

                            // Check if the pushable object will hit a wall or move out of bounds
                            if (isOnWallTile(newX, newY) || isOutOfBounds(newX, newY, b)) {
                                handleSolidCollision(a, b);
                                a.vx = 0; // Stop player movement
                                a.vy = 0;
                            } else {
                                b.setPosition(newX, newY);
                            }

                        } else {
                            let newX2 = clamp(a.x - moveX, spriteMinX(a), spriteMaxX(a));
                            let newY2 = clamp(a.y - moveY, spriteMinY(a), spriteMaxY(a));

                            // Prevent player from moving past tilemap boundaries
                            if (!isOutOfBounds(newX2, newY2, a)) {
                                a.setPosition(newX2, newY2);
                            }
                            a.vx = 0;
                            a.vy = 0;
                        }
                    }
                }
            }
        });
    }

    // Checks if a given position collides with a wall tile
    function isOnWallTile(x: number, y: number): boolean {
        let tilemap = game.currentScene().tileMap;
        if (!tilemap) return false;

        let tempSprite = sprites.create(img`.`); // Create a temporary sprite for collision check
        tempSprite.setPosition(x, y);
        let onWall = tilemap.isOnWall(tempSprite);
        tempSprite.destroy(); // Remove temporary sprite

        return onWall;
    }

    // Checks if a position is outside the tilemap boundaries
    function isOutOfBounds(x: number, y: number, sprite: Sprite): boolean {
        let tilemap2 = game.currentScene().tileMap;
        if (!tilemap2) return false;

        let minX = spriteMinX(sprite);
        let minY = spriteMinY(sprite);
        let maxX = spriteMaxX(sprite);
        let maxY = spriteMaxY(sprite);

        return x < minX || x > maxX || y < minY || y > maxY;
    }

    // Gets the bounding box of a sprite
    function getBoundingBox(sprite: Sprite): { left: number, right: number, top: number, bottom: number } {
        return {
            left: sprite.left,
            right: sprite.right,
            top: sprite.top,
            bottom: sprite.bottom
        };
    }

    // Checks if two bounding boxes overlap
    function isAABBOverlapping(boxA: { left: number, right: number, top: number, bottom: number },
        boxB: { left: number, right: number, top: number, bottom: number }): boolean {
        return (
            boxA.left < boxB.right &&
            boxA.right > boxB.left &&
            boxA.top < boxB.bottom &&
            boxA.bottom > boxB.top
        );
    }

    // Restricts a value within a given range
    function clamp(value: number, min: number, max: number): number {
        return Math.max(min, Math.min(max, value));
    }

    // Gets the minimum X position allowed for a sprite
    function spriteMinX(sprite: Sprite): number {
        return sprite.width / 2;
    }

    // Gets the maximum X position allowed for a sprite within the tilemap
    function spriteMaxX(sprite: Sprite): number {
        let tilemap3 = game.currentScene().tileMap;
        return tilemap3 ? tilemap3.areaWidth() - sprite.width / 2 : scene.screenWidth();
    }

    // Gets the minimum Y position allowed for a sprite
    function spriteMinY(sprite: Sprite): number {
        return sprite.height / 2;
    }

    // Gets the maximum Y position allowed for a sprite within the tilemap
    function spriteMaxY(sprite: Sprite): number {
        let tilemap4 = game.currentScene().tileMap;
        return tilemap4 ? tilemap4.areaHeight() - sprite.height / 2 : scene.screenHeight();
    }
}
