"""
可靠的文件编辑工具 —— 专治 Edit 工具在 Windows/中文/CRLF 环境下匹配失败

用法:
  python tools\edit.py <文件路径> <旧文本文件> <新文本文件>
  python tools\edit.py frontend/src/x.vue old.txt new.txt

旧文本/新文本存在对应文件里，避免 shell 转义问题。
如果不传文件，从 stdin 读 old 和 new（用 ===SEP=== 分隔）。
"""
import sys, os

def main():
    if len(sys.argv) == 4:
        filepath = sys.argv[1]
        with open(sys.argv[2], 'r', encoding='utf-8') as f:
            old = f.read()
        with open(sys.argv[3], 'r', encoding='utf-8') as f:
            new = f.read()
    else:
        # 从 stdin 读取，用 ===SEP=== 分隔 old 和 new
        data = sys.stdin.read()
        parts = data.split('===SEP===')
        if len(parts) != 2:
            print('ERROR: stdin must have exactly one ===SEP=== separator', file=sys.stderr)
            sys.exit(1)
        filepath = parts[0].strip()
        old = parts[1]
        new = parts[2]

    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    if old not in content:
        print(f'ERROR: old text not found in {filepath}', file=sys.stderr)
        # 输出附近上下文帮助调试
        idx = content.find(old[:50])
        if idx >= 0:
            print(f'  Partial match at {idx}: ...{content[idx:idx+100]}...', file=sys.stderr)
        sys.exit(1)

    content = content.replace(old, new, 1)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f'OK: replaced in {filepath}')


if __name__ == '__main__':
    main()
