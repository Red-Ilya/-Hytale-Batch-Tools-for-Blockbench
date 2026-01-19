/**
 * Hytale Batch OBJ Exporter v11.0.0
 * 
 * RU: Профессиональный инструмент для пакетного экспорта моделей Hytale (.blockymodel) в формат OBJ + MTL.
 * Особенности:
 * - UV Fix: Исправлено смещение и искажение UV при неквадратных текстурах (64x32 и др.).
 * - Auto-MTL: Автоматическая генерация файлов материалов и сохранение PNG.
 * - Ultra-Speed: Бинарный парсинг PNG и RAF-синхронизация для быстрой работы.
 * - Structure: Сохранение иерархии папок при экспорте.
 * 
 * EN: Professional tool for batch exporting Hytale models (.blockymodel) to OBJ + MTL format.
 * Features:
 * - UV Fix: Fixed UV shifting/distortion for non-square textures (64x32, etc.).
 * - Auto-MTL: Automatic material generation and PNG extraction.
 * - Ultra-Speed: Binary PNG parsing and RAF sync for high performance.
 * - Structure: Maintains full directory nesting during export.
 * 
 * @author Blockbench Assistant
 * @version 11.0.0
 */

(function () {
  const fs = require('fs').promises;
  const fsSync = require('fs');
  const path = require('path');
  const crypto = require('crypto');

  const PLUGIN_ID = 'hytale_batch_obj_exporter';
  const TITLE = 'Hytale Batch OBJ Exporter';

  function guid() { return crypto.randomUUID(); }

  /**
   * Быстрое извлечение размеров PNG из бинарного заголовка
   */
  function getPngSize(buffer) {
    try {
      return {
        width: buffer.readInt32BE(16),
        height: buffer.readInt32BE(20)
      };
    } catch (e) {
      return { width: 64, height: 64 };
    }
  }

  /**
   * Поиск текстуры по имени модели
   */
  function findTexture(files, modelName) {
    const mName = modelName.toLowerCase();
    return files.find(f => f.toLowerCase() === mName + '.png') ||
           files.find(f => f.toLowerCase().startsWith(mName) && f.toLowerCase().endsWith('.png')) ||
           files.find(f => f.toLowerCase().includes('texture') && f.toLowerCase().endsWith('.png'));
  }

  /**
   * Рекурсивный поиск файлов
   */
  function walkDir(dir) {
    const res = [];
    if (!fsSync.existsSync(dir)) return res;
    fsSync.readdirSync(dir).forEach(f => {
      let p = path.join(dir, f);
      if (fsSync.statSync(p).isDirectory()) res.push(...walkDir(p));
      else if (f.endsWith('.blockymodel')) res.push(p);
    });
    return res;
  }

  async function processBatch(sourcePath, outputPath) {
    const hytaleCodec = Codecs.hytale || Codecs.hytale_model || Codecs.blockymodel;
    if (!hytaleCodec) {
      Blockbench.showQuickMessage('Error: Hytale Codec missing!', 3500);
      return;
    }

    const allFiles = walkDir(sourcePath);
    if (allFiles.length === 0) {
      Blockbench.showQuickMessage('No .blockymodel files found!', 3500);
      return;
    }

    let currentIndex = 0;

    async function next() {
      if (currentIndex >= allFiles.length) {
        Blockbench.setProgress(0);
        Blockbench.showMessageBox({
          title: 'Готово / Success',
          message: `Экспортировано моделей в OBJ: ${currentIndex}\nModels exported to OBJ: ${currentIndex}`
        });
        return;
      }

      const filePath = allFiles[currentIndex];
      const modelName = path.basename(filePath, '.blockymodel');
      const dirname = path.dirname(filePath);

      try {
        if (typeof Project !== 'undefined' && Project) Project.close();

        // 1. Асинхронная подготовка текстуры
        const dirFiles = fsSync.readdirSync(dirname);
        const texFile = findTexture(dirFiles, modelName);
        let realWidth = 64, realHeight = 64, base64 = "", buffer = null;

        if (texFile) {
          const texPath = path.join(dirname, texFile);
          buffer = await fs.readFile(texPath);
          const size = getPngSize(buffer);
          realWidth = size.width;
          realHeight = size.height;
          base64 = `data:image/png;base64,${buffer.toString('base64')}`;
        }

        // 2. Загрузка модели
        const modelContent = await fs.readFile(filePath, 'utf-8');
        hytaleCodec.load(JSON.parse(modelContent), filePath);

        // 3. Синхронизация размеров и исправление UV
        Project.texture_width = realWidth;
        Project.texture_height = realHeight;
        Project.box_uv = false;

        if (base64) {
          Project.textures.forEach(t => t.remove());
          Project.textures = [];
          
          const tex = new Texture({ name: texFile }).add(false);
          tex.fromDataURL(base64);
          tex.width = realWidth;
          tex.height = realHeight;
          tex.uuid = guid();
          tex.id = tex.uuid;

          Cube.all.forEach(cube => {
            for (let side in cube.faces) {
              cube.faces[side].texture = tex.id;
            }
            if (cube.updateUV) cube.updateUV(); // Масштабирование UV под реальный размер
          });
        }

        // Переключение в generic для корректной работы OBJ кодека
        Project.format = 'generic';
        Canvas.updateAll();

        // 4. Отрисовка и экспорт (RAF синхронизация)
        requestAnimationFrame(() => {
          requestAnimationFrame(async () => {
            try {
              const result = Codecs.obj.compile();
              const obj_data = typeof result === 'object' ? result.obj : result;
              const mtl_data = typeof result === 'object' ? result.mtl : "";

              if (obj_data) {
                const relativePath = path.relative(sourcePath, dirname);
                const targetDir = path.join(outputPath, relativePath);
                if (!fsSync.existsSync(targetDir)) fsSync.mkdirSync(targetDir, { recursive: true });

                // Сохранение файлов
                await fs.writeFile(path.join(targetDir, `${modelName}.obj`), obj_data);
                if (mtl_data) await fs.writeFile(path.join(targetDir, `${modelName}.mtl`), mtl_data);
                if (buffer && texFile) await fs.writeFile(path.join(targetDir, texFile), buffer);
              }
            } catch (e) { console.error(`Export error: ${modelName}`, e); }

            currentIndex++;
            Blockbench.setProgress(currentIndex / allFiles.length);
            next();
          });
        });

      } catch (err) {
        console.error(`Error processing ${modelName}:`, err);
        currentIndex++;
        next();
      }
    }

    next();
  }

  BBPlugin.register(PLUGIN_ID, {
    title: TITLE,
    author: 'Blockbench Assistant',
    version: '11.0.0',
    icon: 'archive',
    description: 'Ultra-fast batch export Hytale models to OBJ with UV-Aspect correction.',
    about: 'RU: Массовый экспорт моделей Hytale в OBJ + MTL с исправлением искажений UV-координат.\nEN: Batch export Hytale models to OBJ + MTL with UV aspect ratio fix.',
    category: 'tools',
    onload() {
      this.action = new Action('hytale_batch_export_obj', {
        name: 'Hytale Batch Export to OBJ',
        icon: 'publish',
        category: 'tools',
        click: () => {
          new Dialog({
            title: 'Hytale Batch OBJ Export v11.0',
            id: 'hytale_obj_dialog',
            form: {
              source: { 
                label: 'Source Folder (Models) / Папка с моделями', 
                type: 'folder', 
                value: localStorage.getItem('h_obj_src') || '' 
              },
              output: { 
                label: 'Output Folder (OBJ) / Папка для экспорта', 
                type: 'folder', 
                value: localStorage.getItem('h_obj_out') || '' 
              },
            },
            onConfirm: (data) => {
              localStorage.setItem('h_obj_src', data.source);
              localStorage.setItem('h_obj_out', data.output);
              processBatch(data.source, data.output);
            },
          }).show();
        },
      });
      MenuBar.addAction(this.action, 'tools');
    },
    onunload() {
      this.action?.delete();
    }
  });
})();
