import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.158/build/three.module.js";
import { scene } from "./scene.js";

export class Player {
  constructor(x, color) {
    this.mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1,2,1),
      new THREE.MeshStandardMaterial({ color })
    );
    this.mesh.position.x = x;
    scene.add(this.mesh);

    this.speed = 0.1;
    this.health = 100;
  }

  update(enemy) {
    if (keys["a"]) this.mesh.position.x -= this.speed;
    if (keys["d"]) this.mesh.position.x += this.speed;

    // Punch
    if (keys["j"] && this.distance(enemy) < 2) {
      enemy.health -= 0.5;
      this.mesh.scale.x = 1.2; // punch animation
    } else {
      this.mesh.scale.x = 1;
    }
  }

  distance(enemy) {
    return this.mesh.position.distanceTo(enemy.mesh.position);
  }
}

let keys = {};
window.addEventListener("keydown", e => keys[e.key] = true);
window.addEventListener("keyup", e => keys[e.key] = false);