import pandas as pd
import random

# ======================================
# 你只需要改这里！
# ======================================
INPUT_FILE = r"C:\Users\Administrator\Desktop\初选上传20260622.xlsx"    # 你的Excel文件名
OUTPUT_FILE = r"C:\Users\Administrator\Desktop\初选上传20260622_1.xlsx"   # 输出文件名
DEV_NAMES = [ "黄双慧"]  # 分配的两个人

# 读取Excel
df = pd.read_excel(INPUT_FILE)

# 1. 拿到所有不重复的【所属节点】
unique_nodes = df["所属节点"].dropna().unique()

# 2. 给每个节点随机分配一个人（节点固定，人就固定）
node_to_person = {}
for node in unique_nodes:
    node_to_person[node] = random.choice(DEV_NAMES)

# 3. 给每一行按节点匹配开发人
def assign_developer(row):
    node = row["所属节点"]
    return node_to_person.get(node, "")  # 空节点返回空

df["开发人区分"] = df.apply(assign_developer, axis=1)

# 4. 保存结果
df.to_excel(OUTPUT_FILE, index=False)

print(f"✅ 分配完成！结果已保存到：{OUTPUT_FILE}")
print(f"📊 共分配 {len(unique_nodes)} 个节点")
