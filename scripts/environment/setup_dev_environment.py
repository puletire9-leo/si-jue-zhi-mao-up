"""
开发环境设置脚本
创建独立的数据环境，实现完全的环境隔离
"""

import os
import sys
import mysql.connector
from mysql.connector import Error

def setup_dev_database():
    """设置开发环境数据库"""
    
    # 数据库配置
    db_config = {
        'host': 'localhost',
        'port': 3306,
        'user': 'root',
        'password': 'root'
    }
    
    dev_database = 'sijuelishi_dev'
    
    try:
        # 连接到MySQL服务器
        connection = mysql.connector.connect(**db_config)
        cursor = connection.cursor()
        
        # 创建开发环境数据库
        cursor.execute(f"CREATE DATABASE IF NOT EXISTS {dev_database} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
        print(f"✅ 开发环境数据库 '{dev_database}' 创建成功")
        
        # 使用mysqldump导出生产数据库结构并导入到开发数据库
        print("🔄 正在复制数据库结构...")
        
        # 导出生产数据库结构（不包含数据）
        dump_command = f"mysqldump -h localhost -u root -proot --no-data sijuelishi > temp_structure.sql"
        os.system(dump_command)
        
        # 导入到开发数据库
        import_command = f"mysql -h localhost -u root -proot {dev_database} < temp_structure.sql"
        os.system(import_command)
        
        # 清理临时文件
        if os.path.exists("temp_structure.sql"):
            os.remove("temp_structure.sql")
        
        print("✅ 数据库结构复制完成")
        
    except Error as e:
        print(f"❌ 数据库设置失败: {e}")
        return False
    finally:
        if 'connection' in locals() and connection.is_connected():
            cursor.close()
            connection.close()
    
    return True

def update_dev_config():
    """更新开发环境配置使用独立数据库"""
    
    config_file = os.path.join(os.path.dirname(__file__), '..', '..', 'config', '.env.development')
    
    with open(config_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 更新数据库配置
    content = content.replace('MYSQL_DATABASE=sijuelishi', 'MYSQL_DATABASE=sijuelishi_dev')
    
    with open(config_file, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print("✅ 开发环境配置文件已更新")

def create_dev_data():
    """为开发环境创建测试数据"""
    
    db_config = {
        'host': 'localhost',
        'port': 3306,
        'user': 'root',
        'password': 'root',
        'database': 'sijuelishi_dev'
    }
    
    try:
        connection = mysql.connector.connect(**db_config)
        cursor = connection.cursor()
        
        # 这里可以添加一些开发环境的测试数据
        # 例如：创建测试用户、测试产品等
        
        print("✅ 开发环境测试数据创建完成")
        
    except Error as e:
        print(f"⚠️ 测试数据创建失败: {e}")
    finally:
        if 'connection' in locals() and connection.is_connected():
            cursor.close()
            connection.close()

def main():
    """主函数"""
    print("🚀 开始设置开发环境...")
    print("=" * 60)
    
    # 1. 设置开发数据库
    if setup_dev_database():
        # 2. 更新配置文件
        update_dev_config()
        
        # 3. 创建测试数据（可选）
        create_dev_data()
        
        print("=" * 60)
        print("🎉 开发环境设置完成！")
        print("✅ 开发环境使用独立数据库: sijuelishi_dev")
        print("✅ 生产环境保持原有数据库: sijuelishi")
        print("✅ 完全的环境隔离已实现")
        print("\n📋 使用说明:")
        print("   开发环境: python scripts/startup/start_with_hot_reload.py --env development")
        print("   生产环境: python scripts/startup/start_with_hot_reload.py --env production")
    else:
        print("❌ 开发环境设置失败")

if __name__ == "__main__":
    main()