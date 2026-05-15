import subprocess, os, time, socket

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

kill_port(8090)

# 检查是否已在运行
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.settimeout(1)
try:
    s.connect(('127.0.0.1', 8090))
    s.close()
    print('Java :8090 已在运行')
    exit(0)
except Exception:
    s.close()

# 启动
env = os.environ.copy()
env['JAVA_HOME'] = r'E:\软件\PyCharm 2025.2.1.1\jbr'
env['PATH'] = r'E:\tool\apache-maven-3.9.9\bin;' + env['JAVA_HOME'] + r'\bin;' + env['PATH']

p = subprocess.Popen(
    [r'E:\tool\apache-maven-3.9.9\bin\mvn.cmd', 'spring-boot:run', '-Dspring-boot.run.arguments=--server.port=8090'],
    cwd=r'E:\项目\si-jue-zhi-mao-up\java-backend', env=env
)
print(f'Java 启动中 PID={p.pid}')
p.wait()
