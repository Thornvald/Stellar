#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager, State};

// Types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectConfig {
    pub name: String,
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub projects: Vec<ProjectConfig>,
    #[serde(rename = "unrealEnginePath")]
    pub unreal_engine_path: Option<String>,
}

impl Default for Config {
    fn default() -> Self {
        Config {
            projects: vec![],
            unreal_engine_path: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EngineInstall {
    pub id: String,
    pub name: String,
    pub path: String,
    pub version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BuildStatus {
    pub status: String, // "idle" | "running" | "success" | "error" | "cancelled"
    pub code: Option<i32>,
    pub error: Option<String>,
    #[serde(rename = "startedAt")]
    pub started_at: Option<String>,
    #[serde(rename = "finishedAt")]
    pub finished_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BuildLogsResponse {
    pub lines: Vec<String>,
    #[serde(rename = "nextIndex")]
    pub next_index: usize,
    pub finished: bool,
}

#[derive(Debug, Clone, Serialize)]
struct BuildLogPayload {
    #[serde(rename = "buildId")]
    build_id: String,
    line: String,
}

// Build state management
struct BuildProcess {
    child: Option<Child>,
    status: BuildStatus,
    logs: Arc<Mutex<Vec<String>>>,
}

struct AppState {
    builds: Mutex<HashMap<String, BuildProcess>>,
}

// Helper functions
fn get_config_path(app: &AppHandle) -> PathBuf {
    let config_dir = app
        .path()
        .app_config_dir()
        .unwrap_or_else(|_| PathBuf::from("."));
    config_dir.join("config.json")
}

fn parse_version_from_name(name: &str) -> Option<String> {
    // Try UE_X.X pattern
    if let Some(caps) = regex::Regex::new(r"(?i)UE[_-]([0-9]+(?:\.[0-9]+)*)")
        .ok()
        .and_then(|re| re.captures(name))
    {
        return caps.get(1).map(|m| m.as_str().to_string());
    }
    // Try generic version pattern
    if let Some(caps) = regex::Regex::new(r"([0-9]+(?:\.[0-9]+)*)")
        .ok()
        .and_then(|re| re.captures(name))
    {
        return caps.get(1).map(|m| m.as_str().to_string());
    }
    None
}

fn should_skip_directory(name: &str) -> bool {
    let skip_names = [
        "launcher",
        "epicgameslauncher",
        "epic games launcher",
        "epic online services",
        "directxredist",
        "vcredist",
    ];
    let lower = name.to_lowercase();
    skip_names.iter().any(|s| lower == *s)
}

fn is_engine_root(path: &PathBuf) -> bool {
    let engine_dir = path.join("Engine");
    if !engine_dir.is_dir() {
        return false;
    }
    let binaries = engine_dir.join("Binaries");
    let build = engine_dir.join("Build");
    binaries.is_dir() || build.is_dir()
}

fn format_label(name: &str, version: &Option<String>) -> String {
    if let Some(v) = version {
        format!("Unreal Engine {}", v)
    } else if !name.is_empty() {
        format!("Unreal Engine ({})", name)
    } else {
        "Unreal Engine".to_string()
    }
}

fn derive_editor_target(project_path: &str) -> Result<String, String> {
    let path = PathBuf::from(project_path);
    if !path.exists() {
        return Err(format!("Project file not found at {:?}", path));
    }

    let stem = path
        .file_stem()
        .ok_or_else(|| "Project file name is invalid".to_string())?
        .to_string_lossy()
        .to_string();

    if stem.to_lowercase().ends_with("editor") {
        Ok(stem)
    } else {
        Ok(format!("{}Editor", stem))
    }
}

// Tauri Commands
#[tauri::command]
fn get_config(app: AppHandle) -> Result<Config, String> {
    let config_path = get_config_path(&app);

    if !config_path.exists() {
        return Ok(Config::default());
    }

    let contents =
        fs::read_to_string(&config_path).map_err(|e| format!("Failed to read config: {}", e))?;

    serde_json::from_str(&contents).map_err(|e| format!("Failed to parse config: {}", e))
}

#[tauri::command]
fn save_config(app: AppHandle, config: Config) -> Result<(), String> {
    let config_path = get_config_path(&app);

    if let Some(parent) = config_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
    }

    let contents = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;

    fs::write(&config_path, contents).map_err(|e| format!("Failed to write config: {}", e))
}

#[tauri::command]
fn detect_engines() -> Result<Vec<EngineInstall>, String> {
    let mut installs = Vec::new();
    let mut seen = std::collections::HashSet::new();

    // Get base directories to scan
    let mut base_dirs = Vec::new();

    #[cfg(windows)]
    {
        if let Ok(program_files) = std::env::var("PROGRAMFILES") {
            base_dirs.push(PathBuf::from(program_files).join("Epic Games"));
        }
        if let Ok(program_files_x86) = std::env::var("PROGRAMFILES(X86)") {
            base_dirs.push(PathBuf::from(program_files_x86).join("Epic Games"));
        }
    }

    #[cfg(target_os = "macos")]
    {
        base_dirs.push(PathBuf::from("/Users/Shared/Epic Games"));
        if let Ok(home) = std::env::var("HOME") {
            base_dirs.push(PathBuf::from(home).join("Epic Games"));
        }
    }

    #[cfg(target_os = "linux")]
    {
        if let Ok(home) = std::env::var("HOME") {
            base_dirs.push(PathBuf::from(&home).join("Epic Games"));
            base_dirs.push(PathBuf::from(&home).join(".local/share/Epic Games"));
        }
        base_dirs.push(PathBuf::from("/opt/Epic Games"));
    }

    // Scan base directories
    for base_dir in &base_dirs {
        if let Ok(entries) = fs::read_dir(base_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if !path.is_dir() {
                    continue;
                }

                let name = entry.file_name().to_string_lossy().to_string();
                if should_skip_directory(&name) {
                    continue;
                }

                let normalized = path.to_string_lossy().to_string();
                if seen.contains(&normalized) {
                    continue;
                }

                if !is_engine_root(&path) {
                    continue;
                }

                let version = parse_version_from_name(&name);
                let label = format_label(&name, &version);

                installs.push(EngineInstall {
                    id: normalized.clone(),
                    name: label,
                    path: normalized.clone(),
                    version,
                });
                seen.insert(normalized);
            }
        }
    }

    // Also check Windows launcher installed file
    #[cfg(windows)]
    {
        let launcher_paths = [
            PathBuf::from(
                std::env::var("ProgramData").unwrap_or_else(|_| "C:\\ProgramData".to_string()),
            )
            .join("Epic/UnrealEngineLauncher/LauncherInstalled.dat"),
            PathBuf::from(
                std::env::var("ProgramData").unwrap_or_else(|_| "C:\\ProgramData".to_string()),
            )
            .join("Epic/EpicGamesLauncher/LauncherInstalled.dat"),
        ];

        for launcher_path in &launcher_paths {
            if let Ok(contents) = fs::read_to_string(launcher_path) {
                if let Ok(data) = serde_json::from_str::<serde_json::Value>(&contents) {
                    if let Some(list) = data.get("InstallationList").and_then(|v| v.as_array()) {
                        for item in list {
                            if let Some(location) =
                                item.get("InstallLocation").and_then(|v| v.as_str())
                            {
                                let path = PathBuf::from(location);
                                let name = path
                                    .file_name()
                                    .map(|n| n.to_string_lossy().to_string())
                                    .unwrap_or_default();

                                if should_skip_directory(&name) {
                                    continue;
                                }

                                let normalized = path.to_string_lossy().to_string();
                                if seen.contains(&normalized) {
                                    continue;
                                }

                                if !is_engine_root(&path) {
                                    continue;
                                }

                                let version = item
                                    .get("AppVersion")
                                    .and_then(|v| v.as_str())
                                    .map(|s| s.to_string())
                                    .or_else(|| parse_version_from_name(&name));

                                let display_name = item
                                    .get("DisplayName")
                                    .and_then(|v| v.as_str())
                                    .unwrap_or(&name);

                                let label = format_label(display_name, &version);

                                installs.push(EngineInstall {
                                    id: normalized.clone(),
                                    name: label,
                                    path: normalized.clone(),
                                    version,
                                });
                                seen.insert(normalized);
                            }
                        }
                    }
                }
            }
        }
    }

    // Sort by version descending
    installs.sort_by(|a, b| match (&b.version, &a.version) {
        (Some(bv), Some(av)) => {
            let a_parts: Vec<u32> = av.split('.').filter_map(|s| s.parse().ok()).collect();
            let b_parts: Vec<u32> = bv.split('.').filter_map(|s| s.parse().ok()).collect();
            b_parts.cmp(&a_parts)
        }
        (Some(_), None) => std::cmp::Ordering::Less,
        (None, Some(_)) => std::cmp::Ordering::Greater,
        (None, None) => std::cmp::Ordering::Equal,
    });

    Ok(installs)
}

#[tauri::command]
fn start_build(
    app: AppHandle,
    state: State<AppState>,
    project_path: String,
    unreal_engine_path: String,
) -> Result<String, String> {
    let build_id = uuid::Uuid::new_v4().to_string();

    let ubt_dll = PathBuf::from(&unreal_engine_path)
        .join("Engine/Binaries/DotNET/UnrealBuildTool/UnrealBuildTool.dll");

    if !ubt_dll.exists() {
        return Err(format!("UnrealBuildTool not found at {:?}", ubt_dll));
    }

    let target_name = derive_editor_target(&project_path)?;

    let dotnet_command = format!(
        "dotnet \"{}\" {} Win64 Development -Project=\"{}\" -WaitMutex",
        ubt_dll.display(),
        target_name,
        project_path
    );

    let mut cmd = Command::new("dotnet");
    cmd.arg(ubt_dll)
        .arg(target_name)
        .arg("Win64")
        .arg("Development")
        .arg(format!("-Project={}", project_path))
        .arg("-WaitMutex")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    if let Some(project_dir) = PathBuf::from(&project_path).parent() {
        cmd.current_dir(project_dir);
    }

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to start build: {}", e))?;

    let logs = Arc::new(Mutex::new(Vec::new()));
    {
        let mut guard = logs.lock().unwrap();
        guard.push(format!("Running: {}", dotnet_command));
    }

    let payload = BuildLogPayload {
        build_id: build_id.clone(),
        line: format!("Running: {}", dotnet_command),
    };
    let _ = app.emit("build-log", payload);

    let stdout_logs = Arc::clone(&logs);
    let stdout_app = app.clone();
    let stdout_build = build_id.clone();
    if let Some(stdout) = child.stdout.take() {
        std::thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines() {
                if let Ok(line) = line {
                    if let Ok(mut guard) = stdout_logs.lock() {
                        guard.push(line.clone());
                    }
                    let _ = stdout_app.emit(
                        "build-log",
                        BuildLogPayload {
                            build_id: stdout_build.clone(),
                            line,
                        },
                    );
                }
            }
        });
    }

    let stderr_logs = Arc::clone(&logs);
    let stderr_app = app.clone();
    let stderr_build = build_id.clone();
    if let Some(stderr) = child.stderr.take() {
        std::thread::spawn(move || {
            let reader = BufReader::new(stderr);
            for line in reader.lines() {
                if let Ok(line) = line {
                    if let Ok(mut guard) = stderr_logs.lock() {
                        guard.push(line.clone());
                    }
                    let _ = stderr_app.emit(
                        "build-log",
                        BuildLogPayload {
                            build_id: stderr_build.clone(),
                            line,
                        },
                    );
                }
            }
        });
    }

    let now = chrono::Utc::now().to_rfc3339();

    let build_process = BuildProcess {
        child: Some(child),
        status: BuildStatus {
            status: "running".to_string(),
            code: None,
            error: None,
            started_at: Some(now),
            finished_at: None,
        },
        logs,
    };

    state
        .builds
        .lock()
        .unwrap()
        .insert(build_id.clone(), build_process);

    Ok(build_id)
}

#[tauri::command]
fn get_build_status(state: State<AppState>, build_id: String) -> Result<BuildStatus, String> {
    let mut builds = state.builds.lock().unwrap();

    let build = builds
        .get_mut(&build_id)
        .ok_or_else(|| "Build not found".to_string())?;

    // Check if process has finished
    if build.status.status == "running" {
        if let Some(ref mut child) = build.child {
            match child.try_wait() {
                Ok(Some(exit_status)) => {
                    let now = chrono::Utc::now().to_rfc3339();
                    build.status.finished_at = Some(now);
                    build.status.code = exit_status.code();

                    if exit_status.success() {
                        build.status.status = "success".to_string();
                    } else {
                        build.status.status = "error".to_string();
                        build.status.error =
                            Some(format!("Process exited with code {:?}", exit_status.code()));
                    }
                }
                Ok(None) => {
                    // Still running
                }
                Err(e) => {
                    build.status.status = "error".to_string();
                    build.status.error = Some(format!("Failed to check process: {}", e));
                }
            }
        }
    }

    Ok(build.status.clone())
}

#[tauri::command]
fn get_build_logs(
    state: State<AppState>,
    build_id: String,
    from: usize,
) -> Result<BuildLogsResponse, String> {
    let mut builds = state.builds.lock().unwrap();

    let build = builds
        .get_mut(&build_id)
        .ok_or_else(|| "Build not found".to_string())?;

    let guard = build.logs.lock().unwrap();
    let lines: Vec<String> = guard.iter().skip(from).cloned().collect();
    let next_index = guard.len();
    let finished = build.status.status != "running";

    Ok(BuildLogsResponse {
        lines,
        next_index,
        finished,
    })
}

#[tauri::command]
fn launch_editor(project_path: String, unreal_engine_path: String) -> Result<(), String> {
    let editor_exe =
        PathBuf::from(&unreal_engine_path).join("Engine/Binaries/Win64/UnrealEditor.exe");

    if !editor_exe.exists() {
        return Err(format!(
            "UnrealEditor.exe not found at {:?}. Make sure the engine path is correct.",
            editor_exe
        ));
    }

    let project = PathBuf::from(&project_path);
    if !project.exists() {
        return Err(format!("Project file not found at {:?}", project));
    }

    let mut cmd = Command::new(&editor_exe);
    cmd.arg(&project_path);

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        // DETACHED_PROCESS (0x00000008) so the editor lives independently
        cmd.creation_flags(0x00000008);
    }

    cmd.spawn()
        .map_err(|e| format!("Failed to launch Unreal Editor: {}", e))?;

    Ok(())
}

#[tauri::command]
fn cancel_build(state: State<AppState>, build_id: String) -> Result<bool, String> {
    let mut builds = state.builds.lock().unwrap();

    let build = builds
        .get_mut(&build_id)
        .ok_or_else(|| "Build not found".to_string())?;

    if build.status.status != "running" {
        return Ok(false);
    }

    if let Some(ref mut child) = build.child {
        let _ = child.kill();
        let now = chrono::Utc::now().to_rfc3339();
        build.status.status = "cancelled".to_string();
        build.status.finished_at = Some(now);
    }

    Ok(true)
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState {
            builds: Mutex::new(HashMap::new()),
        })
        .invoke_handler(tauri::generate_handler![
            get_config,
            save_config,
            detect_engines,
            start_build,
            get_build_status,
            get_build_logs,
            cancel_build,
            launch_editor,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
