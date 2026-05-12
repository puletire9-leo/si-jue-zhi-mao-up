"""
自动同步模块
提供自动同步功能
"""

import argparse
import logging
import sys
import os
from pathlib import Path
from datetime import datetime

# 添加项目根目录到Python路径
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / 'scripts'))

from git_sync.config import load_git_sync_config
from git_sync.git_manager import GitSyncManager
from git_sync.hook_manager import GitHookManager
from git_sync.conflict_manager import GitConflictManager


def setup_logging(verbose: bool = False, log_file: str = None):
    """
    设置日志
    
    Args:
        verbose: 是否显示详细日志
        log_file: 日志文件路径
    """
    log_level = logging.DEBUG if verbose else logging.INFO
    
    handlers = [logging.StreamHandler()]
    
    if log_file:
        log_file_path = Path(log_file)
        log_file_path.parent.mkdir(parents=True, exist_ok=True)
        handlers.append(logging.FileHandler(log_file, encoding='utf-8'))
    
    logging.basicConfig(
        level=log_level,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=handlers
    )


def parse_args():
    """解析命令行参数"""
    parser = argparse.ArgumentParser(description="Git自动同步工具")
    
    # 环境选择
    parser.add_argument('--environment', '-e',
                        choices=['development', 'production'],
                        default='development',
                        help='当前环境')
    
    # 操作模式
    parser.add_argument('--mode', '-m',
                        choices=['sync', 'commit', 'push', 'pull', 'check-only', 'push-only'],
                        default='sync',
                        help='操作模式')
    
    # 目标环境
    parser.add_argument('--target-env', '-t',
                        choices=['development', 'production'],
                        help='目标环境（用于双向同步）')
    
    # 其他选项
    parser.add_argument('--verbose', '-v',
                        action='store_true',
                        help='显示详细日志')
    
    parser.add_argument('--dry-run',
                        action='store_true',
                        help='模拟运行，不实际执行')
    
    parser.add_argument('--force',
                        action='store_true',
                        help='强制执行，忽略冲突')
    
    parser.add_argument('--log-file',
                        type=str,
                        help='日志文件路径')
    
    parser.add_argument('--config',
                        type=str,
                        help='自定义配置文件路径')
    
    parser.add_argument('--install-hooks',
                        action='store_true',
                        help='安装Git钩子')
    
    parser.add_argument('--uninstall-hooks',
                        action='store_true',
                        help='卸载Git钩子')
    
    parser.add_argument('--list-hooks',
                        action='store_true',
                        help='列出已安装的钩子')
    
    parser.add_argument('--check-conflicts',
                        action='store_true',
                        help='检查冲突')
    
    parser.add_argument('--resolve-conflicts',
                        action='store_true',
                        help='解决冲突')
    
    parser.add_argument('--conflict-strategy',
                        choices=['ours', 'theirs', 'manual'],
                        help='冲突解决策略')
    
    return parser.parse_args()


