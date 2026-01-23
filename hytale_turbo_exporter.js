/**
 * Hytale Turbo Exporter v11.3.0 (MAX SPEED)
 *
 * Оптимизации:
 * - Blob Object URL вместо Base64 (мгновенная загрузка текстур)
 * - queueMicrotask вместо RAF (минус 16мс на модель)
 * - Оптимизированные циклы обработки UV
 * - Асинхронный I/O без блокировок
 */

(function () {
  const fs = require('fs').promises;
  const fsSync = require('fs');
  const path = require('path');
  const crypto = require('crypto');

  const PLUGIN_ID = 'hytale_turbo_exporter';
  const TITLE = 'Hytale Turbo Exporter';

  let isProcessing = false;

  function guid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  function getPngSize(buffer) {
    try {
      return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
    } catch (e) {
      return { width: 64, height: 64 };
    }
  }

  function findTexture(files, modelName) {
    const mName = modelName.toLowerCase();
    for (let i = 0; i < files.length; i++) {
      const f = files[i].toLowerCase();
      if (f === mName + '.png' || f.startsWith(mName) && f.endsWith('.png') || f.includes(mName) && f.endsWith('.png')) return files[i];
    }
    return files.find(f => f.toLowerCase().includes('texture') && f.toLowerCase().endsWith('.png'));
  }

  async function walkDir(dir) {
    let res = [];
    const files = await fs.readdir(dir, { withFileTypes: true });
    for (const f of files) {
      const p = path.join(dir, f.name);
      if (f.isDirectory()) res.push(...(await walkDir(p)));
      else if (f.name.endsWith('.blockymodel')) res.push(p);
    }
    return res;
  }

  function applyTextureAndOptionalUVScale(texId, ratioW, ratioH) {
    if (!Cube || !Cube.all) return;
    const needScale = (ratioW !== 1 || ratioH !== 1);
    const cubes = Cube.all;
    for (let i = 0; i < cubes.length; i++) {
      const faces = cubes[i].faces;
      for (const side in faces) {
        const face = faces[side];
        if (!face) continue;
        face.texture = texId;
        if (needScale && face.uv) {
          face.uv[0] *= ratioW; face.uv[2] *= ratioW;
          face.uv[1] *= ratioH; face.uv[3] *= ratioH;
        }
      }
    }
  }

  const escHandler = (e) => {
    if (e.key === 'Escape' && isProcessing) {
      isProcessing = false;
      Blockbench.showQuickMessage('Stopped (ESC)', 2000);
    }
  };

  async function processBatch(sourcePath, outputPath) {
    const hytaleCodec = Codecs.hytale || Codecs.hytale_model || Codecs.blockymodel;
    const gltfCodec = Codecs.gltf;
    if (!hytaleCodec || !gltfCodec) return Blockbench.showQuickMessage('Codec Error!', 3000);

    const allFiles = await walkDir(sourcePath);
    if (!allFiles.length) return Blockbench.showQuickMessage('No models found!', 3000);

    isProcessing = true;
    window.addEventListener('keydown', escHandler);
    let currentIndex = 0;

    async function next() {
      if (!isProcessing || currentIndex >= allFiles.length) {
        isProcessing = false;
        window.removeEventListener('keydown', escHandler);
        Blockbench.setProgress(0);
        if (currentIndex >= allFiles.length) Blockbench.showMessageBox({ title: 'Done', message: `Exported: ${currentIndex}` });
        return;
      }

      const filePath = allFiles[currentIndex];
      const modelName = path.basename(filePath, '.blockymodel');
      const dirname = path.dirname(filePath);

      try {
        if (typeof Project !== 'undefined') Project.close();

        const dirFiles = await fs.readdir(dirname);
        const texFile = findTexture(dirFiles, modelName);

        const [modelContent, texBuffer] = await Promise.all([
          fs.readFile(filePath, 'utf-8'),
          texFile ? fs.readFile(path.join(dirname, texFile)) : null
        ]);

        hytaleCodec.load(JSON.parse(modelContent), filePath);

        if (texBuffer) {
          const size = getPngSize(texBuffer);
          Project.texture_width = size.width;
          Project.texture_height = size.height;
          Project.box_uv = false;

          // Удаление старых текстур
          if (Project.textures.length) Project.textures.forEach(t => t.remove());
          Project.textures.length = 0;

          const blob = new Blob([texBuffer], { type: 'image/png' });
          const objUrl = URL.createObjectURL(blob);
          
          const tex = new Texture({ name: texFile, width: size.width, height: size.height }).add(false);
          tex.uuid = tex.id = guid();

          await new Promise(resolve => {
            tex.fromDataURL(objUrl, () => {
              applyTextureAndOptionalUVScale(tex.id, size.width / 64, size.height / 64);
              URL.revokeObjectURL(objUrl); // Чистим память сразу
              resolve();
            });
            setTimeout(resolve, 40); // Ускоренный failsafe
          });
        }

        gltfCodec.textureCache = {}; 
        // Микротаск вместо RAF для скорости
        await new Promise(resolve => queueMicrotask(resolve));

        const result = await gltfCodec.compile({ resource_mode: 'embed', binary: true, include_animations: false });
        
        if (result && isProcessing) {
          const targetDir = path.join(outputPath, path.relative(sourcePath, dirname));
          if (!fsSync.existsSync(targetDir)) await fs.mkdir(targetDir, { recursive: true });
          await fs.writeFile(path.join(targetDir, modelName + '.glb'), Buffer.from(result));
        }
      } catch (err) {
        console.error(err);
      } finally {
        currentIndex++;
        Blockbench.setProgress(currentIndex / allFiles.length);
        next();
      }
    }
    next();
  }

  BBPlugin.register(PLUGIN_ID, {
    title: TITLE,
    author: 'Blockbench Assistant',
    version: '11.3.0',
    icon: 'speed',
    description: 'MAX-SPEED Hytale to GLB exporter. UV fix, Blob URL, no delays.',
    category: 'tools',
    onload() {
      this.action = new Action('hytale_turbo_export_action', {
        name: 'Hytale Turbo Export (MAX SPEED)',
        icon: 'speed',
        category: 'tools',
        click: () => {
          new Dialog({
            title: 'Hytale Turbo Export v11.3.0',
            id: 'hytale_turbo_dialog',
            form: {
              source: { label: 'Source (Models)', type: 'folder', value: localStorage.getItem('h_src') || '' },
              output: { label: 'Output (GLB)', type: 'folder', value: localStorage.getItem('h_out') || '' }
            },
            onConfirm: (data) => {
              localStorage.setItem('h_src', data.source);
              localStorage.setItem('h_out', data.output);
              processBatch(data.source, data.output);
            }
          }).show();
        }
      });
      MenuBar.addAction(this.action, 'tools');
    },
    onunload() {
      isProcessing = false;
      window.removeEventListener('keydown', escHandler);
      this.action?.delete();
    }
  });
})();
