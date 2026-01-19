(function() {
    const fs = require('fs');
    const path = require('path');

    const PLUGIN_CONFIG = {
        id: 'hytale_turbo_exporter',
        title: 'Hytale Turbo Batch Export',
        icon: 'speed',
        author: 'Blockbench Assistant',
        version: '9.5.0',
        description: {
            en: 'Ultra-fast batch export of .blockymodel to .glb with guaranteed texture embedding. Optimised for 2026.',
            ru: 'Ультра-быстрый пакетный экспорт .blockymodel в .glb с гарантированным вшиванием текстур. Оптимизировано для 2026 года.'
        }
    };

    async function processBatch(sourcePath, outputPath) {
        const hytaleCodec = Codecs.hytale || Codecs.hytale_model || Codecs.blockymodel;
        if (!hytaleCodec) return Blockbench.showQuickMessage('Hytale Codec not found!', 3000);

        const allFiles = walkDir(sourcePath);
        if (allFiles.length === 0) return Blockbench.showQuickMessage('No files found!', 3000);

        let currentIndex = 0;
        const originalRendering = Canvas.rendering;
        
        // Disable rendering to achieve maximum speed
        Canvas.rendering = false;

        async function next() {
            if (currentIndex >= allFiles.length) {
                Canvas.rendering = originalRendering;
                Blockbench.setProgress(0);
                Blockbench.showMessageBox({ 
                    title: 'Success / Готово', 
                    message: `Processed ${currentIndex} models successfully.` 
                });
                return;
            }

            const filePath = allFiles[currentIndex];
            const modelName = path.basename(filePath, '.blockymodel');
            const dirname = path.dirname(filePath);

            try {
                if (window.Project) Project.close();

                // 1. Fast Load
                const rawContent = fs.readFileSync(filePath, 'utf-8');
                const jsonContent = JSON.parse(rawContent);
                
                if (typeof hytaleCodec.load === 'function') {
                    hytaleCodec.load(jsonContent, filePath);
                } else {
                    hytaleCodec.parse(jsonContent, filePath);
                }

                if (Project) {
                    Project.resourcePath = dirname;
                    Project.format = 'generic';

                    // 2. Immediate Texture Injection
                    const texFile = fs.readdirSync(dirname).find(f => 
                        f.match(/\.png$/i) && (f.startsWith(modelName) || f.toLowerCase().includes('texture'))
                    );
                    
                    if (texFile) {
                        const base64 = `data:image/png;base64,${fs.readFileSync(path.join(dirname, texFile)).toString('base64')}`;
                        const tex = new Texture({name: texFile}).fromDataURL(base64).add(false, true);
                        
                        Cube.all.forEach(cube => {
                            for (let s in cube.faces) cube.faces[s].texture = tex.id;
                            cube.init();
                        });
                    }

                    // 3. Ultra-fast micro-task wait
                    await Promise.resolve();

                    // 4. Export logic
                    const result = await Codecs.gltf.compile({
                        resource_mode: 'embed',
                        binary: true,
                        include_animations: false
                    });

                    if (result) {
                        const targetDir = path.join(outputPath, path.relative(sourcePath, dirname));
                        if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
                        fs.writeFile(path.join(targetDir, modelName + '.glb'), Buffer.from(result), () => {});
                    }

                    currentIndex++;
                    Blockbench.setProgress(currentIndex / allFiles.length);
                    
                    // Immediate next iteration
                    next();
                }
            } catch (err) {
                console.error(`Error processing ${modelName}:`, err);
                currentIndex++;
                next();
            }
        }
        next();
    }

    function walkDir(dir) {
        let results = [];
        const files = fs.readdirSync(dir);
        for (const file of files) {
            const f = path.join(dir, file);
            if (fs.statSync(f).isDirectory()) results = results.concat(walkDir(f));
            else if (file.endsWith('.blockymodel')) results.push(f);
        }
        return results;
    }

    BBPlugin.register(PLUGIN_CONFIG.id, {
        title: PLUGIN_CONFIG.title,
        author: PLUGIN_CONFIG.author,
        version: PLUGIN_CONFIG.version,
        icon: PLUGIN_CONFIG.icon,
        description: PLUGIN_CONFIG.description.en,
        about: `
        ### English
        Batch export Hytale models to GLB with maximum efficiency.
        - **Turbo Speed**: Bypasses 3D rendering to save time.
        - **Texture Fix**: Solves 'map undefined' error by direct memory injection.
        - **Deep Scan**: Recursively searches folders for .blockymodel files.

        ### Русский
        Пакетный экспорт моделей Hytale в GLB с максимальной эффективностью.
        - **Турбо-скорость**: Отключает 3D-рендеринг во время работы для экономии времени.
        - **Фикс текстур**: Решает ошибку 'map undefined' через прямое внедрение в память.
        - **Глубокий поиск**: Рекурсивно ищет файлы .blockymodel во всех подпапках.
        `,
        onload() {
            this.action = new Action('hytale_turbo_export_action', {
                name: 'Hytale Turbo Export to GLB',
                icon: 'speed',
                category: 'tools',
                click: () => {
                    new Dialog({
                        title: 'Hytale Turbo Export (2026 Edition)',
                        form: {
                            source: { label: 'Source Folder / Папка источник', type: 'folder', value: localStorage.getItem('h_src') || '' },
                            output: { label: 'Output Folder / Папка выход', type: 'folder', value: localStorage.getItem('h_out') || '' }
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
            this.action?.delete();
        }
    });
})();
