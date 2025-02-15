### **Sprite Walls Engine**  

**Sprite Walls Engine** is a MakeCode Arcade extension that provides improved sprite collisions using hitboxes instead of relying on default sprite bounds. This prevents sprites from passing through walls and enables accurate collision detection.  

---

### **Important Notes**  
- Sprites must be at least **4x4 pixels** wide for collisions to work correctly.  
- Collision is handled using **custom hitboxes**, independent of the sprite's built-in bounding box.  

---

### **Installation**  
1. Open [MakeCode Arcade](https://arcade.makecode.com/) and create a new project.  
2. Click **"Extensions" → "Advanced → Extensions"**.  
3. Paste this link in the search bar and press Enter:  
```
https://github.com/Sonicblaston62/Sprite-Walls-Engine
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
- Accurate **hitbox-based** collision detection.  
- Prevents sprites from **phasing through walls**.  
- Supports **pushable objects**.  
- Works for **any sprite size (minimum 4x4 pixels)**.  

---

### **Limitations**  
- Sprites smaller than **4x4 pixels** WONT WORK.  
- Does not currently support **moving platforms or slopes**.  

---

### **License & Contributions**  
Released under the **MIT License**, allowing free use and modification. Contributions are welcome—fork the repository, make changes in `custom.ts`, and submit a pull request.  

For issues or feedback, visit the [GitHub Issues](https://github.com/Sonicblaston62/Sprite-Walls-Engine/issues) page.
