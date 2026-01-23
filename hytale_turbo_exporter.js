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
    return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
      (c ^ crypto.randomBytes(1)[0] & 15 >> c / 4).toString(16)
    );
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
    return (
      files.find(f => f.toLowerCase() === mName + '.png') ||
      files.find(f => f.toLowerCase().startsWith(mName) && f.toLowerCase().endsWith('.png')) ||
      files.find(f => f.toLowerCase().includes(mName) && f.toLowerCase().endsWith('.png')) ||
      files.find(f => f.toLowerCase().includes('texture') && f.toLowerCase().endsWith('.png'))
    );
  }

  async function walkDir(dir) {
    let res = [];
    const files = await fs.readdir(dir, { withFileTypes: true });
    for (const f of files) {
      const p = path.join(dir, f.name);
      if (f.isDirectory()) {
        const sub = await walkDir(p);
        res.push(...sub);
      } else if (f.name.endsWith('.blockymodel')) {
        res.push(p);
      }
    }
    return res;
  }

  function applyTextureAndOptionalUVScale(texId, ratioW, ratioH) {
    if (!Cube || !Cube.all) return;
    const needScale = (ratioW !== 1 || ratioH !== 1);
    Cube.all.forEach(cube => {
      if (!cube || !cube.faces) return;
      for (const side in cube.faces) {
        const face = cube.faces[side];
        if (!face) continue;
        face.texture = texId;
        if (needScale && face.uv && Array.isArray(face.uv) && face.uv.length === 4) {
          face.uv[0] *= ratioW;
          face.uv[2] *= ratioW;
          face.uv[1] *= ratioH;
          face.uv[3] *= ratioH;
        }
      }
    });
  }

  const escHandler = (e) => {
    if (e.key === 'Escape' && isProcessing) {
      isProcessing = false;
      Blockbench.showQuickMessage('Остановлено (ESC)', 2500);
      Blockbench.setProgress(0);
    }
  };

  async function loadTextureFast(texFilePath, texFileName) {
    const buffer = await fs.readFile(texFilePath);
    const size = getPngSize(buffer);
    return {
      name: texFileName,
      buffer,
      width: size.width || 64,
      height: size.height || 64
    };
  }

  async function processBatch(sourcePath, outputPath) {
    const hytaleCodec = Codecs.hytale || Codecs.hytale_model || Codecs.blockymodel;
    const gltfCodec = Codecs.gltf;
    
    if (!hytaleCodec || !gltfCodec) {
      Blockbench.showQuickMessage('Error: Codecs not found!', 3500);
      return;
    }

    const allFiles = await walkDir(sourcePath);
    if (allFiles.length === 0) {
      Blockbench.showQuickMessage('No .blockymodel files found!', 3500);
      return;
    }

    isProcessing = true;
    window.addEventListener('keydown', escHandler);
    let currentIndex = 0;

    async function next() {
      if (!isProcessing) {
        window.removeEventListener('keydown', escHandler);
        Blockbench.setProgress(0);
        return;
      }

      if (currentIndex >= allFiles.length) {
        isProcessing = false;
        window.removeEventListener('keydown', escHandler);
        Blockbench.setProgress(0);
        Blockbench.showMessageBox({ title: TITLE, message: `Готово! Обработано: ${currentIndex}` });
        return;
      }

      const filePath = allFiles[currentIndex];
      const modelName = path.basename(filePath, '.blockymodel');
      const dirname = path.dirname(filePath);

      try {
        if (typeof Project !== 'undefined' && Project) Project.close();

        const dirFiles = await fs.readdir(dirname);
        const texFile = findTexture(dirFiles, modelName);

        const modelRead = fs.readFile(filePath, 'utf-8');
        const texRead = texFile ? loadTextureFast(path.join(dirname, texFile), texFile) : Promise.resolve(null);

        const [modelContent, texData] = await Promise.all([modelRead, texRead]);
        if (!isProcessing) return next();

        hytaleCodec.load(JSON.parse(modelContent), filePath);

        if (texData) {
          Project.texture_width = texData.width;
          Project.texture_height = texData.height;
          Project.box_uv = false;

          const tex = new Texture({ name: texData.name, width: texData.width, height: texData.height }).add(false);
          tex.id = tex.uuid = guid();

          await new Promise((resolve) => {
            const dataUrl = `data:image/png;base64,${texData.buffer.toString('base64')}`;
            tex.fromDataURL(dataUrl, () => {
              applyTextureAndOptionalUVScale(tex.id, texData.width / 64, texData.height / 64);
              resolve();
            });
            setTimeout(resolve, 1); // Уменьшено с 80 до 1мс
          });
        }

        if (!isProcessing) return next();
        gltfCodec.textureCache = {};

        // Экспорт
        let result = await gltfCodec.compile({ resource_mode: 'embed', binary: true, include_animations: false });

        if (result && isProcessing) {
          const relativePath = path.relative(sourcePath, dirname);
          const targetDir = path.join(outputPath, relativePath);
          if (!fsSync.existsSync(targetDir)) await fs.mkdir(targetDir, { recursive: true });
          await fs.writeFile(path.join(targetDir, modelName + '.glb'), Buffer.from(result));
        }
      } catch (err) {
        console.error(`Error: ${modelName}`, err);
      } finally {
        currentIndex++;
        if (currentIndex % 5 === 0) Blockbench.setProgress(currentIndex / allFiles.length);
        
        // Используем setImmediate-подобное поведение для отзывчивости, но без задержек
        if (currentIndex % 10 === 0) {
            setTimeout(next, 0);
        } else {
            next();
        }
      }
    }
    next();
  }

  BBPlugin.register(PLUGIN_ID, {
    title: TITLE,
    author: 'Blockbench Assistant',
    version: '11.2.1',
    icon: 'speed',
    description: 'Ultra-fast Hytale to GLB exporter.',
    category: 'tools',
    onload() {
      this.action = new Action('hytale_turbo_export_action', {
        name: 'Hytale Turbo Export to GLB',
        icon: 'speed',
        click: () => {
          new Dialog({
            title: TITLE,
            id: 'hytale_turbo_dialog',
            form: {
              source: { label: 'Source', type: 'folder', value: localStorage.getItem('h_src') || '' },
              output: { label: 'Output', type: 'folder', value: localStorage.getItem('h_out') || '' }
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
      this.action?.delete();
    }
  });
})();
