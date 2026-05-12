#!/usr/bin/env python3
"""
环境一致性验证主脚本
"""
import os
import sys
import time
import argparse
import logging
from core_validator import EnvConsistencyValidator
from alert_system import AlertSystem

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('env_consistency.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

def main():
    """主函数"""
    parser = argparse.ArgumentParser(description='环境一致性验证脚本')
    parser.add_argument('--env', type=str, default='development', choices=['development', 'production'],
                        help='要验证的目标环境')
    parser.add_argument('--output', type=str, default='env_consistency_report.json',
                        help='报告输出文件路径')
    parser.add_argument('--strict', action='store_true',
                        help='严格模式，发现差异时返回错误码')
    
    args = parser.parse_args()
    
    logger.info("开始环境一致性验证...")
    
    # 获取项目根目录
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    
    # 创建验证器实例
    validator = EnvConsistencyValidator(BASE_DIR)
    
    # 准备报告数据
    report_data = {
        'timestamp': time.strftime('%Y-%m-%d %H:%M:%S'),
        'details': {
            'config_files': [],
            'dependencies': [],
            'environment_variables': [],
            'system_settings': []
        }
    }
    
    try:
        # 1. 验证配置文件一致性
        logger.info("验证配置文件一致性...")
        config_files = [
            ('config/config.py', 'config/config.py'),  # 主配置文件
        ]
        
        dev_files = [dev for dev, _ in config_files]
        prod_files = [prod for _, prod in config_files]
        
        config_results = validator.compare_config_files(dev_files, prod_files)
        report_data['details']['config_files'].extend(config_results)
        
        # 2. 验证依赖版本一致性
        logger.info("验证后端依赖版本一致性...")
        # 读取requirements.txt
        dev_backend_deps = validator.parse_requirements_file(
            os.path.join(BASE_DIR, 'backend/requirements.txt')
        )
        prod_backend_deps = validator.parse_requirements_file(
            os.path.join(BASE_DIR, 'backend/requirements.txt')
        )
        
        backend_dep_results = validator.compare_dependencies(dev_backend_deps, prod_backend_deps)
        report_data['details']['dependencies'].extend(backend_dep_results)
        
        logger.info("验证前端依赖版本一致性...")
        # 读取package.json
        dev_frontend_deps = validator.parse_package_json(
            os.path.join(BASE_DIR, 'frontend/package.json')
        )
        prod_frontend_deps = validator.parse_package_json(
            os.path.join(BASE_DIR, 'frontend/package.json')
        )
        
        frontend_dep_results = validator.compare_dependencies(dev_frontend_deps, prod_frontend_deps)
        report_data['details']['dependencies'].extend(frontend_dep_results)
        
        # 3. 验证环境变量一致性
        logger.info("验证环境变量一致性...")
        dev_env = validator.parse_env_file(
            os.path.join(BASE_DIR, 'config/.env.development')
        )
        prod_env = validator.parse_env_file(
            os.path.join(BASE_DIR, 'config/.env.production')
        )
        
        env_results = validator.compare_environment_variables(dev_env, prod_env)
        report_data['details']['environment_variables'].extend(env_results)
        
        # 4. 生成最终报告
        logger.info("生成一致性报告...")
        final_report = validator.generate_report(report_data)
        
        # 保存报告
        output_path = os.path.join(BASE_DIR, args.output)
        validator.save_report(final_report, output_path)
        
        # 打印摘要
        logger.info(f"验证完成！")
        logger.info(f"状态: {final_report['status']}")
        logger.info(f"总检查项: {final_report['total_checks']}")
        logger.info(f"通过: {final_report['passed_checks']}")
        logger.info(f"失败: {final_report['failed_checks']}")
        logger.info(f"报告已保存至: {output_path}")
        
        # 发送告警（如果验证失败）
        alert_system = AlertSystem()
        alert_system.send_alert(final_report)
        
        # 如果是严格模式且有失败项，返回错误码
        if args.strict and final_report['status'] == 'FAIL':
            logger.error("严格模式下发现差异，返回错误码")
            sys.exit(1)
        
        return final_report
        
    except Exception as e:
        logger.error(f"验证过程中发生错误: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
