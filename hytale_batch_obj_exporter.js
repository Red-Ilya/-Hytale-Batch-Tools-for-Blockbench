/**
 * Hytale Batch OBJ Exporter v1.6.0
 * Optimized for Blockbench 2026
 */

(function() {
    const PLUGIN_CONFIG = {
        id: 'hytale_batch_obj_exporter',
        title: 'Hytale Batch OBJ Exporter',
        icon: 'archive',
        author: 'Blockbench Assistant',
        version: '1.6.0',
        description: 'Batch export .blockymodel to OBJ + MTL with textures. / Пакетный экспорт в OBJ + MTL с текстурами.',
    };

    let exportAction;

    BBPlugin.register(PLUGIN_CONFIG.id, {
        title: PLUGIN_CONFIG.title,
        author: PLUGIN_CONFIG.author,
        variant: 'desktop',
        version: PLUGIN_CONFIG.version,
        icon: PLUGIN_CONFIG.icon,
        description: PLUGIN_CONFIG.description,
        about: 
            "## English\n" +
            "This plugin allows you to mass-convert Hytale models (.blockymodel) into OBJ format.\n" +
            "*   **Preserves Folder Structure**: Recreates your subfolders in the output directory.\n" +
            "*   **Texture Extraction**: Automatically saves embedded Base64 textures as PNG files.\n" +
            "*   **Memory Optimized**: Closes projects after each file to prevent crashes in 2026.\n\n" +
            "## Русский\n" +
            "Этот плагин позволяет массово конвертировать модели Hytale (.blockymodel) в формат OBJ.\n" +
            "*   **Сохранение структуры**: Воссоздает ваши подпапки в папке назначения.\n" +
            "*   **Извлечение текстур**: Автоматически сохраняет вшитые Base64 текстуры в формате PNG.\n" +
            "*   **Оптимизация памяти**: Закрывает проекты после каждого файла для стабильной работы в 2026 году.",
        
        onload() {
            exportAction = new Action('hytale_batch_export_obj', {
                name: 'Hytale Batch Export to OBJ',
                icon: 'publish',
                category: 'tools',
                click: () => showExportDialog()
            });
            MenuBar.addAction(exportAction, 'tools');
        },
        onunload() {
            if (exportAction) exportAction.delete();
        }
    });

    function showExportDialog() {
        const dialog = new Dialog({
            id: 'batch_export_dialog',
            title: 'Hytale Batch OBJ Export (2026 Update)',
            form: {
                source: { 
                    label: 'Source Folder (Models) / Папка с моделями', 
                    type: 'folder', 
                    value: localStorage.getItem('h_batch_src') || '' 
                },
                output: { 
                    label: 'Output Folder (OBJ) / Папка для экспорта', 
                    type: 'folder', 
                    value: localStorage.getItem('h_batch_out') || '' 
                }
            },
            onConfirm: (data) => {
                if (!data.source || !data.output) {
                    Blockbench.showQuickMessage('Please select both folders!', 3000);
                    return;
                }
                localStorage.setItem('h_batch_src', data.source);
                localStorage.setItem('h_batch_out', data.output);
                processBatch(data.source, data.output);
            }
        });
        dialog.show();
    }

    async function processBatch(sourcePath, outputPath) {
        const fs = require('fs');
        const path = require('path');

        const hytaleCodec = Codecs.hytale || Codecs.hytale_model || Codecs.blockymodel;
        if (!hytaleCodec) {
            Blockbench.showMessageBox({
                title: 'Error / Ошибка',
                message: 'Hytale plugin not found! / Плагин Hytale не найден!'
            });
            return;
        }

        function walkDir(dir) {
            let results = [];
            fs.readdirSync(dir).forEach(file => {
                const f = path.join(dir, file);
                if (fs.statSync(f).isDirectory()) results = results.concat(walkDir(f));
                else if (file.endsWith('.blockymodel')) results.push(f);
            });
            return results;
        }

        const allFiles = walkDir(sourcePath);
        if (allFiles.length === 0) {
            Blockbench.showQuickMessage('No .blockymodel files found!', 3000);
            return;
        }

        let exportedCount = 0;
        Blockbench.setProgress(0.01);

        for (let i = 0; i < allFiles.length; i++) {
            const filePath = allFiles[i];
            try {
                const content = fs.readFileSync(filePath, 'utf-8');
                if (window.Project) Project.close();

                let formatId = (hytaleCodec.format && hytaleCodec.format.id) || 'generic';
                new ModelProject({ 
                    format: formatId,
                    name: path.basename(filePath, '.blockymodel')
                }).select();

                hytaleCodec.parse(JSON.parse(content), filePath);

                if (Project) {
                    Project.format = 'generic';
                    const relativePath = path.relative(sourcePath, path.dirname(filePath));
                    const targetDir = path.join(outputPath, relativePath);
                    
                    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

                    const fileName = path.basename(filePath, '.blockymodel');

                    // Texture Processing
                    Project.textures.forEach(tex => {
                        try {
                            let texName = tex.name || 'texture.png';
                            if (!texName.includes('.')) texName += '.png';
                            const targetTexPath = path.join(targetDir, texName);
                            
                            if (tex.path && fs.existsSync(tex.path)) {
                                fs.copyFileSync(tex.path, targetTexPath);
                            } else if (tex.source) {
                                const base64Data = tex.source.replace(/^data:image\/\w+;base64,/, "");
                                fs.writeFileSync(targetTexPath, base64Data, 'base64');
                            }
                        } catch (e) { console.error(e); }
                    });

                    // OBJ Export
                    const result = Codecs.obj.compile();
                    const obj_data = typeof result === 'object' ? result.obj : result;
                    const mtl_data = typeof result === 'object' ? result.mtl : "";

                    fs.writeFileSync(path.join(targetDir, `${fileName}.obj`), obj_data);
                    if (mtl_data) fs.writeFileSync(path.join(targetDir, `${fileName}.mtl`), mtl_data);

                    Project.saved = true;
                    Project.close();
                    exportedCount++;
                }
            } catch (err) {
                console.error(`Error processing ${filePath}:`, err);
            }
            Blockbench.setProgress((i + 1) / allFiles.length);
        }

        Blockbench.setProgress(0);
        Blockbench.showMessageBox({
            title: 'Success / Готово',
            message: `Successfully exported ${exportedCount} models.\nУспешно экспортировано ${exportedCount} моделей.`
        });
    }
})();