def main():
    """主函数"""
    args = parse_args()
    
    # 设置日志
    setup_logging(args.verbose, args.log_file)
    logger = logging.getLogger(__name__)
    
    logger.info(f"=== Git自动同步工具 v1.0.0 ===")
    logger.info(f"当前环境: {args.environment}")
    logger.info(f"操作模式: {args.mode}")
    logger.info(f"干运行: {args.dry_run}")
    logger.info(f"强制执行: {args.force}")
    
    try:
        # 加载配置
        config = load_git_sync_config(args.config)
        logger.info("配置加载完成")
        
        # 初始化管理器
        git_manager = GitSyncManager(config, args.environment)
        hook_manager = GitHookManager(config)
        conflict_manager = GitConflictManager(config)
        
        # 处理钩子相关操作
        if args.install_hooks:
            logger.info("安装Git钩子...")
            success = hook_manager.install_hooks()
            if success:
                logger.info("✅ Git钩子安装成功")
                return 0
            else:
                logger.error("❌ Git钩子安装失败")
                return 1
        
        if args.uninstall_hooks:
            logger.info("卸载Git钩子...")
            success = hook_manager.uninstall_hooks()
            if success:
                logger.info("✅ Git钩子卸载成功")
                return 0
            else:
                logger.error("❌ Git钩子卸载失败")
                return 1
        
        if args.list_hooks:
            logger.info("列出已安装的钩子...")
            hooks = hook_manager.list_hooks()
            if hooks:
                logger.info(f"已安装的钩子: {', '.join(hooks)}")
            else:
                logger.info("没有安装任何钩子")
            return 0
        
        # 处理冲突相关操作
        if args.check_conflicts:
            logger.info("检查冲突...")
            conflicts = conflict_manager.detect_conflicts()
            
            if conflicts:
                logger.warning(f"检测到 {len(conflicts)} 个冲突:")
                for conflict in conflicts:
                    logger.warning(f"  - {conflict['file_path']} ({conflict['conflict_count']} 个冲突标记)")
                
                report = conflict_manager.create_conflict_report()
                logger.info(f"\n冲突报告:")
                logger.info(f"  总冲突数: {report['total_conflicts']}")
                logger.info(f"  解决选项: {[opt['name'] for opt in report['resolution_options']]}")
                
                return 1
            else:
                logger.info("✅ 没有检测到冲突")
                return 0
        
        if args.resolve_conflicts:
            logger.info("解决冲突...")
            
            if args.conflict_strategy:
                result = conflict_manager.resolve_all_conflicts(args.conflict_strategy)
            else:
                result = conflict_manager.resolve_all_conflicts()
            
            if result['success']:
                logger.info(f"✅ 成功解决 {result['resolved_conflicts']} 个冲突")
                return 0
            else:
                logger.error(f"❌ 冲突解决失败: {result['error']}")
                return 1
        
        # 处理同步操作
        if args.mode == 'check-only':
            logger.info("检查同步状态...")
            status = git_manager.get_status()
            
            if status['has_changes']:
                logger.info("检测到本地更改:")
                if status['modified_files']:
                    logger.info(f"  修改的文件: {len(status['modified_files'])}")
                if status['added_files']:
                    logger.info(f"  新增的文件: {len(status['added_files'])}")
                if status['deleted_files']:
                    logger.info(f"  删除的文件: {len(status['deleted_files'])}")
                if status['untracked_files']:
                    logger.info(f"  未跟踪的文件: {len(status['untracked_files'])}")
                return 1
            else:
                logger.info("✅ 没有检测到本地更改")
                return 0
        
        elif args.mode == 'commit':
            logger.info("提交更改...")
            
            if args.dry_run:
                logger.info("干运行模式，不实际提交")
                return 0
            
            status = git_manager.get_status()
            if not status['has_changes']:
                logger.info("没有需要提交的更改")
                return 0
            
            if git_manager.add_files() and git_manager.commit_changes():
                logger.info("✅ 提交成功")
                return 0
            else:
                logger.error("❌ 提交失败")
                return 1
        
        elif args.mode == 'push':
            logger.info("推送更改...")
            
            if args.dry_run:
                logger.info("干运行模式，不实际推送")
                return 0
            
            if git_manager.push_changes():
                logger.info("✅ 推送成功")
                return 0
            else:
                logger.error("❌ 推送失败")
                return 1
        
        elif args.mode == 'pull':
            logger.info("拉取更改...")
            
            if args.dry_run:
                logger.info("干运行模式，不实际拉取")
                return 0
            
            if git_manager.pull_changes():
                logger.info("✅ 拉取成功")
                return 0
            else:
                logger.error("❌ 拉取失败")
                return 1
        
        elif args.mode == 'push-only':
            logger.info("仅推送更改...")
            
            if args.dry_run:
                logger.info("干运行模式，不实际推送")
                return 0
            
            if git_manager.push_changes():
                logger.info("✅ 推送成功")
                return 0
            else:
                logger.error("❌ 推送失败")
                return 1
        
        elif args.mode == 'sync':
            logger.info("执行自动同步...")
            
            if args.dry_run:
                logger.info("干运行模式，不实际同步")
                return 0
            
            result = git_manager.auto_sync(args.target_env)
            
            if result['success']:
                logger.info("✅ 自动同步成功")
                if result['operations']:
                    logger.info(f"执行的操作: {', '.join(result['operations'])}")
                return 0
            else:
                logger.error(f"❌ 自动同步失败: {result['error']}")
                return 1
        
        else:
            logger.error(f"未知的操作模式: {args.mode}")
            return 1
        
    except Exception as e:
        logger.error(f"自动同步工具执行失败: {e}", exc_info=True)
        return 1


if __name__ == "__main__":
    sys.exit(main())
