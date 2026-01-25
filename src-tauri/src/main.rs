#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
//! Tauri host for the Stellar desktop app.

use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::{fs::OpenOptions, io::Write, thread, time::Duration};
use std::sync::Mutex;
use tauri::{Manager, WindowEvent};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

const RPC_HOST: &str = "127.0.0.1";
const RPC_PORT: &str = "42800";
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;
struct BackendProcess(Mutex<Option<Child>>);

impl BackendProcess {
    fn set(&self, child: Child) {
        let mut guard = self.0.lock().expect("backend process lock poisoned");
        *guard = Some(child);
    }

    fn stop(&self) {
        let mut guard = self.0.lock().expect("backend process lock poisoned");
        if let Some(mut child) = guard.take() {
            let _ = child.kill();
        }
    }
}

fn find_backend_script(resource_dir: &Path) -> Result<PathBuf, String> {
    let candidates = [
        resource_dir
            .join("resources")
            .join("backend")
            .join("dist")
            .join("server.cjs"),
        resource_dir
            .join("resources")
            .join("backend")
            .join("dist")
            .join("server.js"),
        resource_dir.join("resources").join("dist").join("server.cjs"),
        resource_dir.join("resources").join("dist").join("server.js"),
        resource_dir.join("resources").join("server.cjs"),
        resource_dir.join("resources").join("server.js"),
        resource_dir.join("backend").join("dist").join("server.cjs"),
        resource_dir.join("backend").join("dist").join("server.js"),
        resource_dir.join("dist").join("server.cjs"),
        resource_dir.join("dist").join("server.js"),
        resource_dir.join("server.cjs"),
        resource_dir.join("server.js"),
    ];

    for candidate in candidates {
        if candidate.exists() {
            return Ok(candidate);
        }
    }

    Err(format!(
        "Backend script not found in resources: {}",
        resource_dir.display()
    ))
}

fn resolve_node_binary(resource_dir: &Path) -> Option<PathBuf> {
    let candidates = [
        resource_dir.join("resources").join("node").join("node.exe"),
        resource_dir.join("resources").join("node.exe"),
        resource_dir.join("node").join("node.exe"),
        resource_dir.join("node.exe"),
    ];

    for candidate in candidates {
        if candidate.exists() {
            return Some(candidate);
        }
    }

    None
}

fn write_backend_log(app: &tauri::AppHandle, message: &str) {
    let log_dir = app
        .path()
        .app_log_dir()
        .or_else(|_| app.path().app_data_dir())
        .or_else(|_| app.path().resource_dir());

    let Ok(dir) = log_dir else {
        return;
    };

    let log_path = dir.join("stellar-backend.log");
    if let Some(parent) = log_path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }

    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(&log_path) {
        let _ = writeln!(file, "{message}");
    }
}

fn open_backend_log(app: &tauri::AppHandle) -> Option<std::fs::File> {
    let log_dir = app
        .path()
        .app_log_dir()
        .or_else(|_| app.path().app_data_dir())
        .or_else(|_| app.path().resource_dir())
        .ok()?;

    let log_path = log_dir.join("stellar-backend.log");
    if let Some(parent) = log_path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }

    OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_path)
        .ok()
}

fn normalize_path(path: &Path) -> PathBuf {
    #[cfg(windows)]
    {
        let raw = path.to_string_lossy();
        if let Some(stripped) = raw.strip_prefix(r"\\?\") {
            return PathBuf::from(stripped);
        }
    }
    path.to_path_buf()
}

fn spawn_backend(app: &tauri::AppHandle) -> Result<Child, String> {
    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|err| format!("Failed to resolve resource dir: {err}"))?;
    let script_path = normalize_path(&find_backend_script(&resource_dir)?);

    let node_path = resolve_node_binary(&resource_dir).map(|path| normalize_path(&path));
    let node_path_for_log = node_path.clone();
    let mut command = match &node_path {
        Some(path) => Command::new(path),
        None => Command::new("node"),
    };
    write_backend_log(
        app,
        &format!(
            "Backend command: node={:?} script={:?}",
            node_path_for_log
                .as_deref()
                .unwrap_or_else(|| Path::new("node")),
            script_path
        ),
    );
    command
        .arg(script_path)
        .env("STELLAR_RPC_HOST", RPC_HOST)
        .env("STELLAR_RPC_PORT", RPC_PORT);

    #[cfg(windows)]
    {
        command.creation_flags(CREATE_NO_WINDOW);
    }

    if let Some(log_file) = open_backend_log(app) {
        if let Ok(log_clone) = log_file.try_clone() {
            command.stdout(Stdio::from(log_clone));
        }
        command.stderr(Stdio::from(log_file));
    }

    let mut child = command
        .spawn()
        .map_err(|err| format!("Failed to spawn backend: {err}"))?;

    let child_id = child.id();
    write_backend_log(app, &format!("Backend spawned with pid {child_id}."));

    if let Ok(Some(status)) = child.try_wait() {
        write_backend_log(app, &format!("Backend exited immediately: {status}"));
    } else {
        let app_handle = app.clone();
        thread::spawn(move || {
            thread::sleep(Duration::from_millis(500));
            write_backend_log(
                &app_handle,
                &format!("Backend still running after 500ms (pid {child_id})."),
            );
        });
    }

    Ok(child)
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            app.manage(BackendProcess(Mutex::new(None)));

            if !cfg!(debug_assertions) {
                let resource_dir = app.path().resource_dir();
                write_backend_log(
                    app.handle(),
                    &format!("Starting backend. Resource dir: {resource_dir:?}"),
                );

                match spawn_backend(app.handle()) {
                    Ok(child) => {
                        app.state::<BackendProcess>().set(child);
                        write_backend_log(app.handle(), "Backend process started.");
                    }
                    Err(err) => {
                        write_backend_log(app.handle(), &format!("Backend failed to start: {err}"));
                    }
                }
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { .. } = event {
                window.app_handle().state::<BackendProcess>().stop();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
