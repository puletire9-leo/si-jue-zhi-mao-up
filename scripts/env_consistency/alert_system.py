#!/usr/bin/env python3
"""
环境一致性告警系统
"""
import os
import sys
import json
import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Dict, List

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('env_consistency_alert.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

class AlertSystem:
    """
    环境一致性告警系统
    """
    def __init__(self, config_file: str = None):
        self.config = self._load_config(config_file)
        self.alert_channels = ['email']  # 支持的告警渠道
    
    def _load_config(self, config_file: str = None) -> Dict:
        """加载告警配置"""
        default_config = {
            'email': {
                'smtp_server': 'smtp.example.com',
                'smtp_port': 587,
                'smtp_user': 'alert@example.com',
                'smtp_password': 'password',
                'sender': 'alert@example.com',
                'recipients': ['dev@example.com', 'ops@example.com'],
                'subject_prefix': '[环境一致性告警]'
            }
        }
        
        if config_file and os.path.exists(config_file):
            try:
                with open(config_file, 'r', encoding='utf-8') as f:
                    user_config = json.load(f)
                    default_config.update(user_config)
            except Exception as e:
                logger.error(f"加载告警配置失败: {e}")
        
        return default_config
    
    def _send_email(self, subject: str, body: str) -> bool:
        """发送电子邮件告警"""
        try:
            email_config = self.config['email']
            
            msg = MIMEMultipart()
            msg['From'] = email_config['sender']
            msg['To'] = ', '.join(email_config['recipients'])
            msg['Subject'] = f"{email_config['subject_prefix']} {subject}"
            
            msg.attach(MIMEText(body, 'html', 'utf-8'))
            
            with smtplib.SMTP(email_config['smtp_server'], email_config['smtp_port']) as server:
                server.starttls()
                server.login(email_config['smtp_user'], email_config['smtp_password'])
                server.send_message(msg)
            
            logger.info(f"告警邮件发送成功，主题: {subject}")
            return True
        except Exception as e:
            logger.error(f"发送告警邮件失败: {e}")
            return False
    
    def generate_alert_message(self, report: Dict) -> str:
        """根据报告生成告警消息"""
        if report['status'] == 'PASS':
            return ""
        
        # 生成HTML格式的告警内容
        html_body = f"""
        <h1>环境一致性验证失败</h1>
        <p>时间: {report['timestamp']}</p>
        <p>状态: {report['status']}</p>
        <p>总检查项: {report['total_checks']}</p>
        <p>通过: {report['passed_checks']}</p>
        <p>失败: {report['failed_checks']}</p>
        
        <h2>失败详情</h2>
        """
        
        # 添加配置文件差异
        config_failures = [f for f in report['details']['config_files'] if not f['is_consistent']]
        if config_failures:
            html_body += f"<h3>配置文件差异 ({len(config_failures)})</h3>"
            for failure in config_failures:
                html_body += f"<p><strong>{failure['dev_file']} ↔ {failure['prod_file']}</strong></p>"
                html_body += f"<pre>{'<br>'.join(failure['diff'])}</pre>"
        
        # 添加依赖差异
        dep_failures = [f for f in report['details']['dependencies'] if not f['is_consistent']]
        if dep_failures:
            html_body += f"<h3>依赖版本差异 ({len(dep_failures)})</h3>"
            html_body += "<table border='1' cellpadding='5' cellspacing='0' style='border-collapse: collapse;'>"
            html_body += "<tr><th>包名</th><th>开发环境版本</th><th>生产环境版本</th></tr>"
            for failure in dep_failures:
                html_body += f"<tr><td>{failure['package']}</td><td>{failure['dev_version']}</td><td>{failure['prod_version']}</td></tr>"
            html_body += "</table>"
        
        # 添加环境变量差异
        env_failures = [f for f in report['details']['environment_variables'] if not f['is_consistent']]
        if env_failures:
            html_body += f"<h3>环境变量差异 ({len(env_failures)})</h3>"
            html_body += "<table border='1' cellpadding='5' cellspacing='0' style='border-collapse: collapse;'>"
            html_body += "<tr><th>变量名</th><th>开发环境值</th><th>生产环境值</th><th>原因</th></tr>"
            for failure in env_failures:
                html_body += f"<tr><td>{failure['variable']}</td><td>{failure['dev_value']}</td><td>{failure['prod_value']}</td><td>{failure['reason']}</td></tr>"
            html_body += "</table>"
        
        return html_body
    
    def send_alert(self, report: Dict) -> bool:
        """发送告警"""
        if report['status'] == 'PASS':
            logger.info("环境一致性验证通过，无需发送告警")
            return True
        
        logger.info("环境一致性验证失败，发送告警...")
        
        # 生成告警消息
        alert_message = self.generate_alert_message(report)
        if not alert_message:
            return True
        
        # 通过所有配置的渠道发送告警
        success = True
        
        for channel in self.alert_channels:
            if channel == 'email':
                subject = f"环境一致性验证失败 - {report['failed_checks']}项差异"
                success = success and self._send_email(subject, alert_message)
        
        return success

if __name__ == "__main__":
    # 示例用法
    import time
    test_report = {
        'timestamp': time.strftime('%Y-%m-%d %H:%M:%S'),
        'status': 'FAIL',
        'total_checks': 100,
        'passed_checks': 95,
        'failed_checks': 5,
        'details': {
            'config_files': [{'dev_file': 'test1', 'prod_file': 'test2', 'is_consistent': False, 'diff': ['差异1', '差异2']}],
            'dependencies': [{'package': 'test-pkg', 'dev_version': '1.0.0', 'prod_version': '2.0.0', 'is_consistent': False}],
            'environment_variables': [{'variable': 'TEST_VAR', 'dev_value': 'dev', 'prod_value': 'prod', 'is_consistent': False, 'reason': 'VALUE_MISMATCH'}],
            'system_settings': []
        }
    }
    
    alert_system = AlertSystem()
    alert_system.send_alert(test_report)
