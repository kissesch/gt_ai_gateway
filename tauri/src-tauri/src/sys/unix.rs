pub struct UnixPlatformState {
    pub stdin: Option<std::process::ChildStdin>,
}

pub fn setup_pty_command(cmd: &mut std::process::Command) -> UnixPlatformState {
    cmd.stdout(std::process::Stdio::piped());
    cmd.stderr(std::process::Stdio::piped());
    // 打开 stdin 管道，借由 Tauri 父进程对其保持持有，使得后端可以通过监听 stdin 断开来感知父进程退出
    cmd.stdin(std::process::Stdio::piped());
    
    UnixPlatformState { stdin: None }
}

pub fn post_spawn(state: &mut UnixPlatformState, child: &mut std::process::Child) {
    // 接管子进程的 stdin，存入 state 随 Tauri 进程存活。
    // Tauri 退出或崩溃时被释放，子进程 stdin 管道将收到 close/end 事件从而自动清理
    state.stdin = child.stdin.take();
}
