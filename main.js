import { initScene, scene, camera, renderer } from "./scene.js";
import { Player } from "./player.js";
import { AI } from "./ai.js";

initScene();

const player = new Player(-2, 0x00ffff);
const enemy = new AI(2, 0xff4444);

function animate() {
  requestAnimationFrame(animate);

  player.update(enemy);
  enemy.update(player);

  renderer.render(scene, camera);
}

animate();