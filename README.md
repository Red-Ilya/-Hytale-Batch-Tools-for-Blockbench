### 🛠 Technical Specifications / Технические характеристики

#### 1. Hytale Turbo GLB Exporter
| Parameter / Параметр | Value / Значение |
| :--- | :--- |
| **Plugin ID** | `hytale_turbo_exporter` |
| **Version** | 9.5.0 (Stable 2026) |
| **Format** | `.blockymodel` ➔ `.glb` (glTF Binary) |
| **Texture Mode** | Embedded (Base64 Injection) |
| **Optimization** | Canvas Rendering Disabled (Turbo Mode) |
| **Memory Management** | Automatic Project Disposal |

**Features:**
*   **English:** Fixes `map undefined` errors by forcing texture initialization in Three.js buffers before export.
*   **Русский:** Устраняет ошибки `map undefined`, принудительно инициализируя текстуры в буферах Three.js перед экспортом.

---

#### 2. Hytale Batch OBJ Exporter
| Parameter / Параметр | Value / Значение |
| :--- | :--- |
| **Plugin ID** | `hytale_batch_obj_exporter` |
| **Version** | 1.6.0 (Stable 2026) |
| **Format** | `.blockymodel` ➔ `.obj` + `.mtl` |
| **Texture Export** | PNG Extraction (External Files) |
| **Hierarchy** | Full Recursive Folder Preservation |
| **Compatibility** | Blender, Unity, Unreal Engine, Cinema4D |

**Features:**
*   **English:** Automatically reconstructs complex folder structures and extracts internal Base64 textures to standalone PNGs.
*   **Русский:** Автоматически воссоздает сложные структуры папок и извлекает внутренние Base64-текстуры в отдельные PNG-файлы.

---

### 🚀 Usage / Использование

1. **Source Folder**: Select the root directory containing your `.blockymodel` files. The plugin will scan all subfolders.
   *Выбор папки*: Выберите корневой каталог с вашими `.blockymodel`. Плагин просканирует все подпапки.
2. **Output Folder**: Select where you want to save converted assets. 
   *Папка назначения*: Выберите, куда сохранить конвертированные ассеты.
3. **Wait for Success**: A progress bar will appear at the bottom of the Blockbench window. 
   *Ожидание*: Индикатор прогресса появится в нижней части окна Blockbench.
