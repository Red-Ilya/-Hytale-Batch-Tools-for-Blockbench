# -Hytale-Batch-Tools-for-Blockbench
English
A collection of high-performance plugins for Blockbench (2026+), specifically designed for mass-processing Hytale assets (.blockymodel). These tools solve common automation issues like texture embedding and memory management.
📦 Included Plugins
1. Hytale Turbo Exporter (hytale_turbo_exporter.js)
Purpose: Ultra-fast batch conversion from .blockymodel to .glb.
Turbo Mode: Disables 3D rendering during process to achieve maximum speed.
Texture Fix: Prevents "map undefined" errors by direct memory injection of textures.
GLB Embedding: Textures are packed directly into the binary file.
2. Hytale Batch OBJ Exporter (hytale_batch_obj_exporter.js)
Purpose: Batch conversion from .blockymodel to .obj + .mtl.
Hierarchy Preservation: Keeps your source folder structure in the output directory.
Texture Extraction: Automatically saves embedded Base64 textures as standalone .png files.
Compatibility: Optimized for Blender, Unity, and Unreal Engine workflows.
🛠 Installation
Download the .js files from this repository.
Open Blockbench.
Go to File > Plugins...
Click on the Load Plugin from File icon (top folder icon).
Select the downloaded scripts.
Русский
Коллекция высокопроизводительных плагинов для Blockbench (актуально для 2026 года), специально разработанных для массовой обработки ассетов Hytale (.blockymodel). Эти инструменты решают типичные проблемы автоматизации, такие как вшивание текстур и управление памятью.
📦 Состав репозитория
1. Hytale Turbo Exporter (hytale_turbo_exporter.js)
Назначение: Ультра-быстрая пакетная конвертация из .blockymodel в .glb.
Турбо-режим: Отключает 3D-рендеринг во время работы для достижения максимальной скорости.
Фикс текстур: Предотвращает ошибки "map undefined" через прямое внедрение текстур в память.
Вшивание GLB: Текстуры упаковываются прямо в бинарный файл.
2. Hytale Batch OBJ Exporter (hytale_batch_obj_exporter.js)
Назначение: Пакетная конвертация из .blockymodel в формат .obj + .mtl.
Сохранение иерархии: Полностью воссоздает структуру исходных папок в папке назначения.
Извлечение текстур: Автоматически сохраняет вшитые Base64 текстуры как отдельные .png файлы.
Совместимость: Оптимизировано для работы в Blender, Unity и Unreal Engine.
🛠 Установка
Скачайте .js файлы из этого репозитория.
Откройте Blockbench.
Перейдите в Файл > Плагины... (File > Plugins).
Нажмите на иконку Загрузить плагин из файла (иконка папки в верхней части окна).
