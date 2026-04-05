import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.158/build/three.module.js";
import { scene } from "./scene.js";

export class AI {
  constructor(x, color) {
    this.mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1,2,1),
      new THREE.MeshStandardMaterial({ color })
    );
    this.mesh.position.x = x;
    scene.add(this.mesh);

    this.health = 100;
  }

  update(player) {
    // Follow player
    if (this.mesh.position.x > player.mesh.position.x)
      this.mesh.position.x -= 0.05;
    else
      this.mesh.position.x += 0.05;

    // Attack
    if (this.mesh.position.distanceTo(player.mesh.position) < 2) {
      if (Math.random() < 0.02) {
        player.health -= 0.3;
      }
    }
  }
}