#!/usr/bin/env python3
"""
环境一致性验证核心模块
"""
import os
import sys
import json
import yaml
import hashlib
import difflib
from typing import Dict, List, Tuple, Any

class EnvConsistencyValidator:
    """
    环境一致性验证器
    """
    def __init__(self, base_dir: str):
        self.base_dir = base_dir
        self.report = {
            'timestamp': '',
            'status': 'PASS',
            'total_checks': 0,
            'passed_checks': 0,
            'failed_checks': 0,
            'details': {
                'config_files': [],
                'dependencies': [],
                'environment_variables': [],
                'system_settings': []
            }
        }
        
    def _read_file(self, file_path: str) -> str:
        """读取文件内容"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                return f.read()
        except Exception as e:
            print(f"Error reading file {file_path}: {e}")
            return ""
    
    def _calculate_file_hash(self, file_path: str) -> str:
        """计算文件哈希值"""
        try:
            with open(file_path, 'rb') as f:
                return hashlib.md5(f.read()).hexdigest()
        except Exception as e:
            print(f"Error calculating hash for {file_path}: {e}")
            return ""
    
    def _compare_text(self, text1: str, text2: str) -> Tuple[bool, List[str]]:
        """比较两段文本，返回差异"""
        if text1 == text2:
            return True, []
        
        diff = difflib.unified_diff(
            text1.splitlines(),
            text2.splitlines(),
            lineterm='',
            fromfile='dev',
            tofile='prod'
        )
        return False, list(diff)
    
    def compare_config_files(self, dev_files: List[str], prod_files: List[str]) -> List[Dict]:
        """比较配置文件"""
        results = []
        
        for dev_file, prod_file in zip(dev_files, prod_files):
            dev_content = self._read_file(os.path.join(self.base_dir, dev_file))
            prod_content = self._read_file(os.path.join(self.base_dir, prod_file))
            
            is_consistent, diff = self._compare_text(dev_content, prod_content)
            
            result = {
                'dev_file': dev_file,
                'prod_file': prod_file,
                'is_consistent': is_consistent,
                'diff': diff
            }
            results.append(result)
        
        return results
    
    def compare_dependencies(self, dev_deps: Dict, prod_deps: Dict) -> List[Dict]:
        """比较依赖版本"""
        results = []
        
        # 获取所有依赖包名
        all_packages = set(dev_deps.keys()).union(set(prod_deps.keys()))
        
        for package in all_packages:
            dev_version = dev_deps.get(package, 'NOT_FOUND')
            prod_version = prod_deps.get(package, 'NOT_FOUND')
            
            is_consistent = dev_version == prod_version
            
            result = {
                'package': package,
                'dev_version': dev_version,
                'prod_version': prod_version,
                'is_consistent': is_consistent
            }
            results.append(result)
        
        return results
    
    def compare_environment_variables(self, dev_env: Dict, prod_env: Dict) -> List[Dict]:
        """比较环境变量"""
        results = []
        
        # 获取所有环境变量名
        all_vars = set(dev_env.keys()).union(set(prod_env.keys()))
        
        for var in all_vars:
            dev_value = dev_env.get(var, 'NOT_SET')
            prod_value = prod_env.get(var, 'NOT_SET')
            
            # 忽略特定的环境特定变量
            ignore_vars = ['ENVIRONMENT', 'DEBUG', 'HOST', 'PORT', 'LOG_LEVEL', 
                         'LOG_FILE', 'MYSQL_DATABASE', 'REDIS_DB', 'CELERY_BROKER_URL',
                         'CELERY_RESULT_BACKEND', 'QDRANT_COLLECTION_NAME', 'CACHE_TTL',
                         'ACCESS_TOKEN_EXPIRE_MINUTES', 'RATE_LIMIT_ENABLED']
            
            if var in ignore_vars:
                is_consistent = True
                reason = 'ENVIRONMENT_SPECIFIC'
            else:
                is_consistent = dev_value == prod_value
                reason = 'OK' if is_consistent else 'VALUE_MISMATCH'
            
            result = {
                'variable': var,
                'dev_value': dev_value,
                'prod_value': prod_value,
                'is_consistent': is_consistent,
                'reason': reason
            }
            results.append(result)
        
        return results
    
    def parse_env_file(self, file_path: str) -> Dict[str, str]:
        """解析环境变量文件"""
        env_vars = {}
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#'):
                        if '=' in line:
                            key, value = line.split('=', 1)
                            env_vars[key.strip()] = value.strip()
        except Exception as e:
            print(f"Error parsing env file {file_path}: {e}")
        return env_vars
    
    def parse_requirements_file(self, file_path: str) -> Dict[str, str]:
        """解析requirements.txt文件"""
        deps = {}
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#') and not line.startswith('-'):
                        # 处理带版本号的依赖
                        if '==' in line:
                            pkg, version = line.split('==', 1)
                            deps[pkg.strip()] = version.strip()
                        else:
                            deps[line.strip()] = 'latest'
        except Exception as e:
            print(f"Error parsing requirements file {file_path}: {e}")
        return deps
    
    def parse_package_json(self, file_path: str) -> Dict[str, str]:
        """解析package.json文件"""
        deps = {}
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                # 合并dependencies和devDependencies
                for dep_type in ['dependencies', 'devDependencies']:
                    if dep_type in data:
                        deps.update(data[dep_type])
        except Exception as e:
            print(f"Error parsing package.json file {file_path}: {e}")
        return deps
    
    def generate_report(self, report_data: Dict) -> Dict:
        """生成一致性报告"""
        # 计算统计信息
        total = 0
        passed = 0
        failed = 0
        
        for check_type, checks in report_data['details'].items():
            total += len(checks)
            passed += sum(1 for check in checks if check['is_consistent'])
        
        failed = total - passed
        status = 'PASS' if failed == 0 else 'FAIL'
        
        final_report = {
            'timestamp': report_data.get('timestamp', ''),
            'status': status,
            'total_checks': total,
            'passed_checks': passed,
            'failed_checks': failed,
            'details': report_data['details']
        }
        
        return final_report
    
    def save_report(self, report: Dict, output_file: str) -> None:
        """保存报告到文件"""
        try:
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(report, f, ensure_ascii=False, indent=2)
            print(f"Report saved to {output_file}")
        except Exception as e:
            print(f"Error saving report: {e}")
