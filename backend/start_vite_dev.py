import subprocess, os, socket

# 先杀旧进程
def kill_port(port):
    try:
        r = subprocess.run(['netstat', '-ano'], capture_output=True, text=True, timeout=5)
        for line in r.stdout.split('\n'):
            if f':{port}' in line and 'LISTENING' in line:
                pid = line.split()[-1]
                subprocess.run(['taskkill', '/F', '/T', '/PID', pid], capture_output=True, timeout=5)
                print(f'已停止旧进程 PID={pid}')
    except Exception:
        pass

kill_port(5175)

s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.settimeout(1)
try:
    s.connect(('127.0.0.1', 5175))
    s.close()
    print('Vite :5175 已在运行')
    exit(0)
except Exception:
    s.close()

p = subprocess.Popen(
    [r'E:\tool\node-v24.15.0\npm.cmd', 'run', 'dev'],
    cwd=r'E:\项目\si-jue-zhi-mao-up\frontend'
)
print(f'Vite 启动中 PID={p.pid}')
p.wait()
