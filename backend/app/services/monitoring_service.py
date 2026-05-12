#!/usr/bin/env python3
"""
错误监控告警服务

功能：
- 监控URL格式错误
- 发送告警通知
- 记录错误日志
- 支持多种告警渠道

使用：
from backend.app.services.monitoring_service import monitoring_service
await monitoring_service.send_alert("url_format_error", "发现无效URL格式")
"""

import logging
import asyncio
from typing import Optional, Dict, Any
from datetime import datetime

logger = logging.getLogger(__name__)

class MonitoringService:
    """
    监控告警服务
    """
    
    def __init__(self):
        """
        初始化监控服务
        """
        self.alert_history = []
        self.alert_cooldown = 3600  # 告警冷却时间（秒）
        logger.info("监控告警服务初始化成功")
    
    async def send_alert(
        self,
        alert_type: str,
        message: str,
        details: Optional[Dict[str, Any]] = None,
        severity: str = "warning"
    ) -> bool:
        """
        发送告警通知
        
        Args:
            alert_type: 告警类型
            message: 告警消息
            details: 详细信息
            severity: 严重程度 (info, warning, error, critical)
            
        Returns:
            是否发送成功
        """
        try:
            # 检查是否在冷却期内
            if await self._check_cooldown(alert_type):
                logger.info(f"告警 {alert_type} 在冷却期内，跳过发送")
                return False
            
            alert_time = datetime.now()
            alert_data = {
                "type": alert_type,
                "message": message,
                "details": details,
                "severity": severity,
                "timestamp": alert_time.isoformat()
            }
            
            # 记录告警历史
            self.alert_history.append(alert_data)
            if len(self.alert_history) > 100:
                self.alert_history = self.alert_history[-100:]
            
            # 发送告警
            logger.warning(f"[ALERT] 告警: [{severity.upper()}] {alert_type}: {message}")
            if details:
                logger.warning(f"详细信息: {details}")
            
            # 执行不同渠道的告警
            await self._send_console_alert(alert_data)
            await self._send_log_alert(alert_data)
            
            # 这里可以添加其他告警渠道，如邮件、短信、企业微信等
            # await self._send_email_alert(alert_data)
            # await self._send_wechat_alert(alert_data)
            
            return True
            
        except Exception as e:
            logger.error(f"发送告警失败: {e}")
            return False
    
    async def _check_cooldown(self, alert_type: str) -> bool:
        """
        检查是否在冷却期内
        
        Args:
            alert_type: 告警类型
            
        Returns:
            是否在冷却期内
        """
        from datetime import datetime, timedelta
        
        # 查找最近的同类型告警
        recent_alerts = [
            alert for alert in self.alert_history 
            if alert["type"] == alert_type
        ]
        
        if recent_alerts:
            # 按时间倒序排序
            recent_alerts.sort(key=lambda x: x["timestamp"], reverse=True)
            last_alert = recent_alerts[0]
            
            # 计算时间差
            last_time = datetime.fromisoformat(last_alert["timestamp"])
            time_diff = (datetime.now() - last_time).total_seconds()
            
            if time_diff < self.alert_cooldown:
                return True
        
        return False
    
    async def _send_console_alert(self, alert_data: Dict[str, Any]):
        """
        发送控制台告警
        
        Args:
            alert_data: 告警数据
        """
        try:
            severity = alert_data.get("severity", "warning").upper()
            message = alert_data.get("message", "")
            alert_type = alert_data.get("type", "unknown")
            details = alert_data.get("details", {})
            timestamp = alert_data.get("timestamp", "")
            
            print(f"\n{'='*80}")
            print(f"[ALERT] ALERT: [{severity}] {alert_type}")
            print(f"[TIME] Time: {timestamp}")
            print(f"[MSG] Message: {message}")
            if details:
                print(f"[LIST] Details: {details}")
            print(f"{'='*80}\n")
            
        except Exception as e:
            logger.error(f"发送控制台告警失败: {e}")
    
    async def _send_log_alert(self, alert_data: Dict[str, Any]):
        """
        发送日志告警
        
        Args:
            alert_data: 告警数据
        """
        try:
            severity = alert_data.get("severity", "warning")
            message = alert_data.get("message", "")
            alert_type = alert_data.get("type", "unknown")
            details = alert_data.get("details", {})
            
            # 根据严重程度选择日志级别
            if severity == "critical":
                logger.critical(f"[ALERT] {alert_type}: {message} - {details}")
            elif severity == "error":
                logger.error(f"[ALERT] {alert_type}: {message} - {details}")
            elif severity == "warning":
                logger.warning(f"[ALERT] {alert_type}: {message} - {details}")
            else:
                logger.info(f"[ALERT] {alert_type}: {message} - {details}")
            
        except Exception as e:
            logger.error(f"发送日志告警失败: {e}")
    
    async def _send_email_alert(self, alert_data: Dict[str, Any]):
        """
        发送邮件告警
        
        Args:
            alert_data: 告警数据
        """
        # 这里可以实现邮件告警逻辑
        # 需要配置SMTP服务器等信息
        pass
    
    async def _send_wechat_alert(self, alert_data: Dict[str, Any]):
        """
        发送企业微信告警
        
        Args:
            alert_data: 告警数据
        """
        # 这里可以实现企业微信告警逻辑
        # 需要配置企业微信机器人webhook等信息
        pass
    
    async def check_url_format_errors(self, error_count: int, details: Optional[Dict[str, Any]] = None):
        """
        检查URL格式错误并发送告警
        
        Args:
            error_count: 错误数量
            details: 详细信息
        """
        if error_count > 0:
            await self.send_alert(
                "url_format_error",
                f"发现 {error_count} 个URL格式错误",
                details=details,
                severity="warning"
            )
    
    async def get_alert_history(self, limit: int = 50) -> list:
        """
        获取告警历史
        
        Args:
            limit: 返回数量限制
            
        Returns:
            告警历史列表
        """
        return self.alert_history[-limit:]

# 全局监控服务实例
monitoring_service = MonitoringService()