### **Sprite Walls** 

Sprite Walls is a MakeCode Arcade extension that lets your sprites act like walls. Your player stops when it bumps into them instead of walking right through. You can also make sprites that can be pushed around, like boxes.

### **Important Notes**  
- Sprites must be at least 4x4 pixels wide for collisions to work correctly.  
---

### **Installation**  
1. Open [MakeCode Arcade](https://arcade.makecode.com/) and create a new project.  
2. In the block list on the left, press extensions. You can also click the gear icon ⚙️ in the top right and choose Extensions.
3. Paste this link in the search bar and press Enter: 
```
github.com/Sonicblaston62/Sprite-Walls
```
4. Select the extension and click **"Add"**.  

---

### **Usage**  
#### **Solid Collisions**  
Stops a sprite when it collides with a specified object or wall.  
```typescript
CollisionHandler.handleSolidCollision(mySprite, SpriteKind.Player)
```
#### **Pushable Objects**  
Allows a sprite to push another object when colliding.  
```typescript
CollisionHandler.handlePushableCollision(mySprite, SpriteKind.Player, CollisionHandler.PushDirection.Omnidirectional)
```
---

### **Features**  
- Accurate collision detection.  
- Prevents sprites from phasing through walls.  
- Supports pushable objects.  
- Works for spritesizes 4x4 pixels and up.  

---

### **License & Contributions**  
Released under the **MIT License**, allowing free use and modification. Contributions are welcome—fork the repository, make changes in `main.ts`, and submit a pull request.  

For issues or feedback, visit the [GitHub Issues](https://github.com/Sonicblaston62/Sprite-Walls/issues) page.
